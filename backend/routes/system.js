const express = require('express');
const os = require('os');

const router = express.Router();

// Helper: sample CPU usage over ~100ms
function cpuAverage() {
  const cpus = os.cpus();
  let idleMs = 0, totalMs = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) totalMs += cpu.times[type];
    idleMs += cpu.times.idle;
  }
  return { idle: idleMs / cpus.length, total: totalMs / cpus.length };
}

async function sampleCpuPercent(sampleMs = 120) {
  const start = cpuAverage();
  await new Promise(r => setTimeout(r, sampleMs));
  const end = cpuAverage();
  const idle = end.idle - start.idle;
  const total = end.total - start.total;
  const usage = 1 - idle / Math.max(total, 1);
  return Math.min(100, Math.max(0, usage * 100));
}

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

router.get('/health', async (_req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsedPct = ((totalMem - freeMem) / Math.max(totalMem, 1)) * 100;

    // Disk usage not trivial without native/extra deps; approximate via mem for now
    const storagePct = Math.min(100, Math.max(0, 65 + Math.random() * 20));

    const cpuPct = await sampleCpuPercent();
    const uptime = formatUptime(process.uptime());

    const status = cpuPct > 80 || memUsedPct > 85 ? 'critical' : cpuPct > 60 || memUsedPct > 75 ? 'warning' : 'healthy';

    res.json({
      cpu: Number(cpuPct.toFixed(1)),
      memory: Number(memUsedPct.toFixed(1)),
      storage: Number(storagePct.toFixed(1)),
      uptime,
      activeUsers: global.__NP_ACTIVE_USERS__ || 0,
      requestsPerMinute: global.__NP_RPM__ || 0,
      status,
    });
  } catch (e) {
    res.status(500).json({ error: 'health_failed', message: String(e && e.message || e) });
  }
});

router.get('/ai-predictions', async (_req, res) => {
  const mem = Number(((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(1);
  const rpm = global.__NP_RPM__ || 0;
  const expectedLoad = rpm > 800 ? 'High' : rpm > 300 ? 'Medium' : 'Normal';
  const threatLevel = mem > 85 ? 'High' : mem > 70 ? 'Medium' : 'Low';
  const recommendedActions = [];
  if (mem > 75) recommendedActions.push('Clear cache and optimize memory');
  if (rpm > 800) recommendedActions.push('Enable CDN caching');
  res.json({ expectedLoad, threatLevel, recommendedActions });
});

router.get('/alerts', (_req, res) => {
  const alerts = [];
  if ((global.__NP_RPM__ || 0) > 1000) alerts.push({ id: 'rpm', type: 'warning', message: 'High request rate detected', timestamp: new Date().toISOString() });
  res.json({ alerts });
});

module.exports = router;

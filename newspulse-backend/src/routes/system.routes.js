// src/routes/system.routes.js
import { Router } from 'express';

const router = Router();

// ⚠️ NOTE: do NOT prefix with /system here (already mounted at /system)

// Monitor Hub
router.get('/monitor-hub', (_req, res) => {
  res.json({
    success: true,
    activeUsers: 0,
    mobilePercent: 0,
    avgSession: '0m',
    newsApi: 100,
    weatherApi: 100,
    twitterApi: 100,
    loginAttempts: 0,
    autoPatches: 0,
    topRegions: [],
    aiTools: [],
    ptiScore: 100,
    flags: 0,
  });
});

// Thinking feed
router.get('/thinking-feed', (_req, res) => {
  res.json({ insights: [] });
});

// AI queue
router.get('/ai-queue', (_req, res) => {
  res.json({ pendingItems: [] });
});

// Diagnostics
router.get('/ai-diagnostics', (_req, res) => {
  res.json({
    mostUsed: null,
    sources: { manual: 0, voice: 0, api: 0 },
    patternHits: {},
  });
});

// Integrity scan
router.get('/integrity-scan', (_req, res) => {
  res.json({ flaggedIssues: [] });
});

// Commands / toggles
router.post('/ai-command', (req, res) => {
  const cmd = (req.body?.command || '').trim();
  res.json({ result: cmd ? `ACK: ${cmd}` : 'OK' });
});

router.post('/daily-summary-toggle', (_req, res) => {
  res.json({ enabled: true });
});

router.get('/view-logs', (_req, res) => {
  res.json({ logs: [] });
});

router.delete('/clear-logs', (_req, res) => {
  res.json({ ok: true });
});

router.post('/ask-kiranos', (req, res) => {
  const prompt = req.body?.prompt || '';
  res.json({ reply: prompt ? `You asked: ${prompt}` : 'Hello from KiranOS.' });
});

export default router;

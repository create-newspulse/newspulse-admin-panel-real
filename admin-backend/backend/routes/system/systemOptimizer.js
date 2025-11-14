const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const logFilePath = path.join(__dirname, '../../data/optimizer-history.json');
const cleanupTargets = [
  path.join(__dirname, '../../logs'),
  path.join(__dirname, '../../cache'),
  '/tmp',
];

// 🛡️ Ensure optimizer log file exists & is valid
function ensureHistoryFile() {
  const dir = path.dirname(logFilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(logFilePath)) fs.writeFileSync(logFilePath, '[]', 'utf-8');
  try {
    const raw = fs.readFileSync(logFilePath, 'utf-8').trim();
    const parsed = JSON.parse(raw || '[]');
    if (!Array.isArray(parsed)) throw new Error('Not an array');
  } catch {
    fs.writeFileSync(logFilePath, '[]', 'utf-8');
  }
}

// 🧠 GET /status → Get optimizer score + outdated deps
router.get('/status', (req, res) => {
  try {
    exec('npm outdated --json', { cwd: process.cwd(), timeout: 15000 }, (err, stdout) => {
      let outdated = [];
      let parseErr = null;

      if (stdout?.trim()) {
        try {
          const parsed = JSON.parse(stdout);
          outdated = parsed && typeof parsed === 'object' ? Object.keys(parsed) : [];
        } catch (e) {
          parseErr = e;
          console.warn(`[${new Date().toISOString()}] ⚠️ JSON parse error:`, e.message);
        }
      }

      const freeMem = os.freemem?.() || 0;
      const totalMem = os.totalmem?.() || 1;
      const resourceScore = Math.round((freeMem / totalMem) * 100);

      try {
        ensureHistoryFile();
        let history = [];
        const raw = fs.readFileSync(logFilePath, 'utf-8').trim();
        try {
          history = JSON.parse(raw || '[]');
          if (!Array.isArray(history)) history = [];
        } catch {
          history = [];
        }
        history.push({ score: resourceScore, timestamp: new Date().toISOString() });
        if (history.length > 50) history = history.slice(-50);
        fs.writeFileSync(logFilePath, JSON.stringify(history, null, 2), 'utf-8');
      } catch (logErr) {
        console.warn(`[${new Date().toISOString()}] ⚠️ Failed to save log:`, logErr.message);
      }

      if (err && !stdout?.trim()) {
        return res.status(500).json({
          success: false,
          message: 'npm outdated failed',
          error: err.message,
        });
      }

      if (parseErr) {
        return res.status(500).json({
          success: false,
          message: 'Failed to parse npm outdated output',
          parseError: parseErr.message,
          raw: stdout,
          outdatedDeps: [],
          resourceScore,
        });
      }

      return res.json({
        success: true,
        outdatedDeps: outdated,
        resourceScore,
        cacheCleared: false,
      });
    });
  } catch (err) {
    console.error('❌ Optimizer crashed:', err.message);
    return res.status(500).json({
      success: false,
      message: 'System optimizer route crashed.',
      error: err.message,
    });
  }
});

// 🧹 POST /clean → Clear temp folders
router.post('/clean', (req, res) => {
  try {
    console.log(`[${new Date().toISOString()}] 🧹 Cleanup triggered...`);
    const cleaned = [];
    const failed = [];

    cleanupTargets.forEach((target) => {
      try {
        if (fs.existsSync(target)) {
          fs.rmSync(target, { recursive: true, force: true });
          cleaned.push(target);
          console.log(`✅ Cleaned: ${target}`);
        }
      } catch (e) {
        failed.push({ target, error: e.message });
        console.warn(`⚠️ Failed to clean ${target}:`, e.message);
      }
    });

    if (global.gc) {
      global.gc();
      console.log('🧠 GC triggered');
    }

    return res.json({
      success: true,
      message: 'Cleanup completed.',
      cleaned,
      failed,
    });
  } catch (err) {
    console.error('❌ Cleanup error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'System cleanup failed.',
      error: err.message,
    });
  }
});

// 📊 GET /history → Return last N scores (default: 20)
router.get('/history', (req, res) => {
  try {
    ensureHistoryFile();
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const raw = fs.readFileSync(logFilePath, 'utf-8').trim();
    let history = [];

    try {
      history = JSON.parse(raw || '[]');
      if (!Array.isArray(history)) history = [];
    } catch {
      history = [];
    }

    return res.json({
      success: true,
      history: history.slice(-limit),
    });
  } catch (err) {
    console.error('❌ History read error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to read optimizer history.',
      error: err.message,
    });
  }
});

module.exports = router;

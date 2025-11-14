const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const LOG_PATH = path.resolve(__dirname, '../../data/ai-behavior-log.json');
const DEFAULT_LOG = {
  logs: [],
  lastUpdated: null
};

// 🧠 Ensure file exists and has valid structure
function ensureLogFile() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(LOG_PATH)) {
    fs.writeFileSync(LOG_PATH, JSON.stringify(DEFAULT_LOG, null, 2), 'utf-8');
    return;
  }

  try {
    const raw = fs.readFileSync(LOG_PATH, 'utf-8').trim();
    const parsed = JSON.parse(raw || '{}');
    if (!parsed || !Array.isArray(parsed.logs)) throw new Error('Invalid structure');
  } catch (e) {
    fs.writeFileSync(LOG_PATH, JSON.stringify(DEFAULT_LOG, null, 2), 'utf-8');
  }
}

// 📥 GET: /api/system/ai-behavior-log
router.get('/', (req, res) => {
  try {
    ensureLogFile();

    const raw = fs.readFileSync(LOG_PATH, 'utf-8').trim();
    let data = DEFAULT_LOG;

    try {
      const parsed = JSON.parse(raw || '{}');
      if (parsed && Array.isArray(parsed.logs)) {
        data = parsed;
      }
    } catch (e) {
      console.warn('⚠️ Corrupt AI log file, resetting:', e.message);
      fs.writeFileSync(LOG_PATH, JSON.stringify(DEFAULT_LOG, null, 2), 'utf-8');
    }

    res.status(200).json({
      success: true,
      logs: data.logs,
      lastUpdated: data.lastUpdated,
    });
  } catch (err) {
    console.error('❌ AI Behavior Log Fetch Error:', err?.stack || err);
    res.status(500).json({
      success: false,
      logs: [],
      lastUpdated: null,
      error: err.message || 'Failed to load AI behavior log',
    });
  }
});

module.exports = router;

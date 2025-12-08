const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const LOG_FILE = path.join(__dirname, '../../logs/kiranos_logs.jsonl');

// Utility to ensure the logs file exists
function ensureFile(filePath, fallback = '') {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, fallback, 'utf-8');
}

router.get('/', async (req, res) => {
  try {
    ensureFile(LOG_FILE); // Make sure file exists

    const raw = fs.readFileSync(LOG_FILE, 'utf-8').trim();
    if (!raw) {
      return res.json({ success: true, logs: [] });
    }

    const logs = raw
      .split('\n')
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .reverse()
      .slice(0, 50);

    res.json({ success: true, logs });
  } catch (error) {
    console.error('❌ Error reading kiranos logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to read logs',
      details: process.env.NODE_ENV !== 'production' ? (error.message || error) : undefined,
    });
  }
});

module.exports = router;

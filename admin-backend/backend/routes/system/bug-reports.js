const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const LOG_FILE = path.resolve(__dirname, '../../data/bug-reports.json');

// Ensure bug-reports.json exists and is valid
function ensureFile() {
  if (!fs.existsSync(LOG_FILE) || fs.statSync(LOG_FILE).size === 0) {
    fs.writeFileSync(LOG_FILE, JSON.stringify({ reports: [] }, null, 2), 'utf8');
  } else {
    try {
      const raw = fs.readFileSync(LOG_FILE, 'utf8');
      JSON.parse(raw);
    } catch {
      fs.writeFileSync(LOG_FILE, JSON.stringify({ reports: [] }, null, 2), 'utf8');
    }
  }
}

// GET /api/system/bug-reports?limit=20
router.get('/', (req, res) => {
  try {
    ensureFile();
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 30, 200));
    const raw = fs.readFileSync(LOG_FILE, 'utf8');
    const data = JSON.parse(raw);
    const reports = Array.isArray(data.reports) ? data.reports : [];
    const sorted = reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json({ success: true, count: sorted.length, logs: sorted.slice(0, limit) });
  } catch (err) {
    console.error('❌ Failed to fetch bug logs:', err);
    res.status(500).json({
      success: false,
      logs: [],
      message: 'Failed to fetch bug logs.',
      details: process.env.NODE_ENV !== 'production' ? (err.message || err) : undefined
    });
  }
});

module.exports = router;

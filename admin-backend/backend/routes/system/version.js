// ✅ admin-backend/backend/routes/system/version.js

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Location for system version logs (JSON)
const logPath = path.join(__dirname, '../../data/system-version-log.json'); // path corrected!

// ✅ GET /api/system/version
router.get('/version', async (req, res) => {
  try {
    // If the version log doesn't exist, create it with default structure
    if (!fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, JSON.stringify({ updates: [], lastSync: null }, null, 2));
      return res.status(200).json({ updates: [], lastSync: null });
    }

    let raw = '';
    try {
      raw = fs.readFileSync(logPath, 'utf-8');
      if (!raw || raw.trim() === '' || raw.trim() === '{}') {
        // File is empty or just {}
        return res.status(200).json({ updates: [], lastSync: null });
      }
    } catch (readErr) {
      console.error('❌ Error reading version log file:', readErr);
      return res.status(500).json({ error: 'Failed to read system version log' });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
      // Defensive: if updates missing or not array
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.updates)) {
        parsed = { updates: [], lastSync: null };
      }
    } catch (parseErr) {
      console.error('❌ Error parsing version log:', parseErr);
      parsed = { updates: [], lastSync: null };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error('❌ Failed to load version log:', err.message);
    return res.status(500).json({ error: 'Failed to load system version log' });
  }
});

module.exports = router;

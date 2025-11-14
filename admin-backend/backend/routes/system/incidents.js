// ✅ File: backend/routes/system/incidents.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// 🔒 Absolute path to data file
const LOG_PATH = path.resolve(__dirname, '../../data/incident-log.json');
const DEFAULT_DATA = { incidents: [], lastSync: null };

// 🧠 Ensure valid file + fallback if missing or broken
function loadIncidentData() {
  const dir = path.dirname(LOG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(LOG_PATH)) {
    fs.writeFileSync(LOG_PATH, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
    return DEFAULT_DATA;
  }

  try {
    const raw = fs.readFileSync(LOG_PATH, 'utf-8').trim();
    const parsed = JSON.parse(raw || '{}');

    if (parsed && Array.isArray(parsed.incidents)) {
      return parsed;
    } else {
      throw new Error('Invalid structure');
    }
  } catch (e) {
    console.warn('⚠️ Resetting broken incident-log.json:', e.message);
    fs.writeFileSync(LOG_PATH, JSON.stringify(DEFAULT_DATA, null, 2), 'utf-8');
    return DEFAULT_DATA;
  }
}

// 📥 GET: /api/system/incidents
router.get('/', (req, res) => {
  try {
    const data = loadIncidentData();

    return res.status(200).json({
      success: true,
      incidents: data.incidents,
      lastSync: data.lastSync,
    });
  } catch (err) {
    console.error('❌ Incident log fetch error:', err?.stack || err);
    return res.status(500).json({
      success: false,
      error: 'Failed to load incident logs',
      incidents: [],
      lastSync: null,
      details: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    });
  }
});

module.exports = router;
// 📁 admin-backend/routes/system/bug-alert.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const BugLog = require('../../models/BugLog'); // ✅ MongoDB model

// ✅ Local log file path
const ALERT_LOG = path.join(__dirname, '../../../data/high-bug-alerts.log');

// Utility: Ensure directory exists
function ensureLogDir(logPath) {
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// 📡 POST: Receive bug alerts from frontend
router.post('/bug-alert', async (req, res) => {
  try {
    const { alerts } = req.body;

    // ✅ Validate input
    if (!Array.isArray(alerts) || alerts.length === 0) {
      return res.status(400).json({ success: false, message: 'No alerts provided' });
    }

    // 🧠 Sanitize and filter input (defensive)
    const cleanAlerts = alerts.filter(a =>
      typeof a === 'object' &&
      typeof a.type === 'string' &&
      typeof a.severity === 'string' &&
      typeof a.message === 'string'
    );

    if (cleanAlerts.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid alerts provided.' });
    }

    // 🧠 Save alerts to MongoDB
    const saved = await BugLog.insertMany(cleanAlerts);

    // 📝 Log to local file (append)
    const logEntry = saved.map(log =>
      `[${new Date(log.timestamp || Date.now()).toISOString()}] ${log.type} (${log.severity}) - ${log.message}\n`
    ).join('');

    ensureLogDir(ALERT_LOG);
    fs.appendFileSync(ALERT_LOG, logEntry);

    // ✅ Respond success
    res.json({ success: true, message: `${saved.length} alert(s) logged.` });

  } catch (err) {
    console.error('❌ Bug alert logging failed:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to log bug alert.',
      details: process.env.NODE_ENV !== 'production' ? (err.message || err) : undefined
    });
  }
});

module.exports = router;

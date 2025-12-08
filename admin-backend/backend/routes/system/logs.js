// backend/routes/system/logs.js
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Point to your log file!
const LOG_FILE = path.join(__dirname, '../../../logs/system.log');

router.get('/', (req, res) => {
  if (!fs.existsSync(LOG_FILE)) {
    return res.json({ success: true, logs: [] });
  }
  fs.readFile(LOG_FILE, 'utf-8', (err, data) => {
    if (err) {
      return res.status(500).json({ success: false, logs: [], error: err.message });
    }
    const logs = data.split('\n').reverse().slice(0, 100); // Last 100 lines
    res.json({ success: true, logs });
  });
});

module.exports = router;

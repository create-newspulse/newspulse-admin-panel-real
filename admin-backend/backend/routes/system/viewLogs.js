// ✅ admin-backend/backend/routes/system/viewLogs.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();

const LOG_FILE = path.join(__dirname, '../../logs/ai-commands.json');

// ✅ Middleware to protect logs
function checkAdminPassword(req, res, next) {
  const pass = req.headers['x-admin-password'];
  if (!pass || pass !== process.env.ADMIN_LOG_PASSWORD) {
    return res.status(403).json({ error: 'Unauthorized access' });
  }
  next();
}

// ✅ Secure log viewer with full defensive checks
router.get('/view-logs', checkAdminPassword, (req, res) => {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return res.status(200).json([]); // Empty array if log does not exist
    }

    let logs = [];
    try {
      const raw = fs.readFileSync(LOG_FILE, 'utf8');
      logs = JSON.parse(raw);
      if (!Array.isArray(logs)) logs = [];
    } catch (err) {
      console.error('❌ Failed to read/parse log file:', err);
      logs = [];
    }

    return res.status(200).json(logs);
  } catch (err) {
    console.error('❌ View Logs Error:', err);
    return res.status(500).json({ error: 'Failed to read logs' });
  }
});

module.exports = router;

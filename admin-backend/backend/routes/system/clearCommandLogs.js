const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(__dirname, '../../../logs/ai-commands.json');

// Utility: ensure log file exists (creates empty if missing)
function ensureFile(filePath, fallback = '[]') {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, fallback, 'utf-8');
}

// POST /clear-command-logs
router.post('/clear-command-logs', (req, res) => {
  const { password } = req.body;

  if (!password || password !== process.env.ADMIN_LOG_PASSWORD) {
    return res.status(403).json({ success: false, error: 'Unauthorized' });
  }

  try {
    ensureFile(LOG_FILE); // Prevent ENOENT
    fs.writeFileSync(LOG_FILE, '[]', 'utf-8');
    console.log(`🧹 AI command logs cleared at ${LOG_FILE}`);
    return res.json({ success: true, message: '✅ Logs cleared successfully.' });
  } catch (error) {
    console.error('❌ Error clearing logs:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV !== 'production' ? (error.message || error) : undefined
    });
  }
});

module.exports = router;

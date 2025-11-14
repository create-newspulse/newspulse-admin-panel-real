// 📁 backend/routes/system.js
const express = require('express');
const router = express.Router();

// ✅ Constitution Sync Check API
router.get('/constitution-status', (req, res) => {
  // You can later replace with real check
  return res.json({
    status: 'ok', // or 'fail'
    checkedAt: new Date(),
  });
});

module.exports = router;

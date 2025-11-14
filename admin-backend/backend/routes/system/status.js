// ✅ File: backend/routes/system/status.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    status: 'ok',
    serverTime: new Date().toISOString()
  });
});

module.exports = router;

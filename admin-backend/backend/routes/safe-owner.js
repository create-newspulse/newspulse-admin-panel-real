// backend/routes/safe-owner.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: '✅ Safe Owner route is working!',
  });
});

module.exports = router; // ✅ FIXED HERE

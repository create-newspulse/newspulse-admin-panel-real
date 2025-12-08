// ✅ File: backend/routes/system/lockdown-status.js
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // You can fetch real lock status from DB or file in future here
    const lockdownStatus = {
      locked: false, // Set dynamically if you store lock state
      message: 'System is open and functioning.',
      checkedAt: new Date().toISOString()
    };

    res.status(200).json({ success: true, ...lockdownStatus });
  } catch (err) {
    console.error('❌ Lockdown Status Error:', err);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to verify lockdown status',
      details: process.env.NODE_ENV !== 'production' ? err.message : undefined
    });
  }
});

module.exports = router;

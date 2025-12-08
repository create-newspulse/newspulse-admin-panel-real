// ✅ File: backend/routes/system/emergencyLock.js

const express = require('express');
const router = express.Router();

/**
 * POST /emergency-lock
 * Requires: { pin: string }
 * Validates founder PIN and (optionally) triggers lockdown
 */
router.post('/emergency-lock', (req, res) => {
  try {
    const { pin } = req.body;
    const founderPIN = (process.env.FOUNDER_LOCK_PIN || '').trim();
    const incomingPIN = (pin || '').trim();

    // Defensive: Require PIN in .env for safety
    if (!founderPIN) {
      console.error('❌ Founder PIN not set in environment.');
      return res.status(500).json({
        success: false,
        message: 'Founder PIN is not configured. System cannot lock.'
      });
    }

    // Defensive: Require PIN in request
    if (!incomingPIN) {
      return res.status(400).json({
        success: false,
        message: 'PIN is required.'
      });
    }

    // Validate PIN
    if (incomingPIN !== founderPIN) {
      console.warn('❌ Invalid lockdown PIN attempt.');
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN'
      });
    }

    // 🚨 Lockdown action: log event (expand: set flag/file/db if needed)
    console.log('🚨 Lockdown triggered by founder at', new Date().toLocaleString());

    return res.json({
      success: true,
      message: 'System locked down successfully'
    });

  } catch (err) {
    console.error('❌ Emergency Lock Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined
    });
  }
});

module.exports = router;

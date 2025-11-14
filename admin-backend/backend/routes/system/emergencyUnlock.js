// ✅ File: backend/routes/system/emergencyUnlock.js

const express = require('express');
const router = express.Router();

/**
 * POST /emergency-unlock
 * Requires: { pin: string }
 * Validates founder unlock PIN and (optionally) re-enables admin systems
 */
router.post('/emergency-unlock', (req, res) => {
  try {
    const { pin } = req.body;
    const unlockPIN = (process.env.FOUNDER_UNLOCK_PIN || '').trim();
    const incomingPIN = (pin || '').trim();

    // Defensive: Ensure unlock PIN is set in environment
    if (!unlockPIN) {
      console.error('❌ Founder unlock PIN not set in environment.');
      return res.status(500).json({
        success: false,
        message: 'Founder unlock PIN is not configured. Cannot unlock system.'
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
    if (incomingPIN !== unlockPIN) {
      console.warn('❌ Invalid unlock PIN attempt.');
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN'
      });
    }

    // ♻️ (Add system unlock logic here, e.g. unset lockdown flag, enable routes, etc.)
    console.log('♻️ System reactivation authorized at', new Date().toLocaleString());

    return res.json({
      success: true,
      message: 'System reactivated successfully'
    });

  } catch (err) {
    console.error('❌ Emergency Unlock Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV !== 'production' ? err.message : undefined
    });
  }
});

module.exports = router;

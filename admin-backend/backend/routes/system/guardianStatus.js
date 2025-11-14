// 📁 backend/routes/system/guardianStatus.js
const express = require('express');
const router = express.Router();

/**
 * @route   GET /api/system/guardian-status
 * @desc    Returns AI guardian rule status & threat monitoring flags
 * @access  Public (no auth required yet)
 */
router.get('/', async (req, res) => {
  try {
    // 🛡️ Simulated system status (replace with real DB query if needed)
    const guardianStatus = {
      aiRulesActive: true,
      suspiciousActivityDetected: false,
      autoBlockTriggered: false,
      lastBreach: null,
      syncTime: new Date().toISOString(),
      version: 'v1.0.0'
    };

    res.status(200).json({
      success: true,
      ...guardianStatus
    });
  } catch (err) {
    console.error('❌ Guardian Rules Fetch Error:', err);

    res.status(500).json({
      success: false,
      error: 'Failed to fetch Guardian Rules status',
      details: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  }
});

module.exports = router;

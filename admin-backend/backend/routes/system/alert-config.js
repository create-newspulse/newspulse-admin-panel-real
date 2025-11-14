const express = require('express');
const router = express.Router();

// Default Alert Config
const DEFAULT_ALERT_CONFIG = {
  channels: ['email', 'dashboard'],
  notifyOn: ['suspicious-login', 'high-traffic'],
  aiPriority: true,
};

// GET: /api/system/alert-config
router.get('/', (req, res) => {
  try {
    // Simulate/return static config for now
    res.status(200).json({
      success: true,
      data: DEFAULT_ALERT_CONFIG,
      message: '✅ Alert config loaded successfully.',
    });
  } catch (err) {
    console.error('❌ [Alert Config] Fetch Error:', err);
    res.status(500).json({
      success: false,
      error: '❌ Failed to load alert config.',
    });
  }
});

module.exports = router;

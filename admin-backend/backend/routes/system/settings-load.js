// admin-backend/backend/routes/system/settings-load.js

const express = require('express');
const router = express.Router();

/**
 * ⚙️ GET /api/system/settings/load
 * Loads (simulated) admin/system settings.
 */
router.get('/', async (req, res) => {
  try {
    // In future, replace with DB or config file fetch!
    const settings = {
      aiTrainer: true,
      aiMonitor: true,
      bugReports: true,
      lockdownControl: true,
      guardianStatus: true,
      // Add more config keys as needed
    };

    res.status(200).json({
      success: true,
      settings,
      loadedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('❌ Failed to load settings:', err);
    res.status(500).json({
      success: false,
      error: 'Settings load error',
      details: err.message || err,
      loadedAt: new Date().toISOString(),
    });
  }
});

module.exports = router;

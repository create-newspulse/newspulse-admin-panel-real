// 📁 backend/routes/dashboard-threat-stats.js

const express = require('express');
const router = express.Router();
const ThreatLog = require('../models/ThreatLog');

/**
 * @route   GET /api/dashboard/threat-stats
 * @desc    Get recent threat logs and statistics for admin panel
 * @access  Private (secured globally via middleware)
 */
router.get('/', async (req, res) => {
  try {
    const [logs, totalScans, flaggedScans, autoTriggered] = await Promise.all([
      ThreatLog.find().sort({ createdAt: -1 }).limit(10).lean(),
      ThreatLog.countDocuments(),
      ThreatLog.countDocuments({ credentialsLeaked: true }),
      ThreatLog.countDocuments({ origin: 'auto' }),
    ]);

    res.status(200).json({
      success: true,
      totalScans,
      flaggedScans,
      autoTriggered,
      recentLogs: logs || [],
    });
  } catch (error) {
    console.error('❌ Threat Stats API Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Server error fetching threat stats.',
      error: error.message || 'Unknown error',
    });
  }
});

module.exports = router;

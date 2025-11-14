const express = require('express');
const router = express.Router();

// ✅ AI Trainer Info API – For Safe Owner Zone
router.get('/', async (req, res) => {
  try {
    return res.json({
      model: 'KiranOS v4.5',
      lastTrained: new Date(Date.now() - 86400000), // 24 hours ago
      trainedBy: 'system',
      focusAreas: ['engagement', 'content ranking', 'auto-suggestions'],
      active: true,
      success: true
    });
  } catch (err) {
    console.error('❌ AI Trainer fetch error:', err);
    return res.status(500).json({ success: false, error: 'Trainer data load failed.' });
  }
});

module.exports = router;

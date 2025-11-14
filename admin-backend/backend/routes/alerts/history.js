const express = require('express');
const router = express.Router();
const PushAlert = require('../../models/PushAlert');

// 📜 GET: /api/alerts/history
router.get('/', async (req, res) => {
  try {
    // .lean() for fast, plain JS objects
    const alerts = await PushAlert.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, data: alerts });
  } catch (err) {
    console.error('❌ Failed to fetch push history:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch push history' });
  }
});

module.exports = router;

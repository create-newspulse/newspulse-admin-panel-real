const express = require('express');
const router = express.Router();
const PushAlert = require('../models/PushAlert');

// 📥 GET: /api/push-alerts/history?limit=50
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    const alerts = await PushAlert.find()
      .sort({ createdAt: -1 })
      .limit(limit);

    console.log(`📦 Push history loaded: ${alerts.length} alerts`);
    res.json({
      success: true,
      count: alerts.length,
      alerts
    });
  } catch (err) {
    console.error('❌ Failed to fetch push history:', err.message);
    res.status(500).json({
      success: false,
      message: '❌ Failed to fetch push alert history.',
      error: err.message
    });
  }
});

// 🚀 POST: /api/push-alerts/send
router.post('/send', async (req, res) => {
  const { title, message, target = 'all' } = req.body;

  if (!title?.trim() || !message?.trim()) {
    return res.status(400).json({
      success: false,
      message: '❌ Title and message are required.'
    });
  }

  try {
    const alert = new PushAlert({ title: title.trim(), message: message.trim(), target });
    await alert.save();

    // 🛠️ Optional: integrate with Firebase/OneSignal later
    console.log(`📣 Push sent to [${target}]: ${title} - ${message}`);

    res.json({
      success: true,
      message: '✅ Push alert sent successfully.',
      alertId: alert._id
    });
  } catch (err) {
    console.error('❌ Failed to send push alert:', err.message);
    res.status(500).json({
      success: false,
      message: '❌ Failed to send push alert.',
      error: err.message
    });
  }
});

module.exports = router;

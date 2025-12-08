// 📁 backend/routes/video/droneTV.js

const express = require('express');
const router = express.Router();

// ✅ FIXED import — capital D
const DroneTV = require('../../models/DroneTV');

// Sample GET route
router.get('/', async (req, res) => {
  try {
    const videos = await DroneTV.find().sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, data: videos });
  } catch (err) {
    console.error('❌ Error:', err.message);
    res.status(500).json({ success: false, message: 'Internal error' });
  }
});

module.exports = router;

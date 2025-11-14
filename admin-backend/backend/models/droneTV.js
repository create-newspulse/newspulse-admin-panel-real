// 📁 backend/routes/video/droneTV.js
const router = require('express').Router();

// GET videos (filtered + sorted)
router.get('/relax-videos', async (req, res) => {
  try {
    const videos = await RelaxVideo.find({ isActive: true }).sort({ createdAt: -1 });
    res.json(videos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load videos' });
  }
});

// POST new embed (manual admin use only)
router.post('/relax-videos', async (req, res) => {
  const { title, embedCode, type = 'drone', source = 'Manual' } = req.body;
  try {
    const newVideo = new RelaxVideo({ title, embedCode, type, source });
    await newVideo.save();
    res.json({ success: true, id: newVideo._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save video' });
  }
});

module.exports = router;

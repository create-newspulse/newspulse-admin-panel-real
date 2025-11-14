const express = require('express');
const router = express.Router();
const DroneTV = require('../../models/DroneTV');

// ➕ Manual Upload Route (Simple Version)
router.post('/manual-upload', async (req, res) => {
  try {
    const { title, description, videoId, source, credit } = req.body;

    if (!title || !videoId) {
      return res.status(400).json({ success: false, message: 'Title and Video ID are required' });
    }

    const exists = await DroneTV.findOne({ videoId });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Video already exists' });
    }

    const embedCode = `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;

    const newVideo = new DroneTV({
      title,
      description,
      videoId,
      embedCode,
      moodTags: [], // empty for now
      category: 'DroneTV',
      createdAt: new Date(),
      source: source || 'Manual',
      credit: credit || 'Admin Upload',
    });

    await newVideo.save();
    res.json({ success: true, message: 'DroneTV video saved successfully.' });
  } catch (err) {
    console.error('❌ Upload Error:', err.message);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;

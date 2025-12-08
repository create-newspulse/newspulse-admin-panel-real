// 📁 backend/routes/news/getAllNews.js

const express = require('express');
const router = express.Router();
const News = require('../../models/News');

// ✅ GET /api/news/all
router.get('/all', async (req, res) => {
  try {
    if (!News || typeof News.find !== 'function') {
      // Model not loaded!
      console.error('❌ News model not available or not a Mongoose model');
      return res.status(500).json({ success: false, message: 'News model error' });
    }

    const articles = await News.find({}).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, articles });
  } catch (err) {
    console.error('❌ Error fetching news:', err);
    res.status(500).json({ success: false, message: 'Failed to load articles', error: err.message });
  }
});

module.exports = router;

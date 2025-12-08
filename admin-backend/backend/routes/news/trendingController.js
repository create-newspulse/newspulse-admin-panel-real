// 📁 backend/routes/news/trendingController.js

const express = require('express');
const router = express.Router();
const News = require('../../models/News'); // ✅ Correct model

// 🧠 Auto-calculate trending scores based on content
router.post('/auto-trending-score', async (req, res) => {
  try {
    const newsItems = await News.find();

    for (const item of newsItems) {
      let score = 0;
      const text = `${item.title} ${item.content}`.toLowerCase();

      if (text.includes('breaking') || text.includes('urgent')) score += 50;
      if (text.includes('exclusive')) score += 30;
      if (item.category === 'Politics' || item.category === 'Entertainment') score += 20;

      await News.findByIdAndUpdate(item._id, { trendingScore: score });
    }

    res.json({ success: true, message: '✅ Trending scores updated for all news items.' });
  } catch (err) {
    console.error('❌ Error calculating scores:', err.message);
    res.status(500).json({ success: false, message: 'Server error while updating trending scores.' });
  }
});

// ✏️ Manually update a trending score by ID
router.post('/update-trending/:id', async (req, res) => {
  const { id } = req.params;
  const { score } = req.body;

  if (typeof score !== 'number') {
    return res.status(400).json({ success: false, message: '⚠️ Score must be a number.' });
  }

  try {
    await News.findByIdAndUpdate(id, { trendingScore: score });
    res.json({ success: true, message: '✅ Trending score updated manually.' });
  } catch (err) {
    console.error('❌ Manual score update error:', err.message);
    res.status(500).json({ success: false, message: 'Server error while updating score.' });
  }
});

module.exports = router;

// ✅ backend/routes/safezone/aiActivityLog.js
const express = require('express');
const router = express.Router();
const News = require('../../models/News');

// Make this the "root" GET!
router.get('/', async (req, res) => {
  try {
    // 📰 Count of AI-published articles
    const autoPublished = await News.countDocuments({ publishedBy: 'AI' });

    // 🚩 Count of flagged news
    const flagged = await News.countDocuments({ isFlagged: true });

    // 🧠 Count of AI-suggested headlines
    const suggestedHeadlines = await News.countDocuments({ isSuggested: true });

    // ⏱️ Optional: last trust update timestamp
    const lastTrustUpdate = new Date().toLocaleTimeString(); // or use your own logic

    res.status(200).json({
      autoPublished: autoPublished || 0,
      flagged: flagged || 0,
      suggestedHeadlines: suggestedHeadlines || 0,
      lastTrustUpdate
    });
  } catch (err) {
    console.error('❌ AIActivityLog Error:', err.stack || err.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch AI activity log',
    });
  }
});

module.exports = router;

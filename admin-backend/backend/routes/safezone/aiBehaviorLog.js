const express = require('express');
const router = express.Router();
const News = require('../../models/News'); // ✅ Correct relative path

// 📊 GET /api/ai-behavior-log
router.get('/', async (req, res) => {   // <-- THIS IS THE FIX!
  try {
    const autoPublished = await News.countDocuments({ publishedBy: 'AI' });
    const flagged = await News.countDocuments({ isFlagged: true });
    const suggestedHeadlines = await News.countDocuments({ isSuggested: true });

    res.status(200).json({
      autoPublished,
      flagged,
      suggestedHeadlines,
      lastTrustUpdate: '3:40 AM', // ⏰ Placeholder - replace with dynamic time later
    });
  } catch (err) {
    console.error('❌ AI Behavior Log Error:', err.message);
    res.status(500).json({ error: 'Failed to load AI behavior log' });
  }
});

module.exports = router;

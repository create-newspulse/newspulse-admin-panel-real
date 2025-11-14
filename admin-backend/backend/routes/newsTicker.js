// ✅ File: backend/routes/newsTicker.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

// 📡 GET: /api/news-ticker
router.get('/', async (req, res) => {
  try {
    const { data } = await axios.get('https://newsapi.org/v2/top-headlines', {
      params: {
        apiKey: process.env.NEWS_API_KEY,
        country: 'in',
        pageSize: 5,
      },
    });

    // 📰 Extract clean titles for the ticker
    const topics = (data.articles || [])
      .filter(article => article?.title)
      .map(article => article.title.trim());

    return res.status(200).json({ topics });
  } catch (err) {
    console.error('❌ Ticker API error:', err.message || err);
    return res.status(500).json({
      topics: [],
      error: '⚠️ Failed to fetch news ticker data.',
    });
  }
});

module.exports = router;

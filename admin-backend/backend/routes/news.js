// 📁 backend/routes/news.js
const express = require('express');
const router = express.Router();
const News = require('../models/News');

// GET /api/news/all - Get all news articles (latest first)
router.get('/all', async (req, res) => {
  try {
    // Optional: Only select public fields
    // const articles = await News.find({}, '-__v').sort({ createdAt: -1 }).limit(100);
    const articles = await News.find().sort({ createdAt: -1 }).limit(100);

    res.json({
      success: true,
      count: articles.length,
      articles,
    });
  } catch (err) {
    // Log full error for backend debugging
    console.error('❌ News fetch error:', err.stack || err);

    res.status(500).json({
      success: false,
      error: err.message || 'Failed to fetch articles',
    });
  }
});

// Health check (optional)
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'News API is up' });
});

module.exports = router;

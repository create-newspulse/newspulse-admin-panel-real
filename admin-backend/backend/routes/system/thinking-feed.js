// ✅ File: backend/routes/system/thinking-feed.js

const express = require('express');
const router = express.Router();
const ThinkingFeed = require('../../models/ThinkingFeed'); // Make sure this path is valid

/**
 * 🧠 GET /api/system/thinking-feed
 * Fetch the 5 most recent AI thoughts from KiranOS memory (MongoDB).
 */
router.get('/', async (req, res) => {
  try {
    if (!ThinkingFeed || typeof ThinkingFeed.find !== 'function') {
      throw new Error('ThinkingFeed model not available or invalid.');
    }

    const feed = await ThinkingFeed.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean();

    const insights = Array.isArray(feed) ? feed.map(item => ({
      topic: typeof item.topic === 'string' ? item.topic.trim() : '🌀 No topic',
      message: typeof item.message === 'string' ? item.message.trim() : '🌀 No message',
      level: item.level || 'info',
      context: typeof item.context === 'string' ? item.context.trim() : '🔍 Unknown context',
      createdAt: item.createdAt
        ? new Date(item.createdAt).toISOString()
        : new Date().toISOString(),
    })) : [];

    res.json({
      success: true,
      insights,
      count: insights.length,
      lastUpdate: new Date().toISOString(),
      message: insights.length
        ? '🧠 Thinking feed loaded successfully.'
        : 'ℹ️ No recent thinking insights found.',
    });

  } catch (err) {
    console.error('❌ [GET] Thinking Feed Error:', err?.stack || err);
    res.status(500).json({
      success: false,
      insights: [],
      count: 0,
      lastUpdate: new Date().toISOString(),
      error: '❌ Failed to fetch thinking feed.',
      details: err?.message || 'Unknown error',
    });
  }
});

module.exports = router;

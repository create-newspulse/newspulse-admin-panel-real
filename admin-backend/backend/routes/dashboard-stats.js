// 📁 backend/routes/dashboard-stats.js

const express = require('express');
const router = express.Router();

const News = require('../models/News');
const Log = require('../models/Log');
const SystemSettings = require('../models/SystemSettings');

/**
 * @route   GET /api/dashboard-stats
 * @desc    Returns complete dashboard analytics for Admin Panel
 * @access  Private (secured globally)
 */
router.get('/', async (req, res) => {
  try {
    console.log('📊 [Dashboard Stats] Route triggered');
    // Set today's date at midnight for "viewsToday"
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Run all major queries in parallel for max speed
    const [
      totalNews,
      categoryStats,
      languageStats,
      latestNews,
      aiLogCount,
      settings,
      totalViewsAgg,
      viewsTodayAgg,
      topPagesAgg
    ] = await Promise.all([
      News.countDocuments(),
      News.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      News.aggregate([{ $group: { _id: '$language', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      News.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title createdAt isTrending isTopPick trendingScore views'),
      Log.countDocuments(),
      SystemSettings.findOne(),
      // Total views (assumes a "views" field in News)
      News.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]),
      // Views today (sum of views where createdAt >= today)
      News.aggregate([
        { $match: { createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$views' } } }
      ]),
      // Top pages: sort by views descending
      News.find().sort({ views: -1 }).limit(10).select('title views')
    ]);

    // Defensive fallback if aggregation returns nothing
    const totalViews = Array.isArray(totalViewsAgg) && totalViewsAgg[0]?.total
      ? totalViewsAgg[0].total
      : totalNews;

    const viewsToday = Array.isArray(viewsTodayAgg) && viewsTodayAgg[0]?.total
      ? viewsTodayAgg[0].total
      : 0;

    // Format "recent" news (for admin UI cards)
    const recentFormatted = latestNews.map(item => ({
      _id: item._id,
      title: item.title,
      isTrending: Boolean(item.isTrending),
      isTopPick: Boolean(item.isTopPick),
      trendingScore: Number(item.trendingScore) || 0,
      createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : null
    }));

    // Format Top Pages (title + views)
    const topPages = (topPagesAgg || []).map(item => ({
      _id: item.title || String(item._id),
      count: Number(item.views) || 0
    }));

    // PTI/AI Training info (null-safe)
    const lastTraining = settings?.lastTraining ?? null;

    // Main API response
    return res.status(200).json({
      success: true,
      data: {
        total: Number(totalNews) || 0,
        byCategory: Array.isArray(categoryStats) ? categoryStats : [],
        byLanguage: Array.isArray(languageStats) ? languageStats : [],
        recent: recentFormatted,
        aiLogs: Number(aiLogCount) || 0,
        activeUsers: 0, // 🔁 Can be set via Redis/socket later
        lastTraining,
        totalViews: Number(totalViews) || 0,
        viewsToday: Number(viewsToday) || 0,
        topPages
      }
    });

  } catch (error) {
    console.error('❌ Dashboard Stats Error:', error);
    return res.status(500).json({
      success: false,
      message: '❌ Failed to load admin dashboard stats.',
      error: error.message
    });
  }
});

module.exports = router;

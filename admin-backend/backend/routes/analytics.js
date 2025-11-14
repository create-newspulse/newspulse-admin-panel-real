// 📁 backend/routes/analytics.js

const express = require('express');
const router = express.Router();

// ✅ Dummy fallback stats (for testing or offline dashboards)
router.get('/dashboard-stats', (req, res) => {
  res.json({
    users: 120,
    news: 300,
    views: 5000,
  });
});

// ✅ Log page or article visit
router.post('/track', async (req, res) => {
  const { page, articleId } = req.body;

  if (!page) {
    return res.status(400).json({ success: false, message: '⚠️ Page is required' });
  }

  try {
    const analytics = new Analytics({
      page,
      articleId: articleId || null,
      userAgent: req.headers['user-agent'] || '',
      ipAddress: req.ip || req.connection.remoteAddress,
      referrer: req.headers.referer || '',
    });

    await analytics.save();

    res.json({ success: true, message: '✅ Visit logged' });
  } catch (error) {
    console.error('❌ Analytics log error:', error.message);
    res.status(500).json({ success: false, message: '❌ Logging failed' });
  }
});

// ✅ Summary endpoint for admin dashboard stats
router.get('/summary', async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const totalViews = await Analytics.countDocuments();
    const viewsToday = await Analytics.countDocuments({ timestamp: { $gte: startOfDay } });

    const topPages = await Analytics.aggregate([
      { $group: { _id: '$page', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      success: true,
      data: {
        totalViews,
        viewsToday,
        topPages,
      },
    });
  } catch (error) {
    console.error('❌ Summary stats error:', error.message);
    res.status(500).json({ success: false, message: '❌ Failed to fetch analytics' });
  }
});

module.exports = router;

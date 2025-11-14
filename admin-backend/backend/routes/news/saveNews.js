const express = require('express');
const router = express.Router();

const AdminUser = require('../../models/AdminUser');
const News = require('../../models/News');

// ✅ 1. Get all news (for dropdowns, AI tools, etc.)
router.get('/all', async (req, res) => {
  try {
    const articles = await News.find().sort({ createdAt: -1 });
    res.json({ success: true, count: articles.length, articles });
  } catch (err) {
    console.error('❌ Error fetching news:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch news' });
  }
});

// ✅ 2. Save a specific news item to an admin user's saved list
router.post('/save/:newsId', async (req, res) => {
  const { userId } = req.body;
  const { newsId } = req.params;

  if (!userId || !newsId) {
    return res.status(400).json({
      success: false,
      message: '🔸 Missing userId or newsId',
    });
  }

  try {
    const user = await AdminUser.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ Admin user not found',
      });
    }

    if (!user.savedNews.includes(newsId)) {
      user.savedNews.push(newsId);
      await user.save();
      return res.json({
        success: true,
        message: '✅ News saved successfully',
      });
    }

    res.json({
      success: true,
      message: 'ℹ️ News already saved',
    });
  } catch (err) {
    console.error('❌ Error saving news:', err.message);
    res.status(500).json({ success: false, message: 'Failed to save news' });
  }
});

// ✅ 3. Get all saved news for a specific user
router.get('/saved', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({
      success: false,
      message: '🔸 Missing userId',
    });
  }

  try {
    const user = await AdminUser.findById(userId).populate('savedNews');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '❌ Admin user not found',
      });
    }

    res.json({
      success: true,
      savedCount: user.savedNews.length,
      saved: user.savedNews,
    });
  } catch (err) {
    console.error('❌ Error fetching saved news:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch saved news' });
  }
});

module.exports = router;

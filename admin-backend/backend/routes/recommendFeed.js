// 📁 backend/routes/recommendFeed.js
const express = require('express');
const router = express.Router();

const News = require('../models/News');
const AdminUser = require('../models/AdminUser');

// 🧠 AI Logic: Smart recommendation with fallback
router.get('/', async (req, res) => {
  const userId = req.query.userId;

  try {
    let recommendations = [];

    if (userId) {
      const user = await AdminUser.findById(userId).lean();

      const preferredCategories = user?.preferredCategories?.length
        ? user.preferredCategories
        : ['National', 'Technology', 'Gujarati']; // Default fallback

      recommendations = await News.find({
        category: { $in: preferredCategories },
      })
        .sort({ createdAt: -1 })
        .limit(12)
        .lean();
    } else {
      // No userId? Show general feed
      recommendations = await News.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    }

    res.json({ success: true, recommendations });
  } catch (err) {
    console.error('❌ Recommend Feed Error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to fetch recommendations' });
  }
});

module.exports = router;

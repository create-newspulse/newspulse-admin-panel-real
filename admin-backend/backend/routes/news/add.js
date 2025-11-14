// 📁 admin-backend/backend/routes/news/add.js

const express = require('express');
const router = express.Router();
const News = require('../../models/News');
const OpenAI = require('openai');
// Ensure Firebase Admin is initialized (via centralized util)
require('../../utils/firebaseAdmin');
const admin = require('firebase-admin');
const requireAuth = require('../../middleware/authMiddleware');

// ✅ Setup OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Firebase will be initialized once by the shared util if FIREBASE_CREDENTIAL_PATH is set

// ✅ POST /api/news/add — Secure Add News API
router.post('/add', requireAuth, async (req, res) => {
  try {
    const { title, content, category, language } = req.body;
    const user = req.user;

    // 🔒 Required field check
    if (!title || !content || !category || !language) {
      return res.status(400).json({
        success: false,
        message: '❗ Missing required fields: title, content, category, or language.',
      });
    }

    // 🔐 Push condition: Only founder + Breaking News
    const allowPush = user?.role === 'founder' && category === 'Breaking News';

    // 🧠 AI Summary
    let summary = '';
    try {
      const aiRes = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'Summarize this news article in 2 lines.' },
          { role: 'user', content },
        ],
      });
      summary = aiRes.choices[0]?.message?.content?.trim() || '';
    } catch (aiErr) {
      console.warn('⚠️ AI Summary failed. Using empty summary.');
    }

    // 💾 Save to MongoDB
    const newPost = await News.create({
      title,
      content,
      summary,
      category,
      language,
    });

    // 🔔 Send Push Notification (if allowed)
    if (allowPush && admin.apps.length) {
      try {
        await admin.messaging().send({
          notification: {
            title,
            body: summary || content.slice(0, 100),
          },
          topic: 'all',
        });
        console.log(`📤 Push sent: ${title}`);
      } catch (pushErr) {
        console.warn('⚠️ Push Error:', pushErr.message);
      }
    }

    // ✅ Response
    return res.json({
      success: true,
      message: '🟢 News added successfully',
      data: newPost,
      push: allowPush ? '✅ Push Sent' : '🔒 Push Skipped',
    });

  } catch (err) {
    console.error('❌ Add News Error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to add news. Please try again later.',
    });
  }
});

module.exports = router;

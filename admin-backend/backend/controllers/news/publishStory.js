// 📁 backend/controllers/news/publishStory.js

const NewsModel = require('../../models/News'); // ✅ Make sure this matches actual path

module.exports = async function publishStory(req, res) {
  try {
    const { title, content, tags, category, language } = req.body;

    // 🔍 Basic validation
    if (!title || !content || !category || !language) {
      return res.status(400).json({
        success: false,
        message: '🚫 Missing required fields: title, content, category, or language.',
      });
    }

    // 📝 Create new news entry
    const newStory = new NewsModel({
      title: title.trim(),
      content,
      tags: tags || [],
      category,
      language,
      author: req.user?.id || 'anonymous',
      role: req.user?.role || 'editor',
      createdAt: new Date(),
      isPublished: true,
    });

    // 💾 Save to DB
    const savedStory = await newStory.save();

    // ✅ Return success
    return res.status(201).json({
      success: true,
      message: '✅ Story published successfully!',
      data: savedStory,
    });

  } catch (error) {
    console.error('❌ Error publishing story:', error.message || error);
    return res.status(500).json({
      success: false,
      message: '🚨 Internal Server Error. Please try again later.',
    });
  }
};

// 📁 admin-backend/backend/routes/ai/summarize.js

const express = require('express');
const { OpenAI } = require('openai'); // ✅ v4 SDK

const router = express.Router();

// ✅ Create OpenAI Instance
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // 🛡️ Must be set in .env
});

// 🎯 Route: POST /api/ai/summarize
router.post('/', async (req, res) => {
  const { content } = req.body;

  if (!content || content.length < 40) {
    return res.status(400).json({
      success: false,
      message: '⚠️ Content is too short or missing',
    });
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a professional news summarizer. Summarize the given article in 2-3 lines.',
        },
        {
          role: 'user',
          content,
        },
      ],
    });

    const summary = response.choices?.[0]?.message?.content?.trim();

    res.json({
      success: true,
      summary,
      message: '✅ Summary generated successfully',
    });

  } catch (error) {
    console.error('❌ OpenAI Summary Error:', error.message);
    res.status(500).json({
      success: false,
      message: '❌ Failed to generate summary. Please try again.',
    });
  }
});

module.exports = router;

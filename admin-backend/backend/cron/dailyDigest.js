// 📁 backend/cron/dailyDigest.js
const News = require('../models/News');
const sendPush = require('../utils/sendPush');
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = async function generateDigest() {
  try {
    const topNews = await News.find().sort({ createdAt: -1 }).limit(5);
    const content = topNews.map(n => `• ${n.title}`).join('\n');

    const aiRes = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Summarize these headlines in 2 lines for a morning digest.' },
        { role: 'user', content },
      ],
    });

    const summary = aiRes.choices[0].message.content.trim();
    await sendPush({
      title: '📰 Today’s Top Stories',
      body: summary,
      topic: 'digest',
    });
  } catch (err) {
    console.error('❌ Digest Push Error:', err.message);
  }
};

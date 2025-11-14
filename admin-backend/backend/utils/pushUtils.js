// 📁 admin-backend/utils/pushUtils.js

const admin = require('firebase-admin');
const PushLog = require('../models/PushLog');
const OpenAI = require('openai');
const logAnalytics = require('./logAnalytics');

// 🔐 Initialize OpenAI with API Key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🧠 Generate a short 1-line summary for notification
async function generateSummary(content) {
  try {
    const aiRes = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'Summarize this in 1 line for a notification.' },
        { role: 'user', content },
      ],
    });

    return aiRes.choices?.[0]?.message?.content?.trim() || content;
  } catch (err) {
    console.warn('⚠️ AI summary failed. Using original content as fallback.');
    return content;
  }
}

// 📢 Send push notification to a specific topic
module.exports.sendTopicPush = async (topic, content, options = {}) => {
  const {
    rawContent,
    titleOverride,
    targetRole = 'all',
    req,
  } = options;

  const summary = await generateSummary(rawContent || content);
  const finalTitle = titleOverride || summary;

  try {
    const response = await admin.messaging().send({
      topic,
      notification: {
        title: finalTitle,
        body: content,
      },
    });

    console.log(`✅ Push sent to topic "${topic}": ${finalTitle}`);

    // ✅ Log in DB
    await PushLog.create({
      topic,
      title: finalTitle,
      body: content,
      role: targetRole,
      firebaseId: response,
      createdAt: new Date(),
    });

    // 📊 Track analytics
    await logAnalytics({
      eventType: 'push',
      page: `push-${topic}`,
      req,
      additionalData: {
        title: finalTitle,
        body: content,
        firebaseId: response,
        targetRole,
      },
    });

  } catch (err) {
    console.error('❌ Push Failed:', err.message);
  }
};

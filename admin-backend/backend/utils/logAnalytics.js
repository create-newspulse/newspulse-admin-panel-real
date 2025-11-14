// 📁 backend/utils/logAnalytics.js

const Analytics = require('../models/Analytics');

const logAnalytics = async ({
  eventType = 'visit',
  page = 'unknown',
  articleId = null,
  userId = null,
  role = 'guest',
  language = 'English',
  req = null,
  additionalData = {},
}) => {
  try {
    const entry = new Analytics({
      eventType,
      page,
      articleId,
      userId,
      role,
      language,
      additionalData,
      ipAddress: req?.ip || '',
      referrer: req?.headers?.referer || '',
      userAgent: req?.headers?.['user-agent'] || '',
    });

    await entry.save();
    return { success: true };
  } catch (err) {
    console.error('❌ Analytics log error:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = logAnalytics;

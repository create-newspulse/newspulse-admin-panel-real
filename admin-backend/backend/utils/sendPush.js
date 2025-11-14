// 📁 backend/utils/sendPush.js

const admin = require('firebase-admin');

async function sendPush({ title, body, topic = 'all' }) {
  if (!admin.apps.length) {
    console.warn('⚠️ Push skipped: Firebase not initialized');
    return;
  }

  try {
    await admin.messaging().send({
      notification: { title, body },
      topic,
    });
    console.log(`📤 Push sent to [${topic}]: ${title}`);
  } catch (err) {
    console.error('❌ Push Error:', err.message);
  }
}

module.exports = sendPush;

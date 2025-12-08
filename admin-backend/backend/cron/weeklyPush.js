// 📁 backend/cron/weeklyPush.js
const sendPush = require('../utils/sendPush');

const categories = [
  { day: 1, topic: 'tech', title: '💻 Weekly Tech Digest' },
  { day: 3, topic: 'youth', title: '🎓 Gen Z Buzz' },
  { day: 5, topic: 'glamorous', title: '✨ Glam Roundup' },
  { day: 0, topic: 'editorial', title: '🧠 Sunday Editorial Picks' },
];

module.exports = async function weeklyCategoryPush() {
  const today = new Date().getDay();
  const match = categories.find(c => c.day === today);
  if (!match) return;
  await sendPush({
    title: match.title,
    body: 'Tap to explore the latest from this category.',
    topic: match.topic,
  });
};

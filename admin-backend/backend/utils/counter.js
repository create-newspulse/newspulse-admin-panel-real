// 📁 backend/utils/counter.js
const SessionLog = require('../models/SessionLog');

async function countActiveUsers() {
  const count = await SessionLog.countDocuments({ active: true });
  return count;
}

module.exports = { countActiveUsers };

// 📁 admin-backend/scripts/addRealPushAlert.js

require('dotenv').config();
const mongoose = require('mongoose');
const PushAlert = require('../backend/models/PushAlert');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  console.log('✅ Connected to MongoDB');

  const alert = new PushAlert({
    message: '🔥 Breaking News: Budget 2025 Passed!',
    category: 'Politics',
    score: 85,
    type: 'breaking',
    createdAt: new Date(),
  });

  await alert.save();
  console.log('✅ Real push alert inserted.');
  mongoose.disconnect();
});

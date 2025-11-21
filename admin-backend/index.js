// 📁 File: admin-backend/index.js

require('dotenv').config();
const mongoose = require('mongoose');
const express = require('express');
const app = require('./backend/index');
const User = require('./backend/models/User');
const bcrypt = require('bcryptjs');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is missing in .env file');
  process.exit(1);
}

// 🌍 Connect to MongoDB and Start Server
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');

  // 🔐 Auto-seed founder admin if missing (idempotent)
  (async () => {
    try {
      const founderEmail = (process.env.FOUNDER_EMAIL || process.env.ADMIN_EMAIL || '').toLowerCase(); // removed hard-coded founder@newspulse.ai
      const founderPassword = process.env.FOUNDER_PASSWORD || process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD || 'Safe!2025@News';
      let user = await User.findOne({ email: founderEmail });
      if (!user) {
        const passwordHash = await bcrypt.hash(founderPassword, 10);
        user = await User.create({
          name: 'Founder Admin',
          email: founderEmail,
          passwordHash,
          role: 'founder',
          isActive: true,
        });
        console.log(`🟢 Auto-seeded founder user: ${founderEmail}`);
      } else {
        if (!user.isActive) {
          user.isActive = true;
          await user.save();
          console.log(`🟢 Reactivated founder user: ${founderEmail}`);
        } else {
          console.log(`ℹ️ Founder user already exists: ${founderEmail}`);
        }
      }
    } catch (e) {
      console.warn('⚠️ Founder auto-seed skipped:', e.message);
    }
  })();

  app.listen(PORT, () => {
    console.log(`🚀 Backend running at: http://localhost:${PORT}`);
  });
})
.catch((err) => {
  console.error('❌ MongoDB connection failed:', err.message);
  process.exit(1);
});

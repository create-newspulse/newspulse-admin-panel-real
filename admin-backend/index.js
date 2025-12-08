// 📁 File: admin-backend/index.js

import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { createRequire } from 'node:module';

dotenv.config();

const require = createRequire(import.meta.url);
const app = require('./backend/index');
const User = require('./backend/models/User');
const connectDB = require('./backend/db/connect');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is missing in .env file');
  process.exit(1);
}

// Start server with DB connection (supports degraded mode if DB down)
(async () => {
  const connected = await connectDB();

  if (connected !== false) {
    console.log('✅ MongoDB connected successfully');

    // 🔐 Auto-seed founder admin if missing (idempotent)
    try {
      const founderEmail = (process.env.FOUNDER_EMAIL || process.env.ADMIN_EMAIL || '').toLowerCase();
      const founderPassword = process.env.FOUNDER_PASSWORD || process.env.ADMIN_PASS || process.env.ADMIN_PASSWORD || 'Safe!2025@News';
      if (founderEmail) {
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
        } else if (!user.isActive) {
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
  } else {
    console.warn('⚠️ Starting server without MongoDB (DEGRADED mode).');
  }

  app.listen(PORT, () => {
    console.log(`🚀 Backend running at: http://localhost:${PORT}`);
    if (process.env.DB_DEGRADED === '1') {
      console.log('🟠 NOTE: Running without MongoDB. Set REQUIRE_MONGO=1 to force exit when DB is down.');
    }
  });
})();

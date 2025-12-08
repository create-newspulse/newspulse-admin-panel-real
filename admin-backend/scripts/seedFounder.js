// scripts/seedFounder.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../backend/db/connect');
const User = require('../backend/models/User');

(async function run() {
  try {
    await connectDB();
    const email = process.env.ADMIN_EMAIL || 'admin@newspulse.ai';
    const rawPass = process.env.ADMIN_PASS || 'Safe!2025@News';
    const passwordHash = await bcrypt.hash(rawPass, 10);

    let user = await User.findOne({ email });
    if (user) {
      console.log('Founder already exists:', email);
    } else {
      user = await User.create({
        name: 'Founder Admin',
        email,
        passwordHash,
        role: 'founder',
      });
      console.log('Founder created:', user.email);
    }
    await mongoose.connection.close();
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();

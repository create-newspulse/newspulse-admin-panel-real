// backend/scripts/seed.js
require('dotenv').config();
const mongoose = require('mongoose');

// ✅ use your existing connect helper
const connectDB = require('../db/connect');

// ✅ load your existing models
const User = require('../models/User');
const Category = require('../models/Category');

(async () => {
  try {
    // connect
    await connectDB();

    // --- Owner user ---
    let owner = await User.findOne({ email: 'owner@newspulse.co.in' });
    if (!owner) {
      owner = new User({ name: 'Founder', email: 'owner@newspulse.co.in', role: 'owner' });
      // assumes your User model has a schema method setPassword
      if (typeof owner.setPassword === 'function') {
        await owner.setPassword(process.env.SEED_OWNER_PASSWORD || 'ChangeMe#8012');
      } else {
        // fallback if you use plain hash field instead of setPassword
        owner.password = process.env.SEED_OWNER_PASSWORD || 'ChangeMe#8012';
      }
      await owner.save();
      console.log('✅ Owner user created: owner@newspulse.co.in /', process.env.SEED_OWNER_PASSWORD || 'ChangeMe#8012');
    } else {
      console.log('ℹ️ Owner user exists');
    }

    // --- Default categories ---
    const defaults = [
      { slug: 'breaking',      name: { en: 'Breaking',      hi: 'ताज़ा',         gu: 'તાજા' },         order: 1 },
      { slug: 'national',      name: { en: 'National',      hi: 'राष्ट्रीय',      gu: 'રાષ્ટ્રીય' },     order: 2 },
      { slug: 'international', name: { en: 'International', hi: 'अंतर्राष्ट्रीय', gu: 'આંતરરાષ્ટ્રીય' }, order: 3 },
      { slug: 'business',      name: { en: 'Business',      hi: 'व्यापार',       gu: 'વ્યવસાય' },     order: 4 },
      { slug: 'sports',        name: { en: 'Sports',        hi: 'खेल',           gu: 'રમતગમત' },      order: 5 },
    ];

    for (const c of defaults) {
      await Category.updateOne({ slug: c.slug }, { $setOnInsert: c }, { upsert: true });
    }
    console.log('✅ Default categories ensured');

    console.log('🎉 Seed complete');
  } catch (e) {
    console.error('❌ Seed error:', e);
    process.exitCode = 1;
  } finally {
    // clean shutdown
    try {
      await mongoose.connection.close();
      console.log('🔌 Mongo disconnected');
    } catch {}
    process.exit();
  }
})();

import { connectDB } from '../config/db.js';
import { User } from '../models/User.js';
import { Category } from '../models/Category.js';

(async () => {
  try {
    await connectDB();

    let owner = await User.findOne({ email: 'owner@newspulse.co.in' });
    if (!owner) {
      owner = new User({ name: 'Founder', email: 'owner@newspulse.co.in', role: 'owner' });
      await owner.setPassword('ChangeMe#8012');
      await owner.save();
      console.log('✅ Owner user created: owner@newspulse.co.in / ChangeMe#8012');
    } else {
      console.log('ℹ️ Owner user exists');
    }

    const defaults = [
      { slug: 'breaking', name: { en: 'Breaking', hi: 'ताज़ा', gu: 'તાજા' }, order: 1 },
      { slug: 'national', name: { en: 'National', hi: 'राष्ट्रीय', gu: 'રાષ્ટ્રીય' }, order: 2 },
      { slug: 'international', name: { en: 'International', hi: 'अंतर्राष्ट्रीय', gu: 'આંતરરાષ્ટ્રીય' }, order: 3 },
      { slug: 'business', name: { en: 'Business', hi: 'व्यापार', gu: 'વ્યવસાય' }, order: 4 },
      { slug: 'sports', name: { en: 'Sports', hi: 'खेल', gu: 'રમતગમત' }, order: 5 },
    ];

    for (const c of defaults) {
      await Category.updateOne({ slug: c.slug }, { $setOnInsert: c }, { upsert: true });
    }
    console.log('✅ Default categories ensured');

    process.exit(0);
  } catch (e) {
    console.error('❌ Seed error:', e);
    process.exit(1);
  }
})();

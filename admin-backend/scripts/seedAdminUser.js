// 📁 scripts/seedAdminUser.js

const mongoose = require('mongoose');
const AdminUser = require('../backend/models/AdminUser');

mongoose.connect('mongodb://localhost:27017/newsPulse', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(async () => {
  const existing = await AdminUser.findOne({ email: 'founder@newspulse.in' });
  if (existing) {
    console.log('⚠️ Founder already exists');
    return process.exit(0);
  }

  const founder = new AdminUser({
    name: 'Kiran Parmar',
    email: 'founder@newspulse.in',
    password: 'NewsPulse#8012',
    role: 'founder',
  });

  await founder.save();
  console.log('✅ Founder created');
  process.exit(0);
});

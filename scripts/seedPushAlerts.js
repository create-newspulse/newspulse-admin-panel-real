require('dotenv').config();
const mongoose = require('mongoose');
const PushNotification = require('../models/PushNotification');

const dummyData = [
  { title: '🔥 Breaking News', message: 'PM announces major policy update today.' },
  { title: '💡 Tip of the Day', message: 'Drink water every 2 hours to stay healthy.' },
  { title: '🗳️ Civic Update', message: 'Voting starts tomorrow in 5 states.' },
  { title: '🌐 Tech Alert', message: 'New AI regulation bill passed in Parliament.' },
];

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  await PushNotification.deleteMany(); // optional: clear old data
  await PushNotification.insertMany(dummyData);
  console.log('✅ Dummy push alerts inserted!');
  process.exit();
})
.catch((err) => {
  console.error('❌ Error seeding push alerts:', err.message);
  process.exit(1);
});

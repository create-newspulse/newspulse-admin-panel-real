// 📁 admin-backend/scripts/seedSamplePoll.js

require('dotenv').config();
const mongoose = require('mongoose');
const Poll = require('../backend/models/Poll');

async function seedSamplePoll() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const sample = {
      question_en: 'Which technology do you love most?',
      question_hi: 'आप किस तकनीक को सबसे ज्यादा पसंद करते हैं?',
      question_gu: 'તમે કઈ તકનીકી સૌથી વધુ પસંદ કરો છો?',
      options_en: ['AI', 'Blockchain', 'AR/VR', 'Web3'],
      options_hi: ['एआई', 'ब्लॉकचेन', 'एआर/वीआर', 'वेब3'],
      options_gu: ['એઆઈ', 'બ્લોકચેન', 'એઆર/વીઆર', 'વેબ3'],
      votes: [0, 0, 0, 0]
    };

    const result = await Poll.create(sample);
    console.log('✅ Sample Poll created:', result.question_en);
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating poll:', err.message);
    process.exit(1);
  }
}

seedSamplePoll();

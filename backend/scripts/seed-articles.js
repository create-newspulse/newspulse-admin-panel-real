require('dotenv').config();
const mongoose = require('mongoose');
const Article = require('../models/Article');

async function run() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/newspulse';
  await mongoose.connect(MONGO_URI);
  console.log('Connected, seeding...');

  const sample = [
    {
      title: 'Local Elections See Record Turnout',
      summary: 'Citizens flock to polling stations across the city.',
      content: 'Full story about local elections and record turnout...',
      category: 'politics',
      status: 'published',
      author: { name: 'Staff Writer' },
      language: 'en',
      ptiCompliance: 'compliant',
      trustScore: 92,
    },
    {
      title: 'Tech Giants Announce New AI Partnership',
      summary: 'Collaboration aims to accelerate AI research and safety.',
      content: 'Details about the partnership and its goals...',
      category: 'technology',
      status: 'draft',
      author: { name: 'Jane Doe' },
      language: 'en',
      ptiCompliance: 'pending',
      trustScore: 78,
    },
    {
      title: 'Monsoon Rains Bring Relief to Farmers',
      summary: 'Adequate rainfall improves crop outlook this season.',
      content: 'Farmers across the region are optimistic...',
      category: 'weather',
      status: 'scheduled',
      author: { name: 'John Singh' },
      language: 'hi',
      ptiCompliance: 'compliant',
      trustScore: 85,
    },
  ];

  await Article.deleteMany({});
  await Article.insertMany(sample);
  console.log('Seeded 3 articles.');
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

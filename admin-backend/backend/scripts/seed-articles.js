/* Seed 25 sample articles for Manage News (CommonJS) */
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Prefer admin-backend/.env next to this script
const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

const Article = require('../models/Article');

const CATEGORIES = ['Breaking','Regional','National','International','Business','Sports','Lifestyle','Glamorous','SciTech','Editorial','WebStories','ViralVideos'];
const LANGS = ['en','hi','gu'];
const rand = (arr) => arr[Math.floor(Math.random()*arr.length)];

async function run() {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGO_URI not set');
    await mongoose.connect(uri);

    const existing = await Article.countDocuments();
    if (existing >= 5) {
      console.log(`Seed skipped: already have ${existing} articles`);
      await mongoose.disconnect();
      return;
    }

    const docs = Array.from({ length: 25 }).map((_, i) => ({
      title: `Sample Article ${i + 1}`,
      summary: 'This is a short summary of the article.',
      content: `<p>Body for article ${i + 1}. Lorem ipsum dolor sit amet.</p>`,
      category: rand(CATEGORIES),
      tags: ['demo','seed'],
      status: i % 5 === 0 ? 'published' : 'draft',
      language: rand(LANGS),
      ptiCompliance: 'pending',
      trustScore: Math.floor(Math.random()*100),
      author: { name: 'Seeder', type: 'human' },
    }));

    await Article.insertMany(docs);
    console.log('✅ Inserted 25 sample articles');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Seed failed:', err.message || err);
    process.exit(1);
  }
}

run();

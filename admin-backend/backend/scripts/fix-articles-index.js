/* Drop and recreate text index on articles to avoid language override errors */
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const Article = require('../models/Article');

const envPath = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath }); else dotenv.config();

(async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGO_URI not set');
    await mongoose.connect(uri);
    const col = mongoose.connection.db.collection('articles');
  const indexes = await col.indexes();
  const textIdx = indexes.find((i) => i.textIndexVersion || (i.key && i.key._fts === 'text'));
    if (textIdx) {
      console.log('Dropping existing text index:', textIdx.name);
      await col.dropIndex(textIdx.name);
    } else {
      console.log('No text index found to drop.');
    }
    console.log('Recreating text index with default_language=english');
  await col.createIndex({ title: 'text', summary: 'text', tags: 'text', content: 'text' }, { default_language: 'english', name: 'article_text_search', language_override: 'none' });
    console.log('✅ Index recreated.');
    await mongoose.disconnect();
  } catch (err) {
    console.error('Fix index failed:', err.message || err);
    process.exit(1);
  }
})();

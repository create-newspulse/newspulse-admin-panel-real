import 'dotenv/config';
import mongoose from 'mongoose';
import { Article } from '../models/Article.js';

async function run() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/newspulse';
  await mongoose.connect(MONGO_URI);
  await Article.deleteMany({});
  await Article.insertMany([
    { title: 'Global Markets Rally', slug: 'global-markets-rally', summary: 'Stocks surge worldwide', content: 'Source Reuters: Markets rally strongly today.', category: 'Business', language: 'en', tags: ['markets','stocks'], status: 'draft', ptiCompliance: 'pending' },
    { title: 'भारत में मानसून की शुरुआत', slug: 'bharat-mein-monsoon', summary: 'देश भर में बारिश', content: 'Source PTI: देश में मानसून की अच्छी शुरुआत।', category: 'Weather', language: 'hi', tags: ['मौसम','बारिश'], status: 'draft', ptiCompliance: 'pending' },
    { title: 'ગુજરાતમાં નવા સ્ટાર્ટઅપ', slug: 'gujarat-nava-startup', summary: 'નવા વિચારો ઉદ્ભવે છે', content: 'Source PTI: સ્ટાર્ટઅપ ઈકોસિસ્ટમ વૃદ્ધિ.', category: 'Technology', language: 'gu', tags: ['સ્ટાર્ટઅપ','ટેક'], status: 'draft', ptiCompliance: 'pending' }
  ]);
  console.log('Seeded');
  await mongoose.disconnect();
}

run().catch(e=>{ console.error(e); process.exit(1); });

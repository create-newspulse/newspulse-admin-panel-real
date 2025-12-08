/* Seed 25 sample articles for Manage News */
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const Article = require('../models/Article');

const CATEGORIES = ['Breaking','Regional','National','International','Business','Sports','Lifestyle','Glamorous','SciTech','Editorial','WebStories','ViralVideos'];
const LANGS = ['en','hi','gu'];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random()*arr.length)]; }

async function run() {
	const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
	if (!uri) throw new Error('MONGO_URI not set');
	await mongoose.connect(uri);

	const existing = await Article.countDocuments();
	if (existing >= 25) {
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
}
	run().catch(err => { console.error(err); process.exit(1); });

const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { openai } = require('../admin-backend/openaiClient');

const FILE = path.join(__dirname, '../admin-backend/backend/data/wonders.json');
const TODAY = dayjs().format('YYYY-MM-DD');

// 🎵 Music pool
const musicList = [
  'https://example.com/music/serene-forest.mp3',
  'https://example.com/music/sky-whispers.mp3',
  'https://example.com/music/soft-ocean.mp3',
  'https://example.com/music/hopeful-light.mp3',
];

// 🌐 Categories
const categories = [
  { emoji: '🌌', label: 'Universe Wonder' },
  { emoji: '🧠', label: 'Mind Wonder' },
  { emoji: '🌄', label: 'Nature Wonder' },
  { emoji: '💭', label: 'Thought Wonder' },
];

// ✨ Prompt builder
function buildPrompt() {
  return `
Generate a one-line inspirational quote for Daily Wonder.

Requirements:
- Keep it poetic or thought-provoking
- No author name
- Don't include category label
- Just the quote sentence only
`.trim();
}

// 📥 Load wonders (safe fallback)
function loadWonders() {
  try {
    const raw = fs.readFileSync(FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('⚠️ No previous wonders or file missing. Starting fresh.');
    return [];
  }
}

// 💾 Save updated list
function saveWonders(data) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    console.log('✅ wonders.json updated');
  } catch (err) {
    console.error('❌ Failed to save wonders file:', err.message);
  }
}

// 🚀 Generate & store wonder
async function generateWonder() {
  const wonders = loadWonders();

  if (wonders.some(w => w.date === TODAY)) {
    console.log(`⏭️ Wonder already exists for ${TODAY}`);
    return;
  }

  try {
    console.log('✨ Generating today\'s Wonder...');

    const aiRes = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: buildPrompt() }],
      max_tokens: 60,
    });

    const quote = aiRes.choices?.[0]?.message?.content?.trim().replace(/^["“”']|["“”']$/g, '') || 'Wonder flows where thought grows.';
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const musicUrl = musicList[Math.floor(Math.random() * musicList.length)];

    const wonder = {
      quote,
      videoEmbedUrl: 'https://www.youtube.com/embed/nR3x8ozAKG0',
      source: 'https://www.youtube.com/@DroneTV',
      creator: 'Drone TV',
      category: `${randomCategory.emoji} ${randomCategory.label}`,
      language: 'en',
      musicUrl,
      date: TODAY,
    };

    wonders.push(wonder);
    saveWonders(wonders);

    console.log(`✅ New Daily Wonder for ${TODAY} created successfully.`);
  } catch (err) {
    console.error('❌ Failed to generate wonder:', err.message || err);
  }
}

generateWonder();

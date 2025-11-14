const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../data/daily-wonder.json');

// 🧠 Fallback samples if file not found or broken
const sampleWonders = [
  {
    quote: "Above the clouds, silence becomes a song.",
    videoEmbedUrl: "https://www.youtube.com/embed/nR3x8ozAKG0",
    source: "https://www.youtube.com/@DroneTV",
    creator: "Drone TV",
    category: "🌄 Nature Wonder",
    language: "en",
    musicUrl: "https://example.com/background-music.mp3",
  }
];

// ✅ GET /api/daily-wonder → return today’s wonders
router.get('/', (req, res) => {
  try {
    let wonders = [];

    try {
      const raw = fs.readFileSync(dataFile, 'utf-8');
      wonders = JSON.parse(raw);
    } catch {
      wonders = sampleWonders;
    }

    const today = new Date().toISOString().slice(0, 10);
    const todaysWonders = wonders.filter(w => w.date === today);

    res.json({
      success: true,
      data: todaysWonders.length ? todaysWonders : wonders.slice(0, 1),
    });

  } catch (err) {
    console.error('❌ Read error:', err);
    res.status(500).json({ success: false, message: 'Server read error' });
  }
});

// ✅ POST /api/daily-wonder → add a new wonder (safe, append)
router.post('/', (req, res) => {
  const { quote, videoEmbedUrl, source, creator, category, language, musicUrl, date } = req.body;

  if (!quote || !videoEmbedUrl || !source || !creator) {
    return res.status(400).json({ success: false, message: '❌ Missing required fields' });
  }

  try {
    let list = [];

    try {
      const raw = fs.readFileSync(dataFile, 'utf-8');
      list = JSON.parse(raw);
    } catch {
      list = [];
    }

    list.push({
      quote,
      videoEmbedUrl,
      source,
      creator,
      category: category || "🌈 Wonder",
      language: language || "en",
      musicUrl: musicUrl || "",
      date: date || new Date().toISOString().slice(0, 10)
    });

    fs.writeFileSync(dataFile, JSON.stringify(list, null, 2));
    res.json({ success: true, message: '✅ Wonder saved successfully' });

  } catch (err) {
    console.error('❌ Write error:', err);
    res.status(500).json({ success: false, message: 'Server write error' });
  }
});

module.exports = router;

// 📁 scripts/fetchDroneTV.js

require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const DroneTV = require('../admin-backend/models/DroneTV'); // ✅ Correct path to model
const { generateMoodTags } = require('../src/utils/generateMoodTags'); // ✅ AI mood tag utility

// ⛓️ MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const API_KEY = process.env.YOUTUBE_API_KEY;
const PLAYLIST_ID = 'PLt3zZrTKU_X1tvJTwXal3KZVZyueWvW2X'; // ✅ Curated safe playlist
const MAX_RESULTS = 10;

async function fetchDroneTV() {
  try {
    console.log('📡 Fetching DroneTV playlist from YouTube...');

    const response = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
      params: {
        part: 'snippet',
        maxResults: MAX_RESULTS,
        playlistId: PLAYLIST_ID,
        key: API_KEY,
      },
    });

    const items = response.data.items || [];

    for (const item of items) {
      const snippet = item.snippet;
      const title = snippet.title;
      const description = snippet.description || '';
      const videoId = snippet.resourceId?.videoId;

      // 🔁 Skip if no ID or already exists
      if (!videoId || await DroneTV.findOne({ videoId })) continue;

      const embedCode = `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`;
      const moodTags = generateMoodTags(title, description); // 🧠 Mood AI

      // 💾 Save video
      await DroneTV.create({
        title,
        description,
        videoId,
        embedCode,
        moodTags,
        category: 'DroneTV',
        createdAt: new Date(),
        source: 'YouTube',
        credit: snippet.channelTitle || 'Unknown',
      });

      console.log('✅ Saved:', title);
    }

    console.log('🎬 DroneTV sync complete.');
    mongoose.connection.close();
  } catch (error) {
    console.error('❌ DroneTV Fetch Error:', error.message);
    mongoose.connection.close();
  }
}

fetchDroneTV();

// backend/routes/youtubeRelaxRoute.js
const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/relax-videos', async (req, res) => {
  try {
    const response = await axios.get(
      `https://www.googleapis.com/youtube/v3/search`, {
        params: {
          key: process.env.YOUTUBE_API_KEY,
          part: 'snippet',
          type: 'video',
          q: 'relaxing nature drone 4k',
          maxResults: 8,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    console.error('YouTube fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

module.exports = router;

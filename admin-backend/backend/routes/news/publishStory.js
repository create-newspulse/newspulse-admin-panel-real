// 📁 backend/routes/news/publishStory.js

const express = require('express');
const router = express.Router();

// 🔐 Middleware
const verifyToken = require('../../middleware/verifyToken');
const verifyEditor = require('../../middleware/verifyEditor');

// 🧠 Controller
const publishStoryController = require('../../controllers/news/publishStory');

// 🚀 Route: Publish a news story (editor or founder only)
router.post('/publish-story', verifyToken, verifyEditor, publishStoryController);

module.exports = router;

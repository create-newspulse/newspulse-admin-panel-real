// 📁 admin-backend/backend/index.js

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// ✅ Core Middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(morgan('dev'));

// ✅ Admin Routes
app.use('/api/admin', require('./routes/admin/auth'));
app.use('/api/admin', require('./routes/admin/getUsers'));
app.use('/api/admin', require('./routes/admin/updateRole'));
app.use('/api/settings', require('./routes/settings'));

// ✅ AI Routes (KiranOS Tools)
app.use('/api/ai', require('./routes/ai/summarize'));         // ✅ Summarizer (v4 ready)
app.use('/api/ai', require('./routes/ai-ranker'));            // Headline score/tag
app.use('/api/ai', require('./routes/ai-headline-suggest'));  // Title ideas
app.use('/api/ai', require('./routes/ai-poll'));              // AI Poll Question

// ✅ Notifications System
app.use('/api/notifications', require('./routes/pushPreview')); // Optional: Push Preview UI

// ✅ Analytics
app.use('/api/analytics', require('./routes/analytics'));

// ✅ News System
app.use('/api/news', require('./routes/news/saveNews'));              // /news/all, etc.
app.use('/api/news', require('./routes/news/add'));                   // Add news
app.use('/api/news', require('./routes/news/trendingController'));   // Trending score (if used)

// ✅ Polls & Daily Wonder (Only Active Ones)
app.use('/api/polls', require('./routes/polls'));
app.use('/api/wonder', require('./routes/dailyWonder'));

// 🚫 Removed for Policy Compliance
// ❌ app.use('/api/recommend-feed', require('./routes/recommendFeed'));
// ❌ app.use('/api/ted-youth', require('./routes/api/ted-youth'));
// ❌ Civic, Sansad TV, DD News, TED, etc. removed

// ✅ Health Check
app.get('/', (req, res) => {
  res.send('🟢 News Pulse Admin Backend is Live');
});

module.exports = app;

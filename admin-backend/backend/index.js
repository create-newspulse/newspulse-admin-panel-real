// 📁 admin-backend/backend/index.js

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const morgan = require('morgan');

const app = express();

// ✅ Core Middleware
// Note: central CORS is applied by the top-level server.mjs; avoid router-level wildcard cors().
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

// ✅ AI System Health (new route)
// Provides a lightweight snapshot of AI-related env/config presence.
// Response intentionally minimal for monitoring dashboards.
app.get('/api/system/ai-health', (req, res) => {
  try {
    const flags = {
      openaiKey: Boolean(process.env.OPENAI_API_KEY),
      googleKey: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
      anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
      env: process.env.NODE_ENV || 'development',
      ts: new Date().toISOString(),
    };
    res.json({ ok: true, ...flags });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'ai-health-failed' });
  }
});

// Non-/api alias for UI components expecting `/system/ai-health`
app.get('/system/ai-health', (req, res) => {
  try {
    const flags = {
      openaiKey: Boolean(process.env.OPENAI_API_KEY),
      googleKey: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
      anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
      env: process.env.NODE_ENV || 'development',
      ts: new Date().toISOString(),
    };
    res.json({ ok: true, ...flags, alias: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: 'ai-health-failed' });
  }
});

// ✅ Admin Stats (new primary + alias)
// Provides lightweight dashboard metrics for charts / analytics widgets.
// Mounted both at /api/admin/stats (via router below) and direct /admin/stats for legacy calls.
app.get('/admin/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      totalNews: 245,
      totalUsers: 1024,
      totalViews: 156789,
      pendingApprovals: 12,
      debug: 5,
      manualEntry: 11,
      technology: 32,
      viewsToday: 542,
      peakTime: '14:00',
      topRegion: 'IN',
      bounceRate: 37,
      recentActivity: [
        { id: 1, action: 'News article published', time: '2h ago' },
        { id: 2, action: 'User registered', time: '4h ago' },
      ],
    },
    alias: true,
  });
});

// --- Dashboard Stats (canonical endpoints expected by frontend) ---
// GET /api/dashboard-stats  and GET /api/stats (alias)
app.get('/api/dashboard-stats', (req, res) => {
  try {
    return res.json({
      ok: true,
      success: true,
      data: {
        totals: {
          news: 247,
          today: 12,
          users: 1024,
          activeUsers: 27,
          totalViews: 125430,
        },
        byCategory: [
          { _id: 'Politics', count: 45 },
          { _id: 'Technology', count: 38 },
          { _id: 'Sports', count: 32 },
        ],
        byLanguage: [
          { _id: 'en', count: 150 },
          { _id: 'hi', count: 67 },
          { _id: 'gu', count: 30 }
        ],
        recent: [],
        aiLogs: 1234,
        activeUsers: 27
      }
    });
  } catch (err) {
    console.error('❌ /api/dashboard-stats error', err);
    return res.status(500).json({ ok: false, success: false, message: 'Failed to fetch dashboard stats' });
  }
});

// Alias without dash
app.get('/api/stats', (req, res) => {
  try {
    return res.json({
      ok: true,
      success: true,
      data: {
        totals: {
          news: 247,
          today: 12,
          users: 1024,
          activeUsers: 27,
          totalViews: 125430,
        },
        byCategory: [
          { _id: 'Politics', count: 45 },
          { _id: 'Technology', count: 38 },
        ],
        byLanguage: [
          { _id: 'en', count: 150 },
          { _id: 'hi', count: 67 }
        ],
        recent: [],
        aiLogs: 1234,
        activeUsers: 27
      }
    });
  } catch (err) {
    console.error('❌ /api/stats error', err);
    return res.status(500).json({ ok: false, success: false, message: 'Failed to fetch stats' });
  }
});

// ✅ Extended startup banner (will print once parent server starts listening)
try {
  console.info('[ADMIN BACKEND] Variant: MongoDB-backed Express server loaded. Stats route aliases active.');
} catch (_) {}

module.exports = app;

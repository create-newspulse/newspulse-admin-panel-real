// Temporary simplified server for testing
import express from 'express';
import cors from 'cors';

const app = express();

// CORS configuration
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
app.use(cors({
  origin: DEV_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());

// Test endpoints
app.get('/', (req, res) => {
  res.send('🟢 News Pulse Admin Backend is Live');
});

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Backend is running 🚀' });
});

// Dashboard stats endpoint
app.get('/api/dashboard-stats', (req, res) => {
  res.json({
    success: true,
    data: {
      total: 0,
      byCategory: [],
      byLanguage: [],
      recent: [],
      aiLogs: 0,
      activeUsers: 0,
      lastTraining: null,
      totalViews: 0,
      viewsToday: 0,
      topPages: []
    }
  });
});

// Stats alias endpoint
app.get('/api/stats', (req, res) => {
  res.json({
    totals: { news: 0, categories: 0, languages: 0, users: 0 },
    aiLogs: 0,
    ok: true,
    source: 'temp-server'
  });
});

// System endpoints that are being called
app.get('/api/system/ai-command', (req, res) => {
  res.json({ success: true, command: null });
});

app.get('/api/system/ai-training-info', (req, res) => {
  res.json({ success: true, lastTraining: null, status: 'idle' });
});

app.get('/api/insights/weekly', (req, res) => {
  res.json({
    summary: { suggestedStories: 82, window: 'last_week' },
    top: { title: 'India\'s Tech Leap in 2025', reads: 21000, engagement: 97 },
    ok: true,
    source: 'temp-server'
  });
});

app.get('/api/charts/traffic', (req, res) => {
  const now = new Date();
  const series = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (7 * (7 - i)));
    return { label: d.toISOString().slice(0, 10), visits: 300 + i * 70 };
  });
  res.json({ series, ok: true, source: 'temp-server' });
});

// News ticker endpoint
app.get('/api/news-ticker', (req, res) => {
  res.json([
    { id: 1, text: 'Breaking: Tech innovation reaches new heights in 2025', priority: 'high' },
    { id: 2, text: 'Market update: Positive trends continue', priority: 'medium' },
    { id: 3, text: 'Weather: Clear skies expected this weekend', priority: 'low' }
  ]);
});

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`🔍 ${req.method} ${req.originalUrl} - ${req.path}`);
  next();
});

// Catch-all for missing endpoints
app.use('/api', (req, res) => {
  console.log(`❌ Missing route: ${req.method} ${req.originalUrl} - Path: ${req.path}`);
  res.status(404).json({ success: false, message: `🔍 Route not found: ${req.originalUrl}` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('🔥 ERROR on', req.originalUrl, err?.stack || err);
  res.status(500).json({ success: false, message: err?.message || 'Internal Server Error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Temporary server running at http://localhost:${PORT}`);
});
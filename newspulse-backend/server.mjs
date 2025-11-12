import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import liveContent from './routes/liveContent.mjs';

const app = express();
const server = http.createServer(app);

const ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map(s=>s.trim()).filter(Boolean);
app.use(cors({ origin: (o,cb)=>(!o||ORIGINS.includes(o))?cb(null,true):cb(null,false), credentials:true }));
app.use(express.json({ limit: '1mb' }));

// Support both MONGODB_URI and legacy MONGO_URI without requiring dotenv-expand
const mongoUriRaw = process.env.MONGODB_URI || '';
const mongoUri = (mongoUriRaw && !mongoUriRaw.includes('${')) ? mongoUriRaw : process.env.MONGO_URI;
console.log('Mongo URI scheme:', mongoUri ? String(mongoUri).split(':')[0] : 'missing-or-unresolved');
mongoose.connect(mongoUri, { dbName: process.env.MONGO_DB || 'newspulse' })
  .then(()=>console.log('Mongo connected'))
  .catch(e=>console.error('Mongo error', e));

app.get('/health', (_req,res)=> res.send('ok'));
app.use('/api/live-content', liveContent);

// Minimal health + stats endpoints to satisfy the admin UI during local dev
app.get('/api/system/health', async (req, res) => {
  const started = Date.now();
  try {
    const dbState = mongoose.connection.readyState; // 0=disconnected,1=connected,2=connecting,3=disconnecting
    const dbHealthy = dbState === 1;
    const payload = {
      success: true,
      target: 'local:5000',
      proxied: false,
      latencyMs: Date.now() - started,
      backend: {
        status: (dbHealthy ? 'healthy' : 'warning'),
        db: dbHealthy ? 'connected' : 'not-connected',
        cpu: undefined,
        memory: undefined,
      },
    };
    res.setHeader('content-type', 'application/json');
    res.status(200).json(payload);
  } catch (e) {
    res.status(200).json({ success: false, error: 'health-error', message: e?.message });
  }
});

app.get('/api/system/backend-origin', (_req, res) => {
  res.json({ origin: `http://localhost:${process.env.PORT || 5000}` });
});

// Minimal AI Training Info endpoints used by context/provider
app.get('/api/system/ai-training-info', (_req, res) => {
  const now = new Date();
  const next = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  res.json({
    data: {
      lastTraining: now.toISOString(),
      nextTraining: next.toISOString(),
      articlesAnalyzed: 1234,
      keywords: 456,
      patternFocus: 'politics,economy,technology',
      modulesTrained: ['Summarizer', 'Classifier', 'SEO-Assist'],
      lockedByFounder: false,
      version: '2025.11.0',
    },
  });
});

app.put('/api/system/ai-training-info', (req, res) => {
  // Accept any payload and echo back under { data } to satisfy UI during dev
  const body = req.body || {};
  res.json({ data: body, ok: true });
});

// Minimal System Monitor Hub data for charts and panels
app.get('/api/system/monitor-hub', (_req, res) => {
  res.json({
    success: true,
    // For ChartComponent (expects these three numbers)
    debug: 12,
    manualEntry: 7,
    technology: 23,
    // For MonitorHubPanel (expects a richer object)
    activeUsers: 3,
    mobilePercent: 68,
    avgSession: '2m 10s',
    newsApi: 99,
    weatherApi: 98,
    twitterApi: 97,
    loginAttempts: 0,
    autoPatches: 0,
    topRegions: ['IN', 'US', 'AE'],
    aiTools: ['Classifier', 'Summarizer', 'SEO-Assist'],
    ptiScore: 100,
    flags: 0,
  });
});

// Simple traffic series for charts page (not required by ChartComponent, but handy)
app.get('/api/charts/traffic', (_req, res) => {
  res.json({
    series: [
      { label: 'Mon', visits: 120 },
      { label: 'Tue', visits: 140 },
      { label: 'Wed', visits: 110 },
      { label: 'Thu', visits: 160 },
      { label: 'Fri', visits: 170 },
      { label: 'Sat', visits: 90 },
      { label: 'Sun', visits: 130 },
    ],
  });
});

const sampleStats = () => ({
  totals: { news: 0, categories: 0, languages: 0, users: 0 },
  byCategory: [],
  byLanguage: [],
  recent: [],
  aiLogs: 0,
});

app.get('/api/dashboard-stats', (_req, res) => {
  res.json({ data: sampleStats() });
});

app.get('/api/stats', (_req, res) => {
  res.json(sampleStats());
});

const io = new Server(server, { cors:{ origin: ORIGINS, methods:['GET','POST'] }});
app.set('io', io);
io.on('connection', s=>console.log('socket', s.id));

server.listen(process.env.PORT || 5000, ()=> console.log('API up'));

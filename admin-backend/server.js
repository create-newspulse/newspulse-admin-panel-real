// admin-backend/server.js
// ✅ News Pulse Admin Backend – Main Server (ESM, cleaned)

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { exec } from 'child_process';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import cron from 'node-cron';
import axios from 'axios';
import { Server as SocketIOServer } from 'socket.io';
import fsSync from 'fs';
import fs from 'fs/promises';
import crypto from 'crypto';
import { OpenAI } from 'openai';

// ---- __dirname / __filename in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load either ESM or CommonJS route modules seamlessly
async function loadRoute(p) {
  const mod = await import(p);
  return (mod && Object.prototype.hasOwnProperty.call(mod, 'default')) ? mod.default : mod;
}

// ===== Global Crash Protection =====
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err?.stack || err);
});
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err?.stack || err);
  process.exit(1);
});

// ===== Data File Sanity Check (sync on startup) =====
function ensureJsonFile(filePath, defaultContent) {
  const dir = path.dirname(filePath);
  if (!fsSync.existsSync(dir)) fsSync.mkdirSync(dir, { recursive: true });
  if (!fsSync.existsSync(filePath) || fsSync.statSync(filePath).size === 0) {
    fsSync.writeFileSync(filePath, defaultContent, 'utf-8');
  }
  let raw = fsSync.readFileSync(filePath, 'utf-8').trim();
  if (!raw) {
    fsSync.writeFileSync(filePath, defaultContent, 'utf-8');
    raw = defaultContent;
  }
  try { JSON.parse(raw); } catch { fsSync.writeFileSync(filePath, defaultContent, 'utf-8'); }
}

const JSON_DEFAULTS = {
  'ai-diagnostics.json': '{"diagnostics":[]}',
  'ai-heal-log.json': '{"logs":[]}',
  'ai-queue.json': '{"queue":[]}',
  'ai-trainer-state.json': '{"state":{}}',
  'ai-training-info.json': '{"lastTrained":null,"stats":{},"logs":[]}',
  'daily-quote.json': '{"quotes":[]}',
  'daily-wonder.json': '{"wonders":[]}',
  'history-today.json': '{"events":[]}',
  'incident-log.json': '{"incidents":[],"lastSync":null}',
  'integrity-scan.json': '{"results":[]}',
  'live-stats.json': '{"stats":[]}',
  'optimizer-history.json': '{"history":[]}',
  'polls.json': '{"polls":[]}',
  'system-version-log.json': '{"versions":[]}',
  'thinking-feed.json': '{"feed":[]}',
  'api-keys.json': '{"keys":[]}',
  'version-log.json': '{"versions":[]}',
  'system-optimizer-status.json': '{"status":"idle","lastRun":null}',
  'alert-config.json': '{"alerts":[]}',
  'revenue.json': '{"total":0,"history":[]}',
  'threat-stats.json': '{"threats":[]}',
  'monitor-hub.json': '{"monitors":[]}',
  'bug-reports.json': '{"reports":[]}',
  'ai-behavior-log.json': '{"behaviors":[]}'
};

const DATA_DIR = path.join(__dirname, 'backend', 'data');
for (const [fname, defContent] of Object.entries(JSON_DEFAULTS)) {
  ensureJsonFile(path.join(DATA_DIR, fname), defContent);
}
console.log('✅ All critical backend/data/*.json files exist and are valid.');

// ====== Database & Models ======
const connectDB = await loadRoute('./backend/db/connect.js'); // works for CJS or ESM
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const SystemSettings = require('./backend/models/SystemSettings.js'); // CommonJS module

mongoose.connection.on('error', (err) => console.error('❌ MongoDB connection error:', err));
mongoose.connection.on('disconnected', () => console.error('❌ MongoDB disconnected!'));

// ====== Express & Server Setup ======
const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);

const isProd = process.env.NODE_ENV === 'production';
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
// Support multiple env var names for CORS allowlist compatibility
const ENV_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGINS || process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = isProd ? ENV_ORIGINS : DEV_ORIGINS;

// ====== Socket.IO (v4) ======
const io = new SocketIOServer(server, {
  path: '/socket.io',
  cors: {
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      if (!isProd) return cb(null, true);
      return cb(new Error('Not allowed by Socket.IO CORS'), false);
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
app.locals.io = io;

let realTimeUserCount = 0;
io.on('connection', (socket) => {
  realTimeUserCount++;
  io.emit('activeUserCount', realTimeUserCount);
  console.log(`👤 Socket connected: ${socket.id} | active: ${realTimeUserCount}`);
  socket.emit('hello', { msg: 'KiranOS socket online ✅' });
  socket.on('disconnect', () => {
    realTimeUserCount--;
    io.emit('activeUserCount', realTimeUserCount);
    console.log(`🔌 Socket disconnected: ${socket.id} | active: ${realTimeUserCount}`);
  });
});

// ====== Core middleware (before routes)
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (!isProd) return cb(null, true);
    return cb(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (!isProd) app.use(morgan('dev'));
else {
  app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 100 }));
  app.use('/api/monitor-hub', rateLimit({ windowMs: 60 * 1000, max: 200 }));
}

// ====== Static Files ======
const UPLOADS_VAULT_PATH = path.join(__dirname, 'uploads', 'vault');
const COVERS_DIR = path.join(__dirname, 'uploads', 'covers');
await fs.mkdir(UPLOADS_VAULT_PATH, { recursive: true });
await fs.mkdir(COVERS_DIR, { recursive: true });
app.use('/uploads/vault', express.static(UPLOADS_VAULT_PATH));
app.use('/uploads/covers', express.static(COVERS_DIR));

// ====== OpenAI (KiranOS) ======
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const FALLBACK_OPENAI_KEY = process.env.OPENAI_FALLBACK_KEY || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const FAST_MODEL = process.env.OPENAI_FAST_MODEL || 'gpt-4o-mini';
console.log('🧠 OpenAI configured:', { key: !!process.env.OPENAI_API_KEY, model: MODEL, fast: FAST_MODEL, hasFallback: !!FALLBACK_OPENAI_KEY });

async function chatFast(messages, { temperature = 0.5, max_tokens = 220 } = {}) {
  // One fast attempt, then one retry on 429/overload, then fallback key if available
  const sys = messages[0]?.role === 'system' ? [] : [{ role: 'system', content: 'Answer concisely. Prefer bullet points. Max 6 lines.' }];
  const full = [...sys, ...messages];
  const tryOnce = async (client) => client.chat.completions.create({ model: FAST_MODEL, messages: full, temperature, max_tokens });
  try {
    return await tryOnce(openai);
  } catch (err) {
    const code = err?.status || err?.code || '';
    const msg = err?.message?.toLowerCase?.() || '';
    const isBusy = code === 429 || msg.includes('rate') || msg.includes('limit') || msg.includes('over') || msg.includes('busy');
    if (isBusy) {
      await new Promise(r => setTimeout(r, 300 + Math.floor(Math.random()*300)));
      try {
        return await tryOnce(openai);
      } catch (err2) {
        if (FALLBACK_OPENAI_KEY) {
          try {
            const alt = new OpenAI({ apiKey: FALLBACK_OPENAI_KEY });
            return await tryOnce(alt);
          } catch (err3) {
            throw err3;
          }
        }
        throw err2;
      }
    }
    throw err;
  }
}

// Health for AI
app.get('/api/system/ai-health', (_req, res) => {
  res.json({ ok: true, model: MODEL, keyLoaded: !!process.env.OPENAI_API_KEY, ts: new Date().toISOString() });
});

// Non-streaming chat (does not collide with your existing /api/ai router)
app.post('/api/ai/chat-core', async (req, res) => {
  try {
    const {
      messages = [],
      temperature = 0.5,
      max_tokens = 220,
      system = 'You are KiranOS, the NewsPulse AI. Stay PTI-compliant and concise.'
    } = req.body || {};
    const fullMessages = [{ role: 'system', content: system }, ...messages];

    const completion = await chatFast(fullMessages, { temperature, max_tokens });

    res.json({
      ok: true,
      model: completion.model,
      content: completion.choices?.[0]?.message?.content || '',
      usage: completion.usage || null
    });
  } catch (err) {
    const code = err?.status || err?.code || 500;
    const msg = err?.message || 'AI_ERROR';
    const isBusy = code === 429 || /rate|limit|busy|over/i.test(msg);
    console.error('❌ /api/ai/chat-core error:', code, msg);
    res.status(isBusy ? 503 : 500).json({ ok: false, error: isBusy ? 'BUSY' : 'AI_ERROR', detail: msg });
  }
});

// Streaming chat via SSE
app.post('/api/ai/stream-core', async (req, res) => {
  try {
    const { messages = [], temperature = 0.6 } = req.body || {};
    const fullMessages = [
      { role: 'system', content: 'You are KiranOS, the NewsPulse AI.' },
      ...messages
    ];

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: fullMessages,
      temperature,
      stream: true
    });

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('❌ /api/ai/stream-core error:', err);
    try { res.write(`data: ${JSON.stringify({ error: 'AI_ERROR', detail: err.message })}\n\n`); } catch {}
    try { res.end(); } catch {}
  }
});

// ====== Route Imports (compat with CJS/ESM via loadRoute)
const dashboardStats = await loadRoute('./backend/routes/dashboard-stats.js');
const revenueRoutes = await loadRoute('./backend/routes/revenue.js');
const exportReportRoute = await loadRoute('./backend/routes/reports/export.js');
const dashboardThreatStats = await loadRoute('./backend/routes/dashboard-threat-stats.js');
const livePollStatsRoute = await loadRoute('./backend/routes/polls/livePollStats.js');
const liveContentRoute = await loadRoute('./backend/routes/system/live-content.mjs');

// System & Utility
const aiCommandRoute = await loadRoute('./backend/routes/system/ai-command.js');
const aiDiagnosticsRoutes = await loadRoute('./backend/routes/system/ai-diagnostics.js');
const clearCommandLogs = await loadRoute('./backend/routes/system/clearCommandLogs.js');
const kiranosCommandRoute = await loadRoute('./backend/routes/system/kiranosCommand.js');
const thinkingFeedRoute = await loadRoute('./backend/routes/system/thinking-feed.js');
const aiTrainingInfo = await loadRoute('./backend/routes/system/ai-training-info.js');
const bugAlertRoute = await loadRoute('./backend/routes/system/bug-alert.js');
const emergencyLockRoute = await loadRoute('./backend/routes/system/emergencyLock.js');
const integrityScanRoute = await loadRoute('./backend/routes/system/integrity-scan.js');
const regionHeatmapRoute = await loadRoute('./backend/routes/system/regionHeatmap.js');
const uptimeMonitorRoute = await loadRoute('./backend/routes/system/uptimeMonitor.js');
const monitorHubRoute = await loadRoute('./backend/routes/system/monitor-hub.js');

// Remaining system routes
const articles = await loadRoute('./backend/routes/articles.js');
const uploads = await loadRoute('./backend/routes/uploads.js');
const firebase = await loadRoute('./backend/routes/firebase.js');
const system = await loadRoute('./backend/routes/system.js');
const liveStats = await loadRoute('./backend/routes/system/live-stats.js');
const bugReports = await loadRoute('./backend/routes/system/bug-reports.js');
const apiKeys = await loadRoute('./backend/routes/system/api-keys.js');
const backupNow = await loadRoute('./backend/routes/system/backupNow.js');
const alertConfig = await loadRoute('./backend/routes/system/alert-config.js');
const firebaseBackupTrigger = await loadRoute('./backend/routes/system/firebaseBackupTrigger.js');
const firebaseUploadLatest = await loadRoute('./backend/routes/system/firebaseUploadLatest.js');
const guardianStatus = await loadRoute('./backend/routes/system/guardianStatus.js');
const versionLog = await loadRoute('./backend/routes/system/version-log.js');
const version = await loadRoute('./backend/routes/system/version.js');
const incidents = await loadRoute('./backend/routes/system/incidents.js');
const emergencyUnlock = await loadRoute('./backend/routes/system/emergencyUnlock.js');
const viewLogs = await loadRoute('./backend/routes/system/viewLogs.js');
const aiLogs = await loadRoute('./backend/routes/system/aiLogs.js');
const aiQueue = await loadRoute('./backend/routes/system/ai-queue.js');
const askKiranos = await loadRoute('./backend/routes/system/ask-kiranos.js');
const lockdownStatus = await loadRoute('./backend/routes/system/lockdown-status.js');
const settingsLoad = await loadRoute('./backend/routes/system/settings-load.js');
const sentinelCheck = await loadRoute('./backend/routes/system/sentinel-check.js');
const secureData = await loadRoute('./backend/routes/system/secure-data.js');
const threatStatus = await loadRoute('./backend/routes/system/threat-status.js');
const systemStatus = await loadRoute('./backend/routes/system/status.js');
const logs = await loadRoute('./backend/routes/system/logs.js');

// Main domain routes
const settings = await loadRoute('./backend/routes/settings.js');
const ai = await loadRoute('./backend/routes/ai.js');
const news = await loadRoute('./backend/routes/news.js');
const polls = await loadRoute('./backend/routes/polls.js');
const recommendFeed = await loadRoute('./backend/routes/recommendFeed.js');
const newsTicker = await loadRoute('./backend/routes/newsTicker.js');
const aiRanker = await loadRoute('./backend/routes/ai-ranker.js');
const aiHeadlineSuggest = await loadRoute('./backend/routes/ai-headline-suggest.js');
const pushAlerts = await loadRoute('./backend/routes/push-alerts.js');
const pushPreview = await loadRoute('./backend/routes/pushPreview.js');
const alertsHistory = await loadRoute('./backend/routes/alerts/history.js');
const alertsSettings = await loadRoute('./backend/routes/alerts/settings.js');
const pushHistory = await loadRoute('./backend/routes/system/push-history.js');
const adminUpdateRole = await loadRoute('./backend/routes/admin/updateRole.js');
const adminAuth = await loadRoute('./backend/routes/admin/auth.js');
const liveRoutes = await loadRoute('./backend/routes/live/index.js');
const droneTV = await loadRoute('./backend/routes/video/droneTV.js');
const insertDroneTV = await loadRoute('./backend/routes/video/insertDroneTV.js');
const founder = await loadRoute('./backend/routes/founder.js');
const geoLookup = await loadRoute('./backend/routes/location/geoLookup.js');
const vaultUpload = await loadRoute('./backend/routes/vault/upload.js');
const vaultDelete = await loadRoute('./backend/routes/vault/delete.js');
const vaultList = await loadRoute('./backend/routes/vault/list.js');
const aiBehaviorLog = await loadRoute('./backend/routes/safezone/aiBehaviorLog.js');
const systemAiBehaviorLog = await loadRoute('./backend/routes/system/aiBehaviorLog.js');
const aiActivityLog = await loadRoute('./backend/routes/safezone/aiActivityLog.js');
const adminChatLogs = await loadRoute('./backend/routes/logs/adminChatLogs.js');
const adminChatAudit = await loadRoute('./backend/routes/admin/adminChatAudit.js');
const kiranosRoutes = await loadRoute('./backend/routes/kiranos.js');
// Compliance (PTI) simple evaluator route
const complianceRoute = await loadRoute('./backend/routes/compliance.js');

// Security routes (Zero-Trust)
const auditTrailRoute = await loadRoute('./backend/routes/security/audit-trail.js');
const sessionsRoute = await loadRoute('./backend/routes/security/sessions.js');
const rbacRoute = await loadRoute('./backend/routes/security/rbac.js');
const webauthnRoute = await loadRoute('./backend/routes/security/webauthn.js');
const rateLimitingRoute = await loadRoute('./backend/routes/security/rate-limiting.js');

// Advanced feature routes
const webStoriesRoute = await loadRoute('./backend/routes/stories/web-stories.js');
const commentModRoute = await loadRoute('./backend/routes/moderation/comments.js');
const seoToolsRoute = await loadRoute('./backend/routes/seo/tools.js');

// Alias bundle/index
const backendIndex = await loadRoute('./backend/index.js');
// Assist suggestions (headline/slug/summary)
const assistRoute = await loadRoute('./backend/routes/assist.js');

// ====== Route Mounts ======
app.use('/api/system/ai-command', aiCommandRoute);
app.use('/api/system/ai-diagnostics', aiDiagnosticsRoutes);
app.use('/api/system/clear-command-logs', clearCommandLogs);
app.use('/api/system/kiranos-command', kiranosCommandRoute);
app.use('/api/system/thinking-feed', thinkingFeedRoute);
app.use('/api/system/ai-training-info', aiTrainingInfo);
app.use('/api/system/bug-alert', bugAlertRoute);
app.use('/api/system/emergency-lock', emergencyLockRoute);
app.use('/api/system/integrity-scan', integrityScanRoute);
app.use('/api/system/region-heatmap', regionHeatmapRoute);
app.use('/api/system/uptime-monitor', uptimeMonitorRoute);
app.use('/api/system/monitor-hub', monitorHubRoute);
app.use('/api/dashboard-threat-stats', dashboardThreatStats);
app.use('/api/articles', articles);
app.use('/api/uploads', uploads);
app.use('/api/firebase', firebase);
app.use('/api/system', system);
app.use('/api/polls/live-stats', liveStats);
app.use('/api/system/bug-reports', bugReports);
app.use('/api/system/api-keys', apiKeys);
app.use('/api/system/backup-now', backupNow);
app.use('/api/system/alert-config', alertConfig);
app.use('/api/system/firebase-backup-trigger', firebaseBackupTrigger);
app.use('/api/system/firebase-upload-latest', firebaseUploadLatest);
app.use('/api/system/guardian-status', guardianStatus);
app.use('/api/system/version-log', versionLog);
app.use('/api/system/version', version);
app.use('/api/system/incidents', incidents);
app.use('/api/system/emergency-unlock', emergencyUnlock);
app.use('/api/system/view-logs', viewLogs);
app.use('/api/system/ai-logs', aiLogs);
app.use('/api/system/ai-queue', aiQueue);
app.use('/api/system/ask-kiranos', askKiranos);
app.use('/api/system/lockdown-status', lockdownStatus);
app.use('/api/system/settings-load', settingsLoad);
app.use('/api/system/sentinel-check', sentinelCheck);
app.use('/api/system/secure-data', secureData);
app.use('/api/system/threat-status', threatStatus);
app.use('/api/system/status', systemStatus);
// Alias to support existing UI components requesting /api/system/health
app.use('/api/system/health', systemStatus);
app.use('/api/dashboard/threat-stats', dashboardThreatStats);
app.use('/api/system/logs', logs);
// Live content (Inspiration Hub / Live TV)
app.use('/api/live-content', liveContentRoute);
// PTI compliance check
app.use('/api/compliance', complianceRoute);

app.use('/api/settings', settings);
app.use('/api/ai', ai);
app.use('/api/news', news);
app.use('/api/polls/live-poll-stats', livePollStatsRoute);
app.use('/api/polls', polls);
app.use('/api/dashboard-stats', dashboardStats);
// Legacy alias for older code requesting /api/stats
app.use('/api/stats', dashboardStats);
app.use('/api/reports', exportReportRoute);
app.use('/api/revenue', revenueRoutes);
// Mount assist route
app.use('/api/assist', assistRoute);

app.use('/api/news/get-all-news', await import('./backend/routes/news/getAllNews.js').then(m=>m.default));
app.use('/api/news/publish-story', await import('./backend/routes/news/publishStory.js').then(m=>m.default));
app.use('/api/recommend-feed', recommendFeed);
app.use('/api/news-ticker', newsTicker);
app.use('/api/ai/ranker', aiRanker);
app.use('/api/ai/headline-suggest', aiHeadlineSuggest);
app.use('/api/push-alerts', pushAlerts);
app.use('/api/push-preview', pushPreview);
app.use('/api/alerts/history', alertsHistory);
app.use('/api/alerts', alertsSettings);
app.use('/api/push-history', pushHistory);
app.use('/api/admin/update-role', adminUpdateRole);
// Canonicalize admin auth mount: remove legacy '/api/admin/auth' shadow path
// All routes inside adminAuth (e.g. router.post('/login')) now resolve to
//   POST /api/admin/login
// Legacy frontend fallbacks to /api/admin/auth/login should be removed after deploy.
app.use('/api/admin', adminAuth);
app.use('/api/live', liveRoutes);
app.use('/api/youtube/drone-tv', droneTV);
app.use('/api/drone/insert', insertDroneTV);
app.use('/api/founder', founder);
app.use('/api/location/geo-lookup', geoLookup);
app.use('/api/vault/upload', vaultUpload);
app.use('/api/vault/delete', vaultDelete);
// Fix mount so GET /api/vault/list hits router's '/list'
app.use('/api/vault', vaultList);

// ====== Media Library Stubs (AI alt-text, EXIF scrub, signed URLs) ======

// In-memory media store for stubs
const mediaStore = [
  {
    id: 'm1',
    url: 'https://picsum.photos/seed/np-1/1200/800',
    filename: 'sample-1.jpg',
    width: 1200,
    height: 800,
    size: 221000,
    rights: 'editorial',
    aiAltText: 'Random landscape photo'
  },
  {
    id: 'm2',
    url: 'https://picsum.photos/seed/np-2/1080/720',
    filename: 'sample-2.jpg',
    width: 1080,
    height: 720,
    size: 198000,
    rights: 'editorial',
    aiAltText: 'City skyline at dusk'
  }
];

// POST: AI alt-text generation (OpenAI Vision w/ fallback)
app.post('/api/ai/alt-text', async (req, res) => {
  try {
    const { url, filename = '', hint = '' } = req.body || {};
    if (!url) return res.status(400).json({ success: false, error: 'Image URL is required' });

  const visionModel = MODEL || 'gpt-4o-mini';
    let prompt = 'Generate a descriptive, accessible ALT text for this image. Focus on key visual elements, people, actions, and context relevant to journalism.';
    if (hint) prompt += ` Context hint: ${hint}`;
    if (filename) prompt += ` Filename: ${filename}`;

    const response = await openai.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url, detail: 'low' } }
          ]
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    });

    const alt = response.choices[0]?.message?.content?.trim() || 'AI-generated alt text unavailable';
    const confidence = response.choices[0]?.finish_reason === 'stop' ? 0.92 : 0.75;

    res.json({ success: true, alt, confidence, url, model: visionModel, tokens: response.usage?.total_tokens || 0 });
  } catch (error) {
    console.error('❌ [OpenAI Vision Error]:', error.message);
    const { filename = '', hint = '' } = req.body || {};
    const base = (filename || '').replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim();
    const fallbackAlt = hint?.trim() || (base ? `Photo of ${base}` : 'News related image');
    res.json({ success: true, alt: fallbackAlt, confidence: 0.45, url: req.body?.url, fallback: true, error: error.message });
  }
});

// POST: EXIF scrubbing (stub)
app.post('/api/uploads/scrub-exif', (req, res) => {
  const { url } = req.body || {};
  res.json({ success: true, message: 'EXIF removed (stub)', url });
});

// GET: signed URL generation (stub)
app.get('/api/uploads/signed-url', (req, res) => {
  const { filename = 'upload.jpg' } = req.query;
  const signed = `https://uploads.example.test/${encodeURIComponent(filename)}?sig=${crypto.randomBytes(6).toString('hex')}&exp=${Date.now() + 5 * 60 * 1000}`;
  res.json({ success: true, url: signed });
});

// ====== Security Routes (Zero-Trust) ======
app.use('/api/security/audit', auditTrailRoute);
app.use('/api/security/sessions', sessionsRoute);
app.use('/api/security/rbac', rbacRoute);
app.use('/api/security/webauthn', webauthnRoute);
app.use('/api/security/rate-limit', rateLimitingRoute);

// ====== Advanced Features ======
// Web Stories, Moderation, SEO: support both /api/* and root mounts for dev callers
app.use('/api/web-stories', webStoriesRoute);
app.use('/web-stories', webStoriesRoute);
app.use('/api/moderation/comments', commentModRoute);
app.use('/moderation/comments', commentModRoute);
app.use('/api/seo', seoToolsRoute);
app.use('/seo', seoToolsRoute);

// ====== Analytics & Monetization Stubs ======

// GET: Revenue analytics
app.get('/api/analytics/revenue', (req, res) => {
  res.json({ total: 48320.5, today: 1420.8, week: 9850.2, month: 48320.5, rpm: 12.4, ctr: 2.3 });
});

// GET: Traffic analytics
app.get('/api/analytics/traffic', (req, res) => {
  res.json({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    pageViews: [12500, 14200, 13800, 15600, 17200, 19400, 18900],
    uniqueVisitors: [8200, 9100, 8900, 10200, 11500, 12800, 12400],
  });
});

// GET: Ad performance
app.get('/api/analytics/ad-performance', (req, res) => {
  res.json({ impressions: 1245000, clicks: 28635, revenue: 15420.8, ctr: 2.3, rpm: 12.38 });
});

// GET: A/B tests
app.get('/api/analytics/ab-tests', (req, res) => {
  res.json({
    tests: [
      { id: 't1', name: 'Homepage Headline', variantA: 'Breaking News Today', variantB: 'Latest Updates', conversionsA: 340, conversionsB: 412, winner: 'B' },
      { id: 't2', name: 'CTA Button Color', variantA: 'Blue', variantB: 'Orange', conversionsA: 280, conversionsB: 275, winner: null },
    ],
  });
});

// Mirror analytics at root for callers using BASE=http://localhost:5000
app.get('/analytics/revenue', (req, res) => {
  res.redirect(307, '/api/analytics/revenue');
});
app.get('/analytics/traffic', (req, res) => {
  res.redirect(307, '/api/analytics/traffic');
});
app.get('/analytics/ad-performance', (req, res) => {
  res.redirect(307, '/api/analytics/ad-performance');
});
app.get('/analytics/ab-tests', (req, res) => {
  res.redirect(307, '/api/analytics/ab-tests');
});

app.use('/api/ai-behavior-log', aiBehaviorLog);
app.use('/api/system/ai-behavior-log', systemAiBehaviorLog);
app.use('/api/ai-activity-log', aiActivityLog);
app.use('/api/logs/admin-chat-logs', adminChatLogs);
app.use('/api/admin-chat-audit', adminChatAudit);
app.use('/api/kiranos', kiranosRoutes);

// Alias for /api/stats to satisfy frontend calls
app.use('/api/stats', dashboardStats);

// Bundle index (keep at end)
app.use(backendIndex);

// ====== Health & Utility Endpoints ======
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Backend is running 🚀' });
});

// Weekly insights (mongo if available, else fallback)
app.get('/api/insights/weekly', async (_req, res) => {
  const connected = mongoose.connection?.readyState === 1;
  let News = null;
  try { News = (await import('./backend/models/News.js')).default; } catch {}
  if (connected && News) {
    try {
      const aWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const suggestedStories = await News.countDocuments({ createdAt: { $gte: aWeekAgo } });
      const top = await News.find({ createdAt: { $gte: aWeekAgo } }).sort({ reads: -1 }).limit(1).lean();
      const t = top[0] || { title: 'No stories yet', reads: 0, engagement: 0 };
      return res.json({ summary: { suggestedStories, window: 'last_week' },
        top: { title: t.title, reads: t.reads || 0, engagement: t.engagement || 0 }, ok: true, source: 'mongo' });
    } catch (e) { console.warn('⚠️ /api/insights/weekly mongo query failed:', e.message); }
  }
  return res.json({ summary: { suggestedStories: 82, window: 'last_week' },
    top: { title: 'India’s Tech Leap in 2025', reads: 21000, engagement: 97 }, ok: true, source: 'fallback' });
});

// Traffic chart (mongo or fallback)
app.get('/api/charts/traffic', async (_req, res) => {
  const connected = mongoose.connection?.readyState === 1;
  let News = null;
  try { News = (await import('./backend/models/News.js')).default; } catch {}
  if (connected && News) {
    try {
      const eightWeeksAgo = new Date(Date.now() - 8 * 7 * 24 * 60 * 60 * 1000);
      const agg = await News.aggregate([
        { $match: { createdAt: { $gte: eightWeeksAgo } } },
        { $group: { _id: { $isoWeek: '$createdAt', year: { $isoWeekYear: '$createdAt' } }, visits: { $sum: '$reads' } } },
        { $sort: { '_id.year': 1, '_id.isoWeek': 1 } }
      ]);
      const series = agg.map(a => ({ label: `${a._id.year}-W${a._id.isoWeek || ''}`, visits: a.visits }));
      return res.json({ series, ok: true, source: 'mongo' });
    } catch (e) { console.warn('⚠️ /api/charts/traffic mongo query failed:', e.message); }
  }
  const now = new Date();
  const series = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now); d.setDate(now.getDate() - (7 * (7 - i)));
    return { label: d.toISOString().slice(0, 10), visits: 300 + i * 70 };
  });
  return res.json({ series, ok: true, source: 'fallback' });
});

// Lightweight monitor hub
app.get('/api/monitor-hub', (_req, res) => {
  res.json({
    activeUsers: realTimeUserCount,
    mobilePercent: 65,
    avgSession: '3m 22s',
    newsApi: 99.8, weatherApi: 96.5, twitterApi: 78.1,
    loginAttempts: 12, autoPatches: 5,
    topRegions: ['Gujarat', 'Delhi', 'Mumbai'],
    aiTools: ['HeadlineRanker', 'TrustMeter', 'SummaryBot'],
    ptiScore: 97.4, flags: 2
  });
});

app.post('/api/emergency-lockdown', (_req, res) => res.json({ success: true, message: 'System lockdown initialized.' }));
app.post('/api/reactivate-system', (_req, res) => res.json({ success: true, message: 'System reactivated successfully.' }));
app.post('/api/notify-down', (_req, res) => res.json({ sent: true }));

app.get('/api/ai-activity-log', (_req, res) =>
  res.json({ autoPublished: 12, flagged: 3, suggestedHeadlines: 8, lastTrustUpdate: '3:40 AM' })
);

app.get('/api/live-feed-config', async (_req, res) => {
  try {
    const configPath = path.join(__dirname, 'backend', 'config', 'liveFeeds.json');
    const data = await fs.readFile(configPath, 'utf8');
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('❌ Failed to read live feed config:', err.message);
    res.status(500).json({ error: 'Failed to read live feed config' });
  }
});

app.post('/api/save-live-feed', async (req, res) => {
  try {
    const configPath = path.join(__dirname, 'backend', 'config', 'liveFeeds.json');
    await fs.writeFile(configPath, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ success: true, message: 'Live feed config saved successfully.' });
  } catch (err) {
    console.error('❌ Failed to save live feed config:', err.message);
    res.status(500).json({ error: 'Failed to save live feed config' });
  }
});

app.get('/api/safezone/system-health', (_req, res) =>
  res.json({ mongodb: '🟢 OK', apiGateway: '🟢 OK', newsCrawler: '🟢 OK', voiceEngine: '🟢 OK',
    domain: process.env.SERVER_URL || 'https://newspulse.co.in' })
);

// Lightweight AI glow status used by AIGlowPanel (parity with server.mjs)
app.get('/api/ai-glow-status', (_req, res) => {
  res.json({
    systems: [
      { system: 'Generator', status: 'active' },
      { system: 'Summarizer', status: 'idle' },
      { system: 'Ranker', status: 'active' },
      { system: 'Translator', status: 'idle' },
    ],
    ts: new Date().toISOString()
  });
});

app.get('/', (_req, res) => res.send('🟢 News Pulse Admin Backend is Live'));

app.get('/backups/latest.zip', async (_req, res) => {
  const filePath = path.join(__dirname, 'data', 'backup-latest.zip');
  try {
    await fs.access(filePath, fsSync.constants.F_OK);
    res.download(filePath, (err) => {
      if (err) {
        console.error('❌ Error downloading backup file:', err);
        if (!res.headersSent) res.status(500).send('Error downloading file.');
      }
    });
  } catch (err) {
    console.error('❌ Backup file not found or inaccessible:', err);
    res.status(404).send('Backup file not found.');
  }
});

// ====== Error Handlers ======
app.use((req, res) => res.status(404).json({ success: false, message: `🔍 Route not found: ${req.originalUrl}` }));
app.use((err, req, res, _next) => {
  console.error('🔥 ERROR on', req.originalUrl, err?.stack || err);
  res.status(500).json({ success: false, message: err?.message || 'Internal Server Error',
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined });
});

// ====== CRON JOBS ======
function handleCronOutput(label) {
  return (err, stdout, stderr) => {
    if (err) return console.error(`❌ ${label} Cron Error:`, err.message);
    if (stderr) console.warn(`⚠️ ${label} Cron stderr:\n${stderr}`);
    if (stdout) console.log(`📤 ${label} Cron Output:\n${stdout}`);
  };
}
function startScheduledJobs() {
  cron.schedule('0 7 * * *', () => exec('node scripts/generateDailyWonder.js', handleCronOutput('Wonder')));
  cron.schedule('1 7 * * *', () => exec('node scripts/generateDailyQuote.js', handleCronOutput('Quote')));
  cron.schedule('2 7 * * *', () => exec('node scripts/generateTodayHistory.js', handleCronOutput('History')));

  cron.schedule('3 7 * * *', async () => {
    try {
      const baseUrl = process.env.SERVER_URL || 'http://localhost:5000';
      const pollRes = await axios.post(`${baseUrl}/api/ai/poll-question`);
      if (pollRes.data?.question_en && pollRes.data?.options_en) {
        const saveRes = await axios.post(`${baseUrl}/api/polls/create`, {
          question: pollRes.data.question_en, options: pollRes.data.options_en,
        });
        console.log(saveRes.data?.success ? '✅ AI Poll Saved' : '⚠️ Poll saving failed');
      } else {
        console.warn('⚠️ AI Poll Cron: No valid question or options received from AI service.');
      }
    } catch (err) {
      console.error('❌ AI Poll Cron Error:', err.message);
    }
  });

  cron.schedule('*/30 * * * *', () => exec('node scripts/fetchDroneTV.js', handleCronOutput('DroneTV')));

  cron.schedule('0 21 * * 0', () => console.log('📣 Triggering viral recap alert...'));

  cron.schedule('*/30 * * * * *', async () => {
    try {
      const baseURL = process.env.SERVER_URL || 'http://localhost:5000';
      const res = await axios.get(`${baseURL}/api/system/threat-status`);
      const r = res.data;
      if (r.credentialsLeaked || r.ipReputationScore < 50) {
        console.log('🚨 [CRON] Threat Detected – Action Required!');
      } else {
        console.log(`✅ [CRON] Threat Check OK – ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      }
    } catch (err) {
      console.error('❌ [CRON] Threat Scanner Failed:', err.message);
    }
  });
}

// ====== Start
console.log('🟢 OpenAI Key Loaded:', process.env.OPENAI_API_KEY ? 'Yes' : 'No');

connectDB()
  .then(async () => {
    if (process.env.DB_DEGRADED === '1') {
      console.warn('⚠️ MongoDB unavailable — running in DEGRADED mode (skipping SystemSettings init)');
    } else {
      await SystemSettings.ensureInitialized();
      console.log('✅ SystemSettings checked/initialized');
    }

    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      startScheduledJobs();
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ====== Graceful Shutdown ======
function shutdown(sig) {
  console.log(`\n${sig} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    mongoose.connection.close(false, () => {
      console.log('Mongo connection closed.');
      process.exit(0);
    });
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));

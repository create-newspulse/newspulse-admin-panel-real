// admin-backend/server.mjs
// ✅ News Pulse Admin Backend – Main Server (ESM entry under CommonJS package)

export { };
import 'dotenv/config';
import dotenv from 'dotenv';
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
import { verifySmtp, isSmtpConfigured } from './backend/utils/mailer.mjs';

// ---- __dirname / __filename in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load either ESM or CommonJS route modules seamlessly
async function loadRoute(p) {
  const mod = await import(p);
  return (mod && Object.prototype.hasOwnProperty.call(mod, 'default')) ? mod.default : mod;
}

// Ensure we can read env from admin-backend/.env even if process.cwd() is repo root
if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
  const localEnv = path.join(__dirname, '.env');
  try {
    if (fsSync.existsSync(localEnv)) {
      dotenv.config({ path: localEnv });
      if (process.env.MONGO_URI || process.env.MONGODB_URI) {
        console.log('🔄 Loaded environment from admin-backend/.env');
      }
    }
  } catch {
    // ignore
  }
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

// Verify SMTP transport once at startup and log a clear status
(async () => {
  const res = await verifySmtp();
  if (res.ok) console.log('📨 SMTP:', res.message);
  else console.warn('⚠️ SMTP verification failed:', res.message);
})();

// ====== Database & Models ======
const connectDB = await loadRoute('./backend/db/connect.js');
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const SystemSettings = require('./backend/models/SystemSettings.js');
// Initialize Firebase Admin once (if FIREBASE_CREDENTIAL_PATH is set)
try { require('./backend/utils/firebaseAdmin.js'); } catch {}

// ====== OpenAI Client & Model (use CJS client for compatibility)
const openaiClient = require('./openaiClient.js');
// Allow fallback if an unsupported model is provided (e.g., placeholder "gpt-5")
let MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const SUPPORTED_MODELS = ['gpt-4o', 'gpt-4o-mini', 'o4-mini'];
const allowAny = process.env.ALLOW_ANY_OPENAI_MODEL === '1' || process.env.OPENAI_MODEL_STRICT === '0';
if (!SUPPORTED_MODELS.includes(MODEL)) {
  if (allowAny) {
    console.warn(`⚠️ OPENAI_MODEL "${MODEL}" not in supported list, but ALLOW_ANY_OPENAI_MODEL=1 so using it anyway.`);
  } else {
    console.warn(`⚠️ Unsupported OPENAI_MODEL "${MODEL}" – falling back to gpt-4o-mini (set ALLOW_ANY_OPENAI_MODEL=1 to bypass)`);
    MODEL = 'gpt-4o-mini';
  }
}
console.log('🧠 OpenAI config:', { key: !!process.env.OPENAI_API_KEY, model: MODEL, allowAny });

mongoose.connection.on('error', (err) => console.error('❌ MongoDB connection error:', err));
mongoose.connection.on('disconnected', () => console.error('❌ MongoDB disconnected!'));

// ====== Express & Server Setup ======
const app = express();
app.set('trust proxy', 1);

const server = http.createServer(app);

const isProd = process.env.NODE_ENV === 'production';
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];
// Support multiple production origins via ALLOWED_ORIGINS (comma-separated)
// Back-compat: also honor CLIENT_ORIGIN and CORS_ORIGIN if provided
const PROD_ORIGINS = (() => {
  const list = [];
  if (process.env.ALLOWED_ORIGINS) {
    list.push(...process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()).filter(Boolean));
  } else if (process.env.CLIENT_ORIGIN) {
    list.push(process.env.CLIENT_ORIGIN);
  }
  if (process.env.CORS_ORIGIN) list.push(process.env.CORS_ORIGIN);
  return Array.from(new Set(list));
})();
const ALLOWED_ORIGINS = isProd ? PROD_ORIGINS : DEV_ORIGINS;
// Additional automatic allow patterns (to reduce redeploy friction for new preview domains)
const AUTO_ALLOW_HOST_PATTERNS = [
  /newspulse-admin-panel-real-[a-z0-9-]+\.vercel\.app$/i, // Vercel preview deployments for this project
  /newspulse.*\.vercel\.app$/i,                          // broader newspulse Vercel previews
  /newspulse\.co\.in$/i                                  // production custom domain
];

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
    if (!origin) return cb(null, true); // same-origin / curl
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    try {
      const host = origin.replace(/^https?:\/\//, '').split('/')[0];
      if (AUTO_ALLOW_HOST_PATTERNS.some(re => re.test(host))) return cb(null, true);
    } catch {}
    if (!isProd) return cb(null, true); // allow all in dev
    console.warn('❌ CORS blocked origin:', origin, 'Allowed list:', ALLOWED_ORIGINS);
    return cb(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
// Allow moderately large JSON bodies from the admin UI (articles pasted for AI tools)
app.use(express.json({ limit: process.env.JSON_LIMIT || '10mb' }));
app.use(express.urlencoded({ extended: true }));
if (!isProd) app.use(morgan('dev'));
else {
  app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 100 }));
  app.use('/api/monitor-hub', rateLimit({ windowMs: 60 * 1000, max: 200 }));
}

// Convert body-parser 413 errors to friendly JSON
app.use((err, _req, res, next) => {
  if (!err) return next();
  if (err.type === 'entity.too.large' || err.statusCode === 413 || err.status === 413) {
    return res.status(413).json({
      ok: false,
      error: 'PAYLOAD_TOO_LARGE',
      message: 'Request body too large to parse. Try a smaller input or use AI Tools that auto-chunk.',
      hint: 'Increase JSON_LIMIT env (e.g., 10mb) if needed in your environment.'
    });
  }
  return next(err);
});

// ---- Lightweight health endpoints mounted EARLY (before other /api/system handlers)
const setHealthHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
};
app.get('/api/system/health', (_req, res) => {
  setHealthHeaders(res);
  res.status(200).json({ success: true, message: 'Backend is healthy ✅', ts: new Date().toISOString() });
});
app.head('/api/system/health', (_req, res) => { setHealthHeaders(res); res.sendStatus(200); });
app.get('/api/health', (_req, res) => {
  setHealthHeaders(res);
  res.status(200).json({ success: true, message: 'Backend is running 🚀', ts: new Date().toISOString() });
});
app.head('/api/health', (_req, res) => { setHealthHeaders(res); res.sendStatus(200); });
// Quick SMTP status check (safe for dev; avoids restart to see status)
app.get('/api/system/smtp-health', async (_req, res) => {
  try {
    const result = await verifySmtp();
    setHealthHeaders(res);
    res.status(result.ok ? 200 : 500).json({ ok: result.ok, message: result.message, configured: isSmtpConfigured() });
  } catch (err) {
    setHealthHeaders(res);
    res.status(500).json({ ok: false, message: err?.message || String(err), configured: isSmtpConfigured() });
  }
});
// Show effective SMTP config (sanitized, no password)
app.get('/api/system/smtp-config', (_req, res) => {
  setHealthHeaders(res);
  const host = process.env.SMTP_HOST || null;
  const port = Number(process.env.SMTP_PORT || 0);
  const secure = (String(process.env.SMTP_SECURE || '').toLowerCase() === 'true') || port === 465;
  const user = process.env.SMTP_USER || null;
  res.json({ configured: isSmtpConfigured(), host, port, secure, user, from: process.env.SMTP_FROM || process.env.EMAIL_FROM || null });
});
// Friendly API root to avoid "Cannot GET /api/" confusion
app.get('/api', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, message: 'NewsPulse Admin API root', health: '/api/system/health' });
});

// ====== Static Files ======
const UPLOADS_VAULT_PATH = path.join(__dirname, 'uploads', 'vault');
const COVERS_DIR = path.join(__dirname, 'uploads', 'covers');
const BULLETINS_DIR = path.join(__dirname, 'uploads', 'bulletins');
await fs.mkdir(UPLOADS_VAULT_PATH, { recursive: true });
await fs.mkdir(COVERS_DIR, { recursive: true });
await fs.mkdir(BULLETINS_DIR, { recursive: true });
app.use('/uploads/vault', express.static(UPLOADS_VAULT_PATH));
app.use('/uploads/covers', express.static(COVERS_DIR));
app.use('/uploads/bulletins', express.static(BULLETINS_DIR));

// ====== AI-specific rate limit and concurrency gate ======
const aiLimiter = rateLimit({
  // Keep a 60s window by default; allow override via env
  windowMs: Number(process.env.AI_RATE_WINDOW_MS || 60_000),
  // Raise default headroom to reduce accidental 429s from bursty clicks
  max: Number(process.env.AI_RATE_MAX_PER_IP || 300),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res /*, next */) => {
    res.setHeader('X-Rate-Limited-By', 'local-limiter');
    return res.status(429).json({
      ok: false,
      error: 'AI_RATE_LIMIT',
      message: 'Too many AI requests from this IP. Please wait a few seconds and try again.',
      windowMs: Number(process.env.AI_RATE_WINDOW_MS || 60_000),
      max: Number(process.env.AI_RATE_MAX_PER_IP || 300)
    });
  },
});

// Slightly higher concurrency and queue with a finite wait timeout
const MAX_AI_CONCURRENCY = Number(process.env.AI_CONCURRENCY || 6);
const MAX_AI_QUEUE = Number(process.env.AI_QUEUE_MAX || 8);
const AI_QUEUE_TIMEOUT_MS = Number(process.env.AI_QUEUE_TIMEOUT_MS || 20_000);
let aiActive = 0;
const aiWaitQueue = []; // [{ proceed, timer, res }]
function aiGate(_req, res, next) {
  const proceed = () => {
    aiActive++;
    res.on('finish', () => {
      aiActive = Math.max(0, aiActive - 1);
      // Pull next queued item (skipping any that already timed out)
      let item;
      while ((item = aiWaitQueue.shift())) {
        if (item && !item.timedOut) {
          clearTimeout(item.timer);
          return setImmediate(item.proceed);
        }
      }
    });
    next();
  };

  if (aiActive < MAX_AI_CONCURRENCY) return proceed();
  if (aiWaitQueue.length >= MAX_AI_QUEUE) {
    res.setHeader('X-Rate-Limited-By', 'queue');
    return res.status(429).json({ ok: false, error: 'AI_BUSY', message: 'AI is busy right now. Please try again in a moment.' });
  }
  const item = { proceed, res, timedOut: false, timer: null };
  item.timer = setTimeout(() => {
    // If still in queue after timeout, mark and respond 429
    item.timedOut = true;
    try {
      res.setHeader('X-Rate-Limited-By', 'queue-timeout');
      res.status(429).json({ ok: false, error: 'AI_BUSY', message: 'AI queue wait exceeded. Please retry shortly.' });
    } catch {}
  }, AI_QUEUE_TIMEOUT_MS).unref?.();
  aiWaitQueue.push(item);
}

// ====== DB-degraded fallbacks (avoid 10s mongoose timeouts in dev) ======
// These light guards short-circuit common system routes when Mongo isn't connected.
// If DB becomes available, we pass through to the real handlers via next().
const isDbReady = () => (mongoose.connection && mongoose.connection.readyState === 1);

app.get('/api/system/thinking-feed', (req, res, next) => {
  if (isDbReady()) return next();
  res.json({ success: true, items: [], degraded: true });
});

app.get('/api/system/ai-queue', (req, res, next) => {
  if (isDbReady()) return next();
  res.json({ success: true, queue: [], degraded: true });
});

app.get('/api/system/monitor-hub', (req, res, next) => {
  if (isDbReady()) return next();
  res.json({
    success: true,
    degraded: true,
    activeUsers: 0,
    mobilePercent: 62,
    avgSession: '3m 05s',
    newsApi: 98.5, weatherApi: 96.2, twitterApi: 80.1,
    loginAttempts: 4, autoPatches: 1,
    topRegions: ['Gujarat', 'Delhi', 'Mumbai'],
    aiTools: ['HeadlineRanker', 'SummaryBot'],
    ptiScore: 96.8, flags: 1,
  });
});

app.get('/api/ai-behavior-log', (req, res, next) => {
  if (isDbReady()) return next();
  res.json({
    success: true,
    degraded: true,
    autoPublished: 0,
    flagged: 0,
    suggestedHeadlines: 0,
    lastTrustUpdate: new Date().toISOString(),
  });
});

// ====== Route Imports (compat with CJS/ESM via loadRoute)
const dashboardStats = await loadRoute('./backend/routes/dashboard-stats.js');
const revenueRoutes = await loadRoute('./backend/routes/revenue.js');
const exportReportRoute = await loadRoute('./backend/routes/reports/export.js');
const dashboardThreatStats = await loadRoute('./backend/routes/dashboard-threat-stats.js');
const livePollStatsRoute = await loadRoute('./backend/routes/polls/livePollStats.js');
const liveContentRoute = await loadRoute('./backend/routes/system/live-content.mjs');
const liveRoute = await loadRoute('./backend/routes/live/index.mjs');

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
const aiToolsRoute = await loadRoute('./backend/routes/ai-tools.js');

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
const aiEngineRoute = await loadRoute('./backend/routes/ai-engine.js');
const airaRoute = await loadRoute('./backend/routes/aira.js');
const news = await loadRoute('./backend/routes/news.js');
const newsWorkflow = await loadRoute('./backend/routes/news/workflow.js');
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
const adminUpdateRole = await loadRoute('./backend/routes/admin/updateRole.mjs');
// Use the full DB-backed auth router (email+password with JWT)
const adminAuth = await loadRoute('./backend/routes/admin/auth.mjs');
const adminMagicAuth = await loadRoute('./backend/routes/admin/magic-auth.mjs');
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
const adminChatLogs = await loadRoute('./backend/routes/logs/adminChatLogs.mjs');
const adminChatAudit = await loadRoute('./backend/routes/admin/adminChatAudit.mjs');
const kiranosRoutes = await loadRoute('./backend/routes/kiranos.js');

// Security routes (Zero-Trust)
const auditTrailRoute = await loadRoute('./backend/routes/security/audit-trail.mjs');
const sessionsRoute = await loadRoute('./backend/routes/security/sessions.mjs');
const rbacRoute = await loadRoute('./backend/routes/security/rbac.mjs');
const webauthnRoute = await loadRoute('./backend/routes/security/webauthn.mjs');
const rateLimitingRoute = await loadRoute('./backend/routes/security/rate-limiting.mjs');

// Advanced feature routes
const webStoriesRoute = await loadRoute('./backend/routes/stories/web-stories.mjs');
const commentModRoute = await loadRoute('./backend/routes/moderation/comments.mjs');
const seoToolsRoute = await loadRoute('./backend/routes/seo/tools.mjs');
// Auth: password reset via OTP (simple in-memory store)
const passwordResetRoute = await loadRoute('./backend/routes/auth/password.mjs');

// (legacy bundle/index not used to avoid mixed module issues)

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
app.use('/api/system/ask-kiranos', aiLimiter, aiGate, askKiranos);
app.use('/api/system/lockdown-status', lockdownStatus);
app.use('/api/system/settings-load', settingsLoad);
app.use('/api/system/sentinel-check', sentinelCheck);
app.use('/api/system/secure-data', secureData);
app.use('/api/system/threat-status', threatStatus);
app.use('/api/system/status', systemStatus);
// Alias: some frontend builds still call /api/system/health
app.use('/api/system/health', systemStatus);
app.use('/api/dashboard/threat-stats', dashboardThreatStats);
app.use('/api/system/logs', logs);
// Live content (Inspiration Hub / Live TV)
app.use('/api/live-content', liveContentRoute);
app.use('/api/live', liveRoute);

app.use('/api/settings', settings);
app.use('/api/ai/tools', aiLimiter, aiGate, aiToolsRoute); // helper wrappers
app.use('/api/ai', aiLimiter, aiGate, ai);
app.use('/api/ai-engine', aiLimiter, aiGate, aiEngineRoute);
app.use('/api/aira', airaRoute);
app.use('/api/news', news);
app.use('/api/news', newsWorkflow);
app.use('/api/polls/live-poll-stats', livePollStatsRoute);
app.use('/api/polls', polls);
app.use('/api/dashboard-stats', dashboardStats);
// Alias for legacy frontend calls expecting /api/stats
app.use('/api/stats', dashboardStats);
app.use('/api/reports', exportReportRoute);
app.use('/api/revenue', revenueRoutes);

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
// Auth password reset (OTP)
app.use('/api/auth/password', passwordResetRoute);
// Mount auth router under both prefixes for compatibility with existing frontend calls
app.use('/api/admin/auth', adminAuth);
app.use('/api/admin', adminAuth); // provides /api/admin/login as alias
// Compatibility layer for SPA auth checks
app.use('/api/admin-auth', adminMagicAuth);
// SafeZone activity endpoints used by panels
app.use('/api/ai-activity-log', aiActivityLog);
app.use('/api/ai-behavior-log', aiBehaviorLog);
app.use('/api/system/ai-behavior-log', systemAiBehaviorLog);
// Admin chat audit endpoints
app.use('/api/admin-chat-audit', adminChatAudit); // GET /api/admin-chat-audit
app.use('/api/logs', adminChatLogs);              // GET /api/logs/admin-chat-audit
// KiranOS Command Center API (ask/speak)
app.use('/api/kiranos', kiranosRoutes);
app.use('/api/youtube/drone-tv', droneTV);
app.use('/api/drone/insert', insertDroneTV);
app.use('/api/founder', founder);
app.use('/api/location/geo-lookup', geoLookup);
app.use('/api/vault/upload', vaultUpload);
app.use('/api/vault/delete', vaultDelete);
app.use('/api/vault', vaultList);

// ====== Core AI endpoints (GPT-5 Auto)
// Shared retry helper for upstream 429/RateLimit errors
async function retryWithBackoff(fn, {
  retries = Number(process.env.AI_MAX_RETRIES || 4),
  baseMs = Number(process.env.AI_RETRY_BASE_MS || 500),
  maxMs = Number(process.env.AI_RETRY_MAX_MS || 6000),
  factor = 2,
  jitter = true,
} = {}) {
  let attempt = 0;
  let lastErr;
  while (attempt <= retries) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err?.message || '';
      const status = err?.status || err?.statusCode || err?.response?.status;
      const isRate = status === 429 || /rate limit|quota|too many requests/i.test(msg);
      const isRetryable = isRate || status === 408 || status === 500 || status === 502 || status === 503 || status === 504;
      if (!isRetryable || attempt === retries) break;
      const delay = Math.min(maxMs, baseMs * Math.pow(factor, attempt));
      const sleep = jitter ? Math.round(delay * (0.5 + Math.random())) : delay;
      await new Promise(r => setTimeout(r, sleep));
      attempt++;
    }
  }
  throw lastErr;
}

// Health for AI configuration
app.get('/api/system/ai-health', (_req, res) => {
  res.json({ ok: true, model: MODEL, keyLoaded: !!process.env.OPENAI_API_KEY, ts: new Date().toISOString() });
});

// Non-streaming chat core
app.post('/api/ai/chat-core', async (req, res) => {
  try {
    const key = process.env.OPENAI_API_KEY || '';
    if (!key || /REPLACE|changeme|placeholder/i.test(key)) {
      return res.status(401).json({ ok: false, error: 'AI_AUTH', detail: 'OpenAI API key not configured. Set OPENAI_API_KEY and redeploy.' });
    }
    const {
      messages = [],
      temperature = 0.6,
      max_tokens = 700,
      system = 'You are KiranOS, the NewsPulse AI. Stay PTI-compliant and concise.'
    } = req.body || {};
    const fullMessages = [{ role: 'system', content: system }, ...messages];

    // Clamp oversized conversations to avoid upstream provider 413/parse failures
    const MAX_INPUT_CHARS = Number(process.env.AI_TOOLS_MAX_INPUT_CHARS || 24000);
    const sizeOf = (msgs) => msgs.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content || '').length), 0);
    let trimmed = fullMessages.slice();
    while (sizeOf(trimmed) > MAX_INPUT_CHARS && trimmed.length > 2) {
      // remove oldest non-system message first
      trimmed.splice(1, 1);
    }
    if (sizeOf(trimmed) > MAX_INPUT_CHARS) {
      const last = trimmed[trimmed.length - 1];
      const allowed = Math.max(0, MAX_INPUT_CHARS - sizeOf(trimmed.slice(0, -1)) - 100);
      if (typeof last.content === 'string') {
        last.content = last.content.slice(-allowed);
      }
    }

    const completion = await retryWithBackoff(() => openaiClient.chat.completions.create({
      model: MODEL,
      messages: trimmed,
      temperature,
      max_tokens,
    }));

    res.json({
      ok: true,
      model: completion.model,
      content: completion.choices?.[0]?.message?.content || '',
      usage: completion.usage || null,
    });
  } catch (err) {
    console.error('❌ /api/ai/chat-core error:', err);
    const msg = err?.message || String(err);
    const isAuth = /incorrect api key|401|invalid_api_key/i.test(msg);
    const isRate = /rate limit|quota|429/i.test(msg) || err?.status === 429;
    res.status(isAuth ? 401 : isRate ? 429 : 500).json({ ok: false, error: isAuth ? 'AI_AUTH' : isRate ? 'AI_RATE_LIMIT' : 'AI_ERROR', detail: msg });
  }
});

// Streaming chat core via Server-Sent Events
app.post('/api/ai/stream-core', async (req, res) => {
  try {
    const key = process.env.OPENAI_API_KEY || '';
    if (!key || /REPLACE|changeme|placeholder/i.test(key)) {
      return res.status(401).json({ ok: false, error: 'AI_AUTH', detail: 'OpenAI API key not configured. Set OPENAI_API_KEY and redeploy.' });
    }
    const { messages = [], temperature = 0.6 } = req.body || {};
    const fullMessages = [
      { role: 'system', content: 'You are KiranOS, the NewsPulse AI.' },
      ...messages,
    ];

    // Clamp oversized payloads before streaming to avoid provider 413s
    const MAX_INPUT_CHARS = Number(process.env.AI_TOOLS_MAX_INPUT_CHARS || 24000);
    const sizeOf = (msgs) => msgs.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content || '').length), 0);
    let trimmed = fullMessages.slice();
    while (sizeOf(trimmed) > MAX_INPUT_CHARS && trimmed.length > 2) {
      trimmed.splice(1, 1);
    }
    if (sizeOf(trimmed) > MAX_INPUT_CHARS) {
      const last = trimmed[trimmed.length - 1];
      const allowed = Math.max(0, MAX_INPUT_CHARS - sizeOf(trimmed.slice(0, -1)) - 100);
      if (typeof last.content === 'string') last.content = last.content.slice(-allowed);
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const stream = await retryWithBackoff(() => openaiClient.chat.completions.create({
      model: MODEL,
      messages: trimmed,
      temperature,
      stream: true,
    }));

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content || '';
      if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('❌ /api/ai/stream-core error:', err);
    const msg = err?.message || String(err);
    const isAuth = /incorrect api key|401|invalid_api_key/i.test(msg);
    const isRate = /rate limit|quota|429/i.test(msg) || err?.status === 429;
    try { res.write(`data: ${JSON.stringify({ error: isAuth ? 'AI_AUTH' : isRate ? 'AI_RATE_LIMIT' : 'AI_ERROR', detail: msg })}\n\n`); } catch {}
    try { res.end(); } catch {}
  }
});

// ====== Media Library Stubs (AI alt-text, EXIF scrub, signed URLs) ======
app.post('/api/ai/alt-text', async (req, res) => {
  try {
    const { url, filename = '', hint = '' } = req.body || {};
    if (!url) return res.status(400).json({ success: false, error: 'Image URL is required' });
    const { default: openaiClient } = await import('./ai/openaiClient.js');
    let prompt = 'Generate a descriptive, accessible alt text for this image. Focus on key visual elements, people, actions, and context relevant to news/journalism.';
    if (hint) prompt += ` Context hint: ${hint}`;
    if (filename) prompt += ` Filename: ${filename}`;
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url, detail: 'low' } }] }],
      max_tokens: 150, temperature: 0.7
    });
    const alt = response.choices[0]?.message?.content?.trim() || 'AI-generated alt text unavailable';
    const confidence = response.choices[0]?.finish_reason === 'stop' ? 0.92 : 0.75;
    res.json({ success: true, alt, confidence, url, model: 'gpt-4o-mini', tokens: response.usage?.total_tokens || 0 });
  } catch (error) {
    const { filename = '', hint = '' } = req.body || {};
    const base = (filename || '').replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim();
    const fallbackAlt = hint?.trim() || (base ? `Photo of ${base}` : 'News related image');
    res.json({ success: true, alt: fallbackAlt, confidence: 0.45, url: req.body.url, fallback: true, error: error.message });
  }
});

// ====== Security Routes (mounts already above) ======

// ====== Health & Utility Endpoints ======
// (moved early versions above to short-circuit heavy routers)
// Fallback root-level health (for external pingers)
app.get('/health', (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Access-Control-Allow-Origin', '*'); res.status(200).json({ ok: true, ts: new Date().toISOString() }); });
app.head('/health', (_req, res) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Access-Control-Allow-Origin', '*'); res.sendStatus(200); });
app.get('/api/system/alerts', (_req, res) => {
  res.json({ success: true, alerts: [] });
});
app.get('/api/system/ai-predictions', (_req, res) => {
  res.json({ success: true, predictions: [] });
});

// Dev/demo helpers so SafeOwnerZone action buttons don't 404
app.post('/api/system/force-critical', (_req, res) => {
  res.json({ success: true, message: 'Critical state triggered (demo)' });
});
app.post('/api/system/reset-health', (_req, res) => {
  res.json({ success: true, message: 'System health reset (demo)' });
});

// Additional Smart System endpoints (lightweight stubs)
app.get('/api/system/seo-health', (_req, res) => {
  res.json({
    success: true,
    seoScore: 82,
    pagesIndexed: 1240,
    sitemapStatus: 'ok',
    brokenLinks: 3,
    openGraphCoverage: 0.92,
  });
});
app.get('/api/system/queue-stats', (_req, res) => {
  res.json({
    success: true,
    publishQueue: 2,
    aiTaskQueue: 0,
    thumbnailsPending: 1,
  });
});
app.get('/api/system/email-auth', (_req, res) => {
  res.json({ success: true, spf: true, dkim: true, dmarc: false });
});

app.get('/', (_req, res) => res.send('🟢 News Pulse Admin Backend is Live'));

// Lightweight AI glow status used by AIGlowPanel
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

// ====== Error Handlers ======
app.use((req, res) => res.status(404).json({ success: false, message: `🔍 Route not found: ${req.originalUrl}` }));
app.use((err, req, res, _next) => {
  console.error('🔥 ERROR on', req.originalUrl, err?.stack || err);
  res.status(500).json({ success: false, message: err?.message || 'Internal Server Error', stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined });
});

// ====== Start
console.log('🟢 OpenAI Key Loaded:', process.env.OPENAI_API_KEY ? 'Yes' : 'No');
connectDB()
  .then(async (res) => {
    const degraded = res === false || process.env.DB_DEGRADED === '1';
    if (!degraded) {
      await SystemSettings.ensureInitialized();
      console.log('✅ SystemSettings checked/initialized');
    } else {
      console.warn('⚠️  Skipping SystemSettings init (DB degraded mode).');
    }

    // Resilient port binding: try PORT..PORT+3 to avoid dev collisions
    const base = Number(process.env.PORT) || 5000;
    const tryListen = (port, attemptsLeft) => {
      server.listen(port, '0.0.0.0')
        .once('listening', () => {
          process.env.PORT = String(port);
          console.log(`🚀 Server running at http://localhost:${port}`);
        })
        .once('error', (err) => {
          if (err && err.code === 'EADDRINUSE' && attemptsLeft > 0) {
            console.warn(`⚠️ Port ${port} in use, retrying on ${port + 1}...`);
            tryListen(port + 1, attemptsLeft - 1);
          } else {
            console.error('❌ Failed to bind port:', err?.message || err);
            process.exit(1);
          }
        });
    };
    tryListen(base, 3);
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
    mongoose.connection
      .close(false)
      .then(() => {
        console.log('Mongo connection closed.');
        process.exit(0);
      })
      .catch((err) => {
        console.error('Error closing Mongo connection:', err?.message || err);
        process.exit(1);
      });
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));

// ====== Simple audit trail middleware for mutating requests ======
import os from 'os';
const AUDIT_LOG = path.join(DATA_DIR, 'audit-trail.jsonl');
app.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const start = Date.now();
  const actor = (req.user?.email) || (req.headers['x-actor'] ?? 'anonymous');
  res.on('finish', () => {
    const entry = {
      ts: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
      actor,
      ip: req.ip,
    };
    fs.appendFile(AUDIT_LOG, JSON.stringify(entry) + os.EOL).catch(() => {});
  });
  next();
});

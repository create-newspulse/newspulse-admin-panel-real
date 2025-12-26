// 🚀 NewsPulse Admin - Demo Server (Advanced Features Only)
// Minimal Express server with ONLY the new features (all ESM, no legacy code)

import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import multer from 'multer';

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Demo media upload (in-memory)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Middleware
const DEV_ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'https://admin.newspulse.co.in',
  'https://newspulse.co.in',
];
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (DEV_ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Demo Auth (minimal) =====
// The admin frontend expects these endpoints:
// - POST /api/admin/login -> { ok:true, token, user }
// - GET  /api/admin/me    -> { ok:true, user }
// This demo server uses an in-memory token map.

/** @type {Map<string, any>} */
const DEMO_SESSIONS = new Map();

function parseCookieHeader(header) {
  const out = {};
  if (!header || typeof header !== 'string') return out;
  const parts = header.split(';');
  for (const p of parts) {
    const idx = p.indexOf('=');
    if (idx <= 0) continue;
    const k = p.slice(0, idx).trim();
    const v = p.slice(idx + 1).trim();
    if (!k) continue;
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function extractToken(req) {
  const auth = req.headers?.authorization;
  if (typeof auth === 'string' && auth.trim()) {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m && m[1]) return m[1].trim();
    return auth.trim();
  }
  const cookies = parseCookieHeader(req.headers?.cookie);
  const c = cookies.np_admin || cookies.np_admin_token || cookies.np_token;
  if (typeof c === 'string' && c.trim()) return c.trim();
  return null;
}

function makeDemoUser(email) {
  const role = (process.env.DEMO_ADMIN_ROLE || 'founder').toString().trim() || 'founder';
  const name = (process.env.DEMO_ADMIN_NAME || 'Demo Admin').toString().trim() || 'Demo Admin';
  return {
    id: crypto.randomUUID(),
    _id: crypto.randomUUID(),
    email,
    name,
    role,
  };
}

app.post('/api/admin/login', (req, res) => {
  const body = req.body || {};
  const email = String(body.email || '').trim();
  const password = String(body.password || '').trim();
  if (!email || !password) {
    return res.status(400).json({ ok: false, message: 'email and password are required' });
  }

  // Optional hard check: set DEMO_ADMIN_PASSWORD to enforce a local password.
  const requiredPassword = (process.env.DEMO_ADMIN_PASSWORD || '').toString();
  if (requiredPassword && password !== requiredPassword) {
    return res.status(401).json({ ok: false, message: 'Invalid email or password' });
  }

  const user = makeDemoUser(email);
  const token = crypto.randomBytes(24).toString('hex');
  DEMO_SESSIONS.set(token, { user, createdAt: Date.now() });

  // Also set a cookie so /me works even if the client relies on withCredentials.
  try {
    res.cookie('np_admin', token, { httpOnly: true, sameSite: 'lax', secure: false, path: '/' });
  } catch {}

  return res.status(200).json({ ok: true, token, user });
});

app.get('/api/admin/me', (req, res) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ ok: false, message: 'Unauthorized' });

  const sess = DEMO_SESSIONS.get(token);
  if (!sess || !sess.user) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  return res.status(200).json({ ok: true, user: sess.user });
});

app.post('/api/admin/logout', (req, res) => {
  const token = extractToken(req);
  if (token) DEMO_SESSIONS.delete(token);
  try {
    res.clearCookie('np_admin', { path: '/' });
  } catch {}
  return res.status(200).json({ ok: true });
});

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ===== Admin Settings (demo storage) =====
const DEFAULT_SETTINGS = {
  ui: {
    showExploreCategories: true,
    showCategoryStrip: true,
    showTrendingStrip: true,
    showLiveUpdatesTicker: false,
    showBreakingTicker: false,
    showQuickTools: true,
    showAppPromo: false,
    showFooter: true,
    theme: 'system',
    density: 'comfortable',
  },
  navigation: { enableTopNav: true, enableSidebar: true, enableBreadcrumbs: true },
  publishing: { autoPublishApproved: false, reviewWorkflow: 'basic', defaultVisibility: 'public' },
  ai: { editorialAssistant: false, autoSummaries: false, contentTagging: true, model: 'gpt' },
  voice: { ttsEnabled: false, ttsVoice: 'female_en', rtlEnabled: false, languages: ['en'] },
  community: { reporterPortalEnabled: true, commentsEnabled: true, moderationLevel: 'moderated' },
  monetization: { adsEnabled: false, sponsorBlocks: false, membershipEnabled: false },
  integrations: { analyticsEnabled: true, analyticsProvider: 'ga4', newsletterProvider: 'none' },
  security: { lockdown: false, twoFactorRequired: false, allowedHosts: [] },
  backups: { enabled: false, cadence: 'weekly' },
  audit: { enabled: true, retentionDays: 90 },
  version: 1,
  updatedAt: new Date().toISOString(),
};

let SITE_SETTINGS = { ...DEFAULT_SETTINGS };

// ===== Broadcast Center (demo storage) =====
// Minimal in-memory implementation used by the admin UI.
// Endpoints:
// - GET/PUT /api/broadcast/settings
// - GET/POST /api/broadcast/items
// - PATCH/DELETE /api/broadcast/items/:id
const DAY_MS = 24 * 60 * 60 * 1000;

// ===== Articles (demo storage) =====
// Contract endpoints expected by the admin panel:
// - GET /api/articles?page=&limit=&sort=&status=&q=&category=&language=&from=&to=
// - GET /api/articles/:id
// - PUT /api/articles/:id
// - PATCH /api/articles/:id

/** @type {Array<any>} */
let ARTICLES = [];

function seedArticlesOnce() {
  // IMPORTANT: Do not show fake stories unless explicitly requested.
  // This prevents local dev from accidentally looking "correct" while using demo data.
  const shouldSeed = String(process.env.DEMO_SEED_ARTICLES || '').toLowerCase() === 'true';
  if (!shouldSeed) return;
  if (ARTICLES.length) return;
  const now = Date.now();
  const mk = (i, overrides = {}) => {
    const createdAt = new Date(now - i * 36e5).toISOString();
    const updatedAt = createdAt;
    const base = {
      _id: crypto.randomUUID(),
      title: `Demo Article ${i + 1}`,
      slug: `demo-article-${i + 1}`,
      summary: `This is a demo summary for article ${i + 1}.`,
      content: `Demo content for article ${i + 1}.`,
      category: ['National', 'International', 'Business', 'Sports'][i % 4],
      language: ['en', 'hi', 'gu'][i % 3],
      status: ['draft', 'published', 'scheduled', 'archived'][i % 4],
      author: { name: ['Editor', 'Founder', 'Reporter'][i % 3] },
      ptiCompliance: ['pending', 'compliant', 'rejected'][i % 3],
      trustScore: Math.round(50 + Math.random() * 50),
      createdAt,
      updatedAt,
      publishAt: null,
      scheduledAt: null,
    };
    return { ...base, ...overrides };
  };

  ARTICLES = [
    mk(0, { status: 'draft' }),
    mk(1, { status: 'draft', source: 'community-reporter', origin: 'community-reporter', isCommunity: true }),
    mk(2, { status: 'published' }),
    mk(3, { status: 'scheduled', publishAt: new Date(now + 6 * 36e5).toISOString() }),
    mk(4, { status: 'archived' }),
  ];
}

function parseSort(sort) {
  const s = String(sort || '-createdAt');
  const desc = s.startsWith('-');
  const field = desc ? s.slice(1) : s;
  return { field, desc };
}

function clampInt(v, def, min, max) {
  const n = Number.parseInt(String(v ?? ''), 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function inDateRange(iso, from, to) {
  const t = new Date(iso || '').getTime();
  if (!Number.isFinite(t)) return true;
  if (from) {
    const f = new Date(from).getTime();
    if (Number.isFinite(f) && t < f) return false;
  }
  if (to) {
    const tt = new Date(to).getTime();
    if (Number.isFinite(tt) && t > tt + 24 * 60 * 60 * 1000 - 1) return false;
  }
  return true;
}

function nowIso() {
  return new Date().toISOString();
}

function getArticleListQuery(req) {
  return {
    page: clampInt(req.query?.page, 1, 1, 10_000),
    limit: clampInt(req.query?.limit, 20, 1, 500),
    status: (req.query?.status ? String(req.query.status).toLowerCase() : '').trim(),
    q: (req.query?.q ? String(req.query.q).toLowerCase() : '').trim(),
    category: (req.query?.category ? String(req.query.category) : '').trim(),
    language: (req.query?.language ? String(req.query.language).toLowerCase() : '').trim(),
    from: (req.query?.from ? String(req.query.from) : '').trim(),
    to: (req.query?.to ? String(req.query.to) : '').trim(),
    sort: parseSort(req.query?.sort),
  };
}

function listArticlesCore(query) {
  const { page, limit, status, q, category, language, from, to, sort } = query;
  const { field, desc } = sort;

  let rows = ARTICLES.slice();

  if (status) rows = rows.filter((a) => String(a.status || '').toLowerCase() === status);
  if (category) {
    const cats = category.split(',').map((x) => x.trim()).filter(Boolean);
    if (cats.length) rows = rows.filter((a) => cats.includes(String(a.category || '')));
  }
  if (language) rows = rows.filter((a) => String(a.language || '').toLowerCase() === language);
  if (q) rows = rows.filter((a) => String(a.title || '').toLowerCase().includes(q));
  if (from || to) rows = rows.filter((a) => inDateRange(a.createdAt, from || null, to || null));

  rows.sort((a, b) => {
    const av = a?.[field];
    const bv = b?.[field];
    const at = field.toLowerCase().includes('at') ? new Date(av || 0).getTime() : av;
    const bt = field.toLowerCase().includes('at') ? new Date(bv || 0).getTime() : bv;
    if (at === bt) return 0;
    if (at == null) return desc ? 1 : -1;
    if (bt == null) return desc ? -1 : 1;
    return (at > bt ? 1 : -1) * (desc ? -1 : 1);
  });

  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const start = (page - 1) * limit;
  const paged = rows.slice(start, start + limit);

  return { rows: paged, total, page, pages };
}

function handleListArticles(req, res) {
  seedArticlesOnce();
  const q = getArticleListQuery(req);
  return res.json(listArticlesCore(q));
}

function handleGetArticle(req, res) {
  seedArticlesOnce();
  const id = String(req.params.id || '');
  const found = ARTICLES.find((a) => String(a._id) === id);
  if (!found) return res.status(404).json({ message: 'Route not found' });
  return res.json({ ok: true, data: found });
}

function handlePutArticle(req, res) {
  seedArticlesOnce();
  const id = String(req.params.id || '');
  const idx = ARTICLES.findIndex((a) => String(a._id) === id);
  if (idx < 0) return res.status(404).json({ message: 'Route not found' });
  const next = { ...ARTICLES[idx], ...(req.body || {}), updatedAt: nowIso() };
  ARTICLES[idx] = next;
  return res.json({ ok: true, data: next });
}

function handlePatchArticle(req, res) {
  seedArticlesOnce();
  const id = String(req.params.id || '');
  const idx = ARTICLES.findIndex((a) => String(a._id) === id);
  if (idx < 0) return res.status(404).json({ message: 'Route not found' });
  const body = req.body || {};
  const next = { ...ARTICLES[idx], ...body, updatedAt: nowIso() };
  // basic schedule normalization
  if (body?.status === 'scheduled' && body?.publishAt) {
    next.scheduledAt = body.publishAt;
  }
  ARTICLES[idx] = next;
  return res.json({ ok: true, data: next });
}

function handleCreateAdminArticle(req, res) {
  seedArticlesOnce();
  const body = req.body || {};
  const next = {
    _id: crypto.randomUUID(),
    title: String(body.title || 'Untitled').trim(),
    slug: String(body.slug || '').trim() || `draft-${Math.random().toString(16).slice(2, 10)}`,
    summary: String(body.summary || '').trim(),
    content: String(body.content || ''),
    category: body.category || 'regional',
    language: body.language || 'en',
    status: body.status || 'draft',
    author: body.author || { name: 'Editor' },
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...body,
  };
  ARTICLES.unshift(next);
  return res.status(201).json({ ok: true, data: next });
}

function handleDeleteAdminArticle(req, res) {
  seedArticlesOnce();
  const id = String(req.params.id || '');
  const hard = String(req.query?.hard || '').toLowerCase() === 'true' || req.query?.hard === true;
  const idx = ARTICLES.findIndex((a) => String(a._id) === id);
  if (idx < 0) return res.status(404).json({ message: 'Route not found' });
  if (hard) {
    ARTICLES.splice(idx, 1);
    return res.status(204).send();
  }
  ARTICLES[idx] = { ...ARTICLES[idx], status: 'deleted', updatedAt: nowIso() };
  return res.json({ ok: true, data: ARTICLES[idx] });
}

app.get('/api/articles', handleListArticles);

app.get('/api/articles/:id', handleGetArticle);

// --- Admin Articles API (alias) ---
// Production admin panel expects: /api/admin/articles* for Draft/Scheduled/etc.
// In the demo backend, we alias these routes to the same in-memory ARTICLES store.
app.get('/api/admin/articles', handleListArticles);

app.get('/api/admin/articles/:id', handleGetArticle);

app.post('/api/admin/articles', handleCreateAdminArticle);

app.put('/api/admin/articles/:id', handlePutArticle);

app.patch('/api/admin/articles/:id', handlePatchArticle);

app.delete('/api/admin/articles/:id', handleDeleteAdminArticle);

app.put('/api/articles/:id', handlePutArticle);

app.patch('/api/articles/:id', handlePatchArticle);

let BROADCAST_SETTINGS = {
  breakingEnabled: true,
  breakingMode: 'manual',
  liveEnabled: true,
  liveMode: 'manual',
};

/** @type {Array<{_id:string,type:'breaking'|'live',text:string,isLive:boolean,createdAt:string,expiresAt:string,language?:string,authorId?:string,updatedAt?:string}>} */
let BROADCAST_ITEMS = [];

function pruneBroadcastItems() {
  const cutoff = Date.now() - DAY_MS;
  BROADCAST_ITEMS = BROADCAST_ITEMS.filter((it) => {
    const created = new Date(it.createdAt).getTime();
    if (!Number.isFinite(created)) return false;
    return created >= cutoff;
  });
}

app.get('/api/broadcast/settings', (req, res) => {
  return res.status(200).json(BROADCAST_SETTINGS);
});

app.put('/api/broadcast/settings', (req, res) => {
  const body = req.body || {};
  const next = {
    breakingEnabled: typeof body.breakingEnabled === 'boolean' ? body.breakingEnabled : BROADCAST_SETTINGS.breakingEnabled,
    breakingMode: body.breakingMode === 'auto' ? 'auto' : 'manual',
    liveEnabled: typeof body.liveEnabled === 'boolean' ? body.liveEnabled : BROADCAST_SETTINGS.liveEnabled,
    liveMode: body.liveMode === 'auto' ? 'auto' : 'manual',
  };
  BROADCAST_SETTINGS = next;
  return res.status(200).json(BROADCAST_SETTINGS);
});

app.get('/api/broadcast/items', (req, res) => {
  pruneBroadcastItems();
  const type = String(req.query?.type || '').toLowerCase();
  if (type !== 'breaking' && type !== 'live') {
    return res.status(400).json({ error: 'Invalid type. Expected breaking|live' });
  }
  const out = BROADCAST_ITEMS
    .filter((it) => it.type === type)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return res.status(200).json(out);
});

app.post('/api/broadcast/items', (req, res) => {
  pruneBroadcastItems();
  const body = req.body || {};
  const type = String(body.type || '').toLowerCase();
  const text = String(body.text || '').trim();
  if (type !== 'breaking' && type !== 'live') {
    return res.status(400).json({ error: 'Invalid type. Expected breaking|live' });
  }
  if (!text) {
    return res.status(400).json({ error: 'Text is required' });
  }
  if (text.length > 160) {
    return res.status(400).json({ error: 'Text too long (max 160)' });
  }
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + DAY_MS).toISOString();
  const item = {
    _id: crypto.randomBytes(12).toString('hex'),
    type,
    text,
    isLive: true,
    createdAt,
    expiresAt,
    language: body.language ? String(body.language) : undefined,
    updatedAt: createdAt,
  };
  BROADCAST_ITEMS.push(item);
  return res.status(201).json(item);
});

app.patch('/api/broadcast/items/:id', (req, res) => {
  pruneBroadcastItems();
  const id = String(req.params.id || '');
  const idx = BROADCAST_ITEMS.findIndex((it) => it._id === id);
  if (idx < 0) return res.status(404).json({ error: 'Not Found' });
  const body = req.body || {};
  const prev = BROADCAST_ITEMS[idx];
  const next = { ...prev };
  if (typeof body.text === 'string') {
    const t = body.text.trim();
    if (!t) return res.status(400).json({ error: 'Text is required' });
    if (t.length > 160) return res.status(400).json({ error: 'Text too long (max 160)' });
    next.text = t;
  }
  if (typeof body.isLive === 'boolean') {
    next.isLive = body.isLive;
  }
  next.updatedAt = nowIso();
  BROADCAST_ITEMS[idx] = next;
  return res.status(200).json(next);
});

app.delete('/api/broadcast/items/:id', (req, res) => {
  pruneBroadcastItems();
  const id = String(req.params.id || '');
  const before = BROADCAST_ITEMS.length;
  BROADCAST_ITEMS = BROADCAST_ITEMS.filter((it) => it._id !== id);
  if (BROADCAST_ITEMS.length === before) return res.status(404).json({ error: 'Not Found' });
  return res.status(200).json({ ok: true });
});

app.get('/api/admin/settings', (req, res) => {
  try {
    const s = SITE_SETTINGS && typeof SITE_SETTINGS === 'object' ? SITE_SETTINGS : DEFAULT_SETTINGS;
    return res.status(200).json(s);
  } catch (e) {
    return res.status(200).json(DEFAULT_SETTINGS);
  }
});

app.put('/api/admin/settings', (req, res) => {
  try {
    const patch = req.body || {};
    const merged = { ...SITE_SETTINGS, ...patch, version: (SITE_SETTINGS.version || 1) + 1, updatedAt: new Date().toISOString() };
    // shallow merge per section to avoid dropping nested fields
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (typeof DEFAULT_SETTINGS[key] === 'object' && !Array.isArray(DEFAULT_SETTINGS[key])) {
        merged[key] = { ...DEFAULT_SETTINGS[key], ...(SITE_SETTINGS[key] || {}), ...(patch[key] || {}) };
      }
    }
    SITE_SETTINGS = merged;
    console.log('[audit] update-settings', { version: SITE_SETTINGS.version });
    return res.status(200).json(SITE_SETTINGS);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid payload' });
  }
});

// ===== Ads Manager (demo storage) =====
// Contract endpoints expected by the admin panel:
// - GET /api/admin/ad-settings -> { ok:true, slotEnabled:{ HOME_728x90:boolean, HOME_RIGHT_300x250:boolean } }
// - PUT /api/admin/ad-settings -> same shape
// - GET /api/admin/ads
// - POST /api/admin/ads
// - PUT /api/admin/ads/:id
// - PATCH /api/admin/ads/:id/toggle
// - DELETE /api/admin/ads/:id

const DEFAULT_AD_SETTINGS = {
  slotEnabled: {
    HOME_728x90: false,
    HOME_RIGHT_300x250: false,
  },
};

let AD_SETTINGS = { ...DEFAULT_AD_SETTINGS };

/** @type {Array<any>} */
let ADS = [];

function boolish(v, fallback = false) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'on' || s === 'enabled' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'off' || s === 'disabled' || s === 'no') return false;
  }
  return fallback;
}

function normIso(v) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

app.get('/api/admin/ad-settings', (_req, res) => {
  return res.status(200).json({ ok: true, slotEnabled: { ...AD_SETTINGS.slotEnabled } });
});

app.put('/api/admin/ad-settings', (req, res) => {
  const body = req.body || {};
  const raw = body.slotEnabled || {};

  AD_SETTINGS = {
    ...AD_SETTINGS,
    slotEnabled: {
      ...AD_SETTINGS.slotEnabled,
      HOME_728x90: boolish(raw.HOME_728x90, AD_SETTINGS.slotEnabled.HOME_728x90),
      HOME_RIGHT_300x250: boolish(raw.HOME_RIGHT_300x250, AD_SETTINGS.slotEnabled.HOME_RIGHT_300x250),
    },
  };

  console.log('[audit] update-ad-settings', AD_SETTINGS.slotEnabled);
  return res.status(200).json({ ok: true, slotEnabled: { ...AD_SETTINGS.slotEnabled } });
});

app.get('/api/admin/ads', (req, res) => {
  const slot = (req.query?.slot ? String(req.query.slot) : '').trim();
  const active = (req.query?.active ? String(req.query.active).toLowerCase() : '').trim();

  let rows = ADS.slice();
  if (slot) rows = rows.filter((a) => String(a.slot || '') === slot);
  if (active === 'true') rows = rows.filter((a) => Boolean(a.isActive));

  return res.status(200).json({ ok: true, ads: rows });
});

app.post('/api/admin/ads', (req, res) => {
  const body = req.body || {};
  const slot = String(body.slot || '').trim();
  const imageUrl = String(body.imageUrl || body.image_url || '').trim();
  if (!slot) return res.status(400).json({ message: 'slot is required' });
  if (!imageUrl) return res.status(400).json({ message: 'imageUrl is required' });

  const now = nowIso();
  const item = {
    _id: crypto.randomUUID(),
    slot,
    title: typeof body.title === 'string' ? body.title : null,
    imageUrl,
    targetUrl: typeof body.targetUrl === 'string' ? body.targetUrl : (typeof body.target_url === 'string' ? body.target_url : null),
    clickable: boolish(body.clickable, true),
    priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : 0,
    startAt: normIso(body.startAt || body.start_at),
    endAt: normIso(body.endAt || body.end_at),
    isActive: boolish(body.isActive ?? body.active, true),
    createdAt: now,
    updatedAt: now,
  };

  ADS.push(item);
  return res.status(201).json({ ok: true, ad: item });
});

app.put('/api/admin/ads/:id', (req, res) => {
  const id = String(req.params.id || '').trim();
  const idx = ADS.findIndex((a) => String(a._id) === id);
  if (idx < 0) return res.status(404).json({ message: 'Not Found' });
  const body = req.body || {};

  const prev = ADS[idx];
  const next = {
    ...prev,
    slot: typeof body.slot === 'string' ? body.slot : prev.slot,
    title: (typeof body.title === 'string' ? body.title : prev.title),
    imageUrl: (typeof body.imageUrl === 'string' ? body.imageUrl : (typeof body.image_url === 'string' ? body.image_url : prev.imageUrl)),
    targetUrl: (typeof body.targetUrl === 'string' ? body.targetUrl : (typeof body.target_url === 'string' ? body.target_url : prev.targetUrl)),
    clickable: (typeof body.clickable === 'boolean' ? body.clickable : prev.clickable),
    priority: Number.isFinite(Number(body.priority)) ? Number(body.priority) : prev.priority,
    startAt: (body.startAt || body.start_at) ? normIso(body.startAt || body.start_at) : prev.startAt,
    endAt: (body.endAt || body.end_at) ? normIso(body.endAt || body.end_at) : prev.endAt,
    isActive: (typeof body.isActive !== 'undefined' || typeof body.active !== 'undefined') ? boolish(body.isActive ?? body.active, prev.isActive) : prev.isActive,
    updatedAt: nowIso(),
  };

  ADS[idx] = next;
  return res.status(200).json({ ok: true, ad: next });
});

app.patch('/api/admin/ads/:id/toggle', (req, res) => {
  const id = String(req.params.id || '').trim();
  const idx = ADS.findIndex((a) => String(a._id) === id);
  if (idx < 0) return res.status(404).json({ message: 'Not Found' });
  const body = req.body || {};

  const prev = ADS[idx];
  const desired = (typeof body.isActive === 'boolean') ? body.isActive : (typeof body.active === 'boolean' ? body.active : !Boolean(prev.isActive));
  const next = { ...prev, isActive: Boolean(desired), updatedAt: nowIso() };
  ADS[idx] = next;
  return res.status(200).json({ ok: true, ad: next });
});

app.delete('/api/admin/ads/:id', (req, res) => {
  const id = String(req.params.id || '').trim();
  const before = ADS.length;
  ADS = ADS.filter((a) => String(a._id) !== id);
  if (ADS.length === before) return res.status(404).json({ message: 'Not Found' });
  return res.status(200).json({ ok: true });
});

// ===== Community Reporter (demo storage) =====
// Endpoints expected by the admin UI:
// - GET  /api/admin/community-reporter/queue
// - GET  /api/admin/community-reporter/submissions
// - GET  /api/admin/community-reporter/submissions/:id
// - POST /api/admin/community-reporter/submissions/:id/decision { decision:'approve'|'reject' }
// - POST /api/admin/community-reporter/submissions/:id/restore
// - POST /api/admin/community-reporter/submissions/:id/hard-delete
// - GET  /api/admin/community/stats
// - POST /api/admin/community-reporter/cleanup

/** @type {Array<any>} */
let COMMUNITY_SUBMISSIONS = [];

function seedCommunitySubmissionsOnce() {
  if (COMMUNITY_SUBMISSIONS.length) return;
  const now = Date.now();
  const mk = (i, overrides = {}) => {
    const createdAt = new Date(now - i * 6 * 60 * 60 * 1000).toISOString();
    const updatedAt = createdAt;
    return {
      _id: crypto.randomUUID(),
      headline: `Community story #${i + 1}`,
      body: `This is a demo community submission body for story #${i + 1}.`,
      category: ['regional', 'national', 'international'][i % 3],
      status: (i % 5 === 0) ? 'rejected' : 'pending',
      priority: (i % 7 === 0) ? 'FOUNDER_REVIEW' : (i % 3 === 0) ? 'EDITOR_REVIEW' : 'LOW_PRIORITY',
      // Reporter identity (THIS prevents “Unknown reporter” in the UI)
      userName: ['Amit Patel', 'Neha Sharma', 'Ravi Singh', 'Priya Desai'][i % 4],
      email: ['amit@example.com', 'neha@example.com', 'ravi@example.com', 'priya@example.com'][i % 4],
      city: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'][i % 4],
      state: 'Gujarat',
      country: 'India',
      district: ['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot'][i % 4],
      contactName: ['Amit Patel', 'Neha Sharma', 'Ravi Singh', 'Priya Desai'][i % 4],
      contactEmail: ['amit@example.com', 'neha@example.com', 'ravi@example.com', 'priya@example.com'][i % 4],
      contactPhone: ['+91 90000 00001', '+91 90000 00002', '+91 90000 00003', '+91 90000 00004'][i % 4],
      contactMethod: 'whatsapp',
      contactOk: true,
      futureContactOk: true,
      // AI/risk fields used by the UI
      riskScore: (i % 3 === 0) ? 72 : (i % 3 === 1) ? 45 : 18,
      flags: (i % 4 === 0) ? ['policy:needs-review'] : [],
      aiHighlighted: i % 6 === 0,
      aiTrendingScore: i % 6 === 0 ? 10 : 0,
      // Source chips
      sourceType: 'community',
      reporterVerificationLevel: 'community_default',
      ethicsStrikes: i % 9 === 0 ? 1 : 0,
      linkedArticleId: null,
      createdAt,
      updatedAt,
      ...overrides,
    };
  };

  COMMUNITY_SUBMISSIONS = [
    mk(0, { status: 'pending', priority: 'FOUNDER_REVIEW', flags: ['policy:needs-review'], riskScore: 78, aiHighlighted: true, aiTrendingScore: 12 }),
    mk(1, { status: 'pending', priority: 'EDITOR_REVIEW', riskScore: 35 }),
    mk(2, { status: 'pending', priority: 'LOW_PRIORITY', riskScore: 12 }),
    mk(3, { status: 'rejected', priority: 'LOW_PRIORITY', rejectReason: 'Incomplete details' }),
    mk(4, { status: 'pending', priority: 'EDITOR_REVIEW', riskScore: 52 }),
  ];
}

function riskTier(score) {
  const n = typeof score === 'number' ? score : Number(score);
  if (!Number.isFinite(n)) return 'LOW';
  if (n >= 70) return 'HIGH';
  if (n >= 40) return 'MEDIUM';
  return 'LOW';
}

function filterCommunityList(query) {
  seedCommunitySubmissionsOnce();
  let rows = COMMUNITY_SUBMISSIONS.slice();
  const status = (query?.status ? String(query.status).toLowerCase() : '').trim();
  if (status) {
    rows = rows.filter((s) => String(s.status || '').toLowerCase() === status);
  }
  const priority = (query?.priority ? String(query.priority).trim() : '').trim();
  if (priority) rows = rows.filter((s) => String(s.priority || '') === priority);

  const risk = (query?.risk ? String(query.risk).toUpperCase() : '').trim();
  if (risk === 'FLAGGED') rows = rows.filter((s) => Array.isArray(s.flags) && s.flags.length > 0);
  else if (risk === 'LOW' || risk === 'MEDIUM' || risk === 'HIGH') rows = rows.filter((s) => riskTier(s.riskScore) === risk);

  const source = (query?.source ? String(query.source).toLowerCase() : '').trim();
  if (source === 'community') {
    rows = rows.filter((s) => (s.sourceType !== 'journalist') || (s.reporterVerificationLevel !== 'verified'));
  } else if (source === 'journalists') {
    rows = rows.filter((s) => (s.sourceType === 'journalist') && (s.reporterVerificationLevel === 'verified'));
  }

  const aiPick = (query?.aiPick === true) || String(query?.aiPick || '').toLowerCase() === 'true';
  if (aiPick) rows = rows.filter((s) => s.aiHighlighted === true || (typeof s.aiTrendingScore === 'number' && s.aiTrendingScore > 0));

  // Newest first
  rows.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return rows;
}

app.get('/api/admin/community-reporter/queue', (req, res) => {
  const rows = filterCommunityList(req.query || {});
  return res.status(200).json({ ok: true, submissions: rows });
});

app.get('/api/admin/community-reporter/submissions', (req, res) => {
  const rows = filterCommunityList(req.query || {});
  return res.status(200).json({ ok: true, submissions: rows, items: rows });
});

app.get('/api/admin/community-reporter/submissions/:id', (req, res) => {
  seedCommunitySubmissionsOnce();
  const id = String(req.params.id || '').trim();
  const s = COMMUNITY_SUBMISSIONS.find((x) => String(x._id) === id);
  if (!s) return res.status(404).json({ ok: false, message: 'Not Found' });
  return res.status(200).json({ ok: true, submission: s });
});

app.post('/api/admin/community-reporter/submissions/:id/decision', (req, res) => {
  seedCommunitySubmissionsOnce();
  seedArticlesOnce();
  const id = String(req.params.id || '').trim();
  const idx = COMMUNITY_SUBMISSIONS.findIndex((x) => String(x._id) === id);
  if (idx < 0) return res.status(404).json({ ok: false, message: 'Not Found' });

  const decision = String(req.body?.decision || '').toLowerCase();
  if (decision !== 'approve' && decision !== 'reject') {
    return res.status(400).json({ ok: false, message: 'decision must be approve|reject' });
  }

  const prev = COMMUNITY_SUBMISSIONS[idx];
  const next = { ...prev, updatedAt: nowIso() };

  let draftArticle = null;
  if (decision === 'approve') {
    next.status = 'approved';
    // Create a draft article so the admin can see it under Manage News → Draft.
    const article = {
      _id: crypto.randomUUID(),
      title: String(prev.headline || 'Community submission').trim(),
      slug: `community-${String(prev._id).slice(0, 8)}`,
      summary: String(prev.body || '').slice(0, 140),
      content: String(prev.body || ''),
      category: prev.category || 'regional',
      language: 'en',
      status: 'draft',
      author: { name: prev.userName || prev.name || 'Community Reporter' },
      createdAt: nowIso(),
      updatedAt: nowIso(),
      source: 'community-reporter',
      origin: 'community-reporter',
      isCommunity: true,
    };
    ARTICLES.unshift(article);
    next.linkedArticleId = article._id;
    draftArticle = article;
  } else {
    next.status = 'rejected';
    if (typeof req.body?.reason === 'string' && req.body.reason.trim()) {
      next.rejectReason = req.body.reason.trim();
    }
  }

  COMMUNITY_SUBMISSIONS[idx] = next;
  return res.status(200).json({
    ok: true,
    action: decision,
    submission: next,
    draftArticle,
  });
});

app.post('/api/admin/community-reporter/submissions/:id/restore', (req, res) => {
  seedCommunitySubmissionsOnce();
  const id = String(req.params.id || '').trim();
  const idx = COMMUNITY_SUBMISSIONS.findIndex((x) => String(x._id) === id);
  if (idx < 0) return res.status(404).json({ ok: false, message: 'Not Found' });
  COMMUNITY_SUBMISSIONS[idx] = { ...COMMUNITY_SUBMISSIONS[idx], status: 'pending', updatedAt: nowIso() };
  return res.status(200).json({ ok: true, submission: COMMUNITY_SUBMISSIONS[idx] });
});

app.post('/api/admin/community-reporter/submissions/:id/hard-delete', (req, res) => {
  seedCommunitySubmissionsOnce();
  const id = String(req.params.id || '').trim();
  const before = COMMUNITY_SUBMISSIONS.length;
  COMMUNITY_SUBMISSIONS = COMMUNITY_SUBMISSIONS.filter((x) => String(x._id) !== id);
  if (COMMUNITY_SUBMISSIONS.length === before) return res.status(404).json({ ok: false, message: 'Not Found' });
  return res.status(200).json({ ok: true });
});

app.post('/api/admin/community-reporter/cleanup', (req, res) => {
  seedCommunitySubmissionsOnce();
  // Demo cleanup: delete rejected low-priority older items.
  const before = COMMUNITY_SUBMISSIONS.length;
  COMMUNITY_SUBMISSIONS = COMMUNITY_SUBMISSIONS.filter((s) => !(String(s.status) === 'rejected' && String(s.priority) === 'LOW_PRIORITY'));
  const deletedCount = before - COMMUNITY_SUBMISSIONS.length;
  return res.status(200).json({ deletedCount });
});

app.get('/api/admin/community/stats', (req, res) => {
  seedCommunitySubmissionsOnce();
  const pendingCount = COMMUNITY_SUBMISSIONS.filter((s) => String(s.status) === 'pending').length;
  const rejectedCount = COMMUNITY_SUBMISSIONS.filter((s) => String(s.status) === 'rejected').length;
  const approvedCount = COMMUNITY_SUBMISSIONS.filter((s) => String(s.status) === 'approved').length;
  const totalStories = COMMUNITY_SUBMISSIONS.length;
  return res.status(200).json({ pendingCount, rejectedCount, approvedCount, totalStories });
});

// ===== OPTIONAL FEATURE ROUTES (guarded to avoid CJS/ESM boundary issues locally) =====
const ENABLE_SECURITY_ROUTES = String(process.env.DEMO_SECURITY_ROUTES || '').toLowerCase() === 'true';
let webauthnRoute, rateLimitingRoute, auditTrailRoute, sessionsRoute, rbacRoute, webStoriesRoute, commentModRoute, seoToolsRoute;
if (ENABLE_SECURITY_ROUTES) {
  try {
    const m1 = await import('./backend/routes/security/webauthn.js');
    const m2 = await import('./backend/routes/security/rate-limiting.js');
    const m3 = await import('./backend/routes/security/audit-trail.js');
    const m4 = await import('./backend/routes/security/sessions.js');
    const m5 = await import('./backend/routes/security/rbac.js');
    const m6 = await import('./backend/routes/stories/web-stories.js');
    const m7 = await import('./backend/routes/moderation/comments.js');
    const m8 = await import('./backend/routes/seo/tools.js');
    webauthnRoute = m1.default; rateLimitingRoute = m2.default; auditTrailRoute = m3.default; sessionsRoute = m4.default;
    rbacRoute = m5.default; webStoriesRoute = m6.default; commentModRoute = m7.default; seoToolsRoute = m8.default;
    console.log('✅ Optional security/feature routes enabled');
  } catch (e) {
    console.log('⚠️  Skipping optional security/feature routes:', e?.message || e);
  }
} else {
  console.log('ℹ️  DEMO_SECURITY_ROUTES not enabled; skipping optional security/feature routes');
}

// ===== OPENAI VISION FOR ALT-TEXT =====
let openaiClient = null;
try {
  // Prefer local path (repo has admin-backend/openaiClient.js). Fallback to legacy folder.
  try {
    const { default: client } = await import('./openaiClient.js');
    openaiClient = client;
  } catch {
    const { default: client } = await import('./ai/openaiClient.js');
    openaiClient = client;
  }
  console.log('✅ OpenAI client loaded');
} catch (error) {
  console.log('⚠️  OpenAI client not available:', error.message);
}

// POST: AI alt-text generation (OpenAI Vision)
app.post('/api/ai/alt-text', async (req, res) => {
  try {
    const { url, filename = '', hint = '' } = req.body || {};
    
    if (!url) {
      return res.status(400).json({ success: false, error: 'Image URL is required' });
    }

    if (!openaiClient) {
      // Fallback if OpenAI not configured
      const base = (filename || '').replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim();
      const fallbackAlt = hint?.trim() || (base ? `Photo of ${base}` : 'News related image');
      return res.json({ 
        success: true, 
        alt: fallbackAlt, 
        confidence: 0.45, 
        url,
        fallback: true,
        error: 'OpenAI not configured' 
      });
    }

    // Build prompt with context
    let prompt = 'Generate a descriptive, accessible alt text for this image. Focus on key visual elements, people, actions, and context relevant to news/journalism.';
    if (hint) prompt += ` Context hint: ${hint}`;
    if (filename) prompt += ` Filename: ${filename}`;

    // Call OpenAI Vision API
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
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

    console.log(`✅ [OpenAI Vision] Generated alt text: "${alt.substring(0, 80)}..."`);
    
    res.json({ 
      success: true, 
      alt, 
      confidence, 
      url,
      model: 'gpt-4o-mini',
      tokens: response.usage?.total_tokens || 0
    });

  } catch (error) {
    console.error('❌ [OpenAI Vision Error]:', error.message);
    
    // Fallback to filename-based alt text
    const { filename = '', hint = '' } = req.body || {};
    const base = (filename || '').replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim();
    const fallbackAlt = hint?.trim() || (base ? `Photo of ${base}` : 'News related image');
    
    res.json({ 
      success: true, 
      alt: fallbackAlt, 
      confidence: 0.45, 
      url: req.body.url,
      fallback: true,
      error: error.message 
    });
  }
});

// POST: EXIF scrubbing (stub)
app.post('/api/uploads/scrub-exif', (req, res) => {
  const { url } = req.body || {};
  res.json({ success: true, message: 'EXIF removed (demo mode)', url });
});

// GET: signed URL generation (stub)
app.get('/api/uploads/signed-url', (req, res) => {
  const { filename = 'upload.jpg' } = req.query;
  const signed = `https://uploads.newspulse.demo/${encodeURIComponent(filename)}?sig=${crypto.randomBytes(6).toString('hex')}&exp=${Date.now() + 5 * 60 * 1000}`;
  res.json({ success: true, url: signed });
});

// GET: Media list (stub for Media Library)
let DEMO_MEDIA_ITEMS = [
  {
    id: 'demo-1',
    filename: 'climate-summit-2025.jpg',
    url: 'https://via.placeholder.com/800x600/3498db/fff?text=Climate+Summit',
    uploadedAt: new Date().toISOString(),
    size: 245678,
    type: 'image/jpeg',
    alt: 'World leaders at Climate Summit 2025'
  },
  {
    id: 'demo-2',
    filename: 'tech-innovation.jpg',
    url: 'https://via.placeholder.com/800x600/e74c3c/fff?text=Tech+Innovation',
    uploadedAt: new Date(Date.now() - 86400000).toISOString(),
    size: 189234,
    type: 'image/jpeg',
    alt: 'Latest tech innovations showcase'
  }
];

app.get('/api/vault/list', (req, res) => {
  res.json({
    success: true,
    items: DEMO_MEDIA_ITEMS,
  });
});

// Legacy list route used by some UIs
app.get('/api/uploads', (req, res) => {
  res.json({
    success: true,
    items: DEMO_MEDIA_ITEMS,
  });
});

// Media capability detection (used by CoverImagePicker + Media Library)
app.get('/api/media/status', (req, res) => {
  // Demo backend always reports enabled so local UX matches Vercel.
  res.json({
    success: true,
    uploadEnabled: true,
    storage: { provider: 'demo' },
  });
});

// Media upload (multipart/form-data, field name: file)
app.post('/api/media/upload', upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ success: false, message: 'Missing file' });
  }
  const id = crypto.randomUUID();
  const filename = file.originalname || `upload-${id}.jpg`;
  // Return a usable image URL without persisting bytes (demo)
  const url = `https://via.placeholder.com/1200x630/111827/ffffff?text=${encodeURIComponent(filename)}`;

  const item = {
    id,
    filename,
    url,
    uploadedAt: new Date().toISOString(),
    size: file.size,
    type: file.mimetype,
    alt: null,
  };
  DEMO_MEDIA_ITEMS = [item, ...DEMO_MEDIA_ITEMS];
  return res.json({ success: true, url, item });
});

// ===== MOUNT OPTIONAL FEATURE ROUTES (if loaded) =====
if (webauthnRoute) app.use('/api/security/webauthn', webauthnRoute);
if (rateLimitingRoute) app.use('/api/security/rate-limit', rateLimitingRoute);
if (auditTrailRoute) app.use('/api/security/audit', auditTrailRoute);
if (sessionsRoute) app.use('/api/security/sessions', sessionsRoute);
if (rbacRoute) app.use('/api/security/rbac', rbacRoute);
if (webStoriesRoute) app.use('/api/web-stories', webStoriesRoute);
if (commentModRoute) app.use('/api/moderation/comments', commentModRoute);
if (seoToolsRoute) app.use('/api/seo', seoToolsRoute);

// ===== ANALYTICS STUBS (for existing Analytics dashboard) =====
app.get('/api/analytics/revenue', (req, res) => {
  res.json({
    total: 48320.5,
    today: 1420.8,
    week: 9850.2,
    month: 48320.5,
    rpm: 12.4,
    ctr: 2.3,
  });
});

app.get('/api/analytics/traffic', (req, res) => {
  res.json({
    daily: [
      { date: '2025-10-20', views: 12450, users: 8234 },
      { date: '2025-10-21', views: 13120, users: 8756 },
      { date: '2025-10-22', views: 11890, users: 7923 },
      { date: '2025-10-23', views: 14230, users: 9345 },
      { date: '2025-10-24', views: 13567, users: 8912 },
      { date: '2025-10-25', views: 15234, users: 9876 },
      { date: '2025-10-26', views: 14890, users: 9234 },
    ],
  });
});

app.get('/api/analytics/ad-performance', (req, res) => {
  res.json({
    impressions: 245680,
    clicks: 5234,
    ctr: 2.13,
    revenue: 1847.32,
    rpm: 7.52,
  });
});

app.get('/api/analytics/ab-tests', (req, res) => {
  res.json({
    tests: [
      {
        id: 'test-1',
        name: 'Headline Length Test',
        status: 'running',
        variants: [
          { name: 'Short (< 60 chars)', ctr: 3.2, conversions: 234 },
          { name: 'Long (> 80 chars)', ctr: 2.8, conversions: 198 },
        ],
      },
    ],
  });
});

// ===== MISSING LEGACY ENDPOINTS (for compatibility) =====

// Dashboard stats
app.get('/api/dashboard/stats', (req, res) => {
  res.json({
    success: true,
    totalNews: 247,
    todayNews: 12,
    activeUsers: 1,
    pendingReviews: 5,
    totalViews: 125430,
    totalRevenue: 48320.5
  });
});

// Dashboard stats alias (with dash)
app.get('/api/dashboard-stats', (req, res) => {
  res.json({
    success: true,
    data: {
      totals: {
        news: 247,
        today: 12,
        activeUsers: 1,
        pendingReviews: 5,
        totalViews: 125430,
        totalRevenue: 48320.5
      },
      byCategory: [
        { category: 'Politics', count: 45 },
        { category: 'Technology', count: 38 },
        { category: 'Sports', count: 32 },
        { category: 'Environment', count: 28 },
        { category: 'Business', count: 25 }
      ],
      byLanguage: [
        { language: 'English', count: 150 },
        { language: 'Hindi', count: 67 },
        { language: 'Gujarati', count: 30 }
      ],
      recent: [],
      aiLogs: 1234,
      activeUsers: 1
    }
  });
});

// Stats alias
app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      totals: {
        news: 247,
        today: 12,
        activeUsers: 1,
        pendingReviews: 5,
        totalViews: 125430,
        totalRevenue: 48320.5
      },
      byCategory: [
        { category: 'Politics', count: 45 },
        { category: 'Technology', count: 38 },
        { category: 'Sports', count: 32 },
        { category: 'Environment', count: 28 },
        { category: 'Business', count: 25 }
      ],
      byLanguage: [
        { language: 'English', count: 150 },
        { language: 'Hindi', count: 67 },
        { language: 'Gujarati', count: 30 }
      ],
      recent: [],
      aiLogs: 1234,
      activeUsers: 1
    }
  });
});

// News/Articles endpoints
app.get('/api/news/all', (req, res) => {
  res.json({
    success: true,
    news: [
      {
        _id: 'demo-1',
        title: 'Climate Summit 2025 Reaches Historic Agreement',
        category: 'Environment',
        status: 'published',
        views: 12453,
        createdAt: new Date('2025-10-24').toISOString()
      },
      {
        _id: 'demo-2',
        title: 'Tech Giants Unveil AI Innovations',
        category: 'Technology',
        status: 'published',
        views: 9876,
        createdAt: new Date('2025-10-25').toISOString()
      }
    ]
  });
});

app.get('/api/news/:id', (req, res) => {
  res.json({
    success: true,
    news: {
      _id: req.params.id,
      title: 'Sample Article',
      content: 'This is a demo article.',
      category: 'General',
      status: 'published'
    }
  });
});

// AI engines
app.get('/api/ai/engines', (req, res) => {
  res.json({
    success: true,
    engines: [
      { id: 'gemini', name: 'Gemini 2.5', status: 'active' },
      { id: 'gpt4', name: 'GPT-4', status: 'active' },
      { id: 'claude', name: 'Claude Sonnet 3.7', status: 'active' }
    ]
  });
});

// System endpoints
app.get('/api/system/ai-training-info', (req, res) => {
  res.json({
    success: true,
    data: {
      lastTraining: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
      nextTraining: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(), // 22 hours from now
      articlesAnalyzed: 1847,
      keywords: 423,
      patternFocus: 'Engagement Intelligence & Threat Detection',
      modulesTrained: ['Headline Ranker', 'KiranOS Hybrid', 'Content Optimizer'],
      lockedByFounder: true,
      version: '5.0 AI+'
    }
  });
});

app.post('/api/system/ai-command', (req, res) => {
  res.json({
    success: true,
    message: 'AI command received (demo mode)',
    result: 'Command processed successfully'
  });
});

app.get('/api/system/integrity-scan', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    issues: 0
  });
});

app.get('/api/system/ai-queue', (req, res) => {
  res.json({
    success: true,
    queue: [],
    pending: 0
  });
});

app.get('/api/system/ai-diagnostics', (req, res) => {
  res.json({
    success: true,
    diagnostics: { status: 'ok', uptime: '2h 15m' }
  });
});

app.get('/api/system/thinking-feed', (req, res) => {
  res.json({
    success: true,
    feed: []
  });
});

// Settings
app.get('/api/settings/load', (req, res) => {
  res.json({
    success: true,
    settings: {
      siteName: 'NewsPulse',
      theme: 'dark',
      language: 'en'
    }
  });
});

// Alerts
app.get('/api/alerts/history', (req, res) => {
  res.json({
    success: true,
    alerts: []
  });
});

// Polls
app.get('/api/polls/live-stats', (req, res) => {
  res.json({
    success: true,
    activePolls: 1,
    totalVotes: 1234
  });
});

// AI activity logs
app.get('/api/ai-activity-log', (req, res) => {
  res.json({
    success: true,
    logs: []
  });
});

app.get('/api/ai-behavior-log', (req, res) => {
  res.json({
    success: true,
    logs: []
  });
});

// Revenue
app.get('/api/revenue', (req, res) => {
  res.json({
    success: true,
    total: 48320.5,
    today: 1420.8
  });
});

// System monitoring
app.get('/api/system/monitor-hub', (req, res) => {
  res.json({
    success: true,
    status: 'operational'
  });
});

app.get('/api/system/bug-reports', (req, res) => {
  res.json({
    success: true,
    reports: []
  });
});

app.get('/api/system/api-keys', (req, res) => {
  res.json({
    success: true,
    keys: []
  });
});

app.get('/api/system/version-log', (req, res) => {
  res.json({
    success: true,
    version: '2.0.0',
    logs: []
  });
});

app.get('/api/system/guardian-status', (req, res) => {
  res.json({
    success: true,
    status: 'active'
  });
});

app.get('/api/system/incidents', (req, res) => {
  res.json({
    success: true,
    incidents: []
  });
});

app.get('/api/admin-chat-audit', (req, res) => {
  res.json({
    success: true,
    audits: []
  });
});

app.get('/api/system/threat-status', (req, res) => {
  res.json({
    success: true,
    threatLevel: 'low',
    threats: []
  });
});

app.get('/api/dashboard/threat-stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      total: 0,
      blocked: 0,
      monitoring: 0
    }
  });
});

app.get('/api/system/alert-config', (req, res) => {
  res.json({
    success: true,
    config: {
      enabled: true,
      channels: ['email', 'push']
    }
  });
});

// ===== SYSTEM MONITORING ENDPOINTS =====
let systemMetrics = {
  cpu: 45,
  memory: 62,
  storage: 55,
  requestCount: 0
};

// Simulate realistic system metrics that can go critical
setInterval(() => {
  systemMetrics.requestCount++;
  // Simulate varying load
  systemMetrics.cpu = 30 + Math.random() * 60; // 30-90%
  systemMetrics.memory = 40 + Math.random() * 50; // 40-90%
  systemMetrics.storage = 50 + Math.random() * 30; // 50-80%
}, 3000);

app.get('/api/system/health', (req, res) => {
  const cpu = systemMetrics.cpu;
  const memory = systemMetrics.memory;
  const storage = systemMetrics.storage;
  
  // Determine status based on thresholds
  let status = 'healthy';
  if (cpu > 80 || memory > 85) {
    status = 'critical';
  } else if (cpu > 60 || memory > 70) {
    status = 'warning';
  }
  
  res.json({
    cpu: parseFloat(cpu.toFixed(1)),
    memory: parseFloat(memory.toFixed(1)),
    storage: parseFloat(storage.toFixed(1)),
    uptime: `${Math.floor(systemMetrics.requestCount / 20)}h ${(systemMetrics.requestCount % 20) * 3}m`,
    activeUsers: 15 + Math.floor(Math.random() * 35),
    requestsPerMinute: 200 + Math.floor(Math.random() * 800),
    status: status
  });
});

app.get('/api/system/ai-health', (_req, res) => {
  // Minimal contract endpoint used by admin UI health checks
  res.json({ ok: true, status: 'ok', provider: 'demo', model: 'demo' });
});

app.get('/api/system/alerts', (req, res) => {
  const alerts = [];
  
  if (systemMetrics.cpu > 80) {
    alerts.push({
      id: '1',
      type: 'critical',
      message: `High CPU usage detected: ${systemMetrics.cpu.toFixed(1)}%`,
      timestamp: new Date().toISOString(),
      action: 'scale-up'
    });
  }
  
  if (systemMetrics.memory > 85) {
    alerts.push({
      id: '2',
      type: 'critical',
      message: `Memory usage critical: ${systemMetrics.memory.toFixed(1)}%`,
      timestamp: new Date().toISOString(),
      action: 'clear-cache'
    });
  }
  
  if (systemMetrics.cpu > 60 && systemMetrics.cpu <= 80) {
    alerts.push({
      id: '3',
      type: 'warning',
      message: `CPU usage elevated: ${systemMetrics.cpu.toFixed(1)}%`,
      timestamp: new Date().toISOString(),
      action: 'monitor'
    });
  }
  
  res.json({ alerts });
});

app.get('/api/system/ai-predictions', (req, res) => {
  res.json({
    expectedLoad: 'Normal',
    threatLevel: 'Low',
    recommendedActions: []
  });
});

app.get('/api/system/thinking-feed', (req, res) => {
  res.json({
    insights: ['System running smoothly', 'All checks passed']
  });
});

app.get('/api/system/ai-queue', (req, res) => {
  res.json({
    pendingItems: []
  });
});

app.get('/api/system/ai-diagnostics', (req, res) => {
  res.json({
    mostUsed: ['status', 5],
    sources: { manual: 2, voice: 1, api: 2 },
    patternHits: { 'system-check': 3 }
  });
});

app.get('/api/system/incidents', (req, res) => {
  res.json({
    incidents: []
  });
});

app.get('/api/system/monitor-hub', (req, res) => {
  res.json({
    status: 'operational',
    metrics: {
      uptime: '99.9%',
      cpu: 45,
      memory: 62
    }
  });
});

app.post('/api/system/ai-command', (req, res) => {
  res.json({
    result: 'Command executed successfully',
    status: 'ok'
  });
});

app.get('/api/system/view-logs', (req, res) => {
  res.json({
    logs: []
  });
});

app.delete('/api/system/clear-logs', (req, res) => {
  res.json({
    success: true,
    message: 'Logs cleared'
  });
});

app.post('/api/system/ask-kiranos', (req, res) => {
  const { prompt } = req.body;
  res.json({
    reply: `KiranOS: I received your question "${prompt}". All systems operational.`
  });
});

app.get('/api/system/integrity-scan', (req, res) => {
  res.json({
    flaggedIssues: []
  });
});

// Force critical state for testing
app.post('/api/system/force-critical', (req, res) => {
  systemMetrics.cpu = 95;
  systemMetrics.memory = 92;
  console.log('⚠️ FORCED CRITICAL STATE - CPU: 95%, Memory: 92%');
  res.json({
    success: true,
    message: 'Critical state activated',
    metrics: systemMetrics
  });
});

// Reset to healthy state
app.post('/api/system/reset-health', (req, res) => {
  systemMetrics.cpu = 45;
  systemMetrics.memory = 55;
  systemMetrics.storage = 60;
  console.log('✅ RESET TO HEALTHY STATE');
  res.json({
    success: true,
    message: 'System reset to healthy state',
    metrics: systemMetrics
  });
});

// ===== HEALTH CHECK =====
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'demo',
    features: [
      'OpenAI Vision Alt-Text',
      'Zero-Trust Security (WebAuthn, Rate Limiting, Audit, Sessions, RBAC)',
      'Web Stories Editor',
      'Comment Moderation',
      'SEO Tools',
      'Analytics Dashboard'
    ],
    timestamp: new Date().toISOString()
  });
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  res.status(500).json({ success: false, error: err.message });
});

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 NewsPulse Admin - Demo Server');
  console.log('='.repeat(60));
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`✅ Mode: Advanced Features Only (No Legacy Code)`);
  console.log('\n📦 Available Features:');
  console.log('   • OpenAI Vision Alt-Text Generation');
  console.log('   • Zero-Trust Security Dashboard');
  console.log('     - WebAuthn/Passkeys');
  console.log('     - Rate Limiting & IP Blocking');
  console.log('     - Audit Trail');
  console.log('     - Session Management');
  console.log('     - RBAC');
  console.log('   • Web Stories Editor');
  console.log('   • Comment Moderation');
  console.log('   • SEO Tools');
  console.log('   • Analytics Dashboard');
  console.log('\n🌐 Frontend: http://localhost:5173');
  console.log('🔧 API Health: http://localhost:3002/api/health');
  console.log('='.repeat(60) + '\n');
});

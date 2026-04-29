const express = require('express');
const Settings = require('../models/Settings');

const router = express.Router();

const DEFAULT_PUBLIC_SITE_SETTINGS = {
  homepage: {
    modules: {
      explore: { enabled: true, order: 1 },
      categoryStrip: { enabled: true, order: 2 },
      trending: { enabled: true, order: 3 },
      quickTools: { enabled: true, order: 6 },
      appPromo: { enabled: false, order: 7 },
      footer: { enabled: true, order: 8 },
    },
  },
  tickers: {
    pauseOnHover: true,
    live: { enabled: false, speedSec: 65, maxItems: 15, order: 4 },
    breaking: { enabled: false, speedSec: 55, maxItems: 12, order: 5 },
  },
  liveTv: { enabled: false, embedUrl: '' },
  inspirationHub: {
    enabled: false,
    droneTvEnabled: false,
    youtubeUrl: '',
    embedUrl: '',
    droneTvYoutubeUrl: '',
    title: '',
    videoTitle: '',
    subtitle: '',
    videoSubtitle: '',
    autoplayMuted: true,
    showOnHomepage: false,
    showOnCategoryPage: true,
    showOnInspirationHubPage: true,
    localizedContent: {
      sectionTitle: { en: '', hi: '', gu: '' },
      sectionSubtitle: { en: '', hi: '', gu: '' },
      droneTvTitle: { en: '', hi: '', gu: '' },
      droneTvSubtitle: { en: '', hi: '', gu: '' },
      dailyWondersHeading: { en: '', hi: '', gu: '' },
      quoteText: { en: '', hi: '', gu: '' },
      cardText: { en: '', hi: '', gu: '' },
      narrationText: { en: '', hi: '', gu: '' },
    },
  },
  languageTheme: { languages: ['en'], themePreset: 'system' },
};

const SETTINGS_KEY = 'public-site-settings';

let memoryStore = {
  draft: clone(DEFAULT_PUBLIC_SITE_SETTINGS),
  published: clone(DEFAULT_PUBLIC_SITE_SETTINGS),
  version: 1,
  updatedAt: new Date().toISOString(),
  draftVersion: 1,
  draftUpdatedAt: new Date().toISOString(),
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(base, patch) {
  const out = Array.isArray(base) ? base.slice() : { ...(base || {}) };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value === undefined) continue;
    out[key] = isObject(out[key]) && isObject(value) ? deepMerge(out[key], value) : value;
  }
  return out;
}

function normalizeHomepageModules(modules) {
  const next = { ...(modules || {}) };
  if (isObject(next.exploreCategories)) next.explore = deepMerge(next.exploreCategories, next.explore || {});
  if (isObject(next.trendingStrip)) next.trending = deepMerge(next.trendingStrip, next.trending || {});
  delete next.exploreCategories;
  delete next.trendingStrip;
  return next;
}

function normalizeSettings(value) {
  const merged = deepMerge(clone(DEFAULT_PUBLIC_SITE_SETTINGS), value || {});
  merged.homepage = merged.homepage || {};
  merged.homepage.modules = deepMerge(
    clone(DEFAULT_PUBLIC_SITE_SETTINGS.homepage.modules),
    normalizeHomepageModules(merged.homepage.modules)
  );
  merged.tickers = deepMerge(clone(DEFAULT_PUBLIC_SITE_SETTINGS.tickers), merged.tickers || {});
  merged.tickers.live = deepMerge(clone(DEFAULT_PUBLIC_SITE_SETTINGS.tickers.live), merged.tickers.live || {});
  merged.tickers.breaking = deepMerge(clone(DEFAULT_PUBLIC_SITE_SETTINGS.tickers.breaking), merged.tickers.breaking || {});
  return merged;
}

function normalizeStore(config) {
  const now = new Date().toISOString();
  const draft = normalizeSettings(config?.draft || config?.published || DEFAULT_PUBLIC_SITE_SETTINGS);
  const published = normalizeSettings(config?.published || config?.draft || DEFAULT_PUBLIC_SITE_SETTINGS);
  return {
    draft,
    published,
    version: Number(config?.version || 1),
    updatedAt: typeof config?.updatedAt === 'string' ? config.updatedAt : now,
    draftVersion: Number(config?.draftVersion || config?.version || 1),
    draftUpdatedAt: typeof config?.draftUpdatedAt === 'string' ? config.draftUpdatedAt : now,
  };
}

async function loadStore() {
  try {
    const doc = await Settings.findOne({ key: SETTINGS_KEY });
    if (!doc) {
      await Settings.findOneAndUpdate(
        { key: SETTINGS_KEY },
        { key: SETTINGS_KEY, config: memoryStore },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      return memoryStore;
    }
    memoryStore = normalizeStore(doc.config || {});
    return memoryStore;
  } catch (err) {
    return memoryStore;
  }
}

async function saveStore(store) {
  memoryStore = normalizeStore(store);
  try {
    await Settings.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { key: SETTINGS_KEY, config: memoryStore },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch (err) {
    // Keep local dev usable even when Mongo is not running.
  }
  return memoryStore;
}

function sendBundle(res, store) {
  return res.json({ ok: true, settings: store, ...store });
}

async function saveDraft(req, res) {
  const current = await loadStore();
  const now = new Date().toISOString();
  const draft = normalizeSettings(req.body || {});
  const next = await saveStore({
    ...current,
    draft,
    draftVersion: Number(current.draftVersion || 1) + 1,
    draftUpdatedAt: now,
  });
  return res.json({ ok: true, status: 'draft', draft: next.draft, published: next.published, ...next });
}

async function publish(req, res) {
  const current = await loadStore();
  const now = new Date().toISOString();
  const source = isObject(req.body) && Object.keys(req.body).length ? req.body : current.draft;
  const published = normalizeSettings(source);
  const next = await saveStore({
    ...current,
    draft: published,
    published,
    version: Number(current.version || 1) + 1,
    updatedAt: now,
    draftVersion: Number(current.draftVersion || 1) + 1,
    draftUpdatedAt: now,
  });
  return res.json({ ok: true, status: 'published', published: next.published, draft: next.draft, ...next });
}

router.get('/admin/settings/public', async (_req, res) => sendBundle(res, await loadStore()));
router.put('/admin/settings/public', saveDraft);
router.put('/admin/settings/public/draft', saveDraft);
router.post('/admin/settings/public/publish', publish);
router.get('/settings/public', async (_req, res) => res.json((await loadStore()).published));
router.get('/public/settings', async (_req, res) => res.json((await loadStore()).published));

module.exports = router;
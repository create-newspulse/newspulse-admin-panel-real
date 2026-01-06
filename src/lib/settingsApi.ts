import { SiteSettingsSchema, type SiteSettings, DEFAULT_SETTINGS } from '@/types/siteSettings';
import { AdminApiError, adminJson } from '@/lib/http/adminFetch';
import { apiUrl } from '@/lib/api';

// Public settings shape (subset safe for frontend)
export type PublicSettings = Record<string, any>;

// Helper: localStorage TTL cache
function getCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { expiresAt, value } = parsed;
    if (!expiresAt || Date.now() > Number(expiresAt)) return null;
    return value as T;
  } catch { return null; }
}

function setCache<T>(key: string, value: T, ttlMs: number) {
  try {
    const expiresAt = Date.now() + Math.max(1000, ttlMs);
    localStorage.setItem(key, JSON.stringify({ value, expiresAt }));
  } catch { /* ignore quota */ }
}

async function json<T>(res: Response): Promise<T> {
  if (res.status === 204) return {} as any;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text) return {} as any;
  try { return JSON.parse(text) as T; } catch { return {} as any; }
}

function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function normalizePublicSiteDraft(draft: SiteSettings): Partial<SiteSettings> {
  // Only send the public-site relevant settings; let backend remain the source of truth.
  const ui: any = (draft as any)?.ui || {};
  const tickers: any = (draft as any)?.tickers || {};
  return {
    ui: {
      ...ui,
      showBreakingTicker: !!ui.showBreakingTicker,
      showLiveUpdatesTicker: !!ui.showLiveUpdatesTicker,
    },
    tickers: {
      ...tickers,
      breakingSpeedSec: clampNumber(tickers.breakingSpeedSec, 1, 60, 6),
      liveSpeedSec: clampNumber(tickers.liveSpeedSec, 1, 60, 6),
    },
    // Include other public-site sections so publish is complete.
    navigation: (draft as any)?.navigation,
    voice: (draft as any)?.voice,
    homepage: (draft as any)?.homepage,
    liveTv: (draft as any)?.liveTv,
    footer: (draft as any)?.footer,
  };
}

function extractPublishedPublicSettings(raw: any): Partial<SiteSettings> {
  // Support backends that return either:
  // - a direct public settings object
  // - an envelope like { published: {...}, version, updatedAt }
  // - a setting envelope like { setting: { status, version, data: {...} } }
  // - a generic envelope like { data: {...} }
  const candidate = (() => {
    if (!raw || typeof raw !== 'object') return raw;
    const anyRaw: any = raw as any;
    if (anyRaw.published && typeof anyRaw.published === 'object') return anyRaw.published;
    if (anyRaw.settings && typeof anyRaw.settings === 'object') return anyRaw.settings;
    if (anyRaw.setting && typeof anyRaw.setting === 'object') {
      if (anyRaw.setting.data && typeof anyRaw.setting.data === 'object') return anyRaw.setting.data;
      return anyRaw.setting;
    }
    if (anyRaw.data && typeof anyRaw.data === 'object') return anyRaw.data;
    return raw;
  })();

  // Parse against full schema (with defaults), then return only the public-safe subset.
  const parsed = SiteSettingsSchema.safeParse({ ...DEFAULT_SETTINGS, ...(candidate ?? {}) });
  const s = parsed.success ? parsed.data : DEFAULT_SETTINGS;
  return {
    ui: s.ui,
    navigation: s.navigation,
    voice: s.voice,
    homepage: s.homepage,
    tickers: s.tickers,
    liveTv: s.liveTv,
    footer: s.footer,
  };
}

type PublicSiteBundle = {
  draft?: unknown;
  published?: unknown;
};

// React 18 StrictMode in dev can mount/unmount/remount, causing duplicate loads.
// De-dupe in-flight requests to reduce noisy duplicate 404s without changing UI behavior.
let publicSiteBundleInFlight: Promise<{ draft: Partial<SiteSettings> | null; published: Partial<SiteSettings> | null }> | null = null;

function extractPublicSiteBundle(raw: any): { draft: Partial<SiteSettings> | null; published: Partial<SiteSettings> | null } {
  if (!raw || typeof raw !== 'object') {
    return { draft: null, published: null };
  }
  const anyRaw: any = raw as any;

  // Expected envelope: { draft, published }
  const draftRaw = anyRaw.draft;
  const publishedRaw = anyRaw.published;

  const published = typeof publishedRaw !== 'undefined' ? extractPublishedPublicSettings({ published: publishedRaw }) : null;
  // Draft may be a full object or an envelope like { draft: {...} }
  const draft = typeof draftRaw !== 'undefined' ? extractPublishedPublicSettings({ published: draftRaw }) : null;

  // Some backends return only one object (treat as published).
  if (!draft && !published) {
    const fallbackPublished = extractPublishedPublicSettings(raw);
    return { draft: null, published: fallbackPublished };
  }

  return { draft, published };
}

async function getPublicSiteSettings(): Promise<Partial<SiteSettings>> {
  // Prefer legacy route expected by some backends:
  // GET /api/admin/public-settings (proxy-mode caller path: /admin/public-settings)
  // Fallback to canonical bundle route:
  // GET /api/admin/settings/public (proxy-mode caller path: /admin/settings/public)
  try {
    const raw = await adminJson<any>('/admin/public-settings', { cache: 'no-store' });
    return extractPublishedPublicSettings(raw);
  } catch (e: any) {
    const status = Number((e as AdminApiError)?.status);
    if (status === 404) {
      // eslint-disable-next-line no-console
      console.error('[settingsApi] 404 GET /admin/public-settings', { url: (e as AdminApiError)?.url });
      const raw = await adminJson<any>('/admin/settings/public', { cache: 'no-store' });
      return extractPublishedPublicSettings(raw);
    }
    throw e;
  }
}

async function getPublicSiteBundle(): Promise<{ draft: Partial<SiteSettings> | null; published: Partial<SiteSettings> | null }> {
  if (publicSiteBundleInFlight) return publicSiteBundleInFlight;
  publicSiteBundleInFlight = (async () => {
    // Preferred: GET /admin/settings/public -> { draft?, published? }
    // Fallback:  GET /admin/public-settings -> { draft?, published? } (legacy backends)
    try {
      const raw: PublicSiteBundle = await adminJson<any>('/admin/settings/public', { cache: 'no-store' });
      return extractPublicSiteBundle(raw);
    } catch (e: any) {
      const status = Number((e as AdminApiError)?.status);
      if (status === 404) {
        // eslint-disable-next-line no-console
        console.error('[settingsApi] 404 GET /admin/settings/public', { url: (e as AdminApiError)?.url });
        const raw: PublicSiteBundle = await adminJson<any>('/admin/public-settings', { cache: 'no-store' });
        return extractPublicSiteBundle(raw);
      }
      throw e;
    }
  })();
  try {
    return await publicSiteBundleInFlight;
  } finally {
    // Always clear so future navigations refetch.
    publicSiteBundleInFlight = null;
  }
}

async function getPublicSiteDraft(): Promise<Partial<SiteSettings>> {
  // Preferred (per backend contract):
  // - GET /admin/public-settings/draft -> { draft } or direct object
  // Fallbacks:
  // - GET /admin/settings/public/draft
  // - GET /admin/settings/public OR /admin/public-settings -> { draft?, published? }
  try {
    const raw = await adminJson<any>('/admin/public-settings/draft', { cache: 'no-store' });
    if (raw && typeof raw === 'object' && (raw as any).draft) {
      return extractPublishedPublicSettings({ published: (raw as any).draft });
    }
    return extractPublishedPublicSettings({ published: raw });
  } catch (e: any) {
    const status = Number((e as AdminApiError)?.status);
    if (status === 404) {
      // eslint-disable-next-line no-console
      console.error('[settingsApi] 404 GET /admin/public-settings/draft', { url: (e as AdminApiError)?.url });
    }
    // If the preferred draft endpoint isn't implemented yet, try the canonical draft route.
    if (status === 404) {
      try {
        const raw = await adminJson<any>('/admin/settings/public/draft', { cache: 'no-store' });
        if (raw && typeof raw === 'object' && (raw as any).draft) {
          return extractPublishedPublicSettings({ published: (raw as any).draft });
        }
        return extractPublishedPublicSettings({ published: raw });
      } catch (e2: any) {
        const status2 = Number((e2 as AdminApiError)?.status);
        if (status2 === 404) {
          // eslint-disable-next-line no-console
          console.error('[settingsApi] 404 GET /admin/settings/public/draft', { url: (e2 as AdminApiError)?.url });
        }
      }
    }

    // If no draft endpoint is implemented, fall back to the bundle.
    if (status === 404) {
      const bundle = await getPublicSiteBundle().catch(() => ({ draft: null, published: null }));
      return bundle.draft || bundle.published || extractPublishedPublicSettings(DEFAULT_SETTINGS);
    }
    if (status === 401) throw new Error('Session expired, please login again.');
    throw e;
  }
}

async function savePublicSiteDraft(draft: SiteSettings, audit?: { action?: string }): Promise<void> {
  const payload = normalizePublicSiteDraft(draft);
  try {
    // Preferred (per backend contract): PUT /admin/public-settings/draft
    await adminJson<any>('/admin/public-settings/draft', {
      method: 'PUT',
      headers: {
        ...(audit?.action ? { 'X-Admin-Action': `${audit.action}:draft` } : {}),
      },
      json: payload,
      cache: 'no-store',
    });
  } catch (e: any) {
    const status = Number((e as AdminApiError)?.status);
    if (status === 401) throw new Error('Session expired, please login again.');
    if (status === 404) {
      // eslint-disable-next-line no-console
      console.error('[settingsApi] 404 PUT /admin/public-settings/draft', { url: (e as AdminApiError)?.url });
      // Fall back to canonical endpoint for newer backends.
      try {
        await adminJson<any>('/admin/settings/public/draft', {
          method: 'PUT',
          headers: {
            ...(audit?.action ? { 'X-Admin-Action': `${audit.action}:draft` } : {}),
          },
          json: payload,
          cache: 'no-store',
        });
        return;
      } catch (e2: any) {
        const status2 = Number((e2 as AdminApiError)?.status);
        if (status2 === 404) {
          // eslint-disable-next-line no-console
          console.error('[settingsApi] 404 PUT /admin/settings/public/draft', { url: (e2 as AdminApiError)?.url });
        }
      }
      throw new Error('Draft API missing in backend');
    }
    throw e;
  }
}

/**
 * Public Site Settings publish:
 * - PUT  /admin/settings/public/draft
 * - POST /admin/settings/public/publish
 * - GET  /admin/settings/public (confirm)
 * - GET  /admin/settings (refresh full admin settings document)
 */
async function publishPublicSiteSettings(
  draft: SiteSettings,
  audit?: { action?: string }
): Promise<{ draft: Partial<SiteSettings> | null; published: Partial<SiteSettings> | null }> {
  const payload = normalizePublicSiteDraft(draft);

  try {
    // 1) Save draft to backend
    // Preferred: /admin/public-settings/*
    // Fallback:  /admin/settings/public/*
    const draftPath = '/admin/public-settings/draft';
    const publishPath = '/admin/public-settings/publish';
    await adminJson<any>(draftPath, {
      method: 'PUT',
      headers: {
        ...(audit?.action ? { 'X-Admin-Action': `${audit.action}:draft` } : {}),
      },
      json: payload,
      cache: 'no-store',
    });

    // 2) Publish (most backends don't require a body here)
    try {
      await adminJson<any>(publishPath, {
        method: 'POST',
        headers: {
          ...(audit?.action ? { 'X-Admin-Action': audit.action } : {}),
        },
        cache: 'no-store',
      });
    } catch (e: any) {
      const status = Number((e as AdminApiError)?.status);
      // Some backends expect the payload again. Retry once with JSON.
      if (status === 400 || status === 415) {
        await adminJson<any>(publishPath, {
          method: 'POST',
          headers: {
            ...(audit?.action ? { 'X-Admin-Action': audit.action } : {}),
          },
          json: payload,
          cache: 'no-store',
        });
      } else if (status === 404) {
        // eslint-disable-next-line no-console
        console.error('[settingsApi] 404 POST /admin/public-settings/publish', { url: (e as AdminApiError)?.url });
        throw e;
      } else {
        throw e;
      }
    }

    // 3) Confirm published settings by refetching the bundle.
    return await getPublicSiteBundle();
  } catch (e: any) {
    const status = Number((e as AdminApiError)?.status);
    if (status === 401) throw new Error('Session expired, please login again.');
    if (status === 404) {
      // eslint-disable-next-line no-console
      console.error('[settingsApi] 404 publish public-site settings', { url: (e as AdminApiError)?.url });
      // Fallback once to newer canonical endpoints.
      try {
        await adminJson<any>('/admin/settings/public/draft', {
          method: 'PUT',
          headers: {
            ...(audit?.action ? { 'X-Admin-Action': `${audit.action}:draft` } : {}),
          },
          json: payload,
          cache: 'no-store',
        });

        await adminJson<any>('/admin/settings/public/publish', {
          method: 'POST',
          headers: {
            ...(audit?.action ? { 'X-Admin-Action': audit.action } : {}),
          },
          cache: 'no-store',
        });

        return await getPublicSiteBundle();
      } catch (e2: any) {
        const status2 = Number((e2 as AdminApiError)?.status);
        if (status2 === 404) {
          // eslint-disable-next-line no-console
          console.error('[settingsApi] 404 fallback publish /admin/settings/public/*', { url: (e2 as AdminApiError)?.url });
        }
      }
      throw new Error('Publish API missing in backend');
    }
    throw e;
  }
}

// Admin settings (auth required)
async function getAdminSettings(): Promise<SiteSettings> {
  let raw: any;
  // Single endpoint only; no automatic fallback chain to settings/load
  raw = await adminJson<any>('/settings', { cache: 'no-store' });
  if (raw && typeof raw === 'object' && raw.settings) raw = raw.settings;

  // Accept both envelope { public, admin, version, updatedAt, updatedBy } and direct SiteSettings
  if (raw && typeof raw === 'object' && (raw.public || raw.admin)) {
    const merged = { ...(raw.public || {}), ...(raw.admin || {}) };
    const meta = { version: raw.version, updatedAt: raw.updatedAt, updatedBy: raw.updatedBy };
    const parsed = SiteSettingsSchema.safeParse({ ...merged, ...meta });
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  }
  const parsed = SiteSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

async function putAdminSettings(patch: Partial<SiteSettings>, audit?: { action?: string }): Promise<SiteSettings> {
  let raw: any;
  // Update via single endpoint; do not auto-refetch via settings/load
  raw = await adminJson<any>('/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(audit?.action ? { 'X-Admin-Action': audit.action } : {}),
    },
    body: JSON.stringify(patch || {}),
  });
  if (raw && typeof raw === 'object' && raw.settings) raw = raw.settings;
  if (raw && typeof raw === 'object' && (raw.public || raw.admin)) {
    const merged = { ...(raw.public || {}), ...(raw.admin || {}) };
    const meta = { version: raw.version, updatedAt: raw.updatedAt, updatedBy: raw.updatedBy };
    const parsed = SiteSettingsSchema.safeParse({ ...merged, ...meta });
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  }
  const parsed = SiteSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

// Public settings for frontend
const PUBLIC_CACHE_KEY = 'np_public_settings_cache_v1';

async function getPublicSettings(): Promise<PublicSettings> {
  const res = await fetch(apiUrl('/settings/public'), { cache: 'no-store', credentials: 'include' });
  try { return await json<PublicSettings>(res); } catch { return {}; }
}

async function getCachedPublicSettings(ttlMs = 10 * 60 * 1000): Promise<PublicSettings> {
  const hit = getCache<PublicSettings>(PUBLIC_CACHE_KEY);
  if (hit) return hit;
  const fresh = await getPublicSettings();
  setCache(PUBLIC_CACHE_KEY, fresh, ttlMs);
  return fresh;
}

export const settingsApi = {
  getAdminSettings,
  putAdminSettings,
  getPublicSiteSettings,
  getPublicSiteBundle,
  getPublicSiteDraft,
  savePublicSiteDraft,
  publishPublicSiteSettings,
  getPublicSettings,
  getCachedPublicSettings,
};
export default settingsApi;

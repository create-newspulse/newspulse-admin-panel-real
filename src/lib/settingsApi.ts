import { SiteSettingsSchema, type SiteSettings, DEFAULT_SETTINGS } from '@/types/siteSettings';
import { adminJson } from '@/lib/http/adminFetch';
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

let inFlightAdminSettings: Promise<SiteSettings> | null = null;
let inFlightAdminPublicSiteSettings: Promise<SiteSettings> | null = null;
let inFlightAdminPublicSiteSettingsBundle: Promise<{ draft: SiteSettings; published: SiteSettings; meta: { version?: number; updatedAt?: string; draftVersion?: number; draftUpdatedAt?: string } }> | null = null;

// Admin settings (auth required)
async function getAdminSettings(): Promise<SiteSettings> {
  if (inFlightAdminSettings) return inFlightAdminSettings;

  inFlightAdminSettings = (async () => {
  let raw: any;
  // Single endpoint only; no automatic fallback chain to settings/load
  raw = await adminJson<any>('/admin/settings', { cache: 'no-store' });
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
  })().finally(() => {
    inFlightAdminSettings = null;
  });

  return inFlightAdminSettings;
}

// Public-site settings (auth required) — admin endpoint for safe public settings only
async function getAdminPublicSiteSettings(): Promise<SiteSettings> {
  if (inFlightAdminPublicSiteSettings) return inFlightAdminPublicSiteSettings;

  inFlightAdminPublicSiteSettings = (async () => {
    const raw = await adminJson<any>('/admin/settings/public', { cache: 'no-store' });
    return parseAdminPublicSiteSettingsResponse(raw, { prefer: 'draft' });
  })().finally(() => {
    inFlightAdminPublicSiteSettings = null;
  });

  return inFlightAdminPublicSiteSettings;
}

async function getAdminPublicSiteSettingsBundle(): Promise<{
  draft: SiteSettings;
  published: SiteSettings;
  meta: { version?: number; updatedAt?: string; draftVersion?: number; draftUpdatedAt?: string };
}> {
  if (inFlightAdminPublicSiteSettingsBundle) return inFlightAdminPublicSiteSettingsBundle;

  inFlightAdminPublicSiteSettingsBundle = (async () => {
    const raw = await adminJson<any>('/admin/settings/public', { cache: 'no-store' });
    const envelope = (raw && typeof raw === 'object' && (raw as any).settings) ? (raw as any).settings : raw;

    const draft = parseAdminPublicSiteSettingsResponse(envelope, { prefer: 'draft' });
    const published = parseAdminPublicSiteSettingsResponse(envelope, { prefer: 'published' });
    const meta = {
      version: typeof (envelope as any)?.version === 'number' ? (envelope as any).version : undefined,
      updatedAt: typeof (envelope as any)?.updatedAt === 'string' ? (envelope as any).updatedAt : undefined,
      draftVersion: typeof (envelope as any)?.draftVersion === 'number' ? (envelope as any).draftVersion : undefined,
      draftUpdatedAt: typeof (envelope as any)?.draftUpdatedAt === 'string' ? (envelope as any).draftUpdatedAt : undefined,
    };
    return { draft, published, meta };
  })().finally(() => {
    inFlightAdminPublicSiteSettingsBundle = null;
  });

  return inFlightAdminPublicSiteSettingsBundle;
}

async function putAdminPublicSiteSettings(patch: Partial<SiteSettings>, audit?: { action?: string }): Promise<SiteSettings> {
  const raw = await adminJson<any>('/admin/settings/public/draft', {
    method: 'PUT',
    headers: {
      ...(audit?.action ? { 'X-Admin-Action': audit.action } : {}),
    },
    json: patch || {},
  });
  return parseAdminPublicSiteSettingsResponse(raw, { prefer: 'draft' });
}

async function publishAdminPublicSiteSettings(settings: Partial<SiteSettings>, audit?: { action?: string }): Promise<SiteSettings> {
  const payload = settings || {};
  const raw = await adminJson<any>('/admin/settings/public/publish', {
    method: 'POST',
    headers: {
      ...(audit?.action ? { 'X-Admin-Action': audit.action } : {}),
    },
    // Backend may publish the stored draft; sending the current draft keeps the call self-describing.
    json: payload,
  });
  return parseAdminPublicSiteSettingsResponse(raw, { prefer: 'published' });
}

function parseAdminPublicSiteSettingsResponse(
  input: unknown,
  opts: { prefer: 'draft' | 'published' } = { prefer: 'draft' }
): SiteSettings {
  let raw: any = input as any;

  // Common wrapper: { settings: ... }
  if (raw && typeof raw === 'object' && (raw as any).settings) raw = (raw as any).settings;

  // Canonical backend envelope:
  // - GET returns { ok, draft, published, ... }
  // - PUT draft returns { ok, status:'draft', draft, ... }
  // - POST publish returns { ok, status:'published', published, ... }
  if (raw && typeof raw === 'object') {
    const anyRaw: any = raw as any;
    const preferredValue =
      opts.prefer === 'published'
        ? (anyRaw.published ?? anyRaw.draft)
        : (anyRaw.draft ?? anyRaw.published);
    if (preferredValue && typeof preferredValue === 'object') {
      raw = preferredValue;
    } else if (anyRaw.status === 'published' && anyRaw.published && typeof anyRaw.published === 'object') {
      raw = anyRaw.published;
    } else if (anyRaw.status === 'draft' && anyRaw.draft && typeof anyRaw.draft === 'object') {
      raw = anyRaw.draft;
    }
  }

  // Accept envelope { public, admin, version, ... } and direct SiteSettings
  if (raw && typeof raw === 'object' && ((raw as any).public || (raw as any).admin)) {
    const anyRaw: any = raw as any;
    const merged = { ...(anyRaw.public || {}), ...(anyRaw.admin || {}) };
    const meta = { version: anyRaw.version, updatedAt: anyRaw.updatedAt, updatedBy: anyRaw.updatedBy };
    const parsed = SiteSettingsSchema.safeParse({ ...merged, ...meta });
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  }

  const parsed = SiteSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

async function putAdminSettings(patch: Partial<SiteSettings>, audit?: { action?: string }): Promise<SiteSettings> {
  let raw: any;
  // Update via single endpoint; do not auto-refetch via settings/load
  raw = await adminJson<any>('/admin/settings', {
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
  getAdminPublicSiteSettings,
  getAdminPublicSiteSettingsBundle,
  putAdminPublicSiteSettings,
  publishAdminPublicSiteSettings,
  getPublicSettings,
  getCachedPublicSettings,
};
export default settingsApi;

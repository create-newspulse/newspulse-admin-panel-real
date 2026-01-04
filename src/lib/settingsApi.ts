import { SiteSettingsSchema, type SiteSettings, DEFAULT_SETTINGS } from '@/types/siteSettings';
import { adminJson } from '@/lib/http/adminFetch';

function isProxyMode(): boolean {
  try {
    const raw = ((import.meta as any)?.env?.VITE_API_URL || '').toString().trim();
    return raw.startsWith('/');
  } catch {
    return false;
  }
}

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

// Admin settings (auth required)
async function getAdminSettings(): Promise<SiteSettings> {
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
}

async function putAdminSettings(patch: Partial<SiteSettings>, audit?: { action?: string }): Promise<SiteSettings> {
  let raw: any;
  // Update via single endpoint; do not auto-refetch via settings/load
  raw = await adminJson<any>('/admin/settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(audit?.action && isProxyMode() ? { 'X-Admin-Action': audit.action } : {}),
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
  const res = await fetch('/settings/public', { cache: 'no-store' });
  try { return await json<PublicSettings>(res); } catch { return {}; }
}

async function getCachedPublicSettings(ttlMs = 10 * 60 * 1000): Promise<PublicSettings> {
  const hit = getCache<PublicSettings>(PUBLIC_CACHE_KEY);
  if (hit) return hit;
  const fresh = await getPublicSettings();
  setCache(PUBLIC_CACHE_KEY, fresh, ttlMs);
  return fresh;
}

export const settingsApi = { getAdminSettings, putAdminSettings, getPublicSettings, getCachedPublicSettings };
export default settingsApi;

import { AdminApiError, adminJson } from '@/lib/http/adminFetch';

export type BroadcastType = 'breaking' | 'live';
export type BroadcastMode = 'manual' | 'auto';

export type BroadcastSettings = {
  breakingEnabled: boolean;
  breakingMode: BroadcastMode;
  liveEnabled: boolean;
  liveMode: BroadcastMode;
};

export type BroadcastItem = {
  _id: string;
  type: BroadcastType;
  text: string;
  isLive: boolean;
  createdAt: string;
  expiresAt: string;
  language?: string;
  authorId?: string;
  updatedAt?: string;
};

export type BroadcastSnapshot = {
  settings: BroadcastSettings;
  // Backend may return either a flat array (with item.type) or a split object.
  itemsLast24h:
    | BroadcastItem[]
    | {
        breaking?: BroadcastItem[];
        live?: BroadcastItem[];
      };
};

const ADMIN_BROADCAST_BASE = '/admin-api/admin/broadcast';
const LEGACY_BROADCAST_BASE = '/admin-api/broadcast';

function isNotFound(e: unknown): boolean {
  return e instanceof AdminApiError && e.status === 404;
}

function normalizeSettingsResponse(raw: unknown): BroadcastSettings {
  if (raw && typeof raw === 'object' && 'settings' in (raw as any)) {
    return (raw as any).settings as BroadcastSettings;
  }
  return raw as BroadcastSettings;
}

function normalizeTypedItems(type: BroadcastType, items: BroadcastItem[]): BroadcastItem[] {
  return (items || []).map((it) => ({ ...it, type: (it as any)?.type || type }));
}

function normalizeSnapshotItems(snapshot: BroadcastSnapshot, type: BroadcastType): BroadcastItem[] {
  const raw = snapshot?.itemsLast24h as any;
  if (Array.isArray(raw)) {
    return (raw as BroadcastItem[]).filter((it) => (it as any)?.type === type);
  }
  if (raw && typeof raw === 'object') {
    const list = (raw[type] || []) as BroadcastItem[];
    return normalizeTypedItems(type, list);
  }
  return [];
}

async function legacyGetSettings(opts?: { signal?: AbortSignal }): Promise<BroadcastSettings> {
  // Legacy backend: GET /api/broadcast/settings
  return adminJson<BroadcastSettings>(`${LEGACY_BROADCAST_BASE}/settings`, { method: 'GET', signal: opts?.signal });
}

async function legacyListItems(type: BroadcastType, opts?: { signal?: AbortSignal }): Promise<BroadcastItem[]> {
  // Legacy backend: GET /api/broadcast/items?type=breaking|live
  const qs = new URLSearchParams({ type });
  return adminJson<BroadcastItem[]>(`${LEGACY_BROADCAST_BASE}/items?${qs.toString()}`, { method: 'GET', signal: opts?.signal });
}

export async function getBroadcastSnapshot(opts?: { signal?: AbortSignal }): Promise<BroadcastSnapshot> {
  try {
    return await adminJson<BroadcastSnapshot>(ADMIN_BROADCAST_BASE, { method: 'GET', signal: opts?.signal });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    // Fallback for older/demo backends that only implement /broadcast/settings + /broadcast/items
    const [settings, breaking, live] = await Promise.all([
      legacyGetSettings(opts),
      legacyListItems('breaking', opts),
      legacyListItems('live', opts),
    ]);
    return {
      settings,
      itemsLast24h: [...normalizeTypedItems('breaking', breaking), ...normalizeTypedItems('live', live)],
    };
  }
}

export async function patchBroadcastSettings(settings: BroadcastSettings): Promise<BroadcastSettings> {
  try {
    const raw = await adminJson<unknown>(`${ADMIN_BROADCAST_BASE}/settings`, { method: 'PATCH', json: settings });
    return normalizeSettingsResponse(raw);
  } catch (e) {
    if (!isNotFound(e)) throw e;
    // Legacy backend uses PUT
    return adminJson<BroadcastSettings>(`${LEGACY_BROADCAST_BASE}/settings`, { method: 'PUT', json: settings });
  }
}

// --- Backwards-compatible API (used by the existing UI) ---

export async function getBroadcastSettings(opts?: { signal?: AbortSignal }): Promise<BroadcastSettings> {
  try {
    const raw = await adminJson<unknown>(ADMIN_BROADCAST_BASE, { method: 'GET', signal: opts?.signal });
    return normalizeSettingsResponse(raw);
  } catch (e) {
    if (!isNotFound(e)) throw e;
    return legacyGetSettings(opts);
  }
}

export async function updateBroadcastSettings(
  settings: BroadcastSettings,
  opts?: {
    liveSpeedSec?: number;
    breakingSpeedSec?: number;
  },
): Promise<BroadcastSettings> {
  // Production contract (Render): PUT /api/admin/broadcast
  try {
    const payload = {
      ...settings,
      ...(typeof opts?.liveSpeedSec === 'number' ? { liveSpeedSec: opts.liveSpeedSec } : null),
      ...(typeof opts?.breakingSpeedSec === 'number' ? { breakingSpeedSec: opts.breakingSpeedSec } : null),
    };
    const raw = await adminJson<unknown>(ADMIN_BROADCAST_BASE, { method: 'PUT', json: payload });
    return normalizeSettingsResponse(raw);
  } catch (e) {
    if (!isNotFound(e)) throw e;
    // Fallback (older/demo backends)
    return patchBroadcastSettings(settings);
  }
}

export async function listBroadcastItems(type: BroadcastType, opts?: { signal?: AbortSignal }): Promise<BroadcastItem[]> {
  const qs = new URLSearchParams({ type });
  try {
    return await adminJson<BroadcastItem[]>(`${ADMIN_BROADCAST_BASE}/items?${qs.toString()}`, {
      method: 'GET',
      signal: opts?.signal,
    });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    return legacyListItems(type, opts);
  }
}

export async function createBroadcastItem(args: {
  type: BroadcastType;
  text: string;
  language?: string;
}): Promise<BroadcastItem | unknown> {
  try {
    return await adminJson(`${ADMIN_BROADCAST_BASE}/items`, { method: 'POST', json: args });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    // Legacy backend: POST /api/broadcast/items { type, text }
    return adminJson(`${LEGACY_BROADCAST_BASE}/items`, { method: 'POST', json: args });
  }
}

export async function patchBroadcastItem(args: {
  id: string;
  text?: string;
  isLive?: boolean;
}): Promise<BroadcastItem | unknown> {
  // Not part of the new minimal contract list, but still used by the current UI.
  // Prefer a direct PATCH if the backend supports it.
  try {
    return await adminJson(`${ADMIN_BROADCAST_BASE}/items/${encodeURIComponent(args.id)}`, {
      method: 'PATCH',
      json: { text: args.text, isLive: args.isLive },
    });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    return adminJson(`${LEGACY_BROADCAST_BASE}/items/${encodeURIComponent(args.id)}`, {
      method: 'PATCH',
      json: { text: args.text, isLive: args.isLive },
    });
  }
}

export async function createBreakingItem(args: { text: string }): Promise<BroadcastItem | unknown> {
  return createBroadcastItem({ type: 'breaking', text: args.text });
}

export async function createLiveItem(args: { text: string }): Promise<BroadcastItem | unknown> {
  return createBroadcastItem({ type: 'live', text: args.text });
}

export async function deleteBroadcastItem(id: string): Promise<{ ok: true } | unknown> {
  try {
    return await adminJson(`${ADMIN_BROADCAST_BASE}/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    return adminJson(`${LEGACY_BROADCAST_BASE}/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }
}

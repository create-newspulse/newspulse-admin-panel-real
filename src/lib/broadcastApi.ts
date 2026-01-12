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

function isNotFound(e: unknown): boolean {
  return e instanceof AdminApiError && e.status === 404;
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
  return adminJson<BroadcastSettings>('/admin-api/broadcast/settings', { method: 'GET', signal: opts?.signal });
}

async function legacyListItems(type: BroadcastType, opts?: { signal?: AbortSignal }): Promise<BroadcastItem[]> {
  // Legacy backend: GET /api/broadcast/items?type=breaking|live
  const qs = new URLSearchParams({ type });
  return adminJson<BroadcastItem[]>(`/admin-api/broadcast/items?${qs.toString()}`, { method: 'GET', signal: opts?.signal });
}

export async function getBroadcastSnapshot(opts?: { signal?: AbortSignal }): Promise<BroadcastSnapshot> {
  try {
    return await adminJson<BroadcastSnapshot>('/admin-api/broadcast', { method: 'GET', signal: opts?.signal });
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
    return await adminJson<BroadcastSettings>('/admin-api/broadcast/settings', { method: 'PATCH', json: settings });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    // Legacy backend uses PUT
    return adminJson<BroadcastSettings>('/admin-api/broadcast/settings', { method: 'PUT', json: settings });
  }
}

// --- Backwards-compatible API (used by the existing UI) ---

export async function getBroadcastSettings(opts?: { signal?: AbortSignal }): Promise<BroadcastSettings> {
  const snapshot = await getBroadcastSnapshot(opts);
  return snapshot.settings;
}

export async function updateBroadcastSettings(settings: BroadcastSettings): Promise<BroadcastSettings> {
  // New contract prefers PATCH; keep this legacy name for the UI.
  return patchBroadcastSettings(settings);
}

export async function listBroadcastItems(type: BroadcastType, opts?: { signal?: AbortSignal }): Promise<BroadcastItem[]> {
  const snapshot = await getBroadcastSnapshot(opts);
  return normalizeSnapshotItems(snapshot, type);
}

export async function createBroadcastItem(args: {
  type: BroadcastType;
  text: string;
  language?: string;
}): Promise<BroadcastItem | unknown> {
  if (args.type === 'breaking') return createBreakingItem({ text: args.text });
  return createLiveItem({ text: args.text });
}

export async function patchBroadcastItem(args: {
  id: string;
  text?: string;
  isLive?: boolean;
}): Promise<BroadcastItem | unknown> {
  // Not part of the new minimal contract list, but still used by the current UI.
  // Prefer a direct PATCH if the backend supports it.
  return adminJson(`/admin-api/broadcast/items/${encodeURIComponent(args.id)}`, {
    method: 'PATCH',
    json: { text: args.text, isLive: args.isLive },
  });
}

export async function createBreakingItem(args: { text: string }): Promise<BroadcastItem | unknown> {
  try {
    return await adminJson('/admin-api/broadcast/breaking/items', { method: 'POST', json: args });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    // Legacy backend: POST /api/broadcast/items { type, text }
    return adminJson('/admin-api/broadcast/items', { method: 'POST', json: { type: 'breaking', text: args.text } });
  }
}

export async function createLiveItem(args: { text: string }): Promise<BroadcastItem | unknown> {
  try {
    return await adminJson('/admin-api/broadcast/live/items', { method: 'POST', json: args });
  } catch (e) {
    if (!isNotFound(e)) throw e;
    // Legacy backend: POST /api/broadcast/items { type, text }
    return adminJson('/admin-api/broadcast/items', { method: 'POST', json: { type: 'live', text: args.text } });
  }
}

export async function deleteBroadcastItem(id: string): Promise<{ ok: true } | unknown> {
  return adminJson(`/admin-api/broadcast/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

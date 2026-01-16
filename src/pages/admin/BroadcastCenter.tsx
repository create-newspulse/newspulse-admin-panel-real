import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNotify } from '@/components/ui/toast-bridge';
import {
  type BroadcastItem,
  type BroadcastSettings,
  type BroadcastType,
} from '@/lib/broadcastApi';
import { AdminApiError, adminJson } from '@/lib/http/adminFetch';
import { adminSettingsApi } from '@/lib/adminSettingsApi';
import type { SiteSettings } from '@/types/siteSettings';

// BroadcastCenter must always go through the same adminFetch/adminJson wrapper used elsewhere.
// IMPORTANT: We explicitly use the same-origin proxy prefix to avoid any env-based absolute URL
// causing cross-origin PUT/POST/PATCH failures ("Failed to fetch") in production.
const PROXY_BASE = '/admin-api';
const PROXY_BROADCAST_BASE = `${PROXY_BASE}/admin/broadcast`;

function isLocalHostUi(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const h = window.location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '::1';
  } catch {
    return false;
  }
}

async function broadcastJson<T = any>(
  path: string,
  init: Parameters<typeof adminJson>[1] = {},
): Promise<T> {
  try {
    // Normal path: /admin-api/admin/broadcast...
    return await adminJson<T>(`${PROXY_BROADCAST_BASE}${path}`, init as any);
  } catch (e) {
    // Dev/localhost fallback for the bundled demo backend, which exposes /api/broadcast/* (not /api/admin/broadcast/*).
    // IMPORTANT: Never fall back in production, to keep all prod traffic on /admin-api/admin/broadcast*.
    const canFallback = import.meta.env.DEV || isLocalHostUi();
    if (canFallback && e instanceof AdminApiError && e.status === 404) {
      // Legacy proxy path: /admin-api/broadcast... (proxy resolves to backend /api/broadcast...)
      return await adminJson<T>(`${PROXY_BASE}/broadcast${path}`, init as any);
    }
    throw e;
  }
}

const unwrapArray = (x: any) => (Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : []);
const unwrapObj = (x: any) => (x?.data && typeof x.data === 'object' ? x.data : x);

function getBroadcastItemId(item: Partial<BroadcastItem> & Record<string, any>): string {
  const itemId = item?._id ?? item?.id;
  if (!itemId) throw new Error('Broadcast item missing id');
  return String(itemId);
}

function normalizeItems(items: any[]): BroadcastItem[] {
  return (items || []).map((it: any) => {
    const _id = it?._id ?? it?.id;
    const id = it?.id ?? it?._id;
    return { ...it, _id, id } as BroadcastItem;
  });
}

function apiStatusText(e: unknown): string {
  if (e instanceof AdminApiError) {
    if (e.status && e.status !== 0) return `HTTP ${e.status}`;
    return 'Network error';
  }
  return '';
}

function apiBodyText(e: unknown): string {
  if (!(e instanceof AdminApiError)) return '';
  const body = (e as any).body;
  if (!body) return '';
  try {
    return typeof body === 'string' ? body : JSON.stringify(body);
  } catch {
    return '';
  }
}

function apiMessage(e: unknown, fallback = 'API error'): string {
  if (e instanceof AdminApiError) return e.message || fallback;
  const anyErr: any = e as any;
  return anyErr?.message || fallback;
}

function apiErrorDetails(e: unknown, fallback = 'API error'): string {
  const status = apiStatusText(e);
  const msg = apiMessage(e, fallback);
  const bodyText = apiBodyText(e);
  const head = `${status ? `${status}: ` : ''}${msg}`;
  return bodyText ? `${head} • ${bodyText}` : head;
}

function isNetworkError(e: unknown): boolean {
  return e instanceof AdminApiError && e.status === 0;
}

function isUnauthorized(e: unknown): boolean {
  return e instanceof AdminApiError && e.status === 401;
}

function isNotFound(e: unknown): boolean {
  return e instanceof AdminApiError && e.status === 404;
}

function notFoundDetails(e: unknown, url: string): string {
  const missing = e instanceof AdminApiError && e.url ? e.url : url;
  return `Backend route missing: ${missing}`;
}

function formatLocalTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function expiresIn(expiresAtIso: string) {
  const t = new Date(expiresAtIso).getTime();
  if (!Number.isFinite(t)) return '';
  const deltaMs = t - Date.now();
  if (deltaMs <= 0) return 'Expired';
  const totalMinutes = Math.floor(deltaMs / 60_000);
  if (totalMinutes <= 0) return '< 1m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${minutes}m`;
  if (minutes <= 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function sortByCreatedDesc(items: BroadcastItem[]) {
  if (!Array.isArray(items)) return [];
  return items.slice().sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function serializeSettings(s: BroadcastSettings | null) {
  if (!s) return '';
  return JSON.stringify({
    breakingEnabled: !!s.breakingEnabled,
    breakingMode: s.breakingMode,
    liveEnabled: !!s.liveEnabled,
    liveMode: s.liveMode,
  });
}

type TickerSpeeds = {
  liveSpeedSec: number;
  breakingSpeedSec: number;
};

function normalizeSpeeds(s?: Partial<TickerSpeeds> | null): TickerSpeeds {
  const live = typeof s?.liveSpeedSec === 'number' ? s!.liveSpeedSec : 8;
  const breaking = typeof s?.breakingSpeedSec === 'number' ? s!.breakingSpeedSec : 6;
  return {
    liveSpeedSec: Math.max(1, Math.min(60, Number(live) || 8)),
    breakingSpeedSec: Math.max(1, Math.min(60, Number(breaking) || 6)),
  };
}

function SectionCard(props: {
  title: string;
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  mode: 'manual' | 'auto';
  onModeChange: (next: 'manual' | 'auto') => void;
  speedSec?: number;
  onSpeedChange?: (next: number) => void;
  inputValue: string;
  onInputChange: (next: string) => void;
  onAdd: () => void;
  addDisabled: boolean;
  items: BroadcastItem[];
  workingIdMap: Record<string, boolean>;
  onToggleLive: (item: BroadcastItem, next: boolean) => void;
  onDelete: (item: BroadcastItem) => void;
}) {
  const itemsSorted = useMemo(() => sortByCreatedDesc(props.items), [props.items]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{props.title}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Last 24h history</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={props.enabled}
            onChange={(e) => props.onEnabledChange(e.target.checked)}
          />
          Enabled
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Mode</label>
          <select
            value={props.mode}
            onChange={(e) => props.onModeChange(e.target.value as 'manual' | 'auto')}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 sm:w-72"
          >
            <option value="manual">Force ON</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        {typeof props.speedSec === 'number' && typeof props.onSpeedChange === 'function' ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Ticker speed (seconds)</label>
            <input
              type="number"
              min={1}
              max={60}
              value={props.speedSec}
              onChange={(e) => props.onSpeedChange?.(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 sm:w-72"
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={props.inputValue}
            onChange={(e) => props.onInputChange(e.target.value)}
            maxLength={160}
            placeholder="Add story (max 160 chars)"
            className="w-full flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            disabled={props.addDisabled}
            onClick={props.onAdd}
          >
            Add
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700">
          {itemsSorted.length === 0 ? (
            <div className="p-4 text-sm text-slate-600 dark:text-slate-300">No recent stories found</div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {itemsSorted.map((it) => {
                let itemId: string | null = null;
                try {
                  itemId = getBroadcastItemId(it as any);
                } catch {
                  itemId = null;
                }
                const busy = itemId ? !!props.workingIdMap[itemId] : false;
                return (
                  <div key={itemId ?? `${it.createdAt}-${it.text}`} className="flex items-start gap-3 p-4">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={!!it.isLive}
                      disabled={busy || !itemId}
                      onChange={(e) => {
                        props.onToggleLive(it, e.target.checked);
                      }}
                      aria-label="LIVE"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white break-words">{it.text}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Created {formatLocalTime(it.createdAt)} • Expires in {expiresIn(it.expiresAt)}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
                      disabled={busy || !itemId}
                      onClick={() => {
                        props.onDelete(it);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default function BroadcastCenter() {
  const notify = useNotify();
  const notifyRef = useRef(notify);
  useEffect(() => { notifyRef.current = notify; }, [notify]);

  const didInitialLoad = useRef(false);
  const refreshInFlight = useRef(false);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  const [settings, setSettings] = useState<BroadcastSettings | null>(null);
  const [initialSettings, setInitialSettings] = useState<string>('');

  const [tickerSpeeds, setTickerSpeeds] = useState<TickerSpeeds>(() => normalizeSpeeds(null));
  const [initialSpeeds, setInitialSpeeds] = useState<string>('');

  const [breakingText, setBreakingText] = useState('');
  const [liveText, setLiveText] = useState('');

  const [breakingItems, setBreakingItems] = useState<BroadcastItem[]>([]);
  const [liveItems, setLiveItems] = useState<BroadcastItem[]>([]);

  const [workingIdMap, setWorkingIdMap] = useState<Record<string, boolean>>({});
  const [addingType, setAddingType] = useState<BroadcastType | null>(null);

  const dirty = useMemo(() => {
    if (!settings) return false;
    if (serializeSettings(settings) !== initialSettings) return true;
    return JSON.stringify(tickerSpeeds) !== initialSpeeds;
  }, [settings, initialSettings, tickerSpeeds, initialSpeeds]);

  const setWorking = useCallback((id: string, next: boolean) => {
    setWorkingIdMap((prev) => {
      if (prev[id] === next) return prev;
      return { ...prev, [id]: next };
    });
  }, []);

  const loadAll = useCallback(async (signal?: AbortSignal) => {
    const [broadcastRes, breakingRes, liveRes, site] = await Promise.all([
      broadcastJson<any>('', { method: 'GET', signal }),
      broadcastJson<any>('/items?type=breaking', { method: 'GET', signal }),
      broadcastJson<any>('/items?type=live', { method: 'GET', signal }),
      adminSettingsApi.getSettings() as Promise<SiteSettings>,
    ]);

    const broadcastObj = unwrapObj(broadcastRes);
    const settingsObj = unwrapObj((broadcastObj as any)?.settings ?? broadcastObj) as BroadcastSettings;

    setSettings(settingsObj);
    setInitialSettings(serializeSettings(settingsObj));
    setBreakingItems(normalizeItems(unwrapArray(breakingRes) as any[]));
    setLiveItems(normalizeItems(unwrapArray(liveRes) as any[]));

    const speeds = normalizeSpeeds((site as any)?.tickers);
    setTickerSpeeds(speeds);
    setInitialSpeeds(JSON.stringify(speeds));
  }, []);

  const refreshAll = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;

    const controller = new AbortController();
    const timeoutMs = 12_000;
    const t = window.setTimeout(() => controller.abort(), timeoutMs);

    setIsRefreshing(true);
    try {
      await loadAll(controller.signal);
      setLastRefreshAt(new Date().toISOString());
    } catch (e: any) {
      const aborted = e?.name === 'AbortError' || e?.code === 20;
      notifyRef.current.err('Refresh failed', aborted ? 'Request timed out' : (e?.message || 'Unknown error'));
      throw e;
    } finally {
      window.clearTimeout(t);
      refreshInFlight.current = false;
      setIsRefreshing(false);
    }
  }, [loadAll]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (didInitialLoad.current) return;
      didInitialLoad.current = true;
      try {
        await refreshAll();
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshAll]);

  const saveSettings = useCallback(async () => {
    if (!settings || saving) return;
    setSaving(true);
    try {
      const payload = {
        breaking: {
          enabled: !!settings.breakingEnabled,
          mode: settings.breakingMode,
          speed: tickerSpeeds.breakingSpeedSec,
          speedSec: tickerSpeeds.breakingSpeedSec,
        },
        live: {
          enabled: !!settings.liveEnabled,
          mode: settings.liveMode,
          speed: tickerSpeeds.liveSpeedSec,
          speedSec: tickerSpeeds.liveSpeedSec,
        },
        // Back-compat for servers still expecting the flat shape
        breakingEnabled: !!settings.breakingEnabled,
        breakingMode: settings.breakingMode,
        liveEnabled: !!settings.liveEnabled,
        liveMode: settings.liveMode,
        breakingSpeedSec: tickerSpeeds.breakingSpeedSec,
        liveSpeedSec: tickerSpeeds.liveSpeedSec,
      };

      const res = await broadcastJson<any>('', {
        method: 'PUT',
        json: payload,
      });

      const savedObj = unwrapObj(res);
      const saved = unwrapObj((savedObj as any)?.settings ?? savedObj) as BroadcastSettings;

      // Keep public-site ticker visibility/speeds in sync from ONE place.
      // This ensures the homepage actually shows/hides tickers consistently.
      const patch: Partial<SiteSettings> = {
        ui: {
          showLiveUpdatesTicker: !!saved.liveEnabled,
          showBreakingTicker: !!saved.breakingEnabled,
        } as any,
        tickers: {
          liveSpeedSec: tickerSpeeds.liveSpeedSec,
          breakingSpeedSec: tickerSpeeds.breakingSpeedSec,
        } as any,
      };
      await adminSettingsApi.putSettings(patch, { action: 'broadcast-center:update-tickers' });

      setSettings(saved);
      setInitialSettings(serializeSettings(saved));
      setInitialSpeeds(JSON.stringify(tickerSpeeds));
      notifyRef.current.ok('Saved ✅');
    } catch (e: any) {
      try {
        console.error('[BroadcastCenter] Save failed', {
          method: 'PUT',
          url: `${PROXY_BROADCAST_BASE}`,
          error: e,
        });
      } catch {}

      if (isNetworkError(e)) {
        notifyRef.current.err('Save failed', 'Wrong API base / backend unreachable');
        return;
      }
      if (isUnauthorized(e)) {
        notifyRef.current.err('Session expired — please login again');
        return;
      }
      if (isNotFound(e)) {
        notifyRef.current.err('Save failed', 'Backend route missing, deploy backend update');
        return;
      }
      notifyRef.current.err('Save failed', apiErrorDetails(e, 'API error'));
    } finally {
      setSaving(false);
    }
  }, [saving, settings, tickerSpeeds]);

  const addItem = useCallback(async (type: BroadcastType) => {
    const text = (type === 'breaking' ? breakingText : liveText).trim();
    if (!text) {
      notifyRef.current.err('Cannot add empty story');
      return;
    }
    if (text.length > 160) {
      notifyRef.current.err('Story is too long', 'Max 160 characters');
      return;
    }
    setAddingType(type);
    try {
      const createdRes = await broadcastJson<any>('/items', {
        method: 'POST',
        json: { type, text },
      });
      if (type === 'breaking') setBreakingText('');
      else setLiveText('');

      const createdObj = unwrapObj(createdRes);
      const createdCandidate = unwrapObj((createdObj as any)?.item ?? (createdObj as any)?.data ?? createdObj);
      const createdItem = createdCandidate && typeof createdCandidate === 'object'
        ? (normalizeItems([createdCandidate])[0] as BroadcastItem)
        : null;

      if (createdItem && (createdItem._id || createdItem.id)) {
        if (type === 'breaking') setBreakingItems((prev) => normalizeItems([createdItem, ...(prev || [])] as any[]));
        else setLiveItems((prev) => normalizeItems([createdItem, ...(prev || [])] as any[]));
      } else {
        const itemsRes = await broadcastJson<any>(`/items?type=${encodeURIComponent(type)}`, { method: 'GET' });
        const items = normalizeItems(unwrapArray(itemsRes) as any[]);
        if (type === 'breaking') setBreakingItems(items);
        else setLiveItems(items);
      }
    } catch (e: any) {
      try {
        console.error('[BroadcastCenter] Add failed', {
          method: 'POST',
          url: `${PROXY_BROADCAST_BASE}/items`,
          type,
          error: e,
        });
      } catch {}

      if (isNetworkError(e)) {
        notifyRef.current.err('Add failed', 'Wrong API base / backend unreachable');
        return;
      }
      if (isUnauthorized(e)) {
        notifyRef.current.err('Session expired — please login again');
        return;
      }
      if (isNotFound(e)) {
        notifyRef.current.err('Add failed', 'Backend route missing, deploy backend update');
        return;
      }
      notifyRef.current.err('Add failed', apiErrorDetails(e, 'API error'));
    } finally {
      setAddingType(null);
    }
  }, [breakingText, liveText]);

  const toggleLive = useCallback(async (type: BroadcastType, item: BroadcastItem, next: boolean) => {
    const itemId = (item as any)?.id ?? (item as any)?._id;
    if (!itemId) {
      notifyRef.current.err('Update failed', 'Missing item id');
      return;
    }

    setWorking(String(itemId), true);
    try {
      await broadcastJson(`/items/${encodeURIComponent(String(itemId))}`, {
        method: 'PATCH',
        json: { isLive: next },
      });
      const itemsRes = await broadcastJson<any>(`/items?type=${encodeURIComponent(type)}`, { method: 'GET' });
      const items = normalizeItems(unwrapArray(itemsRes) as any[]);
      if (type === 'breaking') setBreakingItems(items);
      else setLiveItems(items);
    } catch (e: any) {
      if (isNetworkError(e)) {
        notifyRef.current.err('Update failed', 'Wrong API base / backend unreachable');
        return;
      }
      if (isUnauthorized(e)) {
        notifyRef.current.err('Session expired — please login again');
        return;
      }
      if (isNotFound(e)) {
        notifyRef.current.err('Update not supported', 'Backend missing PATCH /admin/broadcast/items/:id — deploy backend update');
        return;
      }
      notifyRef.current.err('Update failed', apiErrorDetails(e, 'API error'));
    } finally {
      setWorking(String(itemId), false);
    }
  }, [setWorking]);

  const deleteItem = useCallback(async (type: BroadcastType, item: BroadcastItem) => {
    const itemId = (item as any)?.id ?? (item as any)?._id;
    if (!itemId) {
      notifyRef.current.err('Delete failed', 'Missing item id');
      return;
    }
    const id = String(itemId);
    setWorking(id, true);
    try {
      await broadcastJson(`/items/${encodeURIComponent(id)}`, { method: 'DELETE' });
      // Optimistic UI removal (then refresh for canonical state)
      if (type === 'breaking') setBreakingItems((prev) => prev.filter((it: any) => (it?._id ?? it?.id) !== id));
      else setLiveItems((prev) => prev.filter((it: any) => (it?._id ?? it?.id) !== id));

      const itemsRes = await broadcastJson<any>(`/items?type=${encodeURIComponent(type)}`, { method: 'GET' });
      const items = normalizeItems(unwrapArray(itemsRes) as any[]);
      if (type === 'breaking') setBreakingItems(items);
      else setLiveItems(items);
    } catch (e: any) {
      try {
        console.error('[BroadcastCenter] Delete failed', {
          method: 'DELETE',
          url: `${PROXY_BROADCAST_BASE}/items/${encodeURIComponent(id)}`,
          type,
          id,
          error: e,
        });
      } catch {}

      if (isNetworkError(e)) {
        notifyRef.current.err('Delete failed', 'Wrong API base / backend unreachable');
        return;
      }
      if (isUnauthorized(e)) {
        notifyRef.current.err('Session expired — please login again');
        return;
      }
      if (isNotFound(e)) {
        notifyRef.current.err('Delete failed', 'Backend route missing, deploy backend update');
        return;
      }
      notifyRef.current.err('Delete failed', apiErrorDetails(e, 'API error'));
    } finally {
      setWorking(id, false);
    }
  }, [setWorking]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">📡 Broadcast Center</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Manage Breaking + Live Updates line-by-line items (last 24h).</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            disabled={loading || saving || !dirty || !settings}
            onClick={saveSettings}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            disabled={isRefreshing}
            onClick={() => {
              refreshAll().catch(() => null);
            }}
          >
            {isRefreshing ? 'Refreshing…' : 'Refresh LIVE'}
          </button>
        </div>
      </header>

      {lastRefreshAt ? (
        <div className="text-xs text-slate-500 dark:text-slate-400">Last refreshed {formatLocalTime(lastRefreshAt)}</div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="🔥 Breaking"
          enabled={!!settings?.breakingEnabled}
          onEnabledChange={(next) => setSettings((prev) => (prev ? { ...prev, breakingEnabled: next } : prev))}
          mode={(settings?.breakingMode || 'manual') as 'manual' | 'auto'}
          onModeChange={(next) => setSettings((prev) => (prev ? { ...prev, breakingMode: next } : prev))}
          speedSec={tickerSpeeds.breakingSpeedSec}
          onSpeedChange={(next) => setTickerSpeeds((prev) => ({ ...prev, breakingSpeedSec: next }))}
          inputValue={breakingText}
          onInputChange={setBreakingText}
          addDisabled={loading || addingType === 'breaking'}
          onAdd={() => addItem('breaking')}
          items={breakingItems}
          workingIdMap={workingIdMap}
          onToggleLive={(item, next) => toggleLive('breaking', item, next)}
          onDelete={(item) => deleteItem('breaking', item)}
        />

        <SectionCard
          title="🔵 Live Updates"
          enabled={!!settings?.liveEnabled}
          onEnabledChange={(next) => setSettings((prev) => (prev ? { ...prev, liveEnabled: next } : prev))}
          mode={(settings?.liveMode || 'manual') as 'manual' | 'auto'}
          onModeChange={(next) => setSettings((prev) => (prev ? { ...prev, liveMode: next } : prev))}
          speedSec={tickerSpeeds.liveSpeedSec}
          onSpeedChange={(next) => setTickerSpeeds((prev) => ({ ...prev, liveSpeedSec: next }))}
          inputValue={liveText}
          onInputChange={setLiveText}
          addDisabled={loading || addingType === 'live'}
          onAdd={() => addItem('live')}
          items={liveItems}
          workingIdMap={workingIdMap}
          onToggleLive={(item, next) => toggleLive('live', item, next)}
          onDelete={(item) => deleteItem('live', item)}
        />
      </div>
    </div>
  );
}

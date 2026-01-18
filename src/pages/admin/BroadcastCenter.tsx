import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNotify } from '@/components/ui/toast-bridge';
import {
  type BroadcastItem,
  type BroadcastSettings,
  type BroadcastType,
} from '@/lib/broadcastApi';
import { AdminApiError } from '@/lib/http/adminFetch';
import {
  addItemByLang as apiAddBroadcastItemByLang,
  deleteItem as apiDeleteBroadcastItem,
  getBroadcastConfig as apiGetBroadcastConfig,
  listItemsByLang as apiListBroadcastItemsByLang,
  saveBroadcastConfig as apiSaveBroadcastConfig,
} from '@/api/broadcast';
import { adminSettingsApi } from '@/lib/adminSettingsApi';
import { publicSiteSettingsApi } from '@/lib/publicSiteSettingsApi';
import { DEFAULT_PUBLIC_SITE_SETTINGS, normalizePublicSiteSettings } from '@/types/publicSiteSettings';
import { deepMerge } from '@/features/settings/deepMerge';
import type { SiteSettings } from '@/types/siteSettings';

const unwrapArray = (x: any) => (Array.isArray(x) ? x : Array.isArray(x?.data) ? x.data : []);
const unwrapObj = (x: any) => (x?.data && typeof x.data === 'object' ? x.data : x);

function getBroadcastItemId(item: Partial<BroadcastItem> & Record<string, any>): string {
  const itemId = item?.id ?? item?._id;
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

function isMethodNotAllowed(e: unknown): boolean {
  return e instanceof AdminApiError && e.status === 405;
}

function isHtmlMisrouteBody(e: unknown): boolean {
  const s = apiBodyText(e);
  if (!s) return false;
  const t = s.trim().toLowerCase();
  return t.startsWith('<!doctype html') || t.startsWith('<html') || t.includes('<head') || t.includes('<body');
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

  // Special-case: Vercel/Vite rewrite misroute serving the SPA HTML.
  if (isHtmlMisrouteBody(e)) {
    return 'API rewrite misrouted (Vercel served app HTML). Check vercel rewrites for /admin-api/*';
  }

  const head = `${status ? `${status}: ` : ''}${msg}`;
  return bodyText ? `${head} • ${bodyText}` : head;
}

function isNetworkError(e: unknown): boolean {
  return e instanceof AdminApiError && e.status === 0;
}

function networkDetails(e: unknown, fallbackPath: string): string {
  const attempted = e instanceof AdminApiError && e.url ? e.url : fallbackPath;
  return `Wrong API base / backend unreachable • ${attempted}`;
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
  lang: 'en' | 'hi' | 'gu';
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  mode: 'manual' | 'auto';
  onModeChange: (next: 'manual' | 'auto') => void;
  speedSec?: number;
  onSpeedChange?: (next: number) => void;
  items: BroadcastItem[];
  workingIdMap: Record<string, boolean>;
  onDelete: (item: BroadcastItem) => void;
  selectedIdMap: Record<string, boolean>;
  onSelectToggle: (item: BroadcastItem, next: boolean) => void;
}) {
  const itemsSorted = useMemo(() => sortByCreatedDesc(props.items), [props.items]);

  const statusMeta = useCallback((it: any) => {
    const lang = props.lang;
    const raw = (it && typeof it === 'object') ? (it as any).statusByLang : undefined;
    const status = raw && typeof raw === 'object' ? String(raw[lang] || '').trim() : '';
    const normalized = status.toUpperCase();
    const label = normalized || 'PROCESSING';

    const cls = (() => {
      if (label === 'APPROVED') return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800/40';
      if (label === 'BLOCKED') return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800/40';
      return 'bg-yellow-100 text-yellow-900 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-100 dark:border-yellow-800/40';
    })();

    // Phase 2: backend may provide a blocked reason; surface as tooltip when present.
    const reason = (() => {
      const r = (it as any)?.blockedReasonByLang;
      if (r && typeof r === 'object' && r[lang]) return String(r[lang]);
      const r2 = (it as any)?.blockedReason;
      return typeof r2 === 'string' ? r2 : '';
    })();

    return { label, cls, title: label === 'BLOCKED' && reason ? reason : undefined };
  }, [props.lang]);

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
                const st = statusMeta(it as any);
                return (
                  <div key={itemId ?? `${it.createdAt}-${it.text}`} className="flex items-start gap-3 p-4">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={!!(itemId && props.selectedIdMap[itemId])}
                      disabled={!itemId}
                      onChange={(e) => {
                        props.onSelectToggle(it, e.target.checked);
                      }}
                      aria-label="Select"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white break-words">{it.text}</div>
                        <span
                          className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}
                          title={st.title}
                        >
                          {st.label}
                        </span>
                      </div>
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

  const fixedLang: 'gu' = 'gu';

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

  const [newText, setNewText] = useState('');
  const [autoTranslate, setAutoTranslate] = useState(true);

  const [breakingItems, setBreakingItems] = useState<BroadcastItem[]>([]);
  const [liveItems, setLiveItems] = useState<BroadcastItem[]>([]);

  // UI-only selection (no backend update)
  const [selectedBreaking, setSelectedBreaking] = useState<Record<string, boolean>>({});
  const [selectedLive, setSelectedLive] = useState<Record<string, boolean>>({});

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
      apiGetBroadcastConfig(),
      apiListBroadcastItemsByLang('breaking', fixedLang),
      apiListBroadcastItemsByLang('live', fixedLang),
      adminSettingsApi.getSettings() as Promise<SiteSettings>,
    ]);

    const broadcastObj = unwrapObj(broadcastRes);
    const settingsObj = unwrapObj((broadcastObj as any)?.settings ?? broadcastObj) as BroadcastSettings;

    setSettings(settingsObj);
    setInitialSettings(serializeSettings(settingsObj));
    setBreakingItems(normalizeItems(breakingRes as any));
    setLiveItems(normalizeItems(liveRes as any));

    const speeds = normalizeSpeeds((site as any)?.tickers);
    setTickerSpeeds(speeds);
    setInitialSpeeds(JSON.stringify(speeds));
  }, [fixedLang]);

  const refreshItemsForLang = useCallback(async () => {
    const controller = new AbortController();
    const timeoutMs = 12_000;
    const t = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const [breakingRes, liveRes] = await Promise.all([
        apiListBroadcastItemsByLang('breaking', fixedLang),
        apiListBroadcastItemsByLang('live', fixedLang),
      ]);
      setBreakingItems(normalizeItems(breakingRes as any));
      setLiveItems(normalizeItems(liveRes as any));
      setLastRefreshAt(new Date().toISOString());
    } catch (e: any) {
      const aborted = e?.name === 'AbortError' || e?.code === 20;
      notifyRef.current.err('Refresh failed', aborted ? 'Request timed out' : (e?.message || 'Unknown error'));
    } finally {
      window.clearTimeout(t);
    }
  }, [fixedLang]);

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

  // Language is fixed (Gujarati). Keep a dedicated refresh helper for manual refresh + after mutations.

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

      const res = await apiSaveBroadcastConfig(payload);

      const savedObj = unwrapObj(res);
      const saved = unwrapObj((savedObj as any)?.settings ?? savedObj) as BroadcastSettings;

      // Keep public-site ticker visibility/speeds in sync from ONE place.
      // The public site reads these from the Public Site Settings bundle.
      // We update both draft + published so changes take effect immediately.
      try {
        const publicPatch: any = {
          tickers: {
            live: { enabled: !!saved.liveEnabled, speedSec: tickerSpeeds.liveSpeedSec },
            breaking: { enabled: !!saved.breakingEnabled, speedSec: tickerSpeeds.breakingSpeedSec },
          },
        };
        const bundle = await publicSiteSettingsApi.getAdminPublicSiteSettingsBundle();
        const baseDraft = (bundle?.draft || bundle?.published || DEFAULT_PUBLIC_SITE_SETTINGS) as any;
        const nextDraft = normalizePublicSiteSettings(deepMerge(baseDraft, publicPatch));

        await publicSiteSettingsApi.putAdminPublicSiteSettingsDraft(nextDraft, { action: 'broadcast-center:update-public-tickers' });
        await publicSiteSettingsApi.publishAdminPublicSiteSettings(nextDraft, { action: 'broadcast-center:publish-public-tickers' });
      } catch (e: any) {
        // Do not block broadcast saves if public site settings fail; surface the real error.
        notifyRef.current.err('Saved broadcast, but public site update failed', apiErrorDetails(e, 'Public site settings error'));
      }

      // Keep the legacy SiteSettings snapshot reasonably aligned (some admin UI uses it).
      try {
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
      } catch (e: any) {
        notifyRef.current.err('Saved broadcast, but admin settings sync failed', apiErrorDetails(e, 'Admin settings error'));
      }

      setSettings(saved);
      setInitialSettings(serializeSettings(saved));
      setInitialSpeeds(JSON.stringify(tickerSpeeds));
      notifyRef.current.ok('Saved ✅');
    } catch (e: any) {
      try {
        console.error('[BroadcastCenter] Save failed', {
          method: 'PUT',
          url: '/admin-api/admin/broadcast',
          error: e,
        });
      } catch {}

      if (isNetworkError(e)) {
        notifyRef.current.err('Save failed', networkDetails(e, '/admin-api/admin/broadcast'));
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
    const text = newText.trim();
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
      const createdItem = await apiAddBroadcastItemByLang(type, text, fixedLang, { autoTranslate });
      setNewText('');

      // Always refresh the list after add for canonical state.
      // (Some backends don't return the created item.)
      const items = await apiListBroadcastItemsByLang(type, fixedLang);
      if (type === 'breaking') setBreakingItems(items);
      else setLiveItems(items);

      // Keep an optimistic feel if we did get an item back (it should already be included after refresh).
      void createdItem;
    } catch (e: any) {
      try {
        console.error('[BroadcastCenter] Add failed', {
          method: 'POST',
          url: '/admin-api/admin/broadcast/items',
          type,
          error: e,
        });
      } catch {}

      if (isNetworkError(e)) {
        notifyRef.current.err('Add failed', networkDetails(e, '/admin-api/admin/broadcast/items'));
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
      if (isMethodNotAllowed(e)) {
        notifyRef.current.err('Add failed', 'Backend route missing or method not allowed (POST). Check backend /broadcast/items POST route.');
        return;
      }
      notifyRef.current.err('Add failed', apiErrorDetails(e, 'API error'));
    } finally {
      setAddingType(null);
    }
  }, [newText, fixedLang, autoTranslate]);

  const deleteItem = useCallback(async (type: BroadcastType, item: BroadcastItem) => {
    const itemId = (item as any)?.id ?? (item as any)?._id;
    if (!itemId) {
      notifyRef.current.err('Delete failed', 'Missing item id');
      return;
    }
    const id = String(itemId);
    setWorking(id, true);
    try {
      await apiDeleteBroadcastItem(id);
      // Optimistic UI removal (then refresh for canonical state)
      if (type === 'breaking') setBreakingItems((prev) => prev.filter((it: any) => (it?._id ?? it?.id) !== id));
      else setLiveItems((prev) => prev.filter((it: any) => (it?._id ?? it?.id) !== id));

  const items = await apiListBroadcastItemsByLang(type, fixedLang);
      if (type === 'breaking') setBreakingItems(items);
      else setLiveItems(items);
    } catch (e: any) {
      try {
        console.error('[BroadcastCenter] Delete failed', {
          method: 'DELETE',
          url: `/admin-api/admin/broadcast/items/${encodeURIComponent(id)}`,
          type,
          id,
          error: e,
        });
      } catch {}

      if (isNetworkError(e)) {
        notifyRef.current.err('Delete failed', networkDetails(e, `/admin-api/admin/broadcast/items/${encodeURIComponent(id)}`));
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
  }, [setWorking, fixedLang]);

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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            maxLength={160}
            placeholder="Add Gujarati story (max 160 chars)"
            className="w-full flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
          />

          <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={autoTranslate}
              onChange={(e) => setAutoTranslate(e.target.checked)}
            />
            Auto Translate ON
          </label>

          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            disabled={loading || addingType === 'breaking' || !newText.trim()}
            onClick={() => addItem('breaking')}
          >
            {addingType === 'breaking' ? 'Adding…' : 'Add Breaking'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            disabled={loading || addingType === 'live' || !newText.trim()}
            onClick={() => addItem('live')}
          >
            {addingType === 'live' ? 'Adding…' : 'Add Live'}
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Language: Gujarati (gu)</div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="🔥 Breaking"
          lang={fixedLang}
          enabled={!!settings?.breakingEnabled}
          onEnabledChange={(next) => setSettings((prev) => (prev ? { ...prev, breakingEnabled: next } : prev))}
          mode={(settings?.breakingMode || 'manual') as 'manual' | 'auto'}
          onModeChange={(next) => setSettings((prev) => (prev ? { ...prev, breakingMode: next } : prev))}
          speedSec={tickerSpeeds.breakingSpeedSec}
          onSpeedChange={(next) => setTickerSpeeds((prev) => ({ ...prev, breakingSpeedSec: next }))}
          items={breakingItems}
          workingIdMap={workingIdMap}
          onDelete={(item) => deleteItem('breaking', item)}
          selectedIdMap={selectedBreaking}
          onSelectToggle={(item, next) => {
            try {
              const id = getBroadcastItemId(item as any);
              setSelectedBreaking((prev) => ({ ...prev, [id]: next }));
            } catch {
              notifyRef.current.err('Missing item id');
            }
          }}
        />

        <SectionCard
          title="🔵 Live Updates"
          lang={fixedLang}
          enabled={!!settings?.liveEnabled}
          onEnabledChange={(next) => setSettings((prev) => (prev ? { ...prev, liveEnabled: next } : prev))}
          mode={(settings?.liveMode || 'manual') as 'manual' | 'auto'}
          onModeChange={(next) => setSettings((prev) => (prev ? { ...prev, liveMode: next } : prev))}
          speedSec={tickerSpeeds.liveSpeedSec}
          onSpeedChange={(next) => setTickerSpeeds((prev) => ({ ...prev, liveSpeedSec: next }))}
          items={liveItems}
          workingIdMap={workingIdMap}
          onDelete={(item) => deleteItem('live', item)}
          selectedIdMap={selectedLive}
          onSelectToggle={(item, next) => {
            try {
              const id = getBroadcastItemId(item as any);
              setSelectedLive((prev) => ({ ...prev, [id]: next }));
            } catch {
              notifyRef.current.err('Missing item id');
            }
          }}
        />
      </div>
    </div>
  );
}

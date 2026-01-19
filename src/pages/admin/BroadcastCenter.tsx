import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNotify } from '@/components/ui/toast-bridge';
import {
  type BroadcastItem,
  type BroadcastSettings,
  type BroadcastType,
} from '@/lib/broadcastApi';
import { AdminApiError } from '@/lib/http/adminFetch';
import {
  addItem as apiAddBroadcastItem,
  deleteItem as apiDeleteBroadcastItem,
  getBroadcastConfig as apiGetBroadcastConfig,
  listItems as apiListBroadcastItems,
  saveBroadcastConfig as apiSaveBroadcastConfig,
} from '@/api/broadcast';

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
  return (
    t.includes('enable javascript to run this app') ||
    t.startsWith('<!doctype html') ||
    t.startsWith('<html') ||
    t.includes('<head') ||
    t.includes('<body')
  );
}

const REWRITE_MISSING_TOAST = 'API proxy missing. Check Vercel rewrites for /admin-api/* to backend.';

function isRewriteMissing(e: unknown): boolean {
  if (e instanceof AdminApiError && e.code === 'HTML_MISROUTE') return true;
  return isHtmlMisrouteBody(e);
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
  if (isRewriteMissing(e)) {
    return REWRITE_MISSING_TOAST;
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

function serializeSaveKey(s: BroadcastSettings | null, breakingSec: number, liveSec: number) {
  if (!s) return '';
  return JSON.stringify({
    settings: {
      breakingEnabled: !!s.breakingEnabled,
      breakingMode: s.breakingMode,
      liveEnabled: !!s.liveEnabled,
      liveMode: s.liveMode,
    },
    breakingDurationSec: clampDurationSeconds(breakingSec, 12),
    liveDurationSec: clampDurationSeconds(liveSec, 12),
  });
}

type TickerSpeeds = {
  liveSpeedSec: number;
  breakingSpeedSec: number;
};

function normalizeSpeeds(s?: Partial<TickerSpeeds> | null): TickerSpeeds {
  // Defaults: start at Fast = 12s
  const live = typeof s?.liveSpeedSec === 'number' ? s!.liveSpeedSec : 12;
  const breaking = typeof s?.breakingSpeedSec === 'number' ? s!.breakingSpeedSec : 12;
  return {
    // UI contract: clamp 12..30 (prevents extreme scroll speeds)
    liveSpeedSec: Math.max(12, Math.min(30, Number(live) || 12)),
    breakingSpeedSec: Math.max(12, Math.min(30, Number(breaking) || 12)),
  };
}

function clampDurationSeconds(v: unknown, fallback: number) {
  const n = Number(v);
  const base = Number.isFinite(n) ? n : fallback;
  return Math.max(12, Math.min(30, Math.round(base)));
}

function pickDurationSeconds(input: any, kind: 'breaking' | 'live'): number | undefined {
  try {
    const def = 12;

    const nested = input?.[kind];
    const nestedValue =
      nested?.tickerDurationSeconds ??
      nested?.tickerDurationSec ??
      nested?.tickerSpeedSeconds ??
      nested?.tickerSpeedSec ??
      nested?.speedSeconds ??
      nested?.speedSec ??
      nested?.durationSeconds ??
      nested?.durationSec;

    const flatValue =
      input?.[`${kind}TickerDurationSeconds`] ??
      input?.[`${kind}TickerDurationSec`] ??
      input?.[`${kind}SpeedSeconds`] ??
      input?.[`${kind}SpeedSec`] ??
      input?.[`${kind}DurationSeconds`] ??
      input?.[`${kind}DurationSec`];

    const candidate = typeof nestedValue !== 'undefined' ? nestedValue : flatValue;
    if (typeof candidate === 'undefined') return undefined;
    return clampDurationSeconds(candidate, def);
  } catch {
    return undefined;
  }
}

function PresetsRow(props: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  presets?: Array<{ key: string; label: string; value: number }>;
}) {
  const presets = props.presets || [
    { key: 'fast', label: 'Fast', value: 12 },
    { key: 'normal', label: 'Normal', value: 18 },
    { key: 'slow', label: 'Slow', value: 30 },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((p) => {
        const active = props.value === p.value;
        return (
          <button
            key={p.key}
            type="button"
            disabled={props.disabled}
            onClick={() => {
              try {
                if (import.meta.env.DEV) console.log('[BroadcastCenter] preset', p.key, p.value);
              } catch {}
              props.onChange(p.value);
            }}
            className={
              'rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ' +
              (active
                ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800')
            }
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function SectionCard(props: {
  title: string;
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  mode: 'manual' | 'auto';
  onModeChange: (next: 'manual' | 'auto') => void;
  durationSec?: number;
  onDurationChange?: (next: number) => void;
  defaultDurationSec?: number;
  onDurationReset?: () => void;
  inputValue: string;
  onInputChange: (next: string) => void;
  onAdd: () => void;
  addDisabled: boolean;
  items: BroadcastItem[];
  workingIdMap: Record<string, boolean>;
  onDelete: (item: BroadcastItem) => void;
}) {
  const itemsSorted = useMemo(() => sortByCreatedDesc(props.items), [props.items]);
  const durationFallback = typeof props.defaultDurationSec === 'number' ? props.defaultDurationSec : 12;
  const duration = clampDurationSeconds(props.durationSec, durationFallback);

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

        {typeof props.durationSec === 'number' && typeof props.onDurationChange === 'function' ? (
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <label className="text-sm font-semibold text-slate-800 dark:text-slate-200">Scroll duration (seconds)</label>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Higher = slower = more readable</div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Recommended range: 12–30 seconds</div>
              </div>

              <div className="flex flex-col items-stretch gap-2 sm:w-72">
                <PresetsRow
                  value={duration}
                  onChange={(next) => props.onDurationChange?.(clampDurationSeconds(next, durationFallback))}
                />

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={12}
                    max={30}
                    step={1}
                    value={duration}
                    onChange={(e) => props.onDurationChange?.(clampDurationSeconds(e.target.value, durationFallback))}
                    className="w-full"
                    aria-label="Scroll duration"
                  />
                  <div className="w-12 text-right text-sm font-semibold text-slate-900 dark:text-white">
                    {duration}
                  </div>
                </div>

                {typeof props.onDurationReset === 'function' ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      onClick={() => props.onDurationReset?.()}
                    >
                      Reset
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Live preview (simple marquee) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Live preview</div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{duration}s</div>
              </div>
              <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                <style>{`@keyframes np-marquee { 0% { transform: translateX(100%); } 100% { transform: translateX(-120%); } }`}</style>
                <div
                  style={{
                    display: 'inline-block',
                    whiteSpace: 'nowrap',
                    willChange: 'transform',
                    animation: `np-marquee ${Math.max(6, duration)}s linear infinite`,
                  }}
                >
                  line scrolling for preview — edit duration to change speed.
                </div>
              </div>
            </div>
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
                    <input type="checkbox" className="mt-1 h-4 w-4" aria-label="Select item" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white break-words">{it.text}</div>
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

  const didInitialLoad = useRef(false);
  const lastSavedRef = useRef<string>('');
  const refreshInFlight = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  const [settings, setSettings] = useState<BroadcastSettings | null>(null);

  const [breakingSpeedSeconds, setBreakingSpeedSeconds] = useState<number>(() => normalizeSpeeds(null).breakingSpeedSec);
  const [liveSpeedSeconds, setLiveSpeedSeconds] = useState<number>(() => normalizeSpeeds(null).liveSpeedSec);

  const [breakingText, setBreakingText] = useState('');
  const [liveText, setLiveText] = useState('');

  const [breakingItems, setBreakingItems] = useState<BroadcastItem[]>([]);
  const [liveItems, setLiveItems] = useState<BroadcastItem[]>([]);

  const [workingIdMap, setWorkingIdMap] = useState<Record<string, boolean>>({});
  const [addingType, setAddingType] = useState<BroadcastType | null>(null);

  const setWorking = useCallback((id: string, next: boolean) => {
    setWorkingIdMap((prev) => {
      if (prev[id] === next) return prev;
      return { ...prev, [id]: next };
    });
  }, []);

  const loadAll = useCallback(async (_signal?: AbortSignal) => {
    const [broadcastRes, breakingRes, liveRes] = await Promise.all([
      apiGetBroadcastConfig(),
      apiListBroadcastItems('breaking'),
      apiListBroadcastItems('live'),
    ]);

    const broadcastObj = unwrapObj(broadcastRes);
    const rawSettings = unwrapObj((broadcastObj as any)?.settings ?? broadcastObj) as any;
    const settingsObj: BroadcastSettings = {
      breakingEnabled: !!rawSettings?.breakingEnabled,
      breakingMode: rawSettings?.breakingMode === 'auto' ? 'auto' : 'manual',
      liveEnabled: !!rawSettings?.liveEnabled,
      liveMode: rawSettings?.liveMode === 'auto' ? 'auto' : 'manual',
    };

    // Items are already normalized by apiListBroadcastItems, but normalize again defensively.
    setBreakingItems(normalizeItems(breakingRes as any));
    setLiveItems(normalizeItems(liveRes as any));

    const fromBroadcastBreaking = pickDurationSeconds(broadcastObj, 'breaking') ?? pickDurationSeconds((broadcastObj as any)?.settings, 'breaking');
    const fromBroadcastLive = pickDurationSeconds(broadcastObj, 'live') ?? pickDurationSeconds((broadcastObj as any)?.settings, 'live');

    const fallbackSpeeds = normalizeSpeeds(null);
    const breakingDur = typeof fromBroadcastBreaking === 'number' ? fromBroadcastBreaking : fallbackSpeeds.breakingSpeedSec;
    const liveDur = typeof fromBroadcastLive === 'number' ? fromBroadcastLive : fallbackSpeeds.liveSpeedSec;

    const nextBreaking = clampDurationSeconds(breakingDur, 12);
    const nextLive = clampDurationSeconds(liveDur, 12);

    setSettings(settingsObj);
    setBreakingSpeedSeconds(nextBreaking);
    setLiveSpeedSeconds(nextLive);
    lastSavedRef.current = serializeSaveKey(settingsObj, nextBreaking, nextLive);
  }, []);

  const doSave = useCallback(async (
    nextSettings: BroadcastSettings,
    nextBreakingSec: number,
    nextLiveSec: number,
    opts?: { toast?: string }
  ) => {
    if (saving) return;
    setSaving(true);
    try {
      const breakingDurationSeconds = clampDurationSeconds(nextBreakingSec, 12);
      const liveDurationSeconds = clampDurationSeconds(nextLiveSec, 12);

      const savedKey = serializeSaveKey(nextSettings, breakingDurationSeconds, liveDurationSeconds);

      const payload = {
        breakingEnabled: !!nextSettings.breakingEnabled,
        breakingMode: nextSettings.breakingMode,
        liveEnabled: !!nextSettings.liveEnabled,
        liveMode: nextSettings.liveMode,
        // Explicit scroll-duration keys (requested / common variants)
        breakingScrollDurationSec: breakingDurationSeconds,
        breakingScrollDurationSeconds: breakingDurationSeconds,
        liveScrollDurationSec: liveDurationSeconds,
        liveScrollDurationSeconds: liveDurationSeconds,
        // Preferred terminology
        breakingDurationSec: breakingDurationSeconds,
        liveDurationSec: liveDurationSeconds,
        // Back-compat keys (some backends still expect *SpeedSec)
        breakingSpeedSec: breakingDurationSeconds,
        liveSpeedSec: liveDurationSeconds,
        // Back-compat keys
        breakingTickerDurationSeconds: breakingDurationSeconds,
        liveTickerDurationSeconds: liveDurationSeconds,
        // Include items with config save (requested). Backends that don't support it will ignore.
        breakingItems,
        liveItems,
        items: {
          breaking: breakingItems,
          live: liveItems,
        },
        // Nested form (merge-safe on backends that expect per-ticker configs)
        breaking: {
          enabled: !!nextSettings.breakingEnabled,
          mode: nextSettings.breakingMode,
          durationSec: breakingDurationSeconds,
          scrollDurationSec: breakingDurationSeconds,
          items: breakingItems,
        },
        live: {
          enabled: !!nextSettings.liveEnabled,
          mode: nextSettings.liveMode,
          durationSec: liveDurationSeconds,
          scrollDurationSec: liveDurationSeconds,
          items: liveItems,
        },
      };

      await apiSaveBroadcastConfig(payload);

      // Merge-safe: re-fetch the canonical server config so we don't accidentally
      // reset the other ticker if the backend applies defaults.
      try {
        const broadcastRes = await apiGetBroadcastConfig();
        const broadcastObj = unwrapObj(broadcastRes);
        const rawSettings = unwrapObj((broadcastObj as any)?.settings ?? broadcastObj) as any;
        const settingsObj: BroadcastSettings = {
          breakingEnabled: !!rawSettings?.breakingEnabled,
          breakingMode: rawSettings?.breakingMode === 'auto' ? 'auto' : 'manual',
          liveEnabled: !!rawSettings?.liveEnabled,
          liveMode: rawSettings?.liveMode === 'auto' ? 'auto' : 'manual',
        };

        const fromBroadcastBreaking = pickDurationSeconds(broadcastObj, 'breaking') ?? pickDurationSeconds((broadcastObj as any)?.settings, 'breaking');
        const fromBroadcastLive = pickDurationSeconds(broadcastObj, 'live') ?? pickDurationSeconds((broadcastObj as any)?.settings, 'live');

        const nextBreaking = clampDurationSeconds(typeof fromBroadcastBreaking === 'number' ? fromBroadcastBreaking : breakingDurationSeconds, 12);
        const nextLive = clampDurationSeconds(typeof fromBroadcastLive === 'number' ? fromBroadcastLive : liveDurationSeconds, 12);

        setSettings(settingsObj);
        setBreakingSpeedSeconds(nextBreaking);
        setLiveSpeedSeconds(nextLive);
        lastSavedRef.current = serializeSaveKey(settingsObj, nextBreaking, nextLive);
        setLastRefreshAt(new Date().toISOString());
      } catch {
        // If refresh fails, keep the optimistic UI state.
        setSettings(nextSettings);
        setBreakingSpeedSeconds(breakingDurationSeconds);
        setLiveSpeedSeconds(liveDurationSeconds);
        lastSavedRef.current = savedKey;
      }

      notifyRef.current.ok(opts?.toast || 'Saved. Live will update within 10 seconds.');
    } catch (e: any) {
      try {
        console.error('[BroadcastCenter] Save failed', {
          method: 'PUT',
          url: '/admin-api/admin/broadcast',
          error: e,
        });
      } catch {}

      if (isRewriteMissing(e) || isMethodNotAllowed(e)) {
        notifyRef.current.err(REWRITE_MISSING_TOAST);
        return;
      }
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
  }, [saving]);

  const dirty = useMemo(() => {
    if (!settings) return false;
    const nowKey = serializeSaveKey(settings, breakingSpeedSeconds, liveSpeedSeconds);
    return !!nowKey && nowKey !== lastSavedRef.current;
  }, [settings, breakingSpeedSeconds, liveSpeedSeconds]);

  const refreshAll = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setIsRefreshing(true);
    try {
      await loadAll();
      setLastRefreshAt(new Date().toISOString());
    } catch (e: any) {
      if (isRewriteMissing(e) || isMethodNotAllowed(e)) {
        notifyRef.current.err(REWRITE_MISSING_TOAST);
      } else if (isNetworkError(e)) {
        notifyRef.current.err('Refresh failed', networkDetails(e, '/admin-api/admin/broadcast'));
      } else {
        notifyRef.current.err('Refresh failed', apiErrorDetails(e, 'API error'));
      }
    } finally {
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
      } catch (e: any) {
        if (isRewriteMissing(e) || isMethodNotAllowed(e)) {
          notifyRef.current.err(REWRITE_MISSING_TOAST);
        } else if (isNetworkError(e)) {
          notifyRef.current.err('Load failed', networkDetails(e, '/admin-api/admin/broadcast'));
        } else if (isUnauthorized(e)) {
          notifyRef.current.err('Session expired — please login again');
        } else {
          notifyRef.current.err('Load failed', apiErrorDetails(e, 'API error'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshAll]);

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
      const createdItem = await apiAddBroadcastItem(type, text, { lang: 'en', autoTranslate: false });
      if (type === 'breaking') setBreakingText('');
      else setLiveText('');

      // Always refresh the list after add for canonical state.
      // (Some backends don't return the created item.)
      const items = await apiListBroadcastItems(type);
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

      if (isRewriteMissing(e)) {
        notifyRef.current.err(REWRITE_MISSING_TOAST);
        return;
      }
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
  }, [breakingText, liveText]);

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

      const items = await apiListBroadcastItems(type);
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

      if (isRewriteMissing(e)) {
        notifyRef.current.err(REWRITE_MISSING_TOAST);
        return;
      }
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
            disabled={loading || saving || !settings}
            onClick={() => {
              if (!settings) return;
              if (!dirty) {
                notifyRef.current.ok('No changes to save');
                return;
              }
              void doSave(settings, breakingSpeedSeconds, liveSpeedSeconds);
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            disabled={isRefreshing}
            onClick={() => {
              void refreshAll();
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
          onEnabledChange={(next) => {
            setSettings((prev) => (prev ? { ...prev, breakingEnabled: next } : prev));
          }}
          mode={(settings?.breakingMode || 'manual') as 'manual' | 'auto'}
          onModeChange={(next) => setSettings((prev) => (prev ? { ...prev, breakingMode: next } : prev))}
          durationSec={breakingSpeedSeconds}
          onDurationChange={(next) => setBreakingSpeedSeconds(clampDurationSeconds(next, 12))}
          defaultDurationSec={12}
          onDurationReset={() => setBreakingSpeedSeconds(12)}
          inputValue={breakingText}
          onInputChange={setBreakingText}
          addDisabled={loading || addingType === 'breaking'}
          onAdd={() => addItem('breaking')}
          items={breakingItems}
          workingIdMap={workingIdMap}
          onDelete={(item) => deleteItem('breaking', item)}
        />

        <SectionCard
          title="🔵 Live Updates"
          enabled={!!settings?.liveEnabled}
          onEnabledChange={(next) => {
            setSettings((prev) => (prev ? { ...prev, liveEnabled: next } : prev));
          }}
          mode={(settings?.liveMode || 'manual') as 'manual' | 'auto'}
          onModeChange={(next) => setSettings((prev) => (prev ? { ...prev, liveMode: next } : prev))}
          durationSec={liveSpeedSeconds}
          onDurationChange={(next) => setLiveSpeedSeconds(clampDurationSeconds(next, 12))}
          defaultDurationSec={12}
          onDurationReset={() => setLiveSpeedSeconds(12)}
          inputValue={liveText}
          onInputChange={setLiveText}
          addDisabled={loading || addingType === 'live'}
          onAdd={() => addItem('live')}
          items={liveItems}
          workingIdMap={workingIdMap}
          onDelete={(item) => deleteItem('live', item)}
        />
      </div>
    </div>
  );
}

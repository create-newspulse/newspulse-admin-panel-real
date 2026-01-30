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

const PROXY_MISSING_TOAST = 'API proxy missing. Check Vercel rewrites for /admin-api/* to backend.';
const PROXY_HEALTH_URL = '/admin-api/system/health';

let didShowProxyMissingToast = false;

const DEFAULT_TICKER_SPEED_SECONDS = 12;
const DEFAULT_SETTINGS: BroadcastSettings = {
  breakingEnabled: false,
  breakingMode: 'manual',
  liveEnabled: false,
  liveMode: 'manual',
};

type SourceLang = 'en' | 'hi' | 'gu';
const SOURCE_LANG_OPTIONS: Array<{ value: SourceLang; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'gu', label: 'Gujarati' },
];

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

function notifyProxyMissingOnce(notify: ReturnType<typeof useNotify>) {
  if (didShowProxyMissingToast) return;
  didShowProxyMissingToast = true;
  // toast-bridge supports only (title, optionalDesc)
  notify.err(PROXY_MISSING_TOAST);
}

async function checkProxyHealth(): Promise<{ ok: boolean; status?: number }> {
  try {
    const probe = async (url: string) => {
      const res = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
        },
      });

      // If the endpoint is auth-gated, proxy is still reachable.
      if (res.status === 401 || res.status === 403) return { ok: true, status: res.status };

      // A common false positive: 200 OK but SPA HTML was returned (rewrite misroute).
      const ctype = (res.headers.get('content-type') || '').toLowerCase();
      if (res.status === 200 && ctype.includes('text/html')) return { ok: false, status: 502 };

      return { ok: res.ok, status: res.status };
    };

    // Prefer a stable health probe when available.
    const health = await probe(PROXY_HEALTH_URL);
    return health;
  } catch {
    return { ok: false, status: 0 };
  }
}

function pickBoolean(...values: any[]): boolean {
  for (const v of values) {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (s === 'true') return true;
      if (s === 'false') return false;
      if (s === '1') return true;
      if (s === '0') return false;
    }
  }
  return false;
}

function pickMode(...values: any[]): 'manual' | 'auto' {
  for (const v of values) {
    if (v === 'force_on' || v === 'force-on' || v === 'forceon') return 'manual';
    if (v === 'auto') return 'auto';
    if (v === 'manual') return 'manual';
  }
  return 'manual';
}

function toBackendMode(ui: 'manual' | 'auto'): 'force_on' | 'auto' {
  return ui === 'auto' ? 'auto' : 'force_on';
}

function apiMessage(e: unknown, fallback = 'API error'): string {
  if (e instanceof AdminApiError) {
    return e.message || fallback;
  }
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

function isUnauthorized(e: unknown): boolean {
  return e instanceof AdminApiError && e.status === 401;
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

function serializeSaveKey(s: BroadcastSettings | null, breakingSec: number, liveSec: number) {
  if (!s) return '';
  return JSON.stringify({
    settings: {
      breakingEnabled: !!s.breakingEnabled,
      breakingMode: s.breakingMode,
      liveEnabled: !!s.liveEnabled,
      liveMode: s.liveMode,
    },
    breakingTickerSpeedSeconds: clampDurationSeconds(breakingSec, 12),
    liveTickerSpeedSeconds: clampDurationSeconds(liveSec, 12),
  });
}

type TickerSpeeds = {
  liveTickerSpeedSeconds: number;
  breakingTickerSpeedSeconds: number;
};

function normalizeSpeeds(s?: Partial<TickerSpeeds> | null): TickerSpeeds {
  // Defaults: start at Fast = 12s
  const live = typeof s?.liveTickerSpeedSeconds === 'number' ? s!.liveTickerSpeedSeconds : 12;
  const breaking = typeof s?.breakingTickerSpeedSeconds === 'number' ? s!.breakingTickerSpeedSeconds : 12;
  return {
    // UI contract: clamp 12..30 (prevents extreme scroll speeds)
    liveTickerSpeedSeconds: Math.max(12, Math.min(30, Number(live) || 12)),
    breakingTickerSpeedSeconds: Math.max(12, Math.min(30, Number(breaking) || 12)),
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
      input?.[`${kind}DurationSec`] ??
      input?.[`${kind}DurationSeconds`] ??
      input?.[`${kind}TickerDurationSeconds`] ??
      input?.[`${kind}TickerDurationSec`] ??
      input?.[`${kind}SpeedSeconds`] ??
      input?.[`${kind}SpeedSec`] ??
      undefined;

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
    { key: 'normal', label: 'Normal', value: 20 },
    { key: 'slow', label: 'Slow', value: 30 },
  ];

  // Highlight the closest preset for the current slider value.
  const nearestValue = presets.reduce((best, p) => {
    if (typeof best !== 'number') return p.value;
    return Math.abs(p.value - props.value) < Math.abs(best - props.value) ? p.value : best;
  }, presets[0]?.value ?? 12);

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((p) => {
        const active = nearestValue === p.value;
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
  disabled?: boolean;
  enabled: boolean;
  onEnabledChange: (next: boolean) => void;
  mode: 'manual' | 'auto';
  onModeChange: (next: 'manual' | 'auto') => void;
  tickerSpeedSeconds?: number;
  onTickerSpeedSecondsChange?: (next: number) => void;
  defaultTickerSpeedSeconds?: number;
  onTickerSpeedSecondsReset?: () => void;
  inputValue: string;
  onInputChange: (next: string) => void;
  sourceLang: SourceLang;
  onSourceLangChange: (next: SourceLang) => void;
  onAdd: () => void;
  addDisabled: boolean;
  items: BroadcastItem[];
  workingIdMap: Record<string, boolean>;
  onDelete: (item: BroadcastItem) => void;
}) {
  const itemsSorted = useMemo(() => sortByCreatedDesc(props.items), [props.items]);
  const durationFallback = typeof props.defaultTickerSpeedSeconds === 'number' ? props.defaultTickerSpeedSeconds : 12;
  const duration = clampDurationSeconds(props.tickerSpeedSeconds, durationFallback);

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
            disabled={!!props.disabled}
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
            disabled={!!props.disabled}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 sm:w-72"
          >
            <option value="manual">Force ON</option>
            <option value="auto">Auto</option>
          </select>
        </div>

        {typeof props.tickerSpeedSeconds === 'number' && typeof props.onTickerSpeedSecondsChange === 'function' ? (
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
                  onChange={(next) => props.onTickerSpeedSecondsChange?.(clampDurationSeconds(next, durationFallback))}
                  disabled={!!props.disabled}
                />

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={12}
                    max={30}
                    step={1}
                    value={duration}
                    onChange={(e) => props.onTickerSpeedSecondsChange?.(clampDurationSeconds(e.target.value, durationFallback))}
                    disabled={!!props.disabled}
                    className="w-full"
                    aria-label="Scroll duration"
                  />
                  <div className="w-12 text-right text-sm font-semibold text-slate-900 dark:text-white">
                    {duration}
                  </div>
                </div>

                {typeof props.onTickerSpeedSecondsReset === 'function' ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      onClick={() => props.onTickerSpeedSecondsReset?.()}
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
                    key={`np-marquee-${duration}`}
                  style={{
                    display: 'inline-block',
                    whiteSpace: 'nowrap',
                    willChange: 'transform',
                    animation: `np-marquee ${duration}s linear infinite`,
                  }}
                >
                  Live preview — Fast (12s) vs Normal (20s) vs Slow (30s) should be obvious • Live preview — Fast (12s) vs Normal (20s) vs Slow (30s) should be obvious • Live preview — Fast (12s) vs Normal (20s) vs Slow (30s) should be obvious.
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

          <select
            value={props.sourceLang}
            onChange={(e) => props.onSourceLangChange(e.target.value as SourceLang)}
            disabled={props.addDisabled || !!props.disabled}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 sm:w-44"
            aria-label="Language"
          >
            {SOURCE_LANG_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            disabled={props.addDisabled || !!props.disabled}
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

  const [proxyHealthy, setProxyHealthy] = useState<boolean | null>(null);
  const [proxyHealthStatus, setProxyHealthStatus] = useState<number | null>(null);
  const proxyHealthyRef = useRef<boolean | null>(proxyHealthy);
  useEffect(() => { proxyHealthyRef.current = proxyHealthy; }, [proxyHealthy]);

  const ensureProxyHealthy = useCallback(async (opts?: { force?: boolean }) => {
    // If we already confirmed the proxy is reachable, do not re-check unless forced.
    if (!opts?.force && proxyHealthyRef.current === true) return true;

    const health = await checkProxyHealth();
    setProxyHealthy(health.ok);
    setProxyHealthStatus(typeof health.status === 'number' ? health.status : null);
    if (!health.ok) notifyProxyMissingOnce(notifyRef.current);
    return health.ok;
  }, []);

  const didInitialLoad = useRef(false);
  const lastSavedRef = useRef<string>(serializeSaveKey(DEFAULT_SETTINGS, DEFAULT_TICKER_SPEED_SECONDS, DEFAULT_TICKER_SPEED_SECONDS));
  const refreshInFlight = useRef(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);

  const [settings, setSettings] = useState<BroadcastSettings>(() => DEFAULT_SETTINGS);

  const [breakingSourceLang, setBreakingSourceLang] = useState<SourceLang>('en');
  const [liveSourceLang, setLiveSourceLang] = useState<SourceLang>('en');

  const [publicPreview, setPublicPreview] = useState<{
    loading: boolean;
    error?: string | null;
    breaking: Record<SourceLang, string[]>;
    live: Record<SourceLang, string[]>;
  }>(() => ({
    loading: false,
    error: null,
    breaking: { en: [], hi: [], gu: [] },
    live: { en: [], hi: [], gu: [] },
  }));

  const [breakingTickerSpeedSeconds, setBreakingTickerSpeedSeconds] = useState<number>(() => normalizeSpeeds(null).breakingTickerSpeedSeconds);
  const [liveTickerSpeedSeconds, setLiveTickerSpeedSeconds] = useState<number>(() => normalizeSpeeds(null).liveTickerSpeedSeconds);

  const [breakingText, setBreakingText] = useState('');
  const [liveText, setLiveText] = useState('');

  const [breakingItems, setBreakingItems] = useState<BroadcastItem[]>([]);
  const [liveItems, setLiveItems] = useState<BroadcastItem[]>([]);

  const [workingIdMap, setWorkingIdMap] = useState<Record<string, boolean>>({});
  const [addingType, setAddingType] = useState<BroadcastType | null>(null);

  const fetchPublicPreview = useCallback(async () => {
    setPublicPreview((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const fetchOne = async (type: BroadcastType, lang: SourceLang): Promise<string[]> => {
        const url = `/admin-api/public/broadcast?type=${encodeURIComponent(type)}&lang=${encodeURIComponent(lang)}`;
        const res = await fetch(url, {
          method: 'GET',
          cache: 'no-store',
          credentials: 'include',
          headers: { Accept: 'application/json' },
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? ` • ${txt.slice(0, 120)}` : ''}`);
        }

        const data: any = await res.json().catch(() => null);
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
            ? data.items
            : Array.isArray(data?.data?.items)
              ? data.data.items
              : [];

        return (items || [])
          .map((it: any) => String(it?.text ?? it?.headline ?? it ?? '').trim())
          .filter(Boolean)
          .slice(0, 6);
      };

      const [breakingEn, breakingHi, breakingGu, liveEn, liveHi, liveGu] = await Promise.all([
        fetchOne('breaking', 'en'),
        fetchOne('breaking', 'hi'),
        fetchOne('breaking', 'gu'),
        fetchOne('live', 'en'),
        fetchOne('live', 'hi'),
        fetchOne('live', 'gu'),
      ]);

      setPublicPreview({
        loading: false,
        error: null,
        breaking: { en: breakingEn, hi: breakingHi, gu: breakingGu },
        live: { en: liveEn, hi: liveHi, gu: liveGu },
      });
    } catch (e: any) {
      setPublicPreview((prev) => ({
        ...prev,
        loading: false,
        error: e?.message || 'Failed to load public preview',
      }));
    }
  }, []);

  const setWorking = useCallback((id: string, next: boolean) => {
    setWorkingIdMap((prev) => {
      if (prev[id] === next) return prev;
      return { ...prev, [id]: next };
    });
  }, []);

  const loadAll = useCallback(async (_signal?: AbortSignal) => {
    // Load config first; do not fail the whole page if a secondary history endpoint is missing.
    const broadcastRes = await apiGetBroadcastConfig();

    // If this call succeeded, the proxy is definitely reachable.
    setProxyHealthy(true);

    const broadcastObj = unwrapObj(broadcastRes);
    const rawSettings = unwrapObj((broadcastObj as any)?.settings ?? broadcastObj) as any;

    // Backends vary: some store settings flat (breakingEnabled), others nested (breaking.enabled).
    // Read both shapes so enabled/mode don't appear to "reset" after save/refresh.
    const breakingEnabled = pickBoolean(
      rawSettings?.breaking?.enabled,
      rawSettings?.breakingEnabled,
      (broadcastObj as any)?.breaking?.enabled,
      (broadcastObj as any)?.breakingEnabled,
    );
    const liveEnabled = pickBoolean(
      rawSettings?.live?.enabled,
      rawSettings?.liveEnabled,
      (broadcastObj as any)?.live?.enabled,
      (broadcastObj as any)?.liveEnabled,
    );
    const breakingMode = pickMode(
      rawSettings?.breaking?.mode,
      rawSettings?.breakingMode,
      (broadcastObj as any)?.breaking?.mode,
      (broadcastObj as any)?.breakingMode,
    );
    const liveMode = pickMode(
      rawSettings?.live?.mode,
      rawSettings?.liveMode,
      (broadcastObj as any)?.live?.mode,
      (broadcastObj as any)?.liveMode,
    );

    const settingsObj: BroadcastSettings = {
      breakingEnabled,
      breakingMode,
      liveEnabled,
      liveMode,
    };

    const [breakingRes, liveRes] = await Promise.allSettled([
      apiListBroadcastItems('breaking'),
      apiListBroadcastItems('live'),
    ]);

    if (breakingRes.status === 'fulfilled') {
      setBreakingItems(normalizeItems(breakingRes.value as any));
    } else {
      setBreakingItems([]);
      notifyRef.current.err('Breaking history unavailable', apiErrorDetails(breakingRes.reason, 'API error'));
    }

    if (liveRes.status === 'fulfilled') {
      setLiveItems(normalizeItems(liveRes.value as any));
    } else {
      setLiveItems([]);
      notifyRef.current.err('Live history unavailable', apiErrorDetails(liveRes.reason, 'API error'));
    }

    const fromBroadcastBreaking = pickDurationSeconds(broadcastObj, 'breaking') ?? pickDurationSeconds((broadcastObj as any)?.settings, 'breaking');
    const fromBroadcastLive = pickDurationSeconds(broadcastObj, 'live') ?? pickDurationSeconds((broadcastObj as any)?.settings, 'live');

    const fallbackSpeeds = normalizeSpeeds(null);
    const breakingDur = typeof fromBroadcastBreaking === 'number' ? fromBroadcastBreaking : fallbackSpeeds.breakingTickerSpeedSeconds;
    const liveDur = typeof fromBroadcastLive === 'number' ? fromBroadcastLive : fallbackSpeeds.liveTickerSpeedSeconds;

    const nextBreaking = clampDurationSeconds(breakingDur, 12);
    const nextLive = clampDurationSeconds(liveDur, 12);

    setSettings(settingsObj);
    setBreakingTickerSpeedSeconds(nextBreaking);
    setLiveTickerSpeedSeconds(nextLive);
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
      const breakingTickerSpeedSeconds = clampDurationSeconds(nextBreakingSec, 12);
      const liveTickerSpeedSeconds = clampDurationSeconds(nextLiveSec, 12);

      const savedKey = serializeSaveKey(nextSettings, breakingTickerSpeedSeconds, liveTickerSpeedSeconds);

      // Normalized backend payload (per contract)
      const payload = {
        breaking: {
          enabled: !!nextSettings.breakingEnabled,
          mode: toBackendMode(nextSettings.breakingMode),
          durationSec: breakingTickerSpeedSeconds,
        },
        live: {
          enabled: !!nextSettings.liveEnabled,
          mode: toBackendMode(nextSettings.liveMode),
          durationSec: liveTickerSpeedSeconds,
        },
      };

      await apiSaveBroadcastConfig(payload);

      // Save succeeded: proxy definitely reachable.
      setProxyHealthy(true);

      // Merge-safe: re-fetch the canonical server config so we don't accidentally
      // reset the other ticker if the backend applies defaults.
      try {
        const broadcastRes = await apiGetBroadcastConfig();
        const broadcastObj = unwrapObj(broadcastRes);
        const rawSettings = unwrapObj((broadcastObj as any)?.settings ?? broadcastObj) as any;

        const breakingEnabled = pickBoolean(
          rawSettings?.breaking?.enabled,
          rawSettings?.breakingEnabled,
          (broadcastObj as any)?.breaking?.enabled,
          (broadcastObj as any)?.breakingEnabled,
        );
        const liveEnabled = pickBoolean(
          rawSettings?.live?.enabled,
          rawSettings?.liveEnabled,
          (broadcastObj as any)?.live?.enabled,
          (broadcastObj as any)?.liveEnabled,
        );
        const breakingMode = pickMode(
          rawSettings?.breaking?.mode,
          rawSettings?.breakingMode,
          (broadcastObj as any)?.breaking?.mode,
          (broadcastObj as any)?.breakingMode,
        );
        const liveMode = pickMode(
          rawSettings?.live?.mode,
          rawSettings?.liveMode,
          (broadcastObj as any)?.live?.mode,
          (broadcastObj as any)?.liveMode,
        );

        const settingsObj: BroadcastSettings = {
          breakingEnabled,
          breakingMode,
          liveEnabled,
          liveMode,
        };

        const fromBroadcastBreaking = pickDurationSeconds(broadcastObj, 'breaking') ?? pickDurationSeconds((broadcastObj as any)?.settings, 'breaking');
        const fromBroadcastLive = pickDurationSeconds(broadcastObj, 'live') ?? pickDurationSeconds((broadcastObj as any)?.settings, 'live');

        const nextBreaking = clampDurationSeconds(typeof fromBroadcastBreaking === 'number' ? fromBroadcastBreaking : breakingTickerSpeedSeconds, 12);
        const nextLive = clampDurationSeconds(typeof fromBroadcastLive === 'number' ? fromBroadcastLive : liveTickerSpeedSeconds, 12);

        setSettings(settingsObj);
        setBreakingTickerSpeedSeconds(nextBreaking);
        setLiveTickerSpeedSeconds(nextLive);
        lastSavedRef.current = serializeSaveKey(settingsObj, nextBreaking, nextLive);
        setLastRefreshAt(new Date().toISOString());
      } catch {
        // If refresh fails, keep the optimistic UI state.
        setSettings(nextSettings);
        setBreakingTickerSpeedSeconds(breakingTickerSpeedSeconds);
        setLiveTickerSpeedSeconds(liveTickerSpeedSeconds);
        lastSavedRef.current = savedKey;
      }

      notifyRef.current.ok(opts?.toast || 'Saved. Live will update within 10 seconds.');

      // Refresh public preview (best-effort). If the backend doesn't support this endpoint yet,
      // the preview will show an error but the save still succeeded.
      void fetchPublicPreview();
    } catch (e: any) {
      try {
        console.error('[BroadcastCenter] Save failed', {
          method: 'PUT',
          url: '/admin-api/admin/broadcast',
          error: e,
        });
      } catch {}
      if (isMethodNotAllowed(e)) {
        notifyRef.current.err('Save failed', 'Backend method not allowed (405). Expected PUT/POST /api/admin/broadcast.');
        return;
      }
      if (isUnauthorized(e)) {
        notifyRef.current.err('Session expired — please login again');
        return;
      }

      // Non-blocking: warn if proxy health check fails, but still show the real error.
      void ensureProxyHealthy({ force: true });
      notifyRef.current.err('Save failed', apiErrorDetails(e, 'API error'));
    } finally {
      setSaving(false);
    }
  }, [saving, ensureProxyHealthy]);

  const dirty = useMemo(() => {
    const nowKey = serializeSaveKey(settings, breakingTickerSpeedSeconds, liveTickerSpeedSeconds);
    return !!nowKey && nowKey !== lastSavedRef.current;
  }, [settings, breakingTickerSpeedSeconds, liveTickerSpeedSeconds]);

  const refreshAll = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    setIsRefreshing(true);
    try {
      // Non-blocking warning if /admin-api/system/health fails.
      void ensureProxyHealthy({ force: true });
      await loadAll();
      setLastRefreshAt(new Date().toISOString());
    } catch (e: any) {
      void ensureProxyHealthy({ force: true });
      if (isMethodNotAllowed(e)) {
        notifyRef.current.err('Refresh failed', 'Backend method not allowed (405).');
      } else {
        notifyRef.current.err('Refresh failed', apiErrorDetails(e, 'API error'));
      }
    } finally {
      refreshInFlight.current = false;
      setIsRefreshing(false);
    }
  }, [loadAll, ensureProxyHealthy]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (didInitialLoad.current) return;
      didInitialLoad.current = true;
      try {
        await refreshAll();
      } catch (e: any) {
        if (isMethodNotAllowed(e)) {
          notifyRef.current.err('Load failed', 'Backend method not allowed (405).');
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
      const sourceLang: SourceLang = type === 'breaking' ? breakingSourceLang : liveSourceLang;
      const createdItem = await apiAddBroadcastItem(type, text, { sourceLang });
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
      if (isUnauthorized(e)) {
        notifyRef.current.err('Session expired — please login again');
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
  }, [breakingText, liveText, breakingSourceLang, liveSourceLang]);

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
      if (isUnauthorized(e)) {
        notifyRef.current.err('Session expired — please login again');
        return;
      }
      notifyRef.current.err('Delete failed', apiErrorDetails(e, 'API error'));
    } finally {
      setWorking(id, false);
    }
  }, [setWorking]);

  return (
    <div className="space-y-6">
      {proxyHealthy === false ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
          <div className="text-sm font-semibold">Admin API proxy warning</div>
          <div className="mt-1 text-xs opacity-90">
            Health probe to <span className="font-mono">/admin-api/system/health</span> failed{typeof proxyHealthStatus === 'number' ? ` (HTTP ${proxyHealthStatus || 0})` : ''}. You can still try Save/Refresh; if this is local dev, ensure the Vite proxy target is set.
          </div>
          {(() => {
            const direct = String(
              (import.meta as any)?.env?.VITE_BACKEND_URL ||
              (import.meta as any)?.env?.VITE_PROXY_TARGET ||
              (import.meta as any)?.env?.VITE_BACKEND_ORIGIN ||
              ''
            ).trim();
            if (!direct) return null;
            return (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="text-xs">Backend:</div>
                <div className="rounded-md bg-white/70 px-2 py-1 text-xs font-mono dark:bg-black/30">{direct}</div>
                <button
                  type="button"
                  className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950 dark:hover:bg-amber-900/50"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(direct);
                      notifyRef.current.ok('Copied backend URL');
                    } catch {
                      notifyRef.current.err('Copy failed');
                    }
                  }}
                >
                  Copy
                </button>
              </div>
            );
          })()}
        </div>
      ) : null}

      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">📡 Broadcast Center</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Manage Breaking + Live Updates line-by-line items (last 24h).</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            disabled={loading || saving || !dirty}
            onClick={() => {
              void doSave(settings, breakingTickerSpeedSeconds, liveTickerSpeedSeconds);
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

      <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Public ticker preview (EN/HI/GU)</div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Fetches <span className="font-mono">/admin-api/public/broadcast</span> for both tickers.
            </div>
          </div>

          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
            disabled={publicPreview.loading}
            onClick={() => void fetchPublicPreview()}
          >
            {publicPreview.loading ? 'Loading…' : 'Refresh preview'}
          </button>
        </div>

        {publicPreview.error ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-100">
            Preview unavailable: {publicPreview.error}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {(['breaking', 'live'] as const).map((type) => (
            <div key={type} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {type === 'breaking' ? 'Breaking' : 'Live Updates'}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(['en', 'hi', 'gu'] as const).map((lang) => {
                  const lines = (type === 'breaking' ? publicPreview.breaking : publicPreview.live)[lang];
                  return (
                    <div key={lang} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-950">
                      <div className="mb-2 font-semibold text-slate-700 dark:text-slate-200">
                        {lang === 'en' ? 'English' : lang === 'hi' ? 'Hindi' : 'Gujarati'}
                      </div>
                      {lines.length === 0 ? (
                        <div className="text-slate-500 dark:text-slate-400">No lines</div>
                      ) : (
                        <div className="space-y-1">
                          {lines.map((t, i) => (
                            <div key={`${lang}-${i}`} className="truncate" title={t}>
                              {t}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SectionCard
          title="🔥 Breaking"
          disabled={loading}
          enabled={settings.breakingEnabled}
          onEnabledChange={(next) => {
            // Backend treats mode=force_on as always-on; if user disables, also move to Auto.
            setSettings((prev) => ({
              ...prev,
              breakingEnabled: next,
              ...(next ? null : { breakingMode: 'auto' }),
            }));
          }}
          mode={settings.breakingMode}
          onModeChange={(next) => setSettings((prev) => ({ ...prev, breakingMode: next }))}
          tickerSpeedSeconds={breakingTickerSpeedSeconds}
          onTickerSpeedSecondsChange={(next) => setBreakingTickerSpeedSeconds(clampDurationSeconds(next, 12))}
          defaultTickerSpeedSeconds={12}
          onTickerSpeedSecondsReset={() => setBreakingTickerSpeedSeconds(12)}
          inputValue={breakingText}
          onInputChange={setBreakingText}
          sourceLang={breakingSourceLang}
          onSourceLangChange={setBreakingSourceLang}
          addDisabled={loading || addingType === 'breaking'}
          onAdd={() => addItem('breaking')}
          items={breakingItems}
          workingIdMap={workingIdMap}
          onDelete={(item) => deleteItem('breaking', item)}
        />

        <SectionCard
          title="🔵 Live Updates"
          disabled={loading}
          enabled={settings.liveEnabled}
          onEnabledChange={(next) => {
            setSettings((prev) => ({
              ...prev,
              liveEnabled: next,
              ...(next ? null : { liveMode: 'auto' }),
            }));
          }}
          mode={settings.liveMode}
          onModeChange={(next) => setSettings((prev) => ({ ...prev, liveMode: next }))}
          tickerSpeedSeconds={liveTickerSpeedSeconds}
          onTickerSpeedSecondsChange={(next) => setLiveTickerSpeedSeconds(clampDurationSeconds(next, 12))}
          defaultTickerSpeedSeconds={12}
          onTickerSpeedSecondsReset={() => setLiveTickerSpeedSeconds(12)}
          inputValue={liveText}
          onInputChange={setLiveText}
          sourceLang={liveSourceLang}
          onSourceLangChange={setLiveSourceLang}
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

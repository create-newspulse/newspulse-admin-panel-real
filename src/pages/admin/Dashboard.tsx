import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';

import StatsCards from '@components/StatsCards';
import LiveTicker from '@components/LiveTicker';
import ChartComponent from '@components/ChartComponent';
import SystemHealthBadge from '@components/SystemHealthBadge';
import { apiUrl } from '@/lib/apiBase';
import api from '@/utils/api';
import { listArticles } from '@/lib/api/articles';
import { supportedLanguages } from '@/lib/languageConfig';
import { getAdminAnalyticsDashboard, type DashboardAnalyticsResponse } from '@/lib/api/adminAnalytics';
import { ReadershipCards, type ReadershipSummary } from '@/components/analytics/ReadershipCards';

type AdminStats = {
  totalNews: number;
  categoriesCount: number;
  languagesCount: number;
  activeUsersCount: number;
  aiLogsCount: number;
};

function toFiniteNonNegativeNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() ? Number(v) : NaN);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

function pickFirstNumber(...values: unknown[]): number | null {
  for (const v of values) {
    const n = toFiniteNonNegativeNumber(v);
    if (n != null) return n;
  }
  return null;
}

function normalizeLang(code: unknown): string {
  const c = String(code || '').trim().toLowerCase();
  if (!c) return '';
  if (c === 'en') return 'EN';
  if (c === 'hi') return 'HI';
  if (c === 'gu') return 'GU';
  return c.slice(0, 4).toUpperCase();
}

function mapDashboardReadershipSummary(payload: DashboardAnalyticsResponse | any): {
  summary: ReadershipSummary | null;
  empty: boolean;
} {
  const p = payload && typeof payload === 'object' ? payload : {};
  const totals = (p.totals && typeof p.totals === 'object') ? p.totals : {};

  const views = pickFirstNumber(totals.views, totals.totalViews);
  const readers = pickFirstNumber(totals.uniqueReaders, totals.readers);
  const engagedReads = pickFirstNumber(totals.engagedReads, totals.engaged);
  const avgReadTimeSec = pickFirstNumber(totals.avgReadTimeSec, totals.avgReadTimeSeconds, totals.avgReadTime);

  const sources: Array<{ source?: string; views?: number }> = Array.isArray(p.sources) ? p.sources : [];
  const topFromList = sources
    .slice()
    .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))[0];
  const topSource = (p.topSource && typeof p.topSource === 'object' ? p.topSource : null) || topFromList || null;
  const topSourceLabel = String((topSource as any)?.source || '').trim() || '—';
  const topSourceViews = toFiniteNonNegativeNumber((topSource as any)?.views) ?? undefined;

  const languagesArray: Array<{ language?: string; views?: number }> = Array.isArray(p.languages) ? p.languages : [];
  const languageBreakdown = (p.languageBreakdown && typeof p.languageBreakdown === 'object') ? p.languageBreakdown : null;

  const langRows: Array<{ language: string; views: number }> = [];
  for (const row of languagesArray) {
    const lang = normalizeLang((row as any)?.language);
    const v = toFiniteNonNegativeNumber((row as any)?.views) ?? 0;
    if (lang) langRows.push({ language: lang, views: v });
  }
  if (languageBreakdown) {
    for (const [k, v] of Object.entries(languageBreakdown as any)) {
      const lang = normalizeLang(k);
      const n = toFiniteNonNegativeNumber(v) ?? 0;
      if (lang) langRows.push({ language: lang, views: n });
    }
  }

  // de-dupe by language (keep max views)
  const langMax = new Map<string, number>();
  for (const r of langRows) {
    const prev = langMax.get(r.language) ?? 0;
    if (r.views > prev) langMax.set(r.language, r.views);
  }
  const langsSorted = Array.from(langMax.entries())
    .map(([language, v]) => ({ language, views: v }))
    .sort((a, b) => b.views - a.views);

  const languageSummaryLabel = langsSorted.length
    ? langsSorted.slice(0, 3).map((x) => x.language).join(', ')
    : '—';

  const totalViewsForPct = views != null && views > 0 ? views : langsSorted.reduce((acc, r) => acc + r.views, 0);
  const languageSummaryDetail = langsSorted.length
    ? (() => {
        const top = langsSorted[0];
        const pct = totalViewsForPct > 0 ? Math.round((top.views / totalViewsForPct) * 100) : null;
        return pct != null ? `Top: ${top.language} (${pct}%)` : `Top: ${top.language}`;
      })()
    : undefined;

  const anySignal =
    views != null
    || readers != null
    || engagedReads != null
    || avgReadTimeSec != null
    || sources.length > 0
    || langsSorted.length > 0;

  if (!anySignal) {
    return { summary: null, empty: true };
  }

  return {
    summary: {
      views: views ?? 0,
      readers: readers ?? 0,
      engagedReads: engagedReads ?? 0,
      avgReadTimeSec: avgReadTimeSec ?? 0,
      topSourceLabel,
      topSourceViews,
      languageSummaryLabel,
      languageSummaryDetail,
    },
    empty: false,
  };
}

function toFiniteNonNegativeInt(v: unknown): number | null {
  const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() ? Number(v) : NaN);
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < 0) return null;
  return i;
}

function countKeys(v: unknown): number | null {
  if (!v || typeof v !== 'object') return null;
  try {
    const keys = Object.keys(v as any);
    return keys.length;
  } catch {
    return null;
  }
}

function countDistinctFromRows(rows: Array<any>, field: 'category' | 'language'): number {
  const set = new Set<string>();
  for (const r of rows || []) {
    const raw = (r as any)?.[field];
    const s = typeof raw === 'string' ? raw.trim() : '';
    if (s) set.add(s);
  }
  return set.size;
}

function mapAdminStatsPayload(payload: any): {
  mapped: Partial<AdminStats>;
  recognizedAny: boolean;
} {
  const p = payload && typeof payload === 'object' ? payload : {};

  const totalNews =
    toFiniteNonNegativeInt(p.totalNews)
    ?? toFiniteNonNegativeInt(p.totalArticles)
    ?? toFiniteNonNegativeInt(p.total)
    ?? toFiniteNonNegativeInt(p.totals?.news)
    ?? toFiniteNonNegativeInt(p.totals?.totalNews)
    ?? toFiniteNonNegativeInt(p.totals?.articles);

  const categoriesCount =
    toFiniteNonNegativeInt(p.categoriesCount)
    ?? toFiniteNonNegativeInt(p.categories)
    ?? toFiniteNonNegativeInt(p.categoryCount)
    ?? countKeys(p.categoryCounts)
    ?? (Array.isArray(p.byCategory) ? p.byCategory.length : null)
    ?? (Array.isArray(p.categories) ? p.categories.length : null);

  const languagesCount =
    toFiniteNonNegativeInt(p.languagesCount)
    ?? toFiniteNonNegativeInt(p.languages)
    ?? toFiniteNonNegativeInt(p.languageCount)
    ?? countKeys(p.languageCounts)
    ?? (Array.isArray(p.byLanguage) ? p.byLanguage.length : null)
    ?? (Array.isArray(p.languages) ? p.languages.length : null);

  const activeUsersCount =
    toFiniteNonNegativeInt(p.activeUsersCount)
    ?? toFiniteNonNegativeInt(p.activeUsers)
    ?? toFiniteNonNegativeInt(p.totals?.activeUsers)
    ?? toFiniteNonNegativeInt(p.totals?.usersActive);

  const aiLogsCount =
    toFiniteNonNegativeInt(p.aiLogsCount)
    ?? toFiniteNonNegativeInt(p.aiLogs)
    ?? (Array.isArray(p.aiLogs) ? p.aiLogs.length : null)
    ?? (Array.isArray(p.aiActivityLog) ? p.aiActivityLog.length : null);

  const recognizedAny =
    totalNews != null
    || categoriesCount != null
    || languagesCount != null
    || activeUsersCount != null
    || aiLogsCount != null
    || p.ok === true
    || p.success === true;

  return {
    mapped: {
      ...(totalNews != null ? { totalNews } : {}),
      ...(categoriesCount != null ? { categoriesCount } : {}),
      ...(languagesCount != null ? { languagesCount } : {}),
      ...(activeUsersCount != null ? { activeUsersCount } : {}),
      ...(aiLogsCount != null ? { aiLogsCount } : {}),
    },
    recognizedAny,
  };
}

const Dashboard = () => {
  const navigate = useNavigate();

  const [readershipRange, setReadershipRange] = useState<'24h' | '7d' | '30d'>(() => {
    try {
      const raw = localStorage.getItem('np_admin_dashboard_readership_range');
      if (raw === '24h' || raw === '7d' || raw === '30d') return raw;
    } catch {}
    return '30d';
  });

  useEffect(() => {
    try { localStorage.setItem('np_admin_dashboard_readership_range', readershipRange); } catch {}
  }, [readershipRange]);

  const readershipQuery = useQuery({
    queryKey: ['admin', 'analytics', 'dashboard', readershipRange],
    queryFn: async () => {
      const requestedPath = '/analytics/dashboard';
      if (import.meta.env.DEV) {
        try { console.log('[AdminDashboard] readership request →', requestedPath, { range: readershipRange }); } catch {}
      }
      return await getAdminAnalyticsDashboard({ range: readershipRange });
    },
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!readershipQuery.isError) return;
    if (!import.meta.env.DEV) return;
    try { console.error('[AdminDashboard] readership analytics load failed', readershipQuery.error); } catch {}
  }, [readershipQuery.error, readershipQuery.isError]);

  const statsQuery = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const requestedPath = '/admin/stats';
      if (import.meta.env.DEV) {
        try { console.log('[AdminDashboard] stats request →', requestedPath); } catch {}
      }

      try {
        const res = await api.get(requestedPath, { timeout: 12000 });
        const raw = (res as any)?.data;
        const payload = (raw as any)?.data ?? raw ?? {};

        if (import.meta.env.DEV) {
          try {
            console.log('[AdminDashboard] stats response url =', (res as any)?.config?.url);
            console.log('[AdminDashboard] stats raw json =', raw);
          } catch {}
        }

        const { mapped, recognizedAny } = mapAdminStatsPayload(payload);

        // UX requirement: Dashboard “Languages” card shows supported/configured languages (EN/HI/GU),
        // not “detected in stories”. Source of truth is the centralized supportedLanguages list.
        const supportedLanguagesCount = supportedLanguages.length;

        // If the backend returns a 200 with an unexpected JSON shape, don't silently render zeros.
        // Fall back to computing counts from the stable /articles list contract.
        const needsTotal = mapped.totalNews == null;
        const needsCategories = mapped.categoriesCount == null;
        const needsLanguages = false;

        // If nothing at all is recognizable, treat as a mismatch and compute from articles.
        const shouldComputeFromArticles = needsTotal || needsCategories || needsLanguages || !recognizedAny;

        if (import.meta.env.DEV && shouldComputeFromArticles) {
          try {
            console.warn('[AdminDashboard] /admin/stats missing fields; computing from /articles', {
              recognizedAny,
              needsTotal,
              needsCategories,
              needsLanguages,
              keys: payload && typeof payload === 'object' ? Object.keys(payload || {}).slice(0, 25) : undefined,
            });
          } catch {}
        }

        let computedTotal: number | null = null;
        let computedCategories: number | null = null;

        if (shouldComputeFromArticles) {
          const first = await listArticles({ status: 'all', page: 1, limit: 200 });
          computedTotal = toFiniteNonNegativeInt(first.total) ?? 0;

          // Only scan pages when we truly need distinct counts.
          if (needsCategories || needsLanguages) {
            const categories = new Set<string>();

            const absorb = (rows: any[]) => {
              for (const r of rows || []) {
                const c = typeof (r as any)?.category === 'string' ? (r as any).category.trim() : '';
                if (c) categories.add(c);
              }
            };

            absorb(first.rows as any);

            // Fetch remaining pages to get exact distinct counts.
            // Keep concurrency simple and deterministic; admin datasets here are typically modest.
            for (let page = 2; page <= first.pages; page++) {
              const next = await listArticles({ status: 'all', page, limit: 200 });
              absorb(next.rows as any);
            }

            computedCategories = categories.size;
          } else {
            computedCategories = mapped.categoriesCount ?? countDistinctFromRows(first.rows as any, 'category');
          }
        }

        const result: AdminStats = {
          totalNews: mapped.totalNews ?? computedTotal ?? 0,
          categoriesCount: mapped.categoriesCount ?? computedCategories ?? 0,
          languagesCount: supportedLanguagesCount,
          activeUsersCount: mapped.activeUsersCount ?? 0,
          aiLogsCount: mapped.aiLogsCount ?? 0,
        };

        if (import.meta.env.DEV) {
          try { console.log('[AdminDashboard] stats mapped state =', result); } catch {}
        }

        // If we still couldn't derive the core cards, surface a real error.
        if (!Number.isFinite(result.totalNews) || result.totalNews < 0) {
          throw new Error('Dashboard stats: failed to derive totalNews');
        }
        if (!Number.isFinite(result.categoriesCount) || result.categoriesCount < 0) {
          throw new Error('Dashboard stats: failed to derive categoriesCount');
        }
        if (!Number.isFinite(result.languagesCount) || result.languagesCount < 0) {
          throw new Error('Dashboard stats: failed to derive languagesCount');
        }

        return result;
      } catch (e) {
        if (import.meta.env.DEV) {
          try { console.error('[AdminDashboard] stats load failed', e); } catch {}
        }
        throw e;
      }
    },
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    staleTime: 60_000,
  });

  const stats = statsQuery.data ?? null;
  const statsState: 'loading' | 'ready' | 'disabled' = statsQuery.isLoading ? 'loading' : (statsQuery.isSuccess ? 'ready' : 'disabled');
  const state: 'loading' | 'ready' | 'disabled' = statsQuery.isSuccess ? 'ready' : (statsQuery.isLoading ? 'loading' : 'disabled');
  const statsErrorText = statsQuery.isError ? 'Failed to load stats' : undefined;

  const err: any = statsQuery.error;
  const status = err?.response?.status as number | undefined;
  const code = String(err?.code || err?.response?.data?.code || '').toUpperCase();

  useEffect(() => {
    if (status === 401) {
      try { navigate('/admin/login', { replace: true }); } catch {}
    }
  }, [navigate, status]);

  const banner: null | { type: 'error' | 'forbidden' | 'expired'; title: string; subtitle?: string } = (() => {
    if (!statsQuery.isError) return null;

    if (status === 401) {
      return { type: 'expired', title: 'Session expired', subtitle: 'Please log in again.' };
    }

    if (status === 403) {
      return { type: 'forbidden', title: 'Access denied', subtitle: 'Your account does not have permission to view these stats.' };
    }

    const isDbUnavailable = status === 503 || code === 'DB_UNAVAILABLE';
    const isBackendOffline = code === 'BACKEND_OFFLINE' || (!status && !isDbUnavailable);
    const backendOfflineTitle = import.meta.env.DEV
      ? 'Backend offline. Start backend on localhost:5000.'
      : 'API unreachable.';
    return {
      type: 'error',
      title: isDbUnavailable
        ? 'Database unavailable. Check backend MONGODB_URI / Mongo service.'
        : isBackendOffline
          ? backendOfflineTitle
          : 'Failed to load dashboard stats.',
      subtitle: (isDbUnavailable || isBackendOffline)
        ? undefined
        : (status ? `Request failed (HTTP ${status}).` : undefined),
    };
  })();

  // Feature flag: disable the yellow scrolling ticker by default.
  // Enable by setting VITE_SHOW_TICKER=true at build time.
  const SHOW_TICKER = (import.meta.env.VITE_SHOW_TICKER === 'true');

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-100 dark:from-slate-900 dark:to-slate-800 text-gray-900 dark:text-white transition-all duration-500">
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-12">
        <header
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white">Admin Dashboard</h1>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/add')}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Add News
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/articles')}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Manage News
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/drafts')}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Draft Desk
              </button>
            </div>
          </div>
          <div className="mt-1 sm:mt-0">
            <SystemHealthBadge />
          </div>
  </header>

        {banner?.type === 'error' ? (
          <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-5">
            <div className="text-lg font-semibold text-red-800 dark:text-red-200">{banner.title}</div>
            {banner.subtitle ? (
              <div className="mt-1 text-sm text-red-700/90 dark:text-red-200/80">{banner.subtitle}</div>
            ) : null}
          </div>
        ) : null}

        {banner?.type === 'forbidden' ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-5">
            <div className="text-lg font-semibold text-amber-900 dark:text-amber-200">{banner.title}</div>
            {banner.subtitle ? (
              <div className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/80">{banner.subtitle}</div>
            ) : null}
          </div>
        ) : null}

        {banner?.type === 'expired' ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-5">
            <div className="text-lg font-semibold text-amber-900 dark:text-amber-200">{banner.title}</div>
            {banner.subtitle ? (
              <div className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/80">{banner.subtitle}</div>
            ) : null}
          </div>
        ) : null}

        <section>
          <StatsCards
            state={statsState}
            errorText={statsErrorText}
            values={
              stats
                ? {
                    totalNews: stats.totalNews,
                    categoriesCount: stats.categoriesCount,
                    languagesCount: stats.languagesCount,
                    activeUsersCount: stats.activeUsersCount,
                    aiLogsCount: stats.aiLogsCount,
                  }
                : undefined
            }
          />
        </section>

        <section aria-labelledby="readership-analytics" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 id="readership-analytics" className="text-2xl font-semibold text-slate-700 dark:text-slate-100">Readership Analytics</h2>
              <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">Traffic metrics (separate from supported-language settings).</div>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={readershipRange}
                onChange={(e) => setReadershipRange(e.target.value as any)}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7d</option>
                <option value="30d">Last 30d</option>
              </select>
              <button
                type="button"
                onClick={() => navigate('/admin/analytics/articles')}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                View Details
              </button>
            </div>
          </div>

          <div className="mt-4">
            {(() => {
              if (readershipQuery.isLoading) {
                return <ReadershipCards state="loading" onOpenAnalyticsPath="/admin/analytics/articles" />;
              }
              if (readershipQuery.isError) {
                const err: any = readershipQuery.error;
                const status = err?.response?.status;
                const msg = status ? `Request failed (HTTP ${status}).` : 'Request failed.';
                return <ReadershipCards state="error" errorText={msg} onOpenAnalyticsPath="/admin/analytics/articles" />;
              }

              const { summary, empty } = mapDashboardReadershipSummary(readershipQuery.data);
              if (empty) {
                return <ReadershipCards state="empty" onOpenAnalyticsPath="/admin/analytics/articles" />;
              }
              return <ReadershipCards state="ready" summary={summary || undefined} onOpenAnalyticsPath="/admin/analytics/articles" />;
            })()}
          </div>
        </section>

        {state === 'ready' ? (
          <>

            <ChartComponent />

            {SHOW_TICKER && (
              <section>
                <LiveTicker apiUrl={apiUrl('/news-ticker')} position="top" />
              </section>
            )}
          </>
        ) : null}

        <section aria-labelledby="ai-insights" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <h2 id="ai-insights" className="text-2xl font-semibold text-slate-700 dark:text-slate-100 mb-2">
            AI Insights
          </h2>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            AI insights will appear after launch when real analytics are available.
          </div>
        </section>
      </div>
    </main>
  );
};

export default Dashboard;

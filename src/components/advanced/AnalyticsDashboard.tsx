import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  getAdminAnalyticsDashboard,
  listAdminAnalyticsArticles,
  listAdminAnalyticsCategories,
  type AnalyticsCommonFilters,
  type ArticlesAnalyticsRow,
  type CategoryAnalyticsRow,
  type DashboardAnalyticsResponse,
} from '@/lib/api/adminAnalytics';
import { formatDurationShort, formatPercent } from '@/lib/formatDuration';

type DateFilter = '24h' | '7d' | '30d' | 'custom';
type AnalyticsState = 'loading' | 'connected_empty' | 'connected_with_data' | 'error';
type TrafficStatus = 'connected' | 'not_connected' | 'error';

type ReadershipOverview = {
  pageViews: number | null;
  uniqueReaders: number | null;
  engagedReaders: number | null;
  avgReadTimeSec: number | null;
  completionRate: number | null;
  topArticle: { title: string; views: number | null } | null;
  topCategory: { category: string; views: number | null } | null;
};

const FIRST_PARTY_TRAFFIC_SOURCE = 'News Pulse Analytics';
const CONNECTED_EMPTY_MESSAGE = 'No readership analytics data is available for the selected date range.';

const dateFilters: ReadonlyArray<{ id: DateFilter; label: string }> = [
  { id: '24h', label: 'Last 24h' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'custom', label: 'Custom Range' },
];

const defaultOverview: ReadershipOverview = {
  pageViews: null,
  uniqueReaders: null,
  engagedReaders: null,
  avgReadTimeSec: null,
  completionRate: null,
  topArticle: null,
  topCategory: null,
};

function isRemovedAnalyticsTab(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ['ab', 'a-b', 'ab-tests', 'a-b-tests', 'abtests', 'ab_tests', 'a/b-tests', 'a/b', 'affiliate', 'affiliates', 'ads', 'ad-performance', 'finance', 'revenue'].includes(normalized);
}

function toRealNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() ? Number(value) : NaN);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function pickFirstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = toRealNumber(value);
    if (parsed != null) return parsed;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

function hasMetricData(overview: ReadershipOverview): boolean {
  return [overview.pageViews, overview.uniqueReaders, overview.engagedReaders, overview.avgReadTimeSec, overview.completionRate].some((value) => typeof value === 'number' && Number.isFinite(value))
    || Boolean(overview.topArticle || overview.topCategory);
}

function formatNumber(value: number | null): string {
  return value != null ? value.toLocaleString('en-IN') : 'Not configured';
}

function formatTopItem(value: { title?: string; category?: string; views: number | null } | null): string {
  if (!value) return 'No data yet';
  const label = value.title || value.category || 'No data yet';
  const views = value.views != null ? ` (${formatNumber(value.views)} views)` : '';
  return `${label}${views}`;
}

function dashboardRangeParams(dateFilter: DateFilter, customStart: string, customEnd: string): AnalyticsCommonFilters {
  if (dateFilter === 'custom') return { range: 'custom', from: customStart || undefined, to: customEnd || undefined };
  return { range: dateFilter };
}

function topArticle(rows: ArticlesAnalyticsRow[]): ReadershipOverview['topArticle'] {
  const top = rows
    .filter((row) => String(row.articleId || row.title || '').trim())
    .slice()
    .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))[0];
  if (!top) return null;
  return { title: top.title || top.articleId, views: pickFirstNumber(top.views) ?? 0 };
}

function topCategory(rows: CategoryAnalyticsRow[]): ReadershipOverview['topCategory'] {
  const top = rows
    .filter((row) => String(row.category || '').trim())
    .slice()
    .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))[0];
  if (!top) return null;
  return { category: top.category, views: pickFirstNumber(top.views) ?? 0 };
}

function mapReadershipOverview(payload: DashboardAnalyticsResponse | null | undefined, articles: ArticlesAnalyticsRow[], categories: CategoryAnalyticsRow[]): ReadershipOverview {
  const data = asRecord(payload);
  const totals = asRecord(data.totals);

  return {
    pageViews: pickFirstNumber(data.pageViews, data.views, data.totalViews, totals.pageViews, totals.views, totals.totalViews) ?? 0,
    uniqueReaders: pickFirstNumber(data.uniqueReaders, data.uniqueVisitors, data.readers, totals.uniqueReaders, totals.uniqueVisitors, totals.readers) ?? 0,
    engagedReaders: pickFirstNumber(data.engagedReaders, data.engagedReads, data.engaged, totals.engagedReaders, totals.engagedReads, totals.engaged) ?? 0,
    avgReadTimeSec: pickFirstNumber(data.avgReadTimeSec, data.avgReadTimeSeconds, data.avgReadTime, totals.avgReadTimeSec, totals.avgReadTimeSeconds, totals.avgReadTime) ?? 0,
    completionRate: pickFirstNumber(data.completionRate, data.scrollCompletion, totals.completionRate, totals.scrollCompletion) ?? 0,
    topArticle: topArticle(articles),
    topCategory: topCategory(categories),
  };
}

export default function AnalyticsDashboard(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [dateFilter, setDateFilter] = useState<DateFilter>('24h');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [overview, setOverview] = useState<ReadershipOverview>(defaultOverview);
  const [analyticsState, setAnalyticsState] = useState<AnalyticsState>('loading');
  const [trafficStatus, setTrafficStatus] = useState<TrafficStatus>('not_connected');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (isRemovedAnalyticsTab(params.get('tab')) || isRemovedAnalyticsTab(params.get('section'))) {
      navigate('/admin/analytics', { replace: true });
    }
  }, [location.search, navigate]);

  const dateValidationError = useMemo(() => {
    if (dateFilter !== 'custom') return null;
    if (!customStart || !customEnd) return 'Select both start and end dates to load a custom range.';
    if (customEnd < customStart) return 'End date cannot be earlier than start date.';
    return null;
  }, [customEnd, customStart, dateFilter]);

  const loadReport = useCallback(async (options?: { refresh?: boolean }) => {
    const isRefresh = options?.refresh === true;
    if (dateValidationError) {
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setAnalyticsState('loading');

    try {
      const filters = dashboardRangeParams(dateFilter, customStart, customEnd);
      const [dashboard, articleData, categoryData] = await Promise.all([
        getAdminAnalyticsDashboard(filters),
        listAdminAnalyticsArticles({ ...filters, page: 1, limit: 200 }),
        listAdminAnalyticsCategories(filters),
      ]);
      const articleRows = (articleData?.rows || articleData?.items || []) as ArticlesAnalyticsRow[];
      const categoryRows = (categoryData?.rows || categoryData?.items || []) as CategoryAnalyticsRow[];
      const nextOverview = mapReadershipOverview(dashboard, articleRows, categoryRows);

      setOverview(nextOverview);
      setTrafficStatus('connected');
      setAnalyticsState(hasMetricData(nextOverview) ? 'connected_with_data' : 'connected_empty');
    } catch (err) {
      setOverview(defaultOverview);
      setTrafficStatus('error');
      setAnalyticsState('error');
      setError(err instanceof Error ? err.message : 'Unable to load readership analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customEnd, customStart, dateFilter, dateValidationError]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const refreshLocked = Boolean(dateValidationError);
  const refreshLabel = loading ? 'Loading data...' : refreshing ? 'Refreshing data...' : 'Refresh Data';
  const overviewCards = [
    { label: 'Page Views', value: trafficStatus === 'connected' ? formatNumber(overview.pageViews) : 'Not configured' },
    { label: 'Unique Readers', value: trafficStatus === 'connected' ? formatNumber(overview.uniqueReaders) : 'Not configured' },
    { label: 'Engaged Readers', value: trafficStatus === 'connected' ? formatNumber(overview.engagedReaders) : 'Not configured' },
    { label: 'Average Read Time', value: trafficStatus === 'connected' ? formatDurationShort(overview.avgReadTimeSec) : 'Not configured' },
    { label: 'Completion Rate', value: trafficStatus === 'connected' ? formatPercent(overview.completionRate) : 'Not configured' },
    { label: 'Top Article', value: trafficStatus === 'connected' ? formatTopItem(overview.topArticle) : 'Not configured' },
    { label: 'Top Category', value: trafficStatus === 'connected' ? formatTopItem(overview.topCategory) : 'Not configured' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-3xl font-bold">Readership Analytics</h2>
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">Audience metrics from stored News Pulse readership events.</div>
        </div>
        <button
          onClick={() => void loadReport({ refresh: true })}
          disabled={loading || refreshing || refreshLocked}
          className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {refreshLabel}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {dateFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => setDateFilter(filter.id)}
            className={`rounded border px-3 py-2 text-sm font-semibold ${
              dateFilter === filter.id
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200'
            }`}
          >
            {filter.label}
          </button>
        ))}
        {dateFilter === 'custom' ? (
          <div className="flex flex-wrap gap-2">
            <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
            <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => navigate('/admin/analytics/articles')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800">
          Article Analytics
        </button>
        <button type="button" onClick={() => navigate('/admin/analytics/categories')} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-900 dark:hover:bg-slate-800">
          Category Analytics
        </button>
      </div>

      {analyticsState === 'loading' ? <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600 shadow dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Loading readership analytics...</div> : null}

      {analyticsState === 'error' && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
          <div className="font-semibold">Readership analytics unavailable</div>
          <div className="mt-1 text-sm">{error}</div>
        </div>
      ) : null}

      {dateValidationError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {dateValidationError}
        </div>
      ) : null}

      {analyticsState === 'connected_empty' ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-600 shadow dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {CONNECTED_EMPTY_MESSAGE}
        </div>
      ) : null}

      {analyticsState !== 'loading' && analyticsState !== 'error' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {overviewCards.map((card) => (
              <div key={card.label} className="rounded-lg bg-white p-4 shadow dark:bg-slate-800">
                <div className="text-sm text-gray-500 dark:text-gray-400">{card.label}</div>
                <div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{card.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-white p-4 shadow dark:bg-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">Traffic Analytics</div>
                <span className={trafficStatus === 'connected' ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}>
                  {trafficStatus === 'connected' ? 'Connected' : 'Not Configured'}
                </span>
              </div>
              <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{trafficStatus === 'connected' ? FIRST_PARTY_TRAFFIC_SOURCE : 'No analytics provider configured'}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
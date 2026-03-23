import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';

import {
  listAdminAnalyticsCategories,
  type AnalyticsRangeKey,
  type CategoryAnalyticsRow,
} from '@/lib/api/adminAnalytics';
import { formatDurationShort, formatNumberCompact, formatPercent } from '@/lib/formatDuration';
import { ARTICLE_CATEGORY_LABELS, isAllowedArticleCategoryKey } from '@/lib/articleCategories';

type Filters = {
  range: Exclude<AnalyticsRangeKey, 'custom'>;
  status: string;
  language: string;
};

function categoryLabel(c: string): string {
  const key = String(c || '').trim();
  if (!key) return '—';
  return isAllowedArticleCategoryKey(key) ? ARTICLE_CATEGORY_LABELS[key] : key;
}

export default function CategoriesAnalyticsPage() {
  const navigate = useNavigate();

  const [filters, setFilters] = React.useState<Filters>(() => {
    try {
      const raw = localStorage.getItem('np_admin_analytics_categories_filters');
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          range: (parsed?.range === '24h' || parsed?.range === '7d' || parsed?.range === '30d') ? parsed.range : '30d',
          status: typeof parsed?.status === 'string' ? parsed.status : 'all',
          language: typeof parsed?.language === 'string' ? parsed.language : '',
        };
      }
    } catch {}
    return { range: '30d', status: 'all', language: '' };
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('np_admin_analytics_categories_filters', JSON.stringify(filters));
    } catch {}
  }, [filters]);

  const q = useQuery({
    queryKey: ['admin', 'analytics', 'categories', filters],
    queryFn: async () => {
      const data = await listAdminAnalyticsCategories({
        range: filters.range,
        status: filters.status !== 'all' ? filters.status : undefined,
        language: filters.language || undefined,
      });
      const rows = (data?.rows || data?.items || []) as CategoryAnalyticsRow[];
      return rows;
    },
    retry: 0,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (!q.isError) return;
    if (!import.meta.env.DEV) return;
    try {
      // eslint-disable-next-line no-console
      console.error('[CategoriesAnalyticsPage] load failed', q.error);
    } catch {}
  }, [q.error, q.isError]);

  const rows = q.data || [];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Category Analytics</h1>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Performance rollups by category with top articles.</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/admin/analytics')}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Article Analytics
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Back to Dashboard
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">Date range</div>
            <select
              value={filters.range}
              onChange={(e) => setFilters((p) => ({ ...p, range: e.target.value as any }))}
              className="mt-1 w-full border rounded px-3 py-2 bg-white dark:bg-slate-900"
            >
              <option value="24h">Last 24h</option>
              <option value="7d">Last 7d</option>
              <option value="30d">Last 30d</option>
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">Status</div>
            <select
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}
              className="mt-1 w-full border rounded px-3 py-2 bg-white dark:bg-slate-900"
            >
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">Language</div>
            <select
              value={filters.language}
              onChange={(e) => setFilters((p) => ({ ...p, language: e.target.value }))}
              className="mt-1 w-full border rounded px-3 py-2 bg-white dark:bg-slate-900"
            >
              <option value="">All</option>
              <option value="en">EN</option>
              <option value="hi">HI</option>
              <option value="gu">GU</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Categories</div>
          <div className="text-xs text-slate-600 dark:text-slate-300">Range: {filters.range}</div>
        </div>

        {q.isLoading ? (
          <div className="p-4 text-sm text-slate-500 animate-pulse">Loading analytics…</div>
        ) : q.isError ? (
          <div className="p-4">
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
              <div className="text-sm font-semibold text-red-800 dark:text-red-200">Failed to load category analytics</div>
              <div className="mt-1 text-xs text-red-700/90 dark:text-red-200/80">Check `/api/admin/analytics/categories` and dev console for details.</div>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-slate-700 dark:text-slate-200">No category analytics rows for these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr className="text-left">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">Category</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">Views</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">Readers</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">Engaged</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">Avg Read</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">Completion</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-200">Top Articles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {rows
                  .slice()
                  .sort((a, b) => Number(b.views || 0) - Number(a.views || 0))
                  .map((r) => (
                    <tr key={r.category} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 dark:text-white">{categoryLabel(r.category)}</div>
                        <div className="mt-0.5 text-xs text-slate-500">Key: {r.category}</div>
                      </td>
                      <td className="px-4 py-3 font-semibold">{formatNumberCompact(r.views)}</td>
                      <td className="px-4 py-3">{formatNumberCompact(r.uniqueReaders ?? r.readers)}</td>
                      <td className="px-4 py-3">{formatNumberCompact(r.engagedReads)}</td>
                      <td className="px-4 py-3">{formatDurationShort(r.avgReadTimeSec)}</td>
                      <td className="px-4 py-3">{formatPercent(r.completionRate)}</td>
                      <td className="px-4 py-3">
                        {Array.isArray(r.topArticles) && r.topArticles.length ? (
                          <div className="space-y-1">
                            {r.topArticles.slice(0, 4).map((a) => (
                              <div key={a.articleId} className="flex items-center justify-between gap-3">
                                <Link
                                  to={`/admin/articles/${encodeURIComponent(a.articleId)}/edit`}
                                  className="text-xs font-semibold text-blue-700 dark:text-blue-300 hover:underline truncate max-w-[420px]"
                                >
                                  {a.title || a.articleId}
                                </Link>
                                <div className="text-xs text-slate-600 dark:text-slate-300">{formatNumberCompact(a.views)}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500">—</div>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="text-xs text-slate-500">
        Manage workflow actions in <Link to="/admin/articles" className="underline">Manage News</Link>.
      </div>
    </div>
  );
}

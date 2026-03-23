import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminAnalyticsArticle, type ArticleAnalyticsRange } from '@/lib/api/adminAnalytics';
import { formatDurationShort, formatNumberCompact, formatPercent, normalizePercent } from '@/lib/formatDuration';

type RangeKey = '24h' | '7d' | '30d';

function pickRanges(payload: any): Partial<Record<RangeKey, ArticleAnalyticsRange>> {
  const ranges = (payload && typeof payload === 'object' ? (payload as any).ranges : null) || (payload as any)?.byRange;
  if (ranges && typeof ranges === 'object') {
    return {
      '24h': (ranges as any)['24h'],
      '7d': (ranges as any)['7d'],
      '30d': (ranges as any)['30d'],
    };
  }

  // Fallback: treat payload as a single range (use as 30d)
  const single: ArticleAnalyticsRange = {
    totals: (payload as any)?.totals,
    scrollFunnel: (payload as any)?.scrollFunnel,
    sources: (payload as any)?.sources,
    languages: (payload as any)?.languages,
  };
  return { '30d': single };
}

function funnelValue(funnel: any, key: 25 | 50 | 75 | 100): number | null {
  if (!funnel || typeof funnel !== 'object') return null;
  const v = (funnel as any)[`p${key}`] ?? (funnel as any)[String(key)];
  const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v) : NaN);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function MetricCell({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-extrabold text-slate-900 dark:text-white">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{sub}</div> : null}
    </div>
  );
}

export function ArticleAnalyticsPanel({ articleId }: { articleId: string }) {
  const [active, setActive] = React.useState<RangeKey>('30d');

  const q = useQuery({
    queryKey: ['admin', 'analytics', 'article', articleId],
    queryFn: async () => {
      const data = await getAdminAnalyticsArticle(articleId);
      return data;
    },
    retry: 0,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (!q.isError) return;
    if (!import.meta.env.DEV) return;
    try {
      // eslint-disable-next-line no-console
      console.error('[ArticleAnalyticsPanel] failed to load', articleId, q.error);
    } catch {}
  }, [articleId, q.error, q.isError]);

  const ranges = React.useMemo(() => pickRanges(q.data), [q.data]);
  const activeRange = (ranges[active] || null) as ArticleAnalyticsRange | null;

  const activeTotals = activeRange?.totals || {};
  const views = (activeTotals.views ?? 0) as any;
  const readers = (activeTotals.uniqueReaders ?? activeTotals.readers ?? 0) as any;
  const engaged = (activeTotals.engagedReads ?? 0) as any;
  const avg = (activeTotals.avgReadTimeSec ?? 0) as any;
  const completion = activeTotals.completionRate as any;

  const showEmpty = q.isSuccess && (!q.data || (!ranges['24h'] && !ranges['7d'] && !ranges['30d']));

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Readership Analytics</div>
          <div className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">Views, readers, engagement, completion, sources, and language.</div>
        </div>

        <div className="flex items-center gap-2">
          {(['24h', '7d', '30d'] as RangeKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setActive(k)}
              className={
                'px-3 py-1.5 rounded-full text-xs font-semibold border '
                + (active === k
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800')
              }
            >
              {k === '24h' ? 'Last 24h' : k === '7d' ? 'Last 7d' : 'Last 30d'}
            </button>
          ))}
        </div>
      </div>

      {q.isLoading ? (
        <div className="mt-4 text-sm text-slate-500 animate-pulse">Loading analytics…</div>
      ) : q.isError ? (
        <div className="mt-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4">
          <div className="text-sm font-semibold text-red-800 dark:text-red-200">Failed to load article analytics</div>
          <div className="mt-1 text-xs text-red-700/90 dark:text-red-200/80">Check backend `/api/admin/analytics/articles/:id` and dev console for details.</div>
        </div>
      ) : showEmpty ? (
        <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">No analytics yet</div>
          <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">This article hasn’t received traffic in the selected window.</div>
        </div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 lg:grid-cols-5 gap-3">
            <MetricCell label="Views" value={formatNumberCompact(views)} />
            <MetricCell label="Readers" value={formatNumberCompact(readers)} />
            <MetricCell label="Engaged" value={formatNumberCompact(engaged)} />
            <MetricCell label="Avg Read" value={formatDurationShort(avg)} />
            <MetricCell label="Completion" value={formatPercent(completion)} />
          </div>

          <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Scroll funnel */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Scroll Funnel</div>
              <div className="mt-2 space-y-2">
                {([25, 50, 75, 100] as const).map((p) => {
                  const v = funnelValue(activeRange?.scrollFunnel, p);
                  const totalViews = typeof views === 'number' ? views : (typeof views === 'string' ? Number(views) : NaN);
                  const pct = v != null && Number.isFinite(totalViews) && totalViews > 0 ? (v / totalViews) * 100 : null;
                  return (
                    <div key={p} className="flex items-center gap-3">
                      <div className="w-12 text-xs font-semibold text-slate-600 dark:text-slate-300">{p}%</div>
                      <div className="flex-1 h-2 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-2 bg-slate-700 dark:bg-slate-200"
                          style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }}
                        />
                      </div>
                      <div className="w-20 text-right text-xs text-slate-600 dark:text-slate-300">
                        {v == null ? '—' : `${formatNumberCompact(v)}${pct != null ? ` (${Math.round(pct)}%)` : ''}`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sources */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Sources</div>
              <div className="mt-2 space-y-2">
                {Array.isArray(activeRange?.sources) && activeRange!.sources!.length ? (
                  activeRange!.sources!
                    .slice()
                    .sort((a, b) => (Number(b.views || 0) - Number(a.views || 0)))
                    .slice(0, 6)
                    .map((s) => {
                      const label = String(s.source || 'Unknown');
                      const v = s.views;
                      return (
                        <div key={label} className="flex items-center justify-between gap-3 text-xs">
                          <div className="font-semibold text-slate-700 dark:text-slate-200 truncate">{label}</div>
                          <div className="text-slate-600 dark:text-slate-300">{formatNumberCompact(v)}</div>
                        </div>
                      );
                    })
                ) : (
                  <div className="text-xs text-slate-500">—</div>
                )}
              </div>
            </div>

            {/* Languages */}
            <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Language</div>
              <div className="mt-2 space-y-2">
                {Array.isArray(activeRange?.languages) && activeRange!.languages!.length ? (
                  activeRange!.languages!
                    .slice()
                    .sort((a, b) => (Number(b.views || 0) - Number(a.views || 0)))
                    .slice(0, 6)
                    .map((l) => {
                      const label = String(l.language || 'Unknown').toUpperCase();
                      const v = l.views;
                      return (
                        <div key={label} className="flex items-center justify-between gap-3 text-xs">
                          <div className="font-semibold text-slate-700 dark:text-slate-200">{label}</div>
                          <div className="text-slate-600 dark:text-slate-300">{formatNumberCompact(v)}</div>
                        </div>
                      );
                    })
                ) : (
                  <div className="text-xs text-slate-500">—</div>
                )}
              </div>
            </div>
          </div>

          {/* Small range strip */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['24h', '7d', '30d'] as RangeKey[]).map((k) => {
              const r = ranges[k];
              const t = r?.totals || {};
              const v = t.views;
              const rr = t.uniqueReaders ?? t.readers;
              const p = normalizePercent(t.completionRate);
              return (
                <div key={k} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {k === '24h' ? 'Last 24h' : k === '7d' ? 'Last 7d' : 'Last 30d'}
                  </div>
                  <div className="mt-1 text-xs text-slate-700 dark:text-slate-200">
                    <span className="font-semibold">Views</span>: {formatNumberCompact(v)}
                    <span className="mx-2 text-slate-400">•</span>
                    <span className="font-semibold">Readers</span>: {formatNumberCompact(rr)}
                    <span className="mx-2 text-slate-400">•</span>
                    <span className="font-semibold">Completion</span>: {p == null ? '—' : `${Math.round(p)}%`}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

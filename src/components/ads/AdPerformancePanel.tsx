import React from 'react';

import { getAdminAnalyticsAdPerformance, type AdPerformanceAnalyticsResponse } from '@/lib/api/adminAnalytics';

type AdPerformanceSummary = {
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  totalAds: number | null;
  activeAds: number | null;
  scope: string;
};

const ADS_MANAGER_SOURCE = 'Ads Manager';
const LIFETIME_SCOPE = 'Lifetime';
const NO_AD_ACTIVITY_MESSAGE = 'No ad activity yet.';

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

function calculateCtr(impressions: number | null, clicks: number | null): number | null {
  if (impressions == null || clicks == null) return null;
  if (impressions === 0 && clicks === 0) return 0;
  if (impressions <= 0 || clicks < 0) return null;
  return (clicks / impressions) * 100;
}

function formatNumber(value: number | null): string {
  return value != null ? value.toLocaleString('en-IN') : 'Not configured';
}

function formatPercent(value: number | null): string {
  return value != null ? `${value.toFixed(2)}%` : 'Not configured';
}

function mapAdPerformance(payload: AdPerformanceAnalyticsResponse | null | undefined): { connected: boolean; source: string; message: string | null; summary: AdPerformanceSummary } {
  const source = payload?.source || ADS_MANAGER_SOURCE;
  const scope = String(payload?.scope || '').trim().toLowerCase() === 'lifetime' ? LIFETIME_SCOPE : LIFETIME_SCOPE;

  if (!payload?.connected) {
    return {
      connected: false,
      source,
      message: payload?.message || 'No advertisement tracking system configured',
      summary: { impressions: null, clicks: null, ctr: null, totalAds: null, activeAds: null, scope },
    };
  }

  const data = asRecord(payload);
  const metrics = asRecord(payload.metrics);
  const totals = asRecord(payload.totals);
  const impressions = pickFirstNumber(data.impressions, metrics.impressions, metrics.totalImpressions, totals.impressions, totals.totalImpressions);
  const clicks = pickFirstNumber(data.clicks, metrics.clicks, metrics.totalClicks, totals.clicks, totals.totalClicks);
  const ctr = pickFirstNumber(data.ctr, data.ctrPct, data.clickThroughRate, metrics.ctr, metrics.ctrPct, metrics.clickThroughRate, totals.ctr, totals.ctrPct, totals.clickThroughRate) ?? calculateCtr(impressions, clicks);
  const totalAds = pickFirstNumber(data.totalAds, data.total, data.count, metrics.totalAds, metrics.total, metrics.count, totals.totalAds, totals.total, totals.count);
  const activeAds = pickFirstNumber(data.activeAds, data.active, data.activeCount, metrics.activeAds, metrics.active, metrics.activeCount, totals.activeAds, totals.active, totals.activeCount);

  return {
    connected: true,
    source,
    message: null,
    summary: {
      impressions: impressions ?? 0,
      clicks: clicks ?? 0,
      ctr: ctr ?? 0,
      totalAds: totalAds ?? 0,
      activeAds: activeAds ?? 0,
      scope,
    },
  };
}

export default function AdPerformancePanel(): JSX.Element {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [report, setReport] = React.useState(() => mapAdPerformance(null));

  const loadPerformance = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(mapAdPerformance(await getAdminAnalyticsAdPerformance()));
    } catch (err) {
      setReport(mapAdPerformance(null));
      setError(err instanceof Error ? err.message : 'Ads Manager analytics is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadPerformance();
  }, [loadPerformance]);

  const summary = report.summary;
  const hasAdActivity = [summary.impressions, summary.clicks, summary.totalAds, summary.activeAds].some((value) => typeof value === 'number' && value > 0);
  const hasAnyCounter = [summary.impressions, summary.clicks, summary.ctr, summary.totalAds, summary.activeAds].some((value) => typeof value === 'number' && Number.isFinite(value));

  return (
    <div className="space-y-4">
      <div className="border rounded p-4 bg-white dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Ad Performance</h2>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Real lifetime counters from Ads Manager.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={report.connected ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600'}>
              {report.connected ? 'Connected' : 'Not Configured'}
            </span>
            <button type="button" onClick={() => void loadPerformance()} disabled={loading} className="px-3 py-1.5 rounded border text-sm disabled:opacity-60">
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Connected source</div>
            <div className="mt-1 font-semibold text-slate-900 dark:text-white">{report.source}</div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scope</div>
            <div className="mt-1 font-semibold text-slate-900 dark:text-white">{summary.scope}</div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="border rounded p-4 bg-rose-50 text-rose-900 border-rose-200">
          <div className="text-sm font-semibold">Ads Manager analytics is unavailable.</div>
          <div className="mt-1 text-xs">{error}</div>
        </div>
      ) : null}

      {!loading && !report.connected ? (
        <div className="border rounded p-4 bg-white dark:bg-slate-900 text-sm text-slate-600 dark:text-slate-300">
          {report.message || 'No advertisement tracking system configured'}
        </div>
      ) : null}

      {report.connected ? (
        <div className="border rounded p-4 bg-white dark:bg-slate-900">
          <div className="text-sm font-semibold text-slate-900 dark:text-white">Ads Manager Lifetime Metrics</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Date range filters do not apply to these lifetime counters.</div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs uppercase text-slate-500">Impressions</div><div className="mt-1 text-xl font-semibold">{formatNumber(summary.impressions)}</div></div>
            <div className="rounded border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs uppercase text-slate-500">Clicks</div><div className="mt-1 text-xl font-semibold">{formatNumber(summary.clicks)}</div></div>
            <div className="rounded border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs uppercase text-slate-500">CTR</div><div className="mt-1 text-xl font-semibold">{formatPercent(summary.ctr)}</div></div>
            <div className="rounded border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs uppercase text-slate-500">Total Ads</div><div className="mt-1 text-xl font-semibold">{formatNumber(summary.totalAds)}</div></div>
            <div className="rounded border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs uppercase text-slate-500">Active Ads</div><div className="mt-1 text-xl font-semibold">{formatNumber(summary.activeAds)}</div></div>
          </div>
          {(!hasAdActivity || !hasAnyCounter) ? <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{NO_AD_ACTIVITY_MESSAGE}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
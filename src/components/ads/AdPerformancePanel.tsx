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

export type AdPerformanceAdRecord = {
  id: string;
  slot?: string | null;
  title?: string | null;
  headline?: string | null;
  imageUrl?: string | null;
  targetUrl?: string | null;
  clickable?: boolean | null;
  startAt?: string | null;
  endAt?: string | null;
  isActive?: boolean;
  impressions?: number | null;
  clicks?: number | null;
  productType?: string | null;
  placement?: string | null;
  sponsorBrandName?: string | null;
  internalCampaignName?: string | null;
};

export type SponsoredFeaturePerformanceRecord = {
  id: string;
  sponsorName?: string | null;
  internalCampaignName?: string | null;
  headline?: string | null;
  destinationUrl?: string | null;
  coverImage?: string | null;
  publicClickTarget?: string | null;
  isActive?: boolean;
  comboCampaignIsActive?: boolean;
  optionalLinkedSponsoredArticleId?: string | null;
  linkedSponsoredArticleTitle?: string | null;
  linkedSponsoredArticleUrl?: string | null;
  startAt?: string | null;
  endAt?: string | null;
};

export type SponsoredArticlePerformanceRecord = {
  id: string;
  title?: string | null;
  status?: string | null;
  publicUrl?: string | null;
  sponsorCtaUrl?: string | null;
};

type CampaignStatus = 'Active' | 'Scheduled' | 'Ended' | 'Inactive / Off';
type StatusFilter = 'all' | 'Active' | 'Scheduled' | 'Ended' | 'Inactive / Off';
type SortKey = 'impressions' | 'clicks' | 'ctr';

type AdPerformanceRow = {
  id: string;
  title: string;
  placement: string;
  status: CampaignStatus;
  isActive: boolean;
  impressions: number;
  clicks: number;
  ctr: number;
  schedule: string;
  startAt?: string | null;
  endAt?: string | null;
  hasCreative: boolean;
  hasDestination: boolean;
};

type PlacementPerformanceRow = {
  placement: string;
  ads: number;
  activeAds: number;
  impressions: number;
  clicks: number;
  ctr: number;
};

const ADS_MANAGER_SOURCE = 'Ads Manager';
const LIFETIME_SCOPE = 'Lifetime';
const NO_AD_ACTIVITY_MESSAGE = 'No ad activity yet.';
const NO_PERFORMANCE_DATA_MESSAGE = 'No ad performance data yet.';

function toRealNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() ? Number(value) : NaN);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function numberOrZero(value: unknown): number {
  return toRealNumber(value) ?? 0;
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

function calculateCtr(impressions: number | null | undefined, clicks: number | null | undefined): number {
  const safeImpressions = numberOrZero(impressions);
  const safeClicks = numberOrZero(clicks);
  if (safeImpressions <= 0) return 0;
  return (safeClicks / safeImpressions) * 100;
}

function formatNumber(value: number | null): string {
  return value != null ? value.toLocaleString('en-IN') : 'Not configured';
}

function formatPercent(value: number | null): string {
  return value != null ? `${value.toFixed(2)}%` : 'Not configured';
}

function safeDateLabel(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).replace(' am', ' AM').replace(' pm', ' PM');
}

function formatSchedule(startAt?: string | null, endAt?: string | null): string {
  if (!startAt && !endAt) return '-';
  if (startAt && endAt) return `${safeDateLabel(startAt)} to ${safeDateLabel(endAt)}`;
  if (startAt) return `Starts: ${safeDateLabel(startAt)}`;
  return `Ends: ${safeDateLabel(endAt)}`;
}

function dateTime(value?: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function getCampaignStatus(record: { isActive?: boolean; startAt?: string | null; endAt?: string | null }, now = Date.now()): CampaignStatus {
  const startTime = dateTime(record.startAt);
  const endTime = dateTime(record.endAt);
  if (!record.isActive) return 'Inactive / Off';
  if (startTime != null && startTime > now) return 'Scheduled';
  if (endTime != null && endTime < now) return 'Ended';
  return 'Active';
}

function isSponsoredFeatureAd(record: AdPerformanceAdRecord): boolean {
  const productType = String(record.productType || '').trim().toUpperCase();
  const placement = String(record.placement || '').trim().toLowerCase();
  return productType === 'SPONSORED_FEATURE' || placement === 'homepage_sponsored_feature';
}

function isSponsoredArticleLive(status?: string | null): boolean {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'published' || normalized === 'live' || normalized === 'public';
}

function adTitle(record: AdPerformanceAdRecord): string {
  return String(record.headline || record.title || record.internalCampaignName || record.id || 'Untitled ad').trim();
}

function adPlacement(record: AdPerformanceAdRecord): string {
  return String(record.slot || record.placement || 'Unassigned').trim() || 'Unassigned';
}

function hasDestination(record: AdPerformanceAdRecord): boolean {
  if (record.clickable === false) return true;
  return Boolean(String(record.targetUrl || '').trim());
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
      ctr,
      totalAds: totalAds ?? 0,
      activeAds: activeAds ?? 0,
      scope,
    },
  };
}

function toRows(records: AdPerformanceAdRecord[]): AdPerformanceRow[] {
  return records
    .filter((record) => !isSponsoredFeatureAd(record))
    .map((record) => {
      const impressions = numberOrZero(record.impressions);
      const clicks = numberOrZero(record.clicks);
      return {
        id: record.id,
        title: adTitle(record),
        placement: adPlacement(record),
        status: getCampaignStatus(record),
        isActive: Boolean(record.isActive),
        impressions,
        clicks,
        ctr: calculateCtr(impressions, clicks),
        schedule: formatSchedule(record.startAt, record.endAt),
        startAt: record.startAt,
        endAt: record.endAt,
        hasCreative: Boolean(String(record.imageUrl || '').trim()),
        hasDestination: hasDestination(record),
      };
    });
}

function groupByPlacement(rows: AdPerformanceRow[]): PlacementPerformanceRow[] {
  const grouped = new Map<string, PlacementPerformanceRow>();
  for (const row of rows) {
    const existing = grouped.get(row.placement) || { placement: row.placement, ads: 0, activeAds: 0, impressions: 0, clicks: 0, ctr: 0 };
    existing.ads += 1;
    if (row.isActive) existing.activeAds += 1;
    existing.impressions += row.impressions;
    existing.clicks += row.clicks;
    existing.ctr = calculateCtr(existing.impressions, existing.clicks);
    grouped.set(row.placement, existing);
  }
  return [...grouped.values()].sort((left, right) => right.impressions - left.impressions || right.clicks - left.clicks || left.placement.localeCompare(right.placement));
}

function sortRows(rows: AdPerformanceRow[], sortKey: SortKey): AdPerformanceRow[] {
  return [...rows].sort((left, right) => {
    const diff = right[sortKey] - left[sortKey];
    if (diff !== 0) return diff;
    return left.title.localeCompare(right.title);
  });
}

function topRows(rows: AdPerformanceRow[], sortKey: SortKey): AdPerformanceRow[] {
  return sortRows(rows.filter((row) => row[sortKey] > 0), sortKey).slice(0, 5);
}

function buildNeedsAttention(rows: AdPerformanceRow[]): Array<{ id: string; title: string; message: string }> {
  const now = Date.now();
  const items: Array<{ id: string; title: string; message: string }> = [];
  for (const row of rows) {
    if (row.isActive && row.impressions === 0) items.push({ id: `${row.id}:impressions`, title: row.title, message: 'Active ad has no recorded impressions.' });
    if (row.impressions > 0 && row.clicks === 0) items.push({ id: `${row.id}:clicks`, title: row.title, message: 'Ad has impressions but no recorded clicks.' });
    const endTime = dateTime(row.endAt);
    if (row.isActive && endTime != null && endTime < now) items.push({ id: `${row.id}:schedule`, title: row.title, message: 'Schedule has ended.' });
  }
  return items;
}

function buildDeliveryHealth(rows: AdPerformanceRow[], slotEnabled?: Record<string, boolean>): Array<{ id: string; title: string; status: 'Healthy' | 'Needs Attention' | 'Not Applicable'; message: string }> {
  const activeRows = rows.filter((row) => row.isActive);
  if (activeRows.length === 0) return [{ id: 'none', title: 'No active ads', status: 'Not Applicable', message: 'No active ads.' }];

  return activeRows.map((row) => {
    const slotKnown = row.placement !== 'Unassigned';
    const placementToggleKnown = slotEnabled && Object.prototype.hasOwnProperty.call(slotEnabled, row.placement);
    if (!slotKnown) return { id: row.id, title: row.title, status: 'Needs Attention', message: 'Active ad has no valid slot.' };
    if (placementToggleKnown && slotEnabled?.[row.placement] === false) return { id: row.id, title: row.title, status: 'Needs Attention', message: 'Placement is turned off.' };
    if (!row.hasCreative) return { id: row.id, title: row.title, status: 'Needs Attention', message: 'Active ad has no creative image.' };
    if (!row.hasDestination) return { id: row.id, title: row.title, status: 'Needs Attention', message: 'Active ad has no destination link.' };
    if (row.status === 'Ended') return { id: row.id, title: row.title, status: 'Needs Attention', message: 'Schedule has ended.' };
    return { id: row.id, title: row.title, status: 'Healthy', message: 'Active ad has valid slot, creative, destination, and schedule.' };
  });
}

function metricCard(label: string, value: string) {
  return (
    <div key={label} className="rounded border border-slate-200 p-3 dark:border-slate-700">
      <div className="text-xs uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

type AdPerformancePanelProps = {
  ads?: AdPerformanceAdRecord[];
  sponsoredFeatures?: SponsoredFeaturePerformanceRecord[];
  sponsoredArticles?: SponsoredArticlePerformanceRecord[];
  slotEnabled?: Record<string, boolean>;
  loadingAds?: boolean;
  loadingSponsoredContent?: boolean;
  onRefreshData?: () => Promise<void> | void;
};

export default function AdPerformancePanel({
  ads = [],
  sponsoredFeatures = [],
  sponsoredArticles = [],
  slotEnabled,
  loadingAds = false,
  loadingSponsoredContent = false,
  onRefreshData,
}: AdPerformancePanelProps): JSX.Element {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [placementFilter, setPlacementFilter] = React.useState('all');
  const [sortKey, setSortKey] = React.useState<SortKey>('impressions');
  const [report, setReport] = React.useState(() => mapAdPerformance(null));

  const loadPerformance = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [payload] = await Promise.all([
        getAdminAnalyticsAdPerformance(),
        onRefreshData ? Promise.resolve(onRefreshData()).catch(() => undefined) : Promise.resolve(undefined),
      ]);
      setReport(mapAdPerformance(payload));
    } catch (err) {
      setReport(mapAdPerformance(null));
      setError(err instanceof Error ? err.message : 'Ads Manager analytics is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [onRefreshData]);

  React.useEffect(() => {
    void loadPerformance();
  }, [loadPerformance]);

  const summary = report.summary;
  const rows = React.useMemo(() => toRows(ads), [ads]);
  const placementRows = React.useMemo(() => groupByPlacement(rows), [rows]);
  const placements = React.useMemo(() => [...new Set(rows.map((row) => row.placement))].sort(), [rows]);
  const filteredRows = React.useMemo(() => sortRows(
    rows.filter((row) => (statusFilter === 'all' || row.status === statusFilter) && (placementFilter === 'all' || row.placement === placementFilter)),
    sortKey,
  ), [placementFilter, rows, sortKey, statusFilter]);
  const campaignCounts = React.useMemo(() => ({
    Active: rows.filter((row) => row.status === 'Active').length,
    Scheduled: rows.filter((row) => row.status === 'Scheduled').length,
    Ended: rows.filter((row) => row.status === 'Ended').length,
    'Inactive / Off': rows.filter((row) => row.status === 'Inactive / Off').length,
  }), [rows]);
  const needsAttention = React.useMemo(() => buildNeedsAttention(rows), [rows]);
  const deliveryHealth = React.useMemo(() => buildDeliveryHealth(rows, slotEnabled), [rows, slotEnabled]);
  const activeSponsoredFeatureCount = sponsoredFeatures.filter((feature) => feature.isActive).length;
  const eligibleSponsoredArticleCount = sponsoredArticles.filter((article) => isSponsoredArticleLive(article.status)).length;
  const activeComboCount = sponsoredFeatures.filter((feature) => feature.isActive && feature.comboCampaignIsActive !== false && feature.optionalLinkedSponsoredArticleId).length;
  const hasAdActivity = [summary.impressions, summary.clicks, summary.totalAds, summary.activeAds].some((value) => typeof value === 'number' && value > 0);
  const topImpressions = React.useMemo(() => topRows(rows, 'impressions'), [rows]);
  const topClicks = React.useMemo(() => topRows(rows, 'clicks'), [rows]);
  const topCtr = React.useMemo(() => topRows(rows, 'ctr'), [rows]);
  const hasTopPerformers = topImpressions.length > 0 || topClicks.length > 0 || topCtr.length > 0;

  return (
    <div className="space-y-4">
      <div className="border rounded p-4 bg-white dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Ad Performance</h2>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Monitor ad delivery, impressions, clicks, CTR, placements and sponsored campaigns.</div>
            <div className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Current impression and click counters are lifetime metrics.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={report.connected ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600'}>
              {report.connected ? 'Connected' : 'Not Configured'}
            </span>
            <button type="button" onClick={() => void loadPerformance()} disabled={loading || loadingAds || loadingSponsoredContent} className="px-3 py-1.5 rounded border text-sm disabled:opacity-60">
              {loading || loadingAds || loadingSponsoredContent ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Connected Source</div>
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
        <>
          <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Ad Performance Overview">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Ads Manager Lifetime Metrics</div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
              {metricCard('Impressions', formatNumber(summary.impressions))}
              {metricCard('Clicks', formatNumber(summary.clicks))}
              {metricCard('CTR', formatPercent(summary.ctr))}
              {metricCard('Total Ads', formatNumber(summary.totalAds))}
              {metricCard('Active Ads', formatNumber(summary.activeAds))}
              {metricCard('Sponsored Features', sponsoredFeatures.length.toLocaleString('en-IN'))}
              {metricCard('Sponsored Articles', sponsoredArticles.length.toLocaleString('en-IN'))}
            </div>
            {!hasAdActivity ? <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{NO_AD_ACTIVITY_MESSAGE}</div> : null}
          </section>

          <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Per-Ad Performance">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Per-Ad Performance</h3>
              <div className="flex flex-wrap gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Status</span>
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="rounded border border-slate-200 bg-white px-2 py-1 dark:bg-slate-950">
                    <option value="all">All</option>
                    <option value="Active">Active</option>
                    <option value="Scheduled">Scheduled</option>
                    <option value="Ended">Ended</option>
                    <option value="Inactive / Off">Inactive</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Placement</span>
                  <select value={placementFilter} onChange={(event) => setPlacementFilter(event.target.value)} className="rounded border border-slate-200 bg-white px-2 py-1 dark:bg-slate-950">
                    <option value="all">All</option>
                    {placements.map((placement) => <option key={placement} value={placement}>{placement}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">Sort</span>
                  <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)} className="rounded border border-slate-200 bg-white px-2 py-1 dark:bg-slate-950">
                    <option value="impressions">Highest impressions</option>
                    <option value="clicks">Highest clicks</option>
                    <option value="ctr">Highest CTR</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-4 overflow-auto border rounded">
              <table className="min-w-[920px] w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950">
                  <tr>
                    {['Ad', 'Placement / Slot', 'Status', 'Impressions', 'Clicks', 'CTR', 'Schedule'].map((heading) => <th key={heading} className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr><td colSpan={7} className="p-3 text-sm text-slate-500">No ads found.</td></tr>
                  ) : filteredRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="p-2 font-medium text-slate-900 dark:text-white">{row.title}</td>
                      <td className="p-2 font-mono text-xs text-slate-600 dark:text-slate-300">{row.placement}</td>
                      <td className="p-2"><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">{row.status}</span></td>
                      <td className="p-2">{formatNumber(row.impressions)}</td>
                      <td className="p-2">{formatNumber(row.clicks)}</td>
                      <td className="p-2">{formatPercent(row.ctr)}</td>
                      <td className="p-2 text-xs text-slate-600 dark:text-slate-300">{row.schedule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Placement Performance">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Placement Performance</h3>
            <div className="mt-4 overflow-auto border rounded">
              <table className="min-w-[720px] w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-950">
                  <tr>{['Placement', 'Ads', 'Active Ads', 'Impressions', 'Clicks', 'CTR'].map((heading) => <th key={heading} className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {placementRows.length === 0 ? (
                    <tr><td colSpan={6} className="p-3 text-sm text-slate-500">No placement performance recorded yet.</td></tr>
                  ) : placementRows.map((row) => (
                    <tr key={row.placement} className="border-t border-slate-200 dark:border-slate-700">
                      <td className="p-2 font-mono text-xs">{row.placement}</td>
                      <td className="p-2">{formatNumber(row.ads)}</td>
                      <td className="p-2">{formatNumber(row.activeAds)}</td>
                      <td className="p-2">{formatNumber(row.impressions)}</td>
                      <td className="p-2">{formatNumber(row.clicks)}</td>
                      <td className="p-2">{formatPercent(row.ctr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Campaign Status">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Campaign Status</h3>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {Object.entries(campaignCounts).map(([label, count]) => metricCard(label, count.toLocaleString('en-IN')))}
              </div>
            </div>

            <div className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Needs Attention">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Needs Attention</h3>
              <div className="mt-4 space-y-2">
                {needsAttention.length === 0 ? <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No delivery attention items from current records.</div> : needsAttention.map((item) => (
                  <div key={item.id} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    <div className="font-semibold">{item.title}</div>
                    <div className="mt-1">{item.message}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Top Performing Ads">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Top Performing Ads</h3>
            {!hasTopPerformers ? (
              <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{NO_PERFORMANCE_DATA_MESSAGE}</div>
            ) : (
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
                {[
                  { label: 'Highest impressions', rows: topImpressions, value: (row: AdPerformanceRow) => formatNumber(row.impressions) },
                  { label: 'Highest clicks', rows: topClicks, value: (row: AdPerformanceRow) => formatNumber(row.clicks) },
                  { label: 'Highest CTR', rows: topCtr, value: (row: AdPerformanceRow) => formatPercent(row.ctr) },
                ].map((group) => (
                  <div key={group.label} className="rounded border border-slate-200 p-3 dark:border-slate-700">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</div>
                    <div className="mt-3 space-y-2">
                      {group.rows.length === 0 ? <div className="text-sm text-slate-500">No recorded value yet.</div> : group.rows.map((row) => (
                        <div key={`${group.label}:${row.id}`} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate">{row.title}</span>
                          <span className="font-semibold">{group.value(row)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Delivery Health">
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">Delivery Health</h3>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {deliveryHealth.map((item) => (
                <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-slate-900 dark:text-white">{item.title}</div>
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">{item.status}</span>
                  </div>
                  <div className="mt-1 text-slate-600 dark:text-slate-300">{item.message}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Sponsored Content Status">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Sponsored Content Status</h3>
                <div className="mt-1 text-xs text-slate-500">Uses existing Sponsored Feature, Sponsored Article, and Combo Campaign records only.</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded border border-slate-200 p-2"><div className="font-semibold text-slate-900">{activeSponsoredFeatureCount}</div><div>Active features</div></div>
                <div className="rounded border border-slate-200 p-2"><div className="font-semibold text-slate-900">{eligibleSponsoredArticleCount}</div><div>Eligible articles</div></div>
                <div className="rounded border border-slate-200 p-2"><div className="font-semibold text-slate-900">{activeComboCount}</div><div>Active combos</div></div>
              </div>
            </div>
            {activeSponsoredFeatureCount === 0 && eligibleSponsoredArticleCount === 0 ? <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No sponsored content currently active.</div> : null}
            <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
              {sponsoredFeatures.slice(0, 4).map((feature) => {
                const title = String(feature.headline || feature.internalCampaignName || feature.sponsorName || feature.id).trim();
                return (
                  <div key={feature.id} className="rounded border border-slate-200 p-3 text-sm dark:border-slate-700">
                    <div className="font-semibold text-slate-900 dark:text-white">{title}</div>
                    <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-2 dark:text-slate-300">
                      <div>Homepage: {feature.isActive ? 'Homepage ON' : 'Homepage OFF'}</div>
                      <div>Combo: {feature.comboCampaignIsActive === false ? 'Combo Campaign off' : 'Combo Campaign active'}</div>
                      <div>Linked article: {feature.linkedSponsoredArticleTitle || feature.optionalLinkedSponsoredArticleId || 'None'}</div>
                      <div className="break-all">Click target: {feature.publicClickTarget || feature.destinationUrl || feature.linkedSponsoredArticleUrl || '-'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
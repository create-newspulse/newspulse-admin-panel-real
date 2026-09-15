import React from 'react';

import {
  getAdminAnalyticsAdPerformance,
  type AdPerformanceAnalyticsFilters,
  type AdPerformanceAnalyticsResponse,
} from '@/lib/api/adminAnalytics';

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
type RangeMode = 'lifetime' | 'today' | '7d' | '30d' | 'custom';
type TrendRow = { date: string; impressions: number; clicks: number; ctr: number };
type PeriodAdRow = { id: string; title: string; placement: string; status?: string | null; impressions: number; clicks: number; ctr: number };
type PeriodPlacementRow = { placement: string; adsWithActivity: number; impressions: number; clicks: number; ctr: number };

type PeriodReport = {
  impressions: number;
  clicks: number;
  ctr: number;
  adsWithActivity: number;
  dailyTrend: TrendRow[];
  perAds: PeriodAdRow[];
  placements: PeriodPlacementRow[];
  topByImpressions: PeriodAdRow[];
  topByClicks: PeriodAdRow[];
  topByCtr: PeriodAdRow[];
};

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
const NO_PERIOD_DATA_MESSAGE = 'No ad performance data for this period.';

const RANGE_OPTIONS: Array<{ value: RangeMode; label: string }> = [
  { value: 'lifetime', label: 'Lifetime' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'custom', label: 'Custom Range' },
];

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

function arrayFrom(...values: unknown[]): unknown[] {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }
  return [];
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

function mapAdPerformance(payload: AdPerformanceAnalyticsResponse | null | undefined): { connected: boolean; source: string; message: string | null; summary: AdPerformanceSummary; period: PeriodReport } {
  const source = payload?.source || ADS_MANAGER_SOURCE;
  const scope = String(payload?.scope || '').trim().toLowerCase() === 'lifetime' ? LIFETIME_SCOPE : LIFETIME_SCOPE;

  if (!payload?.connected) {
    return {
      connected: false,
      source,
      message: payload?.message || 'No advertisement tracking system configured',
      summary: { impressions: null, clicks: null, ctr: null, totalAds: null, activeAds: null, scope },
      period: emptyPeriodReport(),
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
    period: mapPeriodPerformance(payload),
  };
}

function emptyPeriodReport(): PeriodReport {
  return { impressions: 0, clicks: 0, ctr: 0, adsWithActivity: 0, dailyTrend: [], perAds: [], placements: [], topByImpressions: [], topByClicks: [], topByCtr: [] };
}

function mapTrendRow(raw: unknown): TrendRow {
  const row = asRecord(raw);
  const impressions = numberOrZero(row.impressions ?? row.totalImpressions);
  const clicks = numberOrZero(row.clicks ?? row.totalClicks);
  return {
    date: String(row.date ?? row.day ?? row.key ?? '').trim() || '-',
    impressions,
    clicks,
    ctr: pickFirstNumber(row.ctr, row.ctrPct, row.clickThroughRate) ?? calculateCtr(impressions, clicks),
  };
}

function mapPeriodAdRow(raw: unknown): PeriodAdRow {
  const row = asRecord(raw);
  const impressions = numberOrZero(row.impressions ?? row.totalImpressions);
  const clicks = numberOrZero(row.clicks ?? row.totalClicks);
  return {
    id: String(row.id ?? row.adId ?? row._id ?? row.key ?? row.title ?? '').trim(),
    title: String(row.title ?? row.adTitle ?? row.name ?? row.id ?? row.adId ?? 'Untitled ad').trim(),
    placement: String(row.slot ?? row.placement ?? row.placementKey ?? 'Unassigned').trim() || 'Unassigned',
    status: typeof row.status === 'string' ? row.status : null,
    impressions,
    clicks,
    ctr: pickFirstNumber(row.ctr, row.ctrPct, row.clickThroughRate) ?? calculateCtr(impressions, clicks),
  };
}

function mapPeriodPlacementRow(raw: unknown): PeriodPlacementRow {
  const row = asRecord(raw);
  const impressions = numberOrZero(row.impressions ?? row.totalImpressions);
  const clicks = numberOrZero(row.clicks ?? row.totalClicks);
  return {
    placement: String(row.placement ?? row.slot ?? row.placementKey ?? row.key ?? 'Unassigned').trim() || 'Unassigned',
    adsWithActivity: numberOrZero(row.adsWithActivity ?? row.activeAds ?? row.ads ?? row.count),
    impressions,
    clicks,
    ctr: pickFirstNumber(row.ctr, row.ctrPct, row.clickThroughRate) ?? calculateCtr(impressions, clicks),
  };
}

function mapTopGroup(value: unknown): PeriodAdRow[] {
  return arrayFrom(value).map(mapPeriodAdRow).filter((row) => row.impressions > 0 || row.clicks > 0 || row.ctr > 0).slice(0, 5);
}

function mapPeriodPerformance(payload: AdPerformanceAnalyticsResponse): PeriodReport {
  const data = asRecord(payload);
  const metrics = asRecord(payload.metrics);
  const totals = asRecord(payload.totals);
  const topAds = asRecord(payload.topAds);
  const perAds = arrayFrom(data.perAd, data.perAds, data.perAdPerformance, data.adPerformance, data.ads).map(mapPeriodAdRow);
  const dailyTrend = arrayFrom(data.dailyTrend, data.daily, data.trend, data.days).map(mapTrendRow);
  const placements = arrayFrom(data.placementPerformance, data.perPlacement, data.placements).map(mapPeriodPlacementRow);
  const impressions = pickFirstNumber(data.impressions, metrics.impressions, metrics.totalImpressions, totals.impressions, totals.totalImpressions) ?? 0;
  const clicks = pickFirstNumber(data.clicks, metrics.clicks, metrics.totalClicks, totals.clicks, totals.totalClicks) ?? 0;
  const adsWithActivity = pickFirstNumber(data.adsWithActivity, metrics.adsWithActivity, totals.adsWithActivity)
    ?? perAds.filter((row) => row.impressions > 0 || row.clicks > 0).length;

  return {
    impressions,
    clicks,
    ctr: pickFirstNumber(data.ctr, data.ctrPct, data.clickThroughRate, metrics.ctr, metrics.ctrPct, metrics.clickThroughRate, totals.ctr, totals.ctrPct, totals.clickThroughRate) ?? calculateCtr(impressions, clicks),
    adsWithActivity,
    dailyTrend,
    perAds,
    placements,
    topByImpressions: mapTopGroup(data.topByImpressions ?? topAds.impressions ?? topAds.topByImpressions),
    topByClicks: mapTopGroup(data.topByClicks ?? topAds.clicks ?? topAds.topByClicks),
    topByCtr: mapTopGroup(data.topByCtr ?? data.topByCTR ?? topAds.ctr ?? topAds.topByCtr ?? topAds.topByCTR),
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

function rangeScopeLabel(range: RangeMode, from: string, to: string): string {
  if (range === 'today') return 'Today';
  if (range === '7d') return 'Last 7 Days';
  if (range === '30d') return 'Last 30 Days';
  if (range === 'custom') return from && to ? `Custom: ${from} - ${to}` : 'Custom Range';
  return LIFETIME_SCOPE;
}

function customRangeError(from: string, to: string): string | null {
  if (!from || !to) return 'Select both start and end dates to load a custom range.';
  if (from > to) return 'Start date must be before or equal to end date.';
  return null;
}

function requestFilters(range: RangeMode, from: string, to: string): AdPerformanceAnalyticsFilters | null {
  if (range === 'lifetime') return {};
  if (range === 'custom') {
    if (customRangeError(from, to)) return null;
    return { range: 'custom', from, to };
  }
  return { range };
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
  const [range, setRange] = React.useState<RangeMode>('lifetime');
  const [customFrom, setCustomFrom] = React.useState('');
  const [customTo, setCustomTo] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [placementFilter, setPlacementFilter] = React.useState('all');
  const [sortKey, setSortKey] = React.useState<SortKey>('impressions');
  const [report, setReport] = React.useState(() => mapAdPerformance(null));
  const filters = React.useMemo(() => requestFilters(range, customFrom, customTo), [customFrom, customTo, range]);
  const customError = range === 'custom' ? customRangeError(customFrom, customTo) : null;
  const isLifetime = range === 'lifetime';
  const scopeLabel = rangeScopeLabel(range, customFrom, customTo);

  const loadPerformance = React.useCallback(async () => {
    if (!filters) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [payload] = await Promise.all([
        Object.keys(filters).length ? getAdminAnalyticsAdPerformance(filters) : getAdminAnalyticsAdPerformance(),
        onRefreshData ? Promise.resolve(onRefreshData()).catch(() => undefined) : Promise.resolve(undefined),
      ]);
      setReport(mapAdPerformance(payload));
    } catch (err) {
      setReport(mapAdPerformance(null));
      setError(err instanceof Error ? err.message : 'Ads Manager analytics is unavailable.');
    } finally {
      setLoading(false);
    }
  }, [filters, onRefreshData]);

  React.useEffect(() => {
    void loadPerformance();
  }, [loadPerformance]);

  const summary = report.summary;
  const period = report.period;
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
  const hasPeriodActivity = period.impressions > 0 || period.clicks > 0 || period.adsWithActivity > 0;
  const hasPeriodTopAds = period.topByImpressions.length > 0 || period.topByClicks.length > 0 || period.topByCtr.length > 0;

  return (
    <div className="space-y-4">
      <div className="border rounded p-4 bg-white dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Ad Performance</h2>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">Monitor ad delivery, impressions, clicks, CTR, placements and sponsored campaigns.</div>
            <div className="mt-2 text-xs font-semibold text-slate-600 dark:text-slate-300">Current impression and click counters are lifetime metrics.</div>
            {!isLifetime ? <div className="mt-1 text-xs font-semibold text-slate-600 dark:text-slate-300">Historical period sections use dated backend ad-performance records only.</div> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={report.connected ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700' : 'rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600'}>
              {report.connected ? 'Connected' : 'Not Configured'}
            </span>
            <button type="button" onClick={() => void loadPerformance()} disabled={loading || loadingAds || loadingSponsoredContent || Boolean(customError)} className="px-3 py-1.5 rounded border text-sm disabled:opacity-60">
              {loading || loadingAds || loadingSponsoredContent ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3 text-sm" aria-label="Ad performance range selector">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">Range</span>
            <select value={range} onChange={(event) => setRange(event.target.value as RangeMode)} className="rounded border border-slate-200 bg-white px-3 py-2 dark:bg-slate-950">
              {RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {range === 'custom' ? (
            <>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500">Start date</span>
                <input aria-label="Custom start date" type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="rounded border border-slate-200 bg-white px-3 py-2 dark:bg-slate-950" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500">End date</span>
                <input aria-label="Custom end date" type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="rounded border border-slate-200 bg-white px-3 py-2 dark:bg-slate-950" />
              </label>
              {customError ? <div className="pb-2 text-xs font-semibold text-amber-700">{customError}</div> : null}
            </>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Connected Source</div>
            <div className="mt-1 font-semibold text-slate-900 dark:text-white">{report.source}</div>
          </div>
          <div className="rounded border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Scope</div>
            <div className="mt-1 font-semibold text-slate-900 dark:text-white">{scopeLabel}</div>
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

      {report.connected && isLifetime ? (
        <LifetimePerformance
          summary={summary}
          sponsoredFeatures={sponsoredFeatures}
          sponsoredArticles={sponsoredArticles}
          rows={rows}
          placementRows={placementRows}
          filteredRows={filteredRows}
          placements={placements}
          statusFilter={statusFilter}
          placementFilter={placementFilter}
          sortKey={sortKey}
          onStatusFilter={setStatusFilter}
          onPlacementFilter={setPlacementFilter}
          onSort={setSortKey}
          hasAdActivity={hasAdActivity}
          hasTopPerformers={hasTopPerformers}
          topImpressions={topImpressions}
          topClicks={topClicks}
          topCtr={topCtr}
        />
      ) : null}

      {report.connected && !isLifetime && !customError ? (
        <PeriodPerformance period={period} hasActivity={hasPeriodActivity} hasTopAds={hasPeriodTopAds} />
      ) : null}

      {report.connected ? (
        <CurrentStatusSections
          campaignCounts={campaignCounts}
          needsAttention={needsAttention}
          deliveryHealth={deliveryHealth}
          sponsoredFeatures={sponsoredFeatures}
          activeSponsoredFeatureCount={activeSponsoredFeatureCount}
          eligibleSponsoredArticleCount={eligibleSponsoredArticleCount}
          activeComboCount={activeComboCount}
        />
      ) : null}
    </div>
  );
}

function LifetimePerformance(props: {
  summary: AdPerformanceSummary;
  sponsoredFeatures: SponsoredFeaturePerformanceRecord[];
  sponsoredArticles: SponsoredArticlePerformanceRecord[];
  rows: AdPerformanceRow[];
  placementRows: PlacementPerformanceRow[];
  filteredRows: AdPerformanceRow[];
  placements: string[];
  statusFilter: StatusFilter;
  placementFilter: string;
  sortKey: SortKey;
  onStatusFilter: (value: StatusFilter) => void;
  onPlacementFilter: (value: string) => void;
  onSort: (value: SortKey) => void;
  hasAdActivity: boolean;
  hasTopPerformers: boolean;
  topImpressions: AdPerformanceRow[];
  topClicks: AdPerformanceRow[];
  topCtr: AdPerformanceRow[];
}) {
  return (
    <>
      <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Ad Performance Overview">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Ads Manager Lifetime Metrics</div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-7">
          {metricCard('Impressions', formatNumber(props.summary.impressions))}
          {metricCard('Clicks', formatNumber(props.summary.clicks))}
          {metricCard('CTR', formatPercent(props.summary.ctr))}
          {metricCard('Total Ads', formatNumber(props.summary.totalAds))}
          {metricCard('Active Ads', formatNumber(props.summary.activeAds))}
          {metricCard('Sponsored Features', props.sponsoredFeatures.length.toLocaleString('en-IN'))}
          {metricCard('Sponsored Articles', props.sponsoredArticles.length.toLocaleString('en-IN'))}
        </div>
        {!props.hasAdActivity ? <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{NO_AD_ACTIVITY_MESSAGE}</div> : null}
      </section>

      <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Per-Ad Performance">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Per-Ad Performance</h3>
          <div className="flex flex-wrap gap-2 text-sm">
            <label className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Status</span>
              <select value={props.statusFilter} onChange={(event) => props.onStatusFilter(event.target.value as StatusFilter)} className="rounded border border-slate-200 bg-white px-2 py-1 dark:bg-slate-950">
                <option value="all">All</option>
                <option value="Active">Active</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Ended">Ended</option>
                <option value="Inactive / Off">Inactive</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Placement</span>
              <select value={props.placementFilter} onChange={(event) => props.onPlacementFilter(event.target.value)} className="rounded border border-slate-200 bg-white px-2 py-1 dark:bg-slate-950">
                <option value="all">All</option>
                {props.placements.map((placement) => <option key={placement} value={placement}>{placement}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">Sort</span>
              <select value={props.sortKey} onChange={(event) => props.onSort(event.target.value as SortKey)} className="rounded border border-slate-200 bg-white px-2 py-1 dark:bg-slate-950">
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
              <tr>{['Ad', 'Placement / Slot', 'Status', 'Impressions', 'Clicks', 'CTR', 'Schedule'].map((heading) => <th key={heading} className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {props.filteredRows.length === 0 ? <tr><td colSpan={7} className="p-3 text-sm text-slate-500">No ads found.</td></tr> : props.filteredRows.map((row) => (
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
            <thead className="bg-slate-50 dark:bg-slate-950"><tr>{['Placement', 'Ads', 'Active Ads', 'Impressions', 'Clicks', 'CTR'].map((heading) => <th key={heading} className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>)}</tr></thead>
            <tbody>
              {props.placementRows.length === 0 ? <tr><td colSpan={6} className="p-3 text-sm text-slate-500">No placement performance recorded yet.</td></tr> : props.placementRows.map((row) => (
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

      <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Top Performing Ads">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Top Performing Ads</h3>
        {!props.hasTopPerformers ? <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{NO_PERFORMANCE_DATA_MESSAGE}</div> : (
          <TopAdGroups groups={[
            { label: 'Highest impressions', rows: props.topImpressions, value: (row) => formatNumber(row.impressions) },
            { label: 'Highest clicks', rows: props.topClicks, value: (row) => formatNumber(row.clicks) },
            { label: 'Highest CTR', rows: props.topCtr, value: (row) => formatPercent(row.ctr) },
          ]} />
        )}
      </section>
    </>
  );
}

function PeriodPerformance({ period, hasActivity, hasTopAds }: { period: PeriodReport; hasActivity: boolean; hasTopAds: boolean }) {
  return (
    <>
      <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Period Performance Overview">
        <div className="text-sm font-semibold text-slate-900 dark:text-white">Selected Period Metrics</div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {metricCard('Impressions', formatNumber(period.impressions))}
          {metricCard('Clicks', formatNumber(period.clicks))}
          {metricCard('CTR', formatPercent(period.ctr))}
          {metricCard('Ads With Activity', formatNumber(period.adsWithActivity))}
        </div>
        {!hasActivity ? <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{NO_PERIOD_DATA_MESSAGE}</div> : null}
      </section>

      <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Daily Performance Trend">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Daily Performance Trend</h3>
        <div className="mt-4 overflow-auto border rounded">
          <table className="min-w-[520px] w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950"><tr>{['Date', 'Impressions', 'Clicks', 'CTR'].map((heading) => <th key={heading} className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>)}</tr></thead>
            <tbody>
              {period.dailyTrend.length === 0 ? <tr><td colSpan={4} className="p-3 text-sm text-slate-500">No daily trend records for this period.</td></tr> : period.dailyTrend.map((row) => (
                <tr key={row.date} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="p-2 font-mono text-xs">{row.date}</td>
                  <td className="p-2">{formatNumber(row.impressions)}</td>
                  <td className="p-2">{formatNumber(row.clicks)}</td>
                  <td className="p-2">{formatPercent(row.ctr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Period Per-Ad Performance">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Per-Ad Performance</h3>
        <div className="mt-4 overflow-auto border rounded">
          <table className="min-w-[700px] w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950"><tr>{['Ad', 'Placement / Slot', 'Impressions', 'Clicks', 'CTR'].map((heading) => <th key={heading} className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>)}</tr></thead>
            <tbody>
              {period.perAds.length === 0 ? <tr><td colSpan={5} className="p-3 text-sm text-slate-500">No ad performance data for this period.</td></tr> : period.perAds.map((row) => (
                <tr key={row.id || row.title} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="p-2 font-medium text-slate-900 dark:text-white">{row.title}{row.status ? <div className="text-xs font-normal text-slate-500">{row.status}</div> : null}</td>
                  <td className="p-2 font-mono text-xs text-slate-600 dark:text-slate-300">{row.placement}</td>
                  <td className="p-2">{formatNumber(row.impressions)}</td>
                  <td className="p-2">{formatNumber(row.clicks)}</td>
                  <td className="p-2">{formatPercent(row.ctr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Period Placement Performance">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Placement Performance</h3>
        <div className="mt-4 overflow-auto border rounded">
          <table className="min-w-[700px] w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950"><tr>{['Placement', 'Ads With Activity', 'Impressions', 'Clicks', 'CTR'].map((heading) => <th key={heading} className="p-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{heading}</th>)}</tr></thead>
            <tbody>
              {period.placements.length === 0 ? <tr><td colSpan={5} className="p-3 text-sm text-slate-500">No placement performance recorded yet.</td></tr> : period.placements.map((row) => (
                <tr key={row.placement} className="border-t border-slate-200 dark:border-slate-700">
                  <td className="p-2 font-mono text-xs">{row.placement}</td>
                  <td className="p-2">{formatNumber(row.adsWithActivity)}</td>
                  <td className="p-2">{formatNumber(row.impressions)}</td>
                  <td className="p-2">{formatNumber(row.clicks)}</td>
                  <td className="p-2">{formatPercent(row.ctr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Period Top Ads">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Top Performing Ads</h3>
        {!hasTopAds ? <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">{NO_PERIOD_DATA_MESSAGE}</div> : (
          <TopAdGroups groups={[
            { label: 'Top by Impressions', rows: period.topByImpressions, value: (row) => formatNumber(row.impressions) },
            { label: 'Top by Clicks', rows: period.topByClicks, value: (row) => formatNumber(row.clicks) },
            { label: 'Top by CTR', rows: period.topByCtr, value: (row) => formatPercent(row.ctr) },
          ]} />
        )}
      </section>
    </>
  );
}

function TopAdGroups<T extends { id: string; title: string }>(props: { groups: Array<{ label: string; rows: T[]; value: (row: T) => string }> }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-3">
      {props.groups.map((group) => (
        <div key={group.label} className="rounded border border-slate-200 p-3 dark:border-slate-700">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group.label}</div>
          <div className="mt-3 space-y-2">
            {group.rows.length === 0 ? <div className="text-sm text-slate-500">No recorded value yet.</div> : group.rows.map((row) => (
              <div key={`${group.label}:${row.id || row.title}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate">{row.title}</span>
                <span className="font-semibold">{group.value(row)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CurrentStatusSections(props: {
  campaignCounts: Record<CampaignStatus, number>;
  needsAttention: Array<{ id: string; title: string; message: string }>;
  deliveryHealth: Array<{ id: string; title: string; status: 'Healthy' | 'Needs Attention' | 'Not Applicable'; message: string }>;
  sponsoredFeatures: SponsoredFeaturePerformanceRecord[];
  activeSponsoredFeatureCount: number;
  eligibleSponsoredArticleCount: number;
  activeComboCount: number;
}) {
  return (
    <>
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-label="Current Delivery Status">
        <div className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Campaign Status">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Campaign Status</h3>
          <div className="mt-1 text-xs text-slate-500">Current Ads Manager state, not historical period filtering.</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {Object.entries(props.campaignCounts).map(([label, count]) => metricCard(label, count.toLocaleString('en-IN')))}
          </div>
        </div>

        <div className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Needs Attention">
          <h3 className="text-base font-semibold text-slate-900 dark:text-white">Needs Attention</h3>
          <div className="mt-1 text-xs text-slate-500">Current delivery configuration only.</div>
          <div className="mt-4 space-y-2">
            {props.needsAttention.length === 0 ? <div className="rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No delivery attention items from current records.</div> : props.needsAttention.map((item) => (
              <div key={item.id} className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                <div className="font-semibold">{item.title}</div>
                <div className="mt-1">{item.message}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border rounded p-4 bg-white dark:bg-slate-900" aria-label="Delivery Health">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">Delivery Health</h3>
        <div className="mt-1 text-xs text-slate-500">Current Ads Manager configuration checks only.</div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {props.deliveryHealth.map((item) => (
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
            <div className="rounded border border-slate-200 p-2"><div className="font-semibold text-slate-900">{props.activeSponsoredFeatureCount}</div><div>Active features</div></div>
            <div className="rounded border border-slate-200 p-2"><div className="font-semibold text-slate-900">{props.eligibleSponsoredArticleCount}</div><div>Eligible articles</div></div>
            <div className="rounded border border-slate-200 p-2"><div className="font-semibold text-slate-900">{props.activeComboCount}</div><div>Active combos</div></div>
          </div>
        </div>
        {props.activeSponsoredFeatureCount === 0 && props.eligibleSponsoredArticleCount === 0 ? <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No sponsored content currently active.</div> : null}
        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {props.sponsoredFeatures.slice(0, 4).map((feature) => {
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
  );
}
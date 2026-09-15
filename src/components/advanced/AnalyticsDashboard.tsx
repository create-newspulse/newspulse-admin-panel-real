import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  getAdminAnalyticsAdPerformance,
  getAdminAnalyticsDashboard,
  getAdminAnalyticsRevenue,
  type AdPerformanceAnalyticsResponse,
  type AnalyticsCommonFilters,
  type DashboardAnalyticsResponse,
  type RevenueAnalyticsFilters,
  type RevenueAnalyticsResponse,
} from '@/lib/api/adminAnalytics';

type AnalyticsTab = 'overview' | 'ads';
type DateFilter = 'today' | '7d' | '30d' | 'custom';
type AnalyticsState = 'not_configured' | 'loading' | 'connected_empty' | 'connected_with_data' | 'error';
type IntegrationStatus = 'connected' | 'not_connected' | 'configuration_required' | 'error';

type IntegrationState = {
  status: IntegrationStatus;
  source?: string | null;
  scope?: string | null;
  message?: string | null;
};

type OverviewMetrics = {
  pageViews: number | null;
  uniqueVisitors: number | null;
  adImpressions: number | null;
  adClicks: number | null;
  ctr: number | null;
  totalAds: number | null;
  activeAds: number | null;
  totalRevenue: number | null;
  paidAmount: number | null;
  outstandingAmount: number | null;
  revenueRecordCount: number | null;
  estimatedAdRevenue: number | null;
  confirmedRevenue: number | null;
};

type AdPerformanceSummary = {
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  totalAds: number | null;
  activeAds: number | null;
  scope: string | null;
  dateRangeSupported: boolean;
};

type RevenueSummary = {
  totalRevenue: number | null;
  paidAmount: number | null;
  outstandingAmount: number | null;
  recordCount: number | null;
};

type CampaignPerformance = {
  id?: string;
  campaignName: string;
  advertiser: string;
  placement: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  amountInvoiced: number | null;
  amountReceived: number | null;
  paymentStatus: string;
};

type PerformanceBreakdown = {
  label: string;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
};

type AnalyticsReport = {
  analyticsState?: AnalyticsState;
  dataSourceName: string;
  lastUpdatedAt: string | null;
  integrations: {
    trafficAnalytics: IntegrationState;
    adTracking: IntegrationState;
    financeData: IntegrationState;
  };
  permissions: {
    viewTraffic: boolean;
    viewAdPerformance: boolean;
    viewRevenue: boolean;
    refresh: boolean;
    export: boolean;
  };
  overview: OverviewMetrics;
  adPerformance: {
    summary: AdPerformanceSummary;
    campaigns: CampaignPerformance[];
    devicePerformance: PerformanceBreakdown[];
    placementPerformance: PerformanceBreakdown[];
    recommendations: string[];
  };
  revenue: {
    summary: RevenueSummary;
  };
  message?: string;
};

type AnalyticsReportPatch = Partial<Omit<AnalyticsReport, 'integrations' | 'permissions' | 'overview' | 'adPerformance' | 'revenue'>> & {
  integrations?: Partial<AnalyticsReport['integrations']>;
  permissions?: Partial<AnalyticsReport['permissions']>;
  overview?: Partial<OverviewMetrics>;
  adPerformance?: Partial<Omit<AnalyticsReport['adPerformance'], 'summary'>> & { summary?: Partial<AdPerformanceSummary> };
  revenue?: { summary?: Partial<RevenueSummary> };
};

const ACCESS_DENIED_MESSAGE = 'Access Denied. Founder permission is required.';
const NOT_CONFIGURED_HEADING = 'Analytics is not configured';
const NOT_CONFIGURED_MESSAGE = 'Connect an approved analytics provider to display real News Pulse traffic and performance data. No placeholder or sample information is being displayed.';
const CONNECTED_EMPTY_MESSAGE = 'No analytics data is available for the selected date range.';
const AD_TRACKING_EMPTY_HEADING = 'Ad tracking is not configured';
const AD_TRACKING_EMPTY_MESSAGE = 'Advertisement performance will appear here after campaign impression and click tracking is configured. No sample data is being displayed.';
const AD_CONNECTED_ZERO_MESSAGE = 'No ad activity yet.';
const AD_LIFETIME_LABEL = 'Lifetime';
const REVENUE_CONNECTED_ZERO_MESSAGE = 'No revenue records yet.';
const FIRST_PARTY_TRAFFIC_SOURCE = 'News Pulse Analytics';
const ADS_MANAGER_SOURCE = 'Ads Manager';
const FINANCE_RECORDS_SOURCE = 'Finance Records';

const analyticsTabs: ReadonlyArray<{ id: AnalyticsTab; label: string }> = [
  { id: 'overview', label: '📊 Overview' },
  { id: 'ads', label: '💰 Ad Performance' },
];

const dateFilters: ReadonlyArray<{ id: DateFilter; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: 'custom', label: 'Custom Range' },
];

const defaultReport: AnalyticsReport = {
  analyticsState: 'not_configured',
  dataSourceName: 'Not configured',
  lastUpdatedAt: null,
  integrations: {
    trafficAnalytics: { status: 'not_connected', source: null },
    adTracking: { status: 'not_connected', source: null },
    financeData: { status: 'not_connected', source: null },
  },
  permissions: {
    viewTraffic: false,
    viewAdPerformance: false,
    viewRevenue: false,
    refresh: false,
    export: false,
  },
  overview: {
    pageViews: null,
    uniqueVisitors: null,
    adImpressions: null,
    adClicks: null,
    ctr: null,
    totalAds: null,
    activeAds: null,
    totalRevenue: null,
    paidAmount: null,
    outstandingAmount: null,
    revenueRecordCount: null,
    estimatedAdRevenue: null,
    confirmedRevenue: null,
  },
  adPerformance: {
    summary: {
      impressions: null,
      clicks: null,
      ctr: null,
      totalAds: null,
      activeAds: null,
      scope: null,
      dateRangeSupported: false,
    },
    campaigns: [],
    devicePerformance: [],
    placementPerformance: [],
    recommendations: [],
  },
  revenue: {
    summary: {
      totalRevenue: null,
      paidAmount: null,
      outstandingAmount: null,
      recordCount: null,
    },
  },
  message: NOT_CONFIGURED_MESSAGE,
};

function isRemovedAnalyticsTab(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return ['ab', 'a-b', 'ab-tests', 'a-b-tests', 'abtests', 'ab_tests', 'a/b-tests', 'a/b', 'affiliate', 'affiliates'].includes(normalized);
}

function isRealNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isRealNumber(value) && value > 0;
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

function calculateCtr(impressions: number | null, clicks: number | null): number | null {
  if (!isRealNumber(impressions) || !isRealNumber(clicks)) return null;
  if (impressions === 0 && clicks === 0) return 0;
  if (impressions <= 0 || clicks < 0) return null;
  return (clicks / impressions) * 100;
}

function formatDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatNumber(value: number | null): string {
  return isRealNumber(value) ? value.toLocaleString('en-IN') : 'Not configured';
}

function formatPercent(value: number | null): string {
  return isRealNumber(value) ? `${value.toFixed(2)}%` : 'Not configured';
}

function formatINR(value: number | null): string {
  if (!isRealNumber(value)) return 'Not configured';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Never';
  return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatShortDate(value: string | null): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleDateString('en-IN', { dateStyle: 'medium' });
}

function statusLabel(status: IntegrationStatus): string {
  if (status === 'connected') return 'Connected';
  if (status === 'configuration_required') return 'Configuration Required';
  if (status === 'error') return 'Error';
  return 'Not Configured';
}

function statusClass(status: IntegrationStatus): string {
  if (status === 'connected') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'configuration_required') return 'border-amber-200 bg-amber-50 text-amber-800';
  if (status === 'error') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
}

function integrationDescription(label: 'Traffic Analytics' | 'Ad Tracking' | 'Revenue Data', integration: IntegrationState): string {
  if (integration.status === 'connected') {
    return [integration.source, integration.scope, integration.message].filter(Boolean).join(' • ') || 'Connected';
  }
  if (integration.status !== 'not_connected') return integration.message || integration.source || 'Configuration required';
  if (integration.message) return integration.message;
  if (label === 'Ad Tracking') return 'No advertisement tracking system configured';
  if (label === 'Revenue Data') return 'No revenue data source configured';
  return 'No analytics provider configured';
}

function normalizeReport(payload: Partial<AnalyticsReport> | null | undefined): AnalyticsReport {
  return {
    ...defaultReport,
    ...(payload || {}),
    integrations: {
      ...defaultReport.integrations,
      ...(payload?.integrations || {}),
    },
    permissions: {
      ...defaultReport.permissions,
      ...(payload?.permissions || {}),
    },
    overview: {
      ...defaultReport.overview,
      ...(payload?.overview || {}),
    },
    adPerformance: {
      ...defaultReport.adPerformance,
      ...(payload?.adPerformance || {}),
      summary: {
        ...defaultReport.adPerformance.summary,
        ...(payload?.adPerformance?.summary || {}),
      },
    },
    revenue: {
      ...defaultReport.revenue,
      ...(payload?.revenue || {}),
      summary: {
        ...defaultReport.revenue.summary,
        ...(payload?.revenue?.summary || {}),
      },
    },
  };
}

function mergeReport(base: AnalyticsReport, payload: AnalyticsReportPatch): AnalyticsReport {
  return {
    ...base,
    ...payload,
    integrations: {
      ...base.integrations,
      ...(payload.integrations || {}),
    },
    permissions: {
      ...base.permissions,
      ...(payload.permissions || {}),
    },
    overview: {
      ...base.overview,
      ...(payload.overview || {}),
    },
    adPerformance: {
      ...base.adPerformance,
      ...(payload.adPerformance || {}),
      summary: {
        ...base.adPerformance.summary,
        ...(payload.adPerformance?.summary || {}),
      },
    },
    revenue: {
      ...base.revenue,
      ...(payload.revenue || {}),
      summary: {
        ...base.revenue.summary,
        ...(payload.revenue?.summary || {}),
      },
    },
  };
}

function dashboardRangeParams(dateFilter: DateFilter, customStart: string, customEnd: string): AnalyticsCommonFilters {
  if (dateFilter === 'today') return { range: '24h' };
  if (dateFilter === 'custom') return { range: 'custom', from: customStart || undefined, to: customEnd || undefined };
  return { range: dateFilter };
}

function revenueDateParams(dateFilter: DateFilter, customStart: string, customEnd: string): RevenueAnalyticsFilters {
  if (dateFilter === 'custom') return { dateFrom: customStart || undefined, dateTo: customEnd || undefined };

  const today = new Date();
  const dateTo = formatDateParam(today);
  if (dateFilter === 'today') return { dateFrom: dateTo, dateTo };

  const daysBack = dateFilter === '7d' ? 6 : 29;
  return { dateFrom: formatDateParam(addDays(today, -daysBack)), dateTo };
}

function mapFirstPartyDashboardReport(payload: DashboardAnalyticsResponse | null | undefined): AnalyticsReportPatch {
  const data = payload && typeof payload === 'object' ? payload : {};
  const totals = data.totals && typeof data.totals === 'object' ? data.totals : {};
  const overview: Partial<OverviewMetrics> = {
    pageViews: pickFirstNumber(totals.views, totals.totalViews),
    uniqueVisitors: pickFirstNumber(totals.uniqueReaders, totals.readers),
  };

  return {
    dataSourceName: FIRST_PARTY_TRAFFIC_SOURCE,
    permissions: {
      viewTraffic: true,
      refresh: true,
    },
    integrations: {
      trafficAnalytics: { status: 'connected', source: FIRST_PARTY_TRAFFIC_SOURCE },
    },
    overview,
  };
}

function mapAdPerformanceReport(payload: AdPerformanceAnalyticsResponse | null | undefined): AnalyticsReportPatch {
  if (!payload?.connected) {
    return {
      integrations: {
        adTracking: { status: 'not_connected', source: null, message: payload?.message || AD_TRACKING_EMPTY_MESSAGE },
      },
      permissions: { refresh: true },
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
  const hasActivity = [impressions, clicks, totalAds, activeAds].some(isPositiveNumber);
  const scope = String(payload.scope || '').trim().toLowerCase() === 'lifetime' ? AD_LIFETIME_LABEL : (payload.scope || AD_LIFETIME_LABEL);
  const dateRangeSupported = payload.dateRangeSupported === true;

  return {
    permissions: { viewAdPerformance: true, refresh: true },
    integrations: {
      adTracking: {
        status: 'connected',
        source: payload.source || ADS_MANAGER_SOURCE,
        scope,
        message: hasActivity ? null : AD_CONNECTED_ZERO_MESSAGE,
      },
    },
    overview: {
      adImpressions: impressions,
      adClicks: clicks,
      ctr,
      totalAds,
      activeAds,
    },
    adPerformance: {
      summary: { impressions, clicks, ctr, totalAds, activeAds, scope, dateRangeSupported },
    },
  };
}

function mapRevenueReport(payload: RevenueAnalyticsResponse | null | undefined): AnalyticsReportPatch {
  if (!payload?.connected) {
    return {
      integrations: {
        financeData: { status: 'not_connected', source: null, message: payload?.message || 'No revenue data source configured' },
      },
      permissions: { refresh: true },
    };
  }

  const data = asRecord(payload);
  const metrics = asRecord(payload.metrics);
  const totals = asRecord(payload.totals);
  const totalRevenue = pickFirstNumber(data.totalRevenue, data.revenue, data.amount, metrics.totalRevenue, metrics.revenue, metrics.amount, totals.totalRevenue, totals.revenue, totals.amount);
  const paidAmount = pickFirstNumber(data.paidAmount, data.paid, data.totalPaid, metrics.paidAmount, metrics.paid, metrics.totalPaid, totals.paidAmount, totals.paid, totals.totalPaid);
  const outstandingAmount = pickFirstNumber(data.outstandingAmount, data.outstanding, data.totalOutstanding, metrics.outstandingAmount, metrics.outstanding, metrics.totalOutstanding, totals.outstandingAmount, totals.outstanding, totals.totalOutstanding);
  const recordCount = pickFirstNumber(data.recordCount, data.count, metrics.recordCount, metrics.count, totals.recordCount, totals.count);
  const hasRevenueRecords = isPositiveNumber(recordCount) || [totalRevenue, paidAmount, outstandingAmount].some(isPositiveNumber);

  return {
    permissions: { viewRevenue: true, refresh: true },
    integrations: {
      financeData: {
        status: 'connected',
        source: payload.source || FINANCE_RECORDS_SOURCE,
        message: hasRevenueRecords ? null : REVENUE_CONNECTED_ZERO_MESSAGE,
      },
    },
    overview: {
      totalRevenue,
      paidAmount,
      outstandingAmount,
      revenueRecordCount: recordCount,
      estimatedAdRevenue: totalRevenue,
      confirmedRevenue: paidAmount,
    },
    revenue: {
      summary: { totalRevenue, paidAmount, outstandingAmount, recordCount },
    },
  };
}

export default function AnalyticsDashboard(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [analyticsState, setAnalyticsState] = useState<AnalyticsState>('loading');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (isRemovedAnalyticsTab(params.get('tab')) || isRemovedAnalyticsTab(params.get('section'))) {
      setActiveTab('overview');
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
      setSourceErrors([]);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setSourceErrors([]);
    setAnalyticsState('loading');

    try {
      const [trafficResult, adResult, revenueResult] = await Promise.allSettled([
        getAdminAnalyticsDashboard(dashboardRangeParams(dateFilter, customStart, customEnd)),
        getAdminAnalyticsAdPerformance(),
        getAdminAnalyticsRevenue(revenueDateParams(dateFilter, customStart, customEnd)),
      ]);

      let nextReport = normalizeReport({
        analyticsState: 'connected_empty',
        lastUpdatedAt: new Date().toISOString(),
        message: CONNECTED_EMPTY_MESSAGE,
        permissions: { refresh: true },
      });
      const nextSourceErrors: string[] = [];

      if (trafficResult.status === 'fulfilled') {
        nextReport = mergeReport(nextReport, mapFirstPartyDashboardReport(trafficResult.value));
      } else {
        nextSourceErrors.push('Traffic Analytics');
        nextReport = mergeReport(nextReport, {
          integrations: { trafficAnalytics: { status: 'error', source: FIRST_PARTY_TRAFFIC_SOURCE, message: 'Traffic analytics is unavailable.' } },
        });
      }

      if (adResult.status === 'fulfilled') {
        nextReport = mergeReport(nextReport, mapAdPerformanceReport(adResult.value));
      } else {
        nextSourceErrors.push('Ad Tracking');
        nextReport = mergeReport(nextReport, {
          integrations: { adTracking: { status: 'error', source: ADS_MANAGER_SOURCE, scope: AD_LIFETIME_LABEL, message: 'Ads Manager analytics is unavailable.' } },
        });
      }

      if (revenueResult.status === 'fulfilled') {
        nextReport = mergeReport(nextReport, mapRevenueReport(revenueResult.value));
      } else {
        nextSourceErrors.push('Revenue Data');
        nextReport = mergeReport(nextReport, {
          integrations: { financeData: { status: 'error', source: FINANCE_RECORDS_SOURCE, message: 'Finance Records analytics is unavailable.' } },
        });
      }

      setSourceErrors(nextSourceErrors);
      const nextHasOverviewData = Object.values(nextReport.overview).some(isRealNumber);
      const hasConnectedSource = Object.values(nextReport.integrations).some((integration) => integration.status === 'connected');
      const allSourcesFailed = Object.values(nextReport.integrations).every((integration) => integration.status === 'error');
      setReport(nextReport);
      if (allSourcesFailed) {
        setAnalyticsState('error');
        setError('Analytics sources are unavailable.');
      } else if (hasConnectedSource) {
        setAnalyticsState(nextHasOverviewData ? 'connected_with_data' : 'connected_empty');
      } else {
        setAnalyticsState('not_configured');
      }
    } catch (err) {
      setReport(null);
      setAnalyticsState('error');
      setError(err instanceof Error ? err.message : 'Unable to load analytics data.');
      setSourceErrors([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customEnd, customStart, dateFilter, dateValidationError]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const currentReport = report || defaultReport;
  const canViewRevenue = currentReport.permissions.viewRevenue;
  const canViewAdPerformance = currentReport.permissions.viewAdPerformance;
  const hasOverviewData = Object.values(currentReport.overview).some(isRealNumber);
  const hasCampaignData = currentReport.adPerformance.campaigns.length > 0;
  const hasDevicePerformance = currentReport.adPerformance.devicePerformance.length > 0;
  const hasPlacementPerformance = currentReport.adPerformance.placementPerformance.length > 0;
  const adSummary = currentReport.adPerformance.summary;
  const hasAdSummaryData = [adSummary.impressions, adSummary.clicks, adSummary.ctr, adSummary.totalAds, adSummary.activeAds].some(isRealNumber);
  const hasAdActivity = [adSummary.impressions, adSummary.clicks, adSummary.totalAds, adSummary.activeAds].some(isPositiveNumber);
  const adTrackingStatus = currentReport.integrations.adTracking.status;
  const refreshLocked = Boolean(report && !currentReport.permissions.refresh) || Boolean(dateValidationError);
  const refreshLabel = loading ? 'Loading data...' : refreshing ? 'Refreshing data...' : 'Refresh Data';

  const overviewCards = useMemo(() => [
    { label: 'Page Views', value: formatNumber(currentReport.overview.pageViews), visible: currentReport.permissions.viewTraffic },
    { label: 'Unique Visitors', value: formatNumber(currentReport.overview.uniqueVisitors), visible: currentReport.permissions.viewTraffic },
    { label: 'Ad Impressions', value: formatNumber(currentReport.overview.adImpressions), visible: canViewAdPerformance },
    { label: 'Ad Clicks', value: formatNumber(currentReport.overview.adClicks), visible: canViewAdPerformance },
    { label: 'CTR', value: formatPercent(currentReport.overview.ctr), visible: canViewAdPerformance },
    { label: 'Total Ads', value: formatNumber(currentReport.overview.totalAds), visible: canViewAdPerformance },
    { label: 'Active Ads', value: formatNumber(currentReport.overview.activeAds), visible: canViewAdPerformance },
    { label: 'Total Revenue', value: canViewRevenue ? formatINR(currentReport.overview.totalRevenue) : 'Restricted', visible: true },
    { label: 'Paid Amount', value: canViewRevenue ? formatINR(currentReport.overview.paidAmount) : 'Restricted', visible: true },
    { label: 'Outstanding Amount', value: canViewRevenue ? formatINR(currentReport.overview.outstandingAmount) : 'Restricted', visible: true },
    { label: 'Revenue Records', value: canViewRevenue ? formatNumber(currentReport.overview.revenueRecordCount) : 'Restricted', visible: true },
  ], [canViewAdPerformance, canViewRevenue, currentReport.overview, currentReport.permissions.viewTraffic]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-3xl font-bold">Analytics & Revenue Insights</h2>
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            <span>Data source: {currentReport.dataSourceName}</span>
            <span className="mx-2">•</span>
            <span>Last successfully updated: {formatDate(currentReport.lastUpdatedAt)}</span>
          </div>
        </div>
        <button
          onClick={() => void loadReport({ refresh: true })}
          disabled={loading || refreshing || refreshLocked}
          className="rounded bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
        >
          {refreshLabel}
        </button>
      </div>

      <div className="flex gap-2 border-b border-gray-300 dark:border-gray-600">
        {analyticsTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-medium transition ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-blue-600 dark:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
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

      {analyticsState === 'loading' ? <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-600 shadow dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Loading analytics...</div> : null}

      {analyticsState === 'error' && error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">
          <div className="font-semibold">Analytics unavailable</div>
          <div className="mt-1 text-sm">{error}</div>
        </div>
      ) : null}

      {analyticsState !== 'error' && sourceErrors.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Some analytics sources are unavailable: {sourceErrors.join(', ')}.
        </div>
      ) : null}

      {dateValidationError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {dateValidationError}
        </div>
      ) : null}

      {analyticsState === 'connected_empty' && activeTab === 'overview' ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-slate-600 shadow dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {CONNECTED_EMPTY_MESSAGE}
        </div>
      ) : null}

      {analyticsState !== 'loading' && analyticsState !== 'error' && activeTab === 'overview' ? (
        <div className="space-y-6">
          {analyticsState === 'not_configured' ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-5 text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
              <div className="font-semibold">{NOT_CONFIGURED_HEADING}</div>
              <div className="mt-1 text-sm">{currentReport.message || NOT_CONFIGURED_MESSAGE}</div>
            </div>
          ) : null}

          {hasOverviewData ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {overviewCards.map((card) => (
                <div key={card.label} className="rounded-lg bg-white p-4 shadow dark:bg-slate-800">
                  <div className="text-sm text-gray-500 dark:text-gray-400">{card.label}</div>
                  <div className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{card.visible ? card.value : 'Restricted'}</div>
                </div>
              ))}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {([
              ['Traffic Analytics', currentReport.integrations.trafficAnalytics],
              ['Ad Tracking', currentReport.integrations.adTracking],
              ['Revenue Data', currentReport.integrations.financeData],
            ] as const).map(([label, integration]) => (
              <div key={label} className="rounded-lg bg-white p-4 shadow dark:bg-slate-800">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold">{label}</div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(integration.status)}`}>
                    {statusLabel(integration.status)}
                  </span>
                </div>
                <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">{integrationDescription(label, integration)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {analyticsState !== 'loading' && analyticsState !== 'error' && activeTab === 'ads' ? (
        <div className="space-y-6">
          {adTrackingStatus === 'error' ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-700">{currentReport.integrations.adTracking.message || 'Ads Manager analytics is unavailable.'}</div>
          ) : null}

          {adTrackingStatus !== 'not_connected' && adTrackingStatus !== 'error' && !canViewAdPerformance ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">{ACCESS_DENIED_MESSAGE}</div>
          ) : null}

          {adTrackingStatus === 'not_connected' ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600 shadow dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <div className="font-semibold text-slate-900 dark:text-white">{AD_TRACKING_EMPTY_HEADING}</div>
              <div className="mt-1 text-sm">{AD_TRACKING_EMPTY_MESSAGE}</div>
            </div>
          ) : null}

          {canViewAdPerformance ? (
            <div className="rounded-lg bg-white p-6 shadow dark:bg-slate-800">
              <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Ads Manager Performance</h3>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Lifetime counters from Ads Manager. Date filters do not apply to these metrics.</div>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">{adSummary.scope || AD_LIFETIME_LABEL}</span>
              </div>

              {hasAdSummaryData ? (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs uppercase text-slate-500">Impressions</div><div className="mt-1 text-xl font-semibold">{formatNumber(adSummary.impressions)}</div></div>
                  <div className="rounded border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs uppercase text-slate-500">Clicks</div><div className="mt-1 text-xl font-semibold">{formatNumber(adSummary.clicks)}</div></div>
                  <div className="rounded border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs uppercase text-slate-500">CTR</div><div className="mt-1 text-xl font-semibold">{formatPercent(adSummary.ctr)}</div></div>
                  <div className="rounded border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs uppercase text-slate-500">Total Ads</div><div className="mt-1 text-xl font-semibold">{formatNumber(adSummary.totalAds)}</div></div>
                  <div className="rounded border border-slate-200 p-3 dark:border-slate-700"><div className="text-xs uppercase text-slate-500">Active Ads</div><div className="mt-1 text-xl font-semibold">{formatNumber(adSummary.activeAds)}</div></div>
                </div>
              ) : null}

              {!hasAdActivity ? <div className="mt-4 rounded border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{AD_CONNECTED_ZERO_MESSAGE}</div> : null}
            </div>
          ) : null}

          {canViewAdPerformance && hasCampaignData ? (
            <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-slate-800">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-700">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Campaign</th>
                      <th className="px-4 py-3">Advertiser/Sponsor</th>
                      <th className="px-4 py-3">Placement</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Start</th>
                      <th className="px-4 py-3">End</th>
                      <th className="px-4 py-3">Impressions</th>
                      <th className="px-4 py-3">Clicks</th>
                      <th className="px-4 py-3">CTR</th>
                      <th className="px-4 py-3">Amount Invoiced</th>
                      <th className="px-4 py-3">Amount Received</th>
                      <th className="px-4 py-3">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {currentReport.adPerformance.campaigns.map((campaign) => (
                      <tr key={campaign.id || campaign.campaignName}>
                        <td className="px-4 py-3 font-semibold">{campaign.campaignName}</td>
                        <td className="px-4 py-3">{campaign.advertiser}</td>
                        <td className="px-4 py-3">{campaign.placement}</td>
                        <td className="px-4 py-3">{campaign.status}</td>
                        <td className="px-4 py-3">{formatShortDate(campaign.startDate)}</td>
                        <td className="px-4 py-3">{formatShortDate(campaign.endDate)}</td>
                        <td className="px-4 py-3">{formatNumber(campaign.impressions)}</td>
                        <td className="px-4 py-3">{formatNumber(campaign.clicks)}</td>
                        <td className="px-4 py-3">{formatPercent(campaign.ctr)}</td>
                        <td className="px-4 py-3">{canViewRevenue ? formatINR(campaign.amountInvoiced) : 'Restricted'}</td>
                        <td className="px-4 py-3">{canViewRevenue ? formatINR(campaign.amountReceived) : 'Restricted'}</td>
                        <td className="px-4 py-3">{canViewRevenue ? campaign.paymentStatus : 'Restricted'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {canViewAdPerformance && (hasDevicePerformance || hasPlacementPerformance) ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {hasDevicePerformance ? <BreakdownPanel title="Device Performance" rows={currentReport.adPerformance.devicePerformance} /> : null}
              {hasPlacementPerformance ? <BreakdownPanel title="Placement Performance" rows={currentReport.adPerformance.placementPerformance} /> : null}
            </div>
          ) : null}

          {canViewAdPerformance && currentReport.adPerformance.recommendations.length > 0 ? (
            <div className="rounded-lg bg-white p-6 shadow dark:bg-slate-800">
              <h3 className="text-xl font-semibold">Optimization Recommendations</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-200">
                {currentReport.adPerformance.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BreakdownPanel({ title, rows }: { title: string; rows: PerformanceBreakdown[] }): JSX.Element {
  return (
    <div className="rounded-lg bg-white p-6 shadow dark:bg-slate-800">
      <h3 className="text-xl font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <div className="mt-4 text-sm text-slate-500 dark:text-slate-400">No tracked data is available yet.</div>
      ) : (
        <div className="mt-4 space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="rounded border border-slate-200 p-3 text-sm dark:border-slate-700">
              <div className="font-semibold">{row.label}</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-slate-600 dark:text-slate-300">
                <span>{formatNumber(row.impressions)} impressions</span>
                <span>{formatNumber(row.clicks)} clicks</span>
                <span>{formatPercent(row.ctr)} CTR</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

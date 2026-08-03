import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getAuthToken } from '../../lib/api';

type AnalyticsTab = 'overview' | 'ads';
type DateFilter = 'today' | '7d' | '30d' | 'custom';
type AnalyticsState = 'not_configured' | 'loading' | 'connected_empty' | 'connected_with_data' | 'error';
type IntegrationStatus = 'connected' | 'not_connected' | 'configuration_required' | 'error';

type IntegrationState = {
  status: IntegrationStatus;
  source?: string | null;
  message?: string | null;
};

type OverviewMetrics = {
  pageViews: number | null;
  uniqueVisitors: number | null;
  adImpressions: number | null;
  adClicks: number | null;
  ctr: number | null;
  estimatedAdRevenue: number | null;
  confirmedRevenue: number | null;
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
    campaigns: CampaignPerformance[];
    devicePerformance: PerformanceBreakdown[];
    placementPerformance: PerformanceBreakdown[];
    recommendations: string[];
  };
  message?: string;
};

const ACCESS_DENIED_MESSAGE = 'Access Denied. Founder permission is required.';
const NOT_CONFIGURED_HEADING = 'Analytics is not configured';
const NOT_CONFIGURED_MESSAGE = 'Connect an approved analytics provider to display real News Pulse traffic and performance data. No placeholder or sample information is being displayed.';
const CONNECTED_EMPTY_MESSAGE = 'No analytics data is available for the selected date range.';
const AD_TRACKING_EMPTY_HEADING = 'Ad tracking is not configured';
const AD_TRACKING_EMPTY_MESSAGE = 'Advertisement performance will appear here after campaign impression and click tracking is configured. No sample data is being displayed.';
const envAny = import.meta.env as Record<string, unknown>;

function publicAnalyticsProviderConfigured(): boolean {
  return [
    envAny.VITE_ANALYTICS_PROVIDER_CONFIGURED,
    envAny.VITE_ANALYTICS_TRAFFIC_ENABLED,
    envAny.VITE_ANALYTICS_AD_TRACKING_ENABLED,
    envAny.VITE_ANALYTICS_FINANCE_ENABLED,
  ].some((value) => String(value || '').trim().toLowerCase() === 'true');
}

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
    estimatedAdRevenue: null,
    confirmedRevenue: null,
  },
  adPerformance: {
    campaigns: [],
    devicePerformance: [],
    placementPerformance: [],
    recommendations: [],
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
  if (integration.status !== 'not_connected') return integration.source || integration.message || 'Configuration required';
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
    },
  };
}

export default function AnalyticsDashboard(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const providerConfigured = publicAnalyticsProviderConfigured();
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [analyticsState, setAnalyticsState] = useState<AnalyticsState>(providerConfigured ? 'loading' : 'not_configured');
  const [loading, setLoading] = useState(providerConfigured);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!providerConfigured) {
      setReport(defaultReport);
      setAnalyticsState('not_configured');
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

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
      const params = new URLSearchParams({ range: dateFilter });
      if (dateFilter === 'custom') {
        if (customStart) params.set('start', customStart);
        if (customEnd) params.set('end', customEnd);
      }
      if (isRefresh) params.set('refresh', '1');

      const token = getAuthToken();
      const response = await fetch(`/api/admin/analytics/report?${params.toString()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || (response.status === 403 ? ACCESS_DENIED_MESSAGE : 'Unable to load analytics data.'));
      }

      const nextReport = normalizeReport(payload);
      const nextHasOverviewData = Object.values(nextReport.overview).some(isRealNumber);
      const nextHasAdData = nextReport.adPerformance.campaigns.length > 0
        || nextReport.adPerformance.devicePerformance.length > 0
        || nextReport.adPerformance.placementPerformance.length > 0;
      setReport(nextReport);
      setAnalyticsState(nextHasOverviewData || nextHasAdData ? 'connected_with_data' : 'connected_empty');
    } catch (err) {
      setReport(null);
      setAnalyticsState('error');
      setError(err instanceof Error ? err.message : 'Unable to load analytics data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [customEnd, customStart, dateFilter, dateValidationError, providerConfigured]);

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
  const refreshLocked = !providerConfigured || Boolean(report && !currentReport.permissions.refresh) || Boolean(dateValidationError);
  const refreshLabel = loading ? 'Loading data...' : refreshing ? 'Refreshing data...' : 'Refresh Data';

  const overviewCards = useMemo(() => [
    { label: 'Page Views', value: formatNumber(currentReport.overview.pageViews), visible: currentReport.permissions.viewTraffic },
    { label: 'Unique Visitors', value: formatNumber(currentReport.overview.uniqueVisitors), visible: currentReport.permissions.viewTraffic },
    { label: 'Ad Impressions', value: formatNumber(currentReport.overview.adImpressions), visible: canViewAdPerformance },
    { label: 'Ad Clicks', value: formatNumber(currentReport.overview.adClicks), visible: canViewAdPerformance },
    { label: 'CTR', value: formatPercent(currentReport.overview.ctr), visible: canViewAdPerformance },
    { label: 'Estimated Ad Revenue', value: canViewRevenue ? formatINR(currentReport.overview.estimatedAdRevenue) : 'Restricted', visible: true },
    { label: 'Confirmed Revenue', value: canViewRevenue ? formatINR(currentReport.overview.confirmedRevenue) : 'Restricted', visible: true },
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
        {!providerConfigured ? <div className="text-sm text-slate-500 dark:text-slate-400">Connect an analytics provider before refreshing.</div> : null}
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
          {analyticsState !== 'not_configured' && !canViewAdPerformance ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">{ACCESS_DENIED_MESSAGE}</div>
          ) : null}

          {(analyticsState === 'not_configured' || (canViewAdPerformance && !hasCampaignData && !hasDevicePerformance && !hasPlacementPerformance)) ? (
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-600 shadow dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <div className="font-semibold text-slate-900 dark:text-white">{AD_TRACKING_EMPTY_HEADING}</div>
              <div className="mt-1 text-sm">{AD_TRACKING_EMPTY_MESSAGE}</div>
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

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AnalyticsDashboard from '@/components/advanced/AnalyticsDashboard';
import { getAdminAnalyticsAdPerformance, getAdminAnalyticsDashboard, getAdminAnalyticsRevenue } from '@/lib/api/adminAnalytics';

vi.mock('@/lib/api/adminAnalytics', () => ({
  getAdminAnalyticsAdPerformance: vi.fn(),
  getAdminAnalyticsDashboard: vi.fn(),
  getAdminAnalyticsRevenue: vi.fn(),
}));

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/admin/analytics']}>
      <AnalyticsDashboard />
    </MemoryRouter>,
  );
}

function integrationCard(label: string): HTMLElement {
  const heading = screen.getByText(label);
  const card = heading.closest('.rounded-lg');
  if (!card) throw new Error(`Integration card not found: ${label}`);
  return card as HTMLElement;
}

function formatDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateRange(days: number) {
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setDate(dateFrom.getDate() - (days - 1));
  return { dateFrom: formatDateParam(dateFrom), dateTo: formatDateParam(dateTo) };
}

beforeEach(() => {
  vi.mocked(getAdminAnalyticsDashboard).mockResolvedValue({
    totals: {
      views: 120,
      uniqueReaders: 45,
      engagedReads: 18,
      avgReadTimeSec: 62,
    },
    sources: [{ source: 'Direct', views: 90 }],
    languages: [{ language: 'en', views: 120 }],
  });
  vi.mocked(getAdminAnalyticsAdPerformance).mockResolvedValue({
    connected: true,
    source: 'Ads Manager',
    scope: 'lifetime',
    dateRangeSupported: false,
    metrics: {
      impressions: 12345,
      clicks: 678,
      ctr: 5.49,
      totalAds: 42,
      activeAds: 9,
    },
  });
  vi.mocked(getAdminAnalyticsRevenue).mockResolvedValue({
    connected: true,
    source: 'Finance Records',
    metrics: {
      totalRevenue: 125000,
      paidAmount: 90000,
      outstandingAmount: 35000,
      recordCount: 8,
    },
  });
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('AnalyticsDashboard source wiring', () => {
  it('keeps Traffic Analytics connected to the existing News Pulse source', async () => {
    renderDashboard();

    expect(await screen.findByText('Data source: News Pulse Analytics')).toBeInTheDocument();
    expect(within(integrationCard('Traffic Analytics')).getByText('Connected')).toBeInTheDocument();
    expect(within(integrationCard('Traffic Analytics')).getByText('News Pulse Analytics')).toBeInTheDocument();
    expect(screen.queryByText('Connect an analytics provider before refreshing.')).toBeNull();
    expect(getAdminAnalyticsDashboard).toHaveBeenCalledWith({ range: '24h' });
  });

  it('connects Ad Tracking to Ads Manager when the ad endpoint is connected', async () => {
    renderDashboard();

    await screen.findByText('Data source: News Pulse Analytics');
    expect(within(integrationCard('Ad Tracking')).getByText('Connected')).toBeInTheDocument();
    expect(within(integrationCard('Ad Tracking')).getByText('Ads Manager • Lifetime')).toBeInTheDocument();
  });

  it('keeps zero ad counters connected and truthful', async () => {
    vi.mocked(getAdminAnalyticsAdPerformance).mockResolvedValueOnce({
      connected: true,
      source: 'Ads Manager',
      scope: 'lifetime',
      dateRangeSupported: false,
      metrics: { impressions: 0, clicks: 0, ctr: 0, totalAds: 0, activeAds: 0 },
    });

    renderDashboard();

    expect(await screen.findByText('Data source: News Pulse Analytics')).toBeInTheDocument();
    const adCard = integrationCard('Ad Tracking');
    expect(within(adCard).getByText('Connected')).toBeInTheDocument();
    expect(within(adCard).getByText('Ads Manager • Lifetime • No ad activity yet.')).toBeInTheDocument();
    expect(within(adCard).queryByText('Not Configured')).toBeNull();
  });

  it('renders real Ads Manager metrics and labels them as lifetime in the Ad Performance tab', async () => {
    renderDashboard();

    await screen.findByText('Data source: News Pulse Analytics');
    fireEvent.click(screen.getByRole('button', { name: /Ad Performance/ }));

    expect(screen.getByText('Ads Manager Performance')).toBeInTheDocument();
    expect(screen.getByText('Lifetime counters from Ads Manager. Date filters do not apply to these metrics.')).toBeInTheDocument();
    expect(screen.getByText('12,345')).toBeInTheDocument();
    expect(screen.getByText('678')).toBeInTheDocument();
    expect(screen.getByText('5.49%')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(getAdminAnalyticsAdPerformance).toHaveBeenCalledTimes(1);
  });

  it('does not apply selected date ranges to lifetime ad counters', async () => {
    renderDashboard();

    await screen.findByText('Data source: News Pulse Analytics');
    fireEvent.click(screen.getByRole('button', { name: 'Last 7 Days' }));

    await waitFor(() => expect(getAdminAnalyticsDashboard).toHaveBeenLastCalledWith({ range: '7d' }));
    expect(getAdminAnalyticsRevenue).toHaveBeenLastCalledWith(dateRange(7));
    expect(getAdminAnalyticsAdPerformance).toHaveBeenCalledTimes(2);
    expect(getAdminAnalyticsAdPerformance).toHaveBeenLastCalledWith();
  });

  it('connects Revenue Data to Finance Records when the revenue endpoint is connected', async () => {
    renderDashboard();

    await screen.findByText('Data source: News Pulse Analytics');
    expect(within(integrationCard('Revenue Data')).getByText('Connected')).toBeInTheDocument();
    expect(within(integrationCard('Revenue Data')).getByText('Finance Records')).toBeInTheDocument();
  });

  it('keeps zero Finance Records connected and truthful', async () => {
    vi.mocked(getAdminAnalyticsRevenue).mockResolvedValueOnce({
      connected: true,
      source: 'Finance Records',
      metrics: { totalRevenue: 0, paidAmount: 0, outstandingAmount: 0, recordCount: 0 },
    });

    renderDashboard();

    await screen.findByText('Data source: News Pulse Analytics');
    const revenueCard = integrationCard('Revenue Data');
    expect(within(revenueCard).getByText('Connected')).toBeInTheDocument();
    expect(within(revenueCard).getByText('Finance Records • No revenue records yet.')).toBeInTheDocument();
    expect(within(revenueCard).queryByText('Not Configured')).toBeNull();
  });

  it('renders real Finance Records revenue metrics', async () => {
    renderDashboard();

    await screen.findByText('Data source: News Pulse Analytics');
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText(/₹\s?1,25,000/)).toBeInTheDocument();
    expect(screen.getByText(/₹\s?90,000/)).toBeInTheDocument();
    expect(screen.getByText(/₹\s?35,000/)).toBeInTheDocument();
    expect(screen.getByText('Revenue Records')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('passes selected date ranges to revenue only', async () => {
    renderDashboard();

    await screen.findByText('Data source: News Pulse Analytics');
    expect(getAdminAnalyticsRevenue).toHaveBeenCalledWith(dateRange(1));
    fireEvent.click(screen.getByRole('button', { name: 'Last 30 Days' }));

    await waitFor(() => expect(getAdminAnalyticsRevenue).toHaveBeenLastCalledWith(dateRange(30)));
    expect(getAdminAnalyticsDashboard).toHaveBeenLastCalledWith({ range: '30d' });
    expect(getAdminAnalyticsAdPerformance).toHaveBeenLastCalledWith();
  });

  it('keeps successful sources connected when one source fails', async () => {
    vi.mocked(getAdminAnalyticsAdPerformance).mockRejectedValueOnce(new Error('Ads offline'));

    renderDashboard();

    expect(await screen.findByText('Some analytics sources are unavailable: Ad Tracking.')).toBeInTheDocument();
    expect(within(integrationCard('Traffic Analytics')).getByText('Connected')).toBeInTheDocument();
    expect(within(integrationCard('Revenue Data')).getByText('Connected')).toBeInTheDocument();
    expect(within(integrationCard('Ad Tracking')).getByText('Error')).toBeInTheDocument();
  });

  it('refreshes traffic, ad tracking, and revenue sources', async () => {
    renderDashboard();

    await screen.findByText('Data source: News Pulse Analytics');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Data' }));

    await waitFor(() => expect(getAdminAnalyticsDashboard).toHaveBeenCalledTimes(2));
    expect(getAdminAnalyticsAdPerformance).toHaveBeenCalledTimes(2);
    expect(getAdminAnalyticsRevenue).toHaveBeenCalledTimes(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not introduce placeholder or sample values', async () => {
    renderDashboard();

    await screen.findByText('Data source: News Pulse Analytics');
    expect(screen.queryByText(/50K|87%|500K|sample|placeholder/i)).toBeNull();
  });

  it('keeps empty and error states truthful and safe', async () => {
    vi.mocked(getAdminAnalyticsDashboard).mockRejectedValueOnce(new Error('Traffic offline'));
    vi.mocked(getAdminAnalyticsAdPerformance).mockRejectedValueOnce(new Error('Ads offline'));
    vi.mocked(getAdminAnalyticsRevenue).mockRejectedValueOnce(new Error('Revenue offline'));

    renderDashboard();

    expect(await screen.findByText('Analytics unavailable')).toBeInTheDocument();
    expect(screen.getByText('Analytics sources are unavailable.')).toBeInTheDocument();
  });
});
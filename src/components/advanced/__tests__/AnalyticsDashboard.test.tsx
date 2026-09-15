import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import AnalyticsDashboard from '@/components/advanced/AnalyticsDashboard';
import { getAdminAnalyticsDashboard, listAdminAnalyticsArticles, listAdminAnalyticsCategories } from '@/lib/api/adminAnalytics';

vi.mock('@/lib/api/adminAnalytics', () => ({
  getAdminAnalyticsDashboard: vi.fn(),
  listAdminAnalyticsArticles: vi.fn(),
  listAdminAnalyticsCategories: vi.fn(),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderDashboard(initialPath = '/admin/analytics') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/analytics" element={<><AnalyticsDashboard /><LocationProbe /></>} />
        <Route path="/admin/analytics/articles" element={<><div>Article Analytics Page</div><LocationProbe /></>} />
        <Route path="/admin/analytics/categories" element={<><div>Category Analytics Page</div><LocationProbe /></>} />
      </Routes>
    </MemoryRouter>,
  );
}

function metricCard(label: string): HTMLElement {
  const heading = screen.getByText(label);
  const card = heading.closest('.rounded-lg');
  if (!card) throw new Error(`Metric card not found: ${label}`);
  return card as HTMLElement;
}

beforeEach(() => {
  vi.mocked(getAdminAnalyticsDashboard).mockResolvedValue({
    totals: {
      views: 1234,
      uniqueReaders: 567,
      engagedReads: 321,
      avgReadTimeSec: 83,
      completionRate: 0.74,
    },
  });
  vi.mocked(listAdminAnalyticsArticles).mockResolvedValue({
    rows: [
      { articleId: 'a-low', title: 'Lower Article', views: 10, uniqueReaders: 5 },
      { articleId: 'a-top', title: 'Most Read Article', views: 99, uniqueReaders: 30 },
    ],
  });
  vi.mocked(listAdminAnalyticsCategories).mockResolvedValue({
    rows: [
      { category: 'sports', views: 25, uniqueReaders: 15 },
      { category: 'breaking', views: 80, uniqueReaders: 45 },
    ],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AnalyticsDashboard readership overview', () => {
  it('renders readership metrics only from existing analytics responses', async () => {
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Readership Analytics' })).toBeInTheDocument();
    expect(within(metricCard('Page Views')).getByText('1,234')).toBeInTheDocument();
    expect(within(metricCard('Unique Readers')).getByText('567')).toBeInTheDocument();
    expect(within(metricCard('Engaged Readers')).getByText('321')).toBeInTheDocument();
    expect(within(metricCard('Average Read Time')).getByText('1m 23s')).toBeInTheDocument();
    expect(within(metricCard('Completion Rate')).getByText('74%')).toBeInTheDocument();
    expect(within(metricCard('Top Article')).getByText('Most Read Article (99 views)')).toBeInTheDocument();
    expect(within(metricCard('Top Category')).getByText('breaking (80 views)')).toBeInTheDocument();
    expect(screen.getByText('Traffic Analytics')).toBeInTheDocument();
    expect(screen.getByText('News Pulse Analytics')).toBeInTheDocument();
  });

  it('shows truthful zero and no-data values when connected readership responses are empty', async () => {
    vi.mocked(getAdminAnalyticsDashboard).mockResolvedValueOnce({ totals: {} });
    vi.mocked(listAdminAnalyticsArticles).mockResolvedValueOnce({ rows: [] });
    vi.mocked(listAdminAnalyticsCategories).mockResolvedValueOnce({ rows: [] });

    renderDashboard();

    await screen.findByRole('heading', { name: 'Readership Analytics' });
    expect(within(metricCard('Page Views')).getByText('0')).toBeInTheDocument();
    expect(within(metricCard('Unique Readers')).getByText('0')).toBeInTheDocument();
    expect(within(metricCard('Engaged Readers')).getByText('0')).toBeInTheDocument();
    expect(within(metricCard('Average Read Time')).getByText('0s')).toBeInTheDocument();
    expect(within(metricCard('Completion Rate')).getByText('0%')).toBeInTheDocument();
    expect(within(metricCard('Top Article')).getByText('No data yet')).toBeInTheDocument();
    expect(within(metricCard('Top Category')).getByText('No data yet')).toBeInTheDocument();
  });

  it('shows unavailable state without ad or revenue cards when traffic source fails', async () => {
    vi.mocked(getAdminAnalyticsDashboard).mockRejectedValueOnce(new Error('Traffic offline'));

    renderDashboard();

    expect(await screen.findByText('Readership analytics unavailable')).toBeInTheDocument();
    expect(screen.getByText('Traffic offline')).toBeInTheDocument();
    expect(screen.queryByText('Ad Tracking')).toBeNull();
    expect(screen.queryByText('Revenue Data')).toBeNull();
  });

  it('maps Last 24h, Last 7 Days, and Last 30 Days to existing readership range params', async () => {
    renderDashboard();

    await screen.findByRole('heading', { name: 'Readership Analytics' });
    expect(getAdminAnalyticsDashboard).toHaveBeenLastCalledWith({ range: '24h' });
    fireEvent.click(screen.getByRole('button', { name: 'Last 7 Days' }));
    await waitFor(() => expect(getAdminAnalyticsDashboard).toHaveBeenLastCalledWith({ range: '7d' }));
    fireEvent.click(screen.getByRole('button', { name: 'Last 30 Days' }));
    await waitFor(() => expect(getAdminAnalyticsDashboard).toHaveBeenLastCalledWith({ range: '30d' }));
  });

  it('maps custom readership range to existing from/to params', async () => {
    renderDashboard();

    await screen.findByRole('heading', { name: 'Readership Analytics' });
    fireEvent.click(screen.getByRole('button', { name: 'Custom Range' }));
    const inputs = screen.getAllByDisplayValue('');
    fireEvent.change(inputs[0], { target: { value: '2026-09-01' } });
    fireEvent.change(inputs[1], { target: { value: '2026-09-16' } });

    await waitFor(() => expect(getAdminAnalyticsDashboard).toHaveBeenLastCalledWith({ range: 'custom', from: '2026-09-01', to: '2026-09-16' }));
    expect(listAdminAnalyticsArticles).toHaveBeenLastCalledWith({ range: 'custom', from: '2026-09-01', to: '2026-09-16', page: 1, limit: 200 });
    expect(listAdminAnalyticsCategories).toHaveBeenLastCalledWith({ range: 'custom', from: '2026-09-01', to: '2026-09-16' });
  });

  it('navigates to existing Article Analytics page', async () => {
    renderDashboard();

    await screen.findByRole('heading', { name: 'Readership Analytics' });
    fireEvent.click(screen.getByRole('button', { name: 'Article Analytics' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/analytics/articles');
    expect(screen.getByText('Article Analytics Page')).toBeInTheDocument();
  });

  it('navigates to existing Category Analytics page', async () => {
    renderDashboard();

    await screen.findByRole('heading', { name: 'Readership Analytics' });
    fireEvent.click(screen.getByRole('button', { name: 'Category Analytics' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/analytics/categories');
    expect(screen.getByText('Category Analytics Page')).toBeInTheDocument();
  });

  it('does not render ad, revenue, finance, or placeholder presentation on the readership page', async () => {
    renderDashboard();

    await screen.findByRole('heading', { name: 'Readership Analytics' });
    expect(screen.queryByText('Ad Performance')).toBeNull();
    expect(screen.queryByText('Ad Tracking')).toBeNull();
    expect(screen.queryByText('Ad Impressions')).toBeNull();
    expect(screen.queryByText('Ad Clicks')).toBeNull();
    expect(screen.queryByText('CTR')).toBeNull();
    expect(screen.queryByText('Total Ads')).toBeNull();
    expect(screen.queryByText('Active Ads')).toBeNull();
    expect(screen.queryByText('Revenue Data')).toBeNull();
    expect(screen.queryByText('Total Revenue')).toBeNull();
    expect(screen.queryByText('Paid Amount')).toBeNull();
    expect(screen.queryByText('Outstanding Amount')).toBeNull();
    expect(screen.queryByText('Revenue Records')).toBeNull();
    expect(screen.queryByText(/50K|87%|500K|sample|placeholder/i)).toBeNull();
  });
});
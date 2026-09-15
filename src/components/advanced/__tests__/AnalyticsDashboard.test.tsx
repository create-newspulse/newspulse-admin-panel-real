import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AnalyticsDashboard from '@/components/advanced/AnalyticsDashboard';
import { getAdminAnalyticsDashboard } from '@/lib/api/adminAnalytics';

vi.mock('@/lib/api/adminAnalytics', () => ({
  getAdminAnalyticsDashboard: vi.fn(),
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
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('AnalyticsDashboard first-party traffic source', () => {
  it('recognizes News Pulse first-party traffic analytics without external provider flags', async () => {
    renderDashboard();

    expect(await screen.findByText('Data source: News Pulse Analytics')).toBeInTheDocument();
    expect(within(integrationCard('Traffic Analytics')).getByText('Connected')).toBeInTheDocument();
    expect(within(integrationCard('Traffic Analytics')).getByText('News Pulse Analytics')).toBeInTheDocument();
    expect(screen.queryByText('Connect an analytics provider before refreshing.')).toBeNull();
    expect(getAdminAnalyticsDashboard).toHaveBeenCalledWith({ range: '24h' });
  });

  it('keeps ad tracking and revenue data not configured without real sources', async () => {
    renderDashboard();

    await screen.findByText('Data source: News Pulse Analytics');
    expect(within(integrationCard('Ad Tracking')).getByText('Not Configured')).toBeInTheDocument();
    expect(within(integrationCard('Ad Tracking')).getByText('No advertisement tracking system configured')).toBeInTheDocument();
    expect(within(integrationCard('Revenue Data')).getByText('Not Configured')).toBeInTheDocument();
    expect(within(integrationCard('Revenue Data')).getByText('No revenue data source configured')).toBeInTheDocument();
  });

  it('displays real zero traffic values without placeholder numbers', async () => {
    vi.mocked(getAdminAnalyticsDashboard).mockResolvedValueOnce({
      totals: { views: 0, uniqueReaders: 0, engagedReads: 0, avgReadTimeSec: 0 },
      sources: [],
      languages: [],
    });

    renderDashboard();

    expect(await screen.findByText('Data source: News Pulse Analytics')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/50K|87%|500K/i)).toBeNull();
  });

  it('refreshes through the existing first-party analytics dashboard helper only', async () => {
    renderDashboard();

    await screen.findByText('Data source: News Pulse Analytics');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Data' }));

    await waitFor(() => expect(getAdminAnalyticsDashboard).toHaveBeenCalledTimes(2));
    expect(getAdminAnalyticsDashboard).toHaveBeenLastCalledWith({ range: '24h' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps empty and error states truthful and safe', async () => {
    vi.mocked(getAdminAnalyticsDashboard).mockResolvedValueOnce({ totals: {}, sources: [], languages: [] });
    const { unmount } = renderDashboard();

    expect(await screen.findByText('No analytics data is available for the selected date range.')).toBeInTheDocument();
    expect(screen.getByText('Data source: News Pulse Analytics')).toBeInTheDocument();
    unmount();

    vi.mocked(getAdminAnalyticsDashboard).mockRejectedValueOnce(new Error('Backend offline'));
    renderDashboard();

    expect(await screen.findByText('Analytics unavailable')).toBeInTheDocument();
    expect(screen.getByText('Backend offline')).toBeInTheDocument();
  });
});
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AdsManager from '@/pages/AdsManager';
import { adminApi } from '@/lib/api';
import { getAdminAnalyticsAdPerformance } from '@/lib/api/adminAnalytics';
import { getAdInquiriesUnreadCount, listAdInquiries } from '@/lib/adsInquiriesApi';
import { listSponsoredArticleInventory, listSponsoredFeatures } from '@/lib/sponsoredFeaturesApi';

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@context/AuthContext', () => ({
  useAuth: () => ({ isFounder: true, user: { role: 'founder', specialRights: ['ads', 'ads_manager', 'media_kit'] } }),
}));

vi.mock('@/lib/sponsoredFeaturesApi', () => ({
  deleteSponsoredFeature: vi.fn(),
  listSponsoredArticleInventory: vi.fn(),
  listSponsoredFeatures: vi.fn(),
  saveSponsoredFeature: vi.fn(),
  setSponsoredArticleVisibility: vi.fn(),
  setSponsoredFeatureActive: vi.fn(),
  setSponsoredFeatureComboActive: vi.fn(),
}));

vi.mock('@/lib/adsInquiriesApi', () => ({
  ADS_INQUIRIES_BASE: '/admin/ad-inquiries',
  getAdInquiryStatusCount: vi.fn().mockResolvedValue(0),
  getAdInquiriesUnreadCount: vi.fn(),
  listAdInquiries: vi.fn(),
  logAdsInquiriesDiagnostic: vi.fn(),
  markAdInquiryRead: vi.fn(),
  markAdInquiriesRead: vi.fn(),
  moveAdInquiryToTrash: vi.fn(),
  moveAdInquiriesToTrash: vi.fn(),
  permanentlyDeleteAdInquiries: vi.fn(),
  permanentlyDeleteAdInquiry: vi.fn(),
  replyToAdInquiry: vi.fn(),
  restoreAdInquiry: vi.fn(),
  restoreAdInquiries: vi.fn(),
  messagePreview: (value: string) => value,
}));

vi.mock('@/lib/api/adminAnalytics', () => ({
  getAdminAnalyticsAdPerformance: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn() },
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function mockAdsManagerRecords(records: any[]) {
  vi.mocked(adminApi.get).mockImplementation(async (path: string) => {
    if (path === '/admin/ads') return { data: { ads: records } };
    if (path === '/admin/ad-settings') return { data: { slotEnabled: { HOME_728x90: true, HOME_RIGHT_300x250: true, ARTICLE_INLINE: true, ARTICLE_END: true, FOOTER_BANNER_728x90: true } } };
    if (path === '/media-kit') return { data: null };
    return { data: {} };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminApi.get).mockImplementation(async (path: string) => {
    if (path === '/admin/ads') return { data: { ads: [] } };
    if (path === '/admin/ad-settings') return { data: { slotEnabled: {} } };
    if (path === '/media-kit') return { data: null };
    return { data: {} };
  });
  vi.mocked(getAdInquiriesUnreadCount).mockResolvedValue(0);
  vi.mocked(listAdInquiries).mockResolvedValue({ items: [], total: 0, source: 'mock', raw: {} });
  vi.mocked(listSponsoredFeatures).mockResolvedValue([]);
  vi.mocked(listSponsoredArticleInventory).mockResolvedValue([]);
  vi.mocked(getAdminAnalyticsAdPerformance).mockResolvedValue({
    connected: true,
    source: 'Ads Manager',
    scope: 'lifetime',
    dateRangeSupported: false,
    metrics: { impressions: 0, clicks: 0, ctr: 0, totalAds: 5, activeAds: 0 },
  });
});

afterEach(() => {
  cleanup();
});

describe('AdsManager module organization', () => {
  it('keeps existing tab order and renders the existing Ads tab actions and sections', async () => {
    render(<AdsManager />);

    const tabs = screen.getAllByRole('button', { name: /^(Ads|Ad Inquiries|Media Kit|Ad Performance)$/ }).map((button) => button.textContent);
    expect(tabs).toEqual(['Ads', 'Ad Inquiries', 'Media Kit', 'Ad Performance']);
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Ad' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sponsored Content' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ad Placements' })).toBeInTheDocument();
    await waitFor(() => expect(adminApi.get).toHaveBeenCalledWith('/admin/ads', { params: {} }));
  });

  it('keeps the Ad Inquiries tab rendering the existing inquiry component path', async () => {
    render(<AdsManager />);

    fireEvent.click(screen.getByRole('button', { name: 'Ad Inquiries' }));

    expect(await screen.findByRole('heading', { name: 'Ad Inquiries' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deleted' })).toBeInTheDocument();
    expect(listAdInquiries).toHaveBeenCalled();
  });

  it('keeps the Media Kit tab rendering the existing media kit component path', async () => {
    render(<AdsManager />);

    fireEvent.click(screen.getByRole('button', { name: 'Media Kit' }));

    expect(await screen.findByText('Internal / Confidential')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refresh|Loading/ })).toBeInTheDocument();
  });

  it('renders the new Ad Performance tab from the existing ad-performance helper', async () => {
    render(<AdsManager />);

    fireEvent.click(screen.getByRole('button', { name: 'Ad Performance' }));

    expect(await screen.findByRole('heading', { name: 'Ad Performance' })).toBeInTheDocument();
    expect(getAdminAnalyticsAdPerformance).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getAdminAnalyticsAdPerformance).mock.calls[0]).toEqual([]);
    expect(screen.getByText('Monitor ad delivery, impressions, clicks, CTR, placements and sponsored campaigns.')).toBeInTheDocument();
    expect(screen.getByText('Current impression and click counters are lifetime metrics.')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(within(screen.getByText('Connected Source').closest('.rounded') as HTMLElement).getByText('Ads Manager')).toBeInTheDocument();
    expect(within(screen.getByText('Scope').closest('.rounded') as HTMLElement).getByText('Lifetime')).toBeInTheDocument();
    const overviewSection = screen.getByLabelText('Ad Performance Overview');
    expect(within(within(overviewSection).getByText('Impressions').closest('.rounded') as HTMLElement).getByText('0')).toBeInTheDocument();
    expect(within(within(overviewSection).getByText('Clicks').closest('.rounded') as HTMLElement).getByText('0')).toBeInTheDocument();
    expect(within(overviewSection).getByText('0.00%')).toBeInTheDocument();
    expect(within(within(overviewSection).getByText('Total Ads').closest('.rounded') as HTMLElement).getByText('5')).toBeInTheDocument();
    expect(within(within(overviewSection).getByText('Active Ads').closest('.rounded') as HTMLElement).getByText('0')).toBeInTheDocument();
    expect(within(within(overviewSection).getByText('Sponsored Features').closest('.rounded') as HTMLElement).getByText('0')).toBeInTheDocument();
    expect(within(within(overviewSection).getByText('Sponsored Articles').closest('.rounded') as HTMLElement).getByText('0')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Lifetime' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Last 7 Days' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Last 30 Days' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Custom Range' })).toBeInTheDocument();
  });

  it('loads dated ad performance ranges through the existing helper params', async () => {
    render(<AdsManager />);

    fireEvent.click(screen.getByRole('button', { name: 'Ad Performance' }));
    await waitFor(() => expect(getAdminAnalyticsAdPerformance).toHaveBeenCalledTimes(1));
    expect(vi.mocked(getAdminAnalyticsAdPerformance).mock.calls[0]).toEqual([]);

    const rangeSelect = screen.getByLabelText('Range');
    fireEvent.change(rangeSelect, { target: { value: 'today' } });
    await waitFor(() => expect(getAdminAnalyticsAdPerformance).toHaveBeenLastCalledWith({ range: 'today' }));

    fireEvent.change(rangeSelect, { target: { value: '7d' } });
    await waitFor(() => expect(getAdminAnalyticsAdPerformance).toHaveBeenLastCalledWith({ range: '7d' }));

    fireEvent.change(rangeSelect, { target: { value: '30d' } });
    await waitFor(() => expect(getAdminAnalyticsAdPerformance).toHaveBeenLastCalledWith({ range: '30d' }));

    fireEvent.change(rangeSelect, { target: { value: 'custom' } });
    expect(screen.getByText('Select both start and end dates to load a custom range.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Custom start date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Custom end date'), { target: { value: '2026-09-16' } });
    await waitFor(() => expect(getAdminAnalyticsAdPerformance).toHaveBeenLastCalledWith({ range: 'custom', from: '2026-09-01', to: '2026-09-16' }));
  });

  it('renders dated ad performance from backend range data without mixing in lifetime counters', async () => {
    vi.mocked(getAdminAnalyticsAdPerformance).mockResolvedValueOnce({
      connected: true,
      source: 'Ads Manager',
      scope: 'lifetime',
      metrics: { impressions: 9999, clicks: 999, ctr: 9.99, totalAds: 9, activeAds: 4 },
    }).mockResolvedValueOnce({
      connected: true,
      source: 'Ads Manager',
      dateRangeSupported: true,
      metrics: { impressions: 245, clicks: 19, ctr: 7.76, adsWithActivity: 2 },
      dailyTrend: [
        { date: '2026-09-15', impressions: 120, clicks: 9, ctr: 7.5 },
        { date: '2026-09-16', impressions: 125, clicks: 10, ctr: 8 },
      ],
      perAd: [
        { id: 'ad-range-1', title: 'Range Leader', placement: 'HOME_728x90', impressions: 200, clicks: 16, ctr: 8 },
      ],
      placementPerformance: [
        { placement: 'HOME_728x90', adsWithActivity: 1, impressions: 200, clicks: 16, ctr: 8 },
      ],
      topByImpressions: [{ id: 'ad-range-1', title: 'Range Leader', impressions: 200, clicks: 16, ctr: 8 }],
      topByClicks: [{ id: 'ad-range-1', title: 'Range Leader', impressions: 200, clicks: 16, ctr: 8 }],
      topByCtr: [{ id: 'ad-range-1', title: 'Range Leader', impressions: 200, clicks: 16, ctr: 8 }],
    });

    render(<AdsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Ad Performance' }));
    await waitFor(() => expect(getAdminAnalyticsAdPerformance).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Range'), { target: { value: '7d' } });
    await waitFor(() => expect(getAdminAnalyticsAdPerformance).toHaveBeenLastCalledWith({ range: '7d' }));

    expect(screen.getByText('Historical period sections use dated backend ad-performance records only.')).toBeInTheDocument();
    expect(within(screen.getByText('Scope').closest('.rounded') as HTMLElement).getByText('Last 7 Days')).toBeInTheDocument();
    const periodOverview = await screen.findByLabelText('Period Performance Overview');
    expect(within(within(periodOverview).getByText('Impressions').closest('.rounded') as HTMLElement).getByText('245')).toBeInTheDocument();
    expect(within(within(periodOverview).getByText('Clicks').closest('.rounded') as HTMLElement).getByText('19')).toBeInTheDocument();
    expect(within(periodOverview).getByText('7.76%')).toBeInTheDocument();
    expect(within(within(periodOverview).getByText('Ads With Activity').closest('.rounded') as HTMLElement).getByText('2')).toBeInTheDocument();

    const trendSection = screen.getByLabelText('Daily Performance Trend');
    expect(within(trendSection).getByText('2026-09-15')).toBeInTheDocument();
    expect(within(trendSection).getByText('2026-09-16')).toBeInTheDocument();
    const perAdSection = screen.getByLabelText('Period Per-Ad Performance');
    expect(within(perAdSection).getByText('Range Leader')).toBeInTheDocument();
    const placementSection = screen.getByLabelText('Period Placement Performance');
    expect(within(placementSection).getByText('HOME_728x90')).toBeInTheDocument();
    const topSection = screen.getByLabelText('Period Top Ads');
    expect(within(topSection).getByText('Top by Impressions')).toBeInTheDocument();
    expect(within(topSection).getAllByText('Range Leader').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByLabelText('Ad Performance Overview')).toBeNull();
  });

  it('keeps dated ad performance failure truthful without fake values', async () => {
    vi.mocked(getAdminAnalyticsAdPerformance).mockResolvedValueOnce({
      connected: true,
      source: 'Ads Manager',
      scope: 'lifetime',
      metrics: { impressions: 0, clicks: 0, ctr: 0, totalAds: 0, activeAds: 0 },
    }).mockRejectedValueOnce(new Error('range unavailable'));

    render(<AdsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Ad Performance' }));
    await waitFor(() => expect(getAdminAnalyticsAdPerformance).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('Range'), { target: { value: '30d' } });

    expect(await screen.findByText('range unavailable')).toBeInTheDocument();
    expect(screen.getByText('No advertisement tracking system configured')).toBeInTheDocument();
    expect(screen.queryByLabelText('Period Performance Overview')).toBeNull();
    expect(screen.queryByText(/50K|87%|500K|sample|placeholder/i)).toBeNull();
  });

  it('renders lifetime per-ad, placement, campaign, attention, health, and sponsored status from existing Ads Manager records', async () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const olderPast = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    mockAdsManagerRecords([
      { id: 'ad-hero', slot: 'HOME_728x90', title: 'Hero Banner', imageUrl: 'https://cdn.example/hero.jpg', targetUrl: 'https://sponsor.example', isActive: true, startAt: past, endAt: future, impressions: 1000, clicks: 50 },
      { id: 'ad-zero', slot: 'HOME_RIGHT_300x250', title: 'Quiet Rail', imageUrl: 'https://cdn.example/rail.jpg', targetUrl: 'https://sponsor.example/rail', isActive: true, startAt: past, endAt: future, impressions: 0, clicks: 0 },
      { id: 'ad-noclick', slot: 'ARTICLE_END', title: 'Article Ender', imageUrl: 'https://cdn.example/end.jpg', targetUrl: 'https://sponsor.example/end', isActive: true, impressions: 40, clicks: 0 },
      { id: 'ad-scheduled', slot: 'ARTICLE_INLINE', title: 'Future Inline', imageUrl: 'https://cdn.example/future.jpg', targetUrl: 'https://sponsor.example/future', isActive: true, startAt: future, impressions: 0, clicks: 0 },
      { id: 'ad-ended', slot: 'FOOTER_BANNER_728x90', title: 'Ended Footer', imageUrl: 'https://cdn.example/footer.jpg', targetUrl: 'https://sponsor.example/footer', isActive: true, endAt: olderPast, impressions: 300, clicks: 30 },
      { id: 'ad-paused', slot: 'HOME_728x90', title: 'Paused Banner', imageUrl: 'https://cdn.example/paused.jpg', targetUrl: 'https://sponsor.example/paused', isActive: false, impressions: 10, clicks: 1 },
    ]);
    vi.mocked(getAdminAnalyticsAdPerformance).mockResolvedValueOnce({
      connected: true,
      source: 'Ads Manager',
      scope: 'lifetime',
      dateRangeSupported: false,
      metrics: { impressions: 1350, clicks: 81, ctr: 6, totalAds: 6, activeAds: 5 },
    });
    vi.mocked(listSponsoredFeatures).mockResolvedValue([
      {
        id: 'sf-1',
        headline: 'Sponsored Homepage Lead',
        sponsorName: 'Pulse Partner',
        destinationUrl: 'https://partner.example',
        publicClickTarget: '/news/sponsored-story',
        isActive: true,
        comboCampaignIsActive: true,
        optionalLinkedSponsoredArticleId: 'article-1',
        linkedSponsoredArticleTitle: 'Sponsored Story',
      } as any,
    ]);
    vi.mocked(listSponsoredArticleInventory).mockResolvedValue([
      { id: 'article-1', title: 'Sponsored Story', status: 'published', publicUrl: '/news/sponsored-story' },
    ] as any);

    render(<AdsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Ad Performance' }));

    const perAdSection = await screen.findByLabelText('Per-Ad Performance');
    expect(await within(perAdSection).findByText('Hero Banner')).toBeInTheDocument();
    const zeroRow = within(perAdSection).getByText('Quiet Rail').closest('tr') as HTMLElement;
    expect(within(zeroRow).getAllByText('0').length).toBeGreaterThanOrEqual(2);
    expect(within(zeroRow).getByText('0.00%')).toBeInTheDocument();
    expect(within(perAdSection).getByText('Future Inline').closest('tr')).toHaveTextContent('Scheduled');
    expect(within(perAdSection).getByText('Ended Footer').closest('tr')).toHaveTextContent('Ended');
    expect(within(perAdSection).getByText('Paused Banner').closest('tr')).toHaveTextContent('Inactive / Off');

    const placementSection = screen.getByLabelText('Placement Performance');
    const homePlacementRow = within(placementSection).getByText('HOME_728x90').closest('tr') as HTMLElement;
    expect(within(homePlacementRow).getByText('2')).toBeInTheDocument();
    expect(within(homePlacementRow).getByText('1,010')).toBeInTheDocument();
    expect(within(homePlacementRow).getByText('51')).toBeInTheDocument();
    expect(within(homePlacementRow).getByText('5.05%')).toBeInTheDocument();

    const campaignStatusSection = screen.getByLabelText('Campaign Status');
    expect(within(campaignStatusSection).getByText('Active').closest('.rounded')).toHaveTextContent('3');
    expect(within(campaignStatusSection).getByText('Scheduled').closest('.rounded')).toHaveTextContent('1');
    expect(within(campaignStatusSection).getByText('Ended').closest('.rounded')).toHaveTextContent('1');
    expect(within(campaignStatusSection).getByText('Inactive / Off').closest('.rounded')).toHaveTextContent('1');

    const topSection = screen.getByLabelText('Top Performing Ads');
    expect(within(topSection).getByText('Highest impressions')).toBeInTheDocument();
    expect(within(topSection).getByText('Highest clicks')).toBeInTheDocument();
    expect(within(topSection).getByText('Highest CTR')).toBeInTheDocument();
    expect(within(topSection).getAllByText('Hero Banner').length).toBeGreaterThanOrEqual(2);

    const attentionSection = screen.getByLabelText('Needs Attention');
    expect(within(attentionSection).getByText('Quiet Rail')).toBeInTheDocument();
    expect(within(attentionSection).getAllByText('Active ad has no recorded impressions.').length).toBeGreaterThan(0);
    expect(within(attentionSection).getByText('Article Ender')).toBeInTheDocument();
    expect(within(attentionSection).getByText('Ad has impressions but no recorded clicks.')).toBeInTheDocument();

    const healthSection = screen.getByLabelText('Delivery Health');
    expect(within(healthSection).getByText('Hero Banner')).toBeInTheDocument();
    expect(within(healthSection).getAllByText('Healthy').length).toBeGreaterThan(0);

    const sponsoredSection = await screen.findByLabelText('Sponsored Content Status');
    expect(within(sponsoredSection).getByText('Sponsored Homepage Lead')).toBeInTheDocument();
    expect(within(sponsoredSection).getByText('Homepage: Homepage ON')).toBeInTheDocument();
    expect(within(sponsoredSection).getByText('Combo: Combo Campaign active')).toBeInTheDocument();
    expect(within(sponsoredSection).getByText('Linked article: Sponsored Story')).toBeInTheDocument();

    expect(screen.queryByText('Total Revenue')).toBeNull();
    expect(screen.queryByText('Paid Amount')).toBeNull();
    expect(screen.queryByText('Advertiser Leads')).toBeNull();
    expect(screen.queryByText('Page Views')).toBeNull();
    expect(adminApi.post).not.toHaveBeenCalled();
    expect(adminApi.put).not.toHaveBeenCalled();
    expect(adminApi.patch).not.toHaveBeenCalled();
    expect(adminApi.delete).not.toHaveBeenCalled();
  });

  it('keeps zero ad activity connected and truthful', async () => {
    vi.mocked(getAdminAnalyticsAdPerformance).mockResolvedValueOnce({
      connected: true,
      source: 'Ads Manager',
      scope: 'lifetime',
      dateRangeSupported: false,
      metrics: { impressions: 0, clicks: 0, ctr: 0, totalAds: 0, activeAds: 0 },
    });

    render(<AdsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Ad Performance' }));

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('No ad activity yet.')).toBeInTheDocument();
    expect(screen.getByText('No ad performance data yet.')).toBeInTheDocument();
    expect(screen.queryByText(/50K|87%|500K|sample|placeholder/i)).toBeNull();
  });

  it('renders connected missing ad counters as zeroes instead of Not configured', async () => {
    vi.mocked(getAdminAnalyticsAdPerformance).mockResolvedValueOnce({
      connected: true,
      source: 'Ads Manager',
      scope: 'lifetime',
      dateRangeSupported: false,
      metrics: {},
    });

    render(<AdsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Ad Performance' }));

    expect(await screen.findByText('Connected')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('0.00%')).toBeInTheDocument();
    expect(screen.queryByText('Not configured')).toBeNull();
    expect(screen.getByText('No ad activity yet.')).toBeInTheDocument();
  });
});
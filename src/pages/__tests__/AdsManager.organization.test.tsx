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
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(within(screen.getByText('Connected source').closest('.rounded') as HTMLElement).getByText('Ads Manager')).toBeInTheDocument();
    expect(within(screen.getByText('Scope').closest('.rounded') as HTMLElement).getByText('Lifetime')).toBeInTheDocument();
    expect(screen.getByText('Date range filters do not apply to these lifetime counters.')).toBeInTheDocument();
    expect(within(screen.getByText('Impressions').closest('.rounded') as HTMLElement).getByText('0')).toBeInTheDocument();
    expect(within(screen.getByText('Clicks').closest('.rounded') as HTMLElement).getByText('0')).toBeInTheDocument();
    expect(screen.getByText('0.00%')).toBeInTheDocument();
    expect(within(screen.getByText('Total Ads').closest('.rounded') as HTMLElement).getByText('5')).toBeInTheDocument();
    expect(within(screen.getByText('Active Ads').closest('.rounded') as HTMLElement).getByText('0')).toBeInTheDocument();
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
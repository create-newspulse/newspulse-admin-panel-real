import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import appSource from '../../App.tsx?raw';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import AdsManager from '@/pages/AdsManager';
import AdminModuleRoute from '@/components/AdminModuleRoute';
import { adminApi, api } from '@/lib/api';
import { getAdminAnalyticsAdPerformance } from '@/lib/api/adminAnalytics';
import { getAdInquiriesUnreadCount, listAdInquiries } from '@/lib/adsInquiriesApi';
import { listSponsoredArticleInventory, listSponsoredFeatures, saveSponsoredFeature } from '@/lib/sponsoredFeaturesApi';

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@context/AuthContext', () => ({
  useAuth: () => ({ isFounder: true, isAuthenticated: true, isReady: true, isRestoring: false, isLoading: false, user: { role: 'founder', specialRights: ['ads', 'ads_manager', 'media_kit'] } }),
}));

vi.mock('@/hooks/useAdminEffectiveAccess', () => ({
  useAdminEffectiveAccess: () => ({ isLoading: false }),
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
  api: { get: vi.fn(), post: vi.fn() },
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

function mockCreativeImage(width = 728, height = 90, fails = false) {
  vi.stubGlobal('Image', class {
    naturalWidth = width;
    naturalHeight = height;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) { queueMicrotask(() => fails ? this.onerror?.() : this.onload?.()); }
  });
}

function openDisplayCreate(slot: string, imageUrl = 'https://cdn.example/display.jpg') {
  fireEvent.click(screen.getByRole('button', { name: 'Create Ad' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: slot } });
  fireEvent.change(within(dialog).getByPlaceholderText('e.g. Sponsor: ACME'), { target: { value: 'Display Sponsor' } });
  const urls = within(dialog).getAllByPlaceholderText('https://...');
  fireEvent.change(urls[0], { target: { value: imageUrl } });
  fireEvent.change(urls[1], { target: { value: 'https://sponsor.example/display' } });
  return dialog;
}

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
  mockCreativeImage();
  vi.mocked(api.get).mockResolvedValue({ data: { mediaKit: { title: 'Saved Media Kit' } } });
  vi.mocked(adminApi.get).mockImplementation(async (path: string) => {
    if (path === '/admin/ads') return { data: { ads: [] } };
    if (path === '/admin/ad-settings') return { data: { slotEnabled: {} } };
    if (path === '/media-kit') return { data: null };
    return { data: {} };
  });
  vi.mocked(getAdInquiriesUnreadCount).mockResolvedValue(0);
  vi.mocked(listAdInquiries).mockResolvedValue({ items: [], total: 0, source: 'mock', raw: {} });
  vi.mocked(listSponsoredFeatures).mockResolvedValue([]);
  vi.mocked(saveSponsoredFeature).mockResolvedValue([]);
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
  vi.unstubAllGlobals();
});

describe('AdsManager module organization', () => {
  it.each(['/admin/ads', '/admin/ads-manager'])('keeps the guarded Ads Manager route loadable: %s', async (path) => {
    expect(appSource).toContain(`path="${path}" element={<AdminModuleRoute moduleKey="ads_manager"><LockCheckWrapper><AdsManager /></LockCheckWrapper></AdminModuleRoute>}`);
    render(<MemoryRouter initialEntries={[path]}><Routes>
      <Route path={path} element={<AdminModuleRoute moduleKey="ads_manager"><AdsManager /></AdminModuleRoute>} />
    </Routes></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Ads Manager' })).toBeInTheDocument();
    await waitFor(() => expect(adminApi.get).toHaveBeenCalledWith('/admin/ads', { params: {} }));
  });

  it.each([true, false])('previews the saved destination with Combo enabled=%s', async (comboCampaignIsActive) => {
    vi.mocked(listSponsoredFeatures).mockResolvedValue([{
      id: 'feature-preview', headline: 'Preview Feature', sponsorName: 'Preview Sponsor',
      internalCampaignName: 'Preview Campaign', shortSummary: 'Preview Summary', ctaText: 'Read more',
      placement: 'homepage_sponsored_feature',
      destinationUrl: 'https://sponsor.example/fallback', coverImage: 'https://cdn.example/cover.jpg',
      isActive: true, comboCampaignIsActive, optionalLinkedSponsoredArticleId: 'article-preview',
      linkedSponsoredArticleTitle: 'Preview Article', linkedSponsoredArticleUrl: '/news/preview-article',
    } as any]);
    vi.mocked(listSponsoredArticleInventory).mockResolvedValue([{
      id: 'article-preview', title: 'Preview Article', status: 'published', publicUrl: '/news/preview-article',
    }]);

    render(<AdsManager />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Sponsored Feature' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByRole('option', { name: 'Preview Article (published)' });
    expect(within(dialog).queryByRole('spinbutton')).toBeNull();
    const expectedTarget = comboCampaignIsActive ? '/news/preview-article' : 'https://sponsor.example/fallback';
    expect(within(dialog).getAllByText(expectedTarget)).toHaveLength(2);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Sponsored Feature' }));
    await waitFor(() => expect(saveSponsoredFeature).toHaveBeenCalledWith({
      sponsorName: 'Preview Sponsor', headline: 'Preview Feature', shortSummary: 'Preview Summary',
      ctaText: 'Read more', coverImage: 'https://cdn.example/cover.jpg', destinationUrl: 'https://sponsor.example/fallback',
      linkedSponsoredArticleId: 'article-preview', linkedSponsoredArticleTitle: 'Preview Article',
      linkedSponsoredArticleUrl: '/news/preview-article', isActive: true, comboCampaignIsActive,
      startAt: null, endAt: null, internalCampaignName: 'Preview Campaign',
    }, 'feature-preview'));
    expect(vi.mocked(saveSponsoredFeature).mock.calls[0][0]).not.toHaveProperty('priority');
  });

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

  it('keeps supported display priority editable and labels thumbnails truthfully', async () => {
    vi.mocked(adminApi.post).mockResolvedValue({ data: { ad: { id: 'new-display', slot: 'HOME_728x90', title: 'Display Sponsor', isActive: true } } });
    render(<AdsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Ad' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'HOME_728x90' } });
    fireEvent.change(within(dialog).getByPlaceholderText('e.g. Sponsor: ACME'), { target: { value: 'Display Sponsor' } });
    const urls = within(dialog).getAllByPlaceholderText('https://...');
    fireEvent.change(urls[0], { target: { value: 'https://cdn.example/display.jpg' } });
    fireEvent.change(urls[1], { target: { value: 'https://sponsor.example/display' } });
    fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '7' } });
    expect(within(dialog).getByRole('spinbutton')).toHaveValue(7);
    expect(within(dialog).getByText('Creative thumbnail (not public layout)')).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeEnabled());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Ad' }));
    await waitFor(() => expect(adminApi.post).toHaveBeenCalledWith('/admin/ads', {
      slot: 'HOME_728x90', title: 'Display Sponsor', imageUrl: 'https://cdn.example/display.jpg',
      targetUrl: 'https://sponsor.example/display', clickable: true, isClickable: true, priority: 7,
      startAt: null, endAt: null, isActive: true, active: true, productType: 'STANDARD_AD',
    }));
  });

  it('rejects a 728x90 creative for the billboard before create', async () => {
    render(<AdsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Ad' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'HOME_BILLBOARD_970x250' } });
    fireEvent.change(within(dialog).getAllByPlaceholderText('https://...')[0], { target: { value: 'https://cdn.example/banner.jpg' } });
    expect(within(dialog).getByText('Required creative size: 970 × 250 px')).toBeInTheDocument();
    expect(await within(dialog).findByText('Uploaded creative: 728 × 90 px')).toBeInTheDocument();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Creative size mismatch');
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeDisabled();
    fireEvent.submit(dialog.querySelector('form')!);
    expect(adminApi.post).not.toHaveBeenCalled();
  });

  it.each([
    ['HOME_728x90', 728, 90],
    ['FOOTER_BANNER_728x90', 728, 90],
    ['HOME_BILLBOARD_970x250', 970, 250],
    ['TOP_HOME_BILLBOARD_970x250', 970, 250],
    ['HOME_RIGHT_300x250', 300, 250],
    ['HOME_LEFT_300x250', 300, 250],
    ['HOME_RIGHT_300x600', 300, 600],
    ['HOME_LEFT_300x600', 300, 600],
  ])('uses canonical requirements and an undistorted frame for %s', async (slot, width, height) => {
    mockCreativeImage(Number(width), Number(height));
    vi.mocked(adminApi.post).mockResolvedValue({ data: {} });
    render(<AdsManager />);
    const dialog = openDisplayCreate(String(slot));
    expect(within(dialog).getByText(`Required creative size: ${width} × ${height} px`)).toBeInTheDocument();
    expect(await within(dialog).findByText(`Uploaded creative: ${width} × ${height} px`)).toBeInTheDocument();
    expect(within(dialog).queryByRole('alert')).toBeNull();
    const frame = within(dialog).getByTestId('ad-placement-frame');
    expect(frame).toHaveStyle({ aspectRatio: `${width} / ${height}`, width: '100%' });
    expect(frame.querySelector('img')).toHaveClass('object-contain');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Ad' }));
    await waitFor(() => expect(adminApi.post).toHaveBeenCalledWith('/admin/ads', expect.objectContaining({ slot })));
  });

  it.each([
    ['HOME_728x90', 1456, 180],
    ['FOOTER_BANNER_728x90', 1456, 180],
    ['HOME_BILLBOARD_970x250', 1940, 500],
    ['TOP_HOME_BILLBOARD_970x250', 1940, 500],
    ['HOME_RIGHT_300x250', 600, 500],
    ['HOME_LEFT_300x600', 600, 1200],
  ])('accepts exact 2x aspect ratio for %s', async (slot, width, height) => {
    mockCreativeImage(Number(width), Number(height));
    render(<AdsManager />);
    const dialog = openDisplayCreate(String(slot));
    await within(dialog).findByText(`Uploaded creative: ${width} × ${height} px`);
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeEnabled();
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('uses exact integer aspect ratios without a rounding tolerance', async () => {
    mockCreativeImage(970, 251);
    render(<AdsManager />);
    const dialog = openDisplayCreate('HOME_BILLBOARD_970x250');
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Selected creative is 970 × 251.');
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeDisabled();
  });

  it('rejects a 728x90 creative for the new TOP_HOME_BILLBOARD_970x250 slot', async () => {
    mockCreativeImage(728, 90);
    render(<AdsManager />);
    const dialog = openDisplayCreate('TOP_HOME_BILLBOARD_970x250');
    expect(within(dialog).getByText('Required creative size: 970 × 250 px')).toBeInTheDocument();
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Selected creative is 728 × 90.');
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeDisabled();
  });

  it('keeps TOP_HOME_BILLBOARD_970x250 as a distinct product from HOME_728x90 and HOME_BILLBOARD_970x250', async () => {
    render(<AdsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Ad' }));
    const dialog = screen.getByRole('dialog');
    const options = Array.from(within(dialog).getByRole('combobox').querySelectorAll('option'))
      .map((option) => (option as HTMLOptionElement).value);
    expect(options).toContain('HOME_728x90');
    expect(options).toContain('HOME_BILLBOARD_970x250');
    expect(options).toContain('TOP_HOME_BILLBOARD_970x250');
    // Exact, separate slot IDs - no normalization/collapsing onto an existing slot.
    expect(new Set(options).size).toBe(options.length);
  });

  it.each(['LIVE_UPDATE_SPONSOR', 'BREAKING_SPONSOR', 'ARTICLE_INLINE', 'ARTICLE_END'])('does not add image-size rules to %s', async (slot) => {
    mockCreativeImage(0, 0, true);
    vi.mocked(adminApi.post).mockResolvedValue({ data: {} });
    render(<AdsManager />);
    const dialog = openDisplayCreate(slot);
    expect(within(dialog).queryByLabelText('Placement preview')).toBeNull();
    expect(within(dialog).queryByText(/Required creative size/)).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Ad' }));
    await waitFor(() => expect(adminApi.post).toHaveBeenCalledWith('/admin/ads', expect.objectContaining({ slot })));
  });

  it.each([false, true])('allows unchanged legacy creative edits, including failed image load=%s', async (fails) => {
    mockCreativeImage(728, 90, fails);
    const record = {
      id: 'legacy', slot: 'HOME_BILLBOARD_970x250', title: 'Legacy Billboard',
      imageUrl: 'https://cdn.example/legacy.jpg', targetUrl: 'https://sponsor.example',
      clickable: true, priority: 7, isActive: true,
      startAt: '2026-09-01T08:30:00.000Z', endAt: '2026-11-01T18:15:00.000Z',
    };
    mockAdsManagerRecords([record]);
    vi.mocked(adminApi.put).mockResolvedValue({ data: { ad: record } });
    render(<AdsManager />);
    const row = (await screen.findByText('Legacy Billboard')).closest('tr')!;
    expect(screen.getByRole('columnheader', { name: 'Thumbnail' })).toBeInTheDocument();
    expect(within(row).getByRole('img')).toHaveAttribute('src', record.imageUrl);
    fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    expect(await within(dialog).findByText('Existing creative unchanged. Other edits can still be saved.')).toBeInTheDocument();
    const scheduleInputs = dialog.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    expect(new Date(scheduleInputs[0].value).toISOString()).toBe(record.startAt);
    expect(new Date(scheduleInputs[1].value).toISOString()).toBe(record.endAt);
    fireEvent.change(within(dialog).getByPlaceholderText('e.g. Sponsor: ACME'), { target: { value: 'Updated title' } });
    fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '9' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(adminApi.put).toHaveBeenCalledWith('/admin/ads/legacy', {
      slot: record.slot, title: 'Updated title', imageUrl: record.imageUrl,
      targetUrl: record.targetUrl, clickable: true, isClickable: true, priority: 9,
      startAt: record.startAt, endAt: record.endAt, isActive: true, active: true, productType: 'STANDARD_AD',
    }));
    expect(adminApi.patch).not.toHaveBeenCalled();
    expect(adminApi.delete).not.toHaveBeenCalled();
  });

  it.each(['placement', 'creative'])('blocks changed %s on an existing ad, including the hosting save path', async (change) => {
    const record = {
      id: 'existing', slot: 'HOME_728x90', title: 'Existing Banner',
      imageUrl: 'https://cdn.example/original.jpg', targetUrl: 'https://sponsor.example', isActive: true,
    };
    mockAdsManagerRecords([record]);
    render(<AdsManager />);
    fireEvent.click(within((await screen.findByText(record.title)).closest('tr')!).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByText('Uploaded creative: 728 × 90 px');
    if (change === 'placement') {
      fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'HOME_BILLBOARD_970x250' } });
    } else {
      mockCreativeImage(300, 250);
      fireEvent.change(within(dialog).getAllByPlaceholderText('https://...')[0], { target: { value: 'https://cdn.example/replacement.jpg' } });
    }
    await within(dialog).findByRole('alert');
    expect(within(dialog).getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Host this image' })).toBeDisabled();
    fireEvent.submit(dialog.querySelector('form')!);
    expect(adminApi.put).not.toHaveBeenCalled();
    if (change === 'placement') {
      fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: record.slot } });
      expect(within(dialog).getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    } else {
      mockCreativeImage();
      fireEvent.change(within(dialog).getAllByPlaceholderText('https://...')[0], { target: { value: 'https://cdn.example/correct.jpg' } });
      await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Save Changes' })).toBeEnabled());
      vi.mocked(adminApi.put).mockResolvedValue({ data: { ad: record } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
      await waitFor(() => expect(adminApi.put).toHaveBeenCalledWith('/admin/ads/existing', expect.objectContaining({ imageUrl: 'https://cdn.example/correct.jpg' })));
    }
  });

  it('blocks an unreadable new creative without treating it as valid', async () => {
    mockCreativeImage(0, 0, true);
    render(<AdsManager />);
    const dialog = openDisplayCreate('HOME_728x90');
    await within(dialog).findByText('Unable to verify creative dimensions.');
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeDisabled();
    fireEvent.submit(dialog.querySelector('form')!);
    expect(adminApi.post).not.toHaveBeenCalled();
  });

  it('ignores stale image loads and blocks save while the replacement is loading', async () => {
    const pending: Array<{ naturalWidth: number; naturalHeight: number; onload: (() => void) | null }> = [];
    vi.stubGlobal('Image', class {
      naturalWidth = 728;
      naturalHeight = 90;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { pending.push(this); }
    });
    render(<AdsManager />);
    const dialog = openDisplayCreate('HOME_728x90');
    const staleLoad = pending[0].onload!;
    await act(async () => staleLoad());
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeEnabled();
    fireEvent.change(within(dialog).getAllByPlaceholderText('https://...')[0], { target: { value: 'https://cdn.example/replacement.jpg' } });
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeDisabled();
    await act(async () => staleLoad());
    expect(within(dialog).queryByText('Uploaded creative: 728 × 90 px')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeDisabled();
    pending[1].naturalWidth = 970;
    pending[1].naturalHeight = 250;
    await act(async () => pending[1].onload?.());
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Selected creative is 970 × 250.');
    expect(adminApi.post).not.toHaveBeenCalled();
  });

  it('measures a selected file, then rechecks the uploaded URL before create', async () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:local-creative');
      static revokeObjectURL = revokeObjectURL;
    });
    vi.mocked(api.post).mockResolvedValue({ data: { hostedUrl: 'https://cdn.example/uploaded.jpg' } });
    vi.mocked(adminApi.post).mockResolvedValue({ data: {} });
    render(<AdsManager />);
    const dialog = openDisplayCreate('HOME_728x90');
    await within(dialog).findByText('Uploaded creative: 728 × 90 px');
    const file = new File(['image'], 'banner.png', { type: 'image/png' });
    fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await within(dialog).findByText('Selected creative: 728 × 90 px');
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeDisabled();
    expect(within(dialog).getByRole('img', { name: 'Creative in selected placement' })).toHaveAttribute('src', 'blob:local-creative');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Upload Image' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeEnabled());
    expect(api.post).toHaveBeenCalledWith('/ads/upload-image', expect.any(FormData), expect.any(Object));
    expect((vi.mocked(api.post).mock.calls[0][1] as FormData).get('file')).toBe(file);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:local-creative');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Ad' }));
    await waitFor(() => expect(adminApi.post).toHaveBeenCalledWith('/admin/ads', expect.objectContaining({ imageUrl: 'https://cdn.example/uploaded.jpg' })));
  });

  it('does not exempt a replacement upload when hosting returns the original legacy URL', async () => {
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:replacement-creative');
      static revokeObjectURL = vi.fn();
    });
    const record = {
      id: 'same-url', slot: 'HOME_BILLBOARD_970x250', title: 'Legacy Upload',
      imageUrl: 'https://cdn.example/legacy.jpg', targetUrl: 'https://sponsor.example', isActive: true,
    };
    mockAdsManagerRecords([record]);
    vi.mocked(api.post).mockResolvedValue({ data: { hostedUrl: record.imageUrl } });
    render(<AdsManager />);
    fireEvent.click(within((await screen.findByText(record.title)).closest('tr')!).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    await within(dialog).findByText('Existing creative unchanged. Other edits can still be saved.');
    fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [new File(['image'], 'wrong.png', { type: 'image/png' })] } });
    await within(dialog).findByText('Selected creative: 728 × 90 px');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Upload Image' }));
    await within(dialog).findByText('Uploaded creative: 728 × 90 px');
    expect(within(dialog).getByRole('button', { name: 'Save Changes' })).toBeDisabled();
    expect(within(dialog).queryByText('Existing creative unchanged. Other edits can still be saved.')).toBeNull();
    fireEvent.submit(dialog.querySelector('form')!);
    expect(adminApi.put).not.toHaveBeenCalled();
  });

  it('keeps lifetime inventory independent of Ads-tab slot and active filters', async () => {
    const records = [
      { id: 'home', slot: 'HOME_728x90', title: 'Home record', isActive: true, impressions: 10, clicks: 1 },
      { id: 'footer', slot: 'FOOTER_BANNER_728x90', title: 'Off footer record', isActive: false, impressions: 20, clicks: 2 },
      { id: 'home-off', slot: 'HOME_728x90', title: 'Off home record', isActive: false, impressions: 30, clicks: 3 },
    ];
    vi.mocked(adminApi.get).mockImplementation(async (path, config) => {
      if (path !== '/admin/ads') return { data: { slotEnabled: {} } };
      const params = config?.params || {};
      return { data: { ads: records.filter((ad) => (!params.slot || ad.slot === params.slot) && (params.active !== 'true' || ad.isActive)) } };
    });
    render(<AdsManager />);
    await screen.findByText('Off footer record');
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'HOME_728x90' } });
    await waitFor(() => expect(adminApi.get).toHaveBeenCalledWith('/admin/ads', { params: { slot: 'HOME_728x90' } }));
    expect(await screen.findByText('Off home record')).toBeInTheDocument();
    expect(screen.queryByText('Off footer record')).toBeNull();
    fireEvent.click(screen.getByLabelText('Active only'));
    await waitFor(() => expect(adminApi.get).toHaveBeenCalledWith('/admin/ads', { params: { slot: 'HOME_728x90', active: 'true' } }));
    expect(await screen.findByText('Home record')).toBeInTheDocument();
    expect(screen.queryByText('Off home record')).toBeNull();
    expect(screen.queryByText('Off footer record')).toBeNull();
    vi.mocked(adminApi.get).mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Ad Performance' }));
    const section = await screen.findByLabelText('Per-Ad Performance');
    expect(await within(section).findByText('Off footer record')).toBeInTheDocument();
    expect(within(section).getByText('Off home record')).toBeInTheDocument();
    expect(within(section).getByText('Home record')).toBeInTheDocument();
    expect(adminApi.get).toHaveBeenCalledWith('/admin/ads', { params: {} });
    fireEvent.click(screen.getByRole('button', { name: 'Ads' }));
    expect(screen.getByRole('combobox')).toHaveValue('HOME_728x90');
    expect(screen.getByLabelText('Active only')).toBeChecked();
    expect(screen.getByText('Home record')).toBeInTheDocument();
    expect(screen.queryByText('Off home record')).toBeNull();
    expect(screen.queryByText('Off footer record')).toBeNull();
  });

  it.each([
    ['live', true, 'published', '', '', true, 'cover.jpg', 'Combo Campaign active', '1'],
    ['off', false, 'published', '', '', true, 'cover.jpg', 'Combo bundle ready', '0'],
    ['scheduled', true, 'published', '2999-01-01T00:00:00Z', '', true, 'cover.jpg', 'Combo bundle ready', '0'],
    ['expired', true, 'published', '', '2000-01-01T00:00:00Z', true, 'cover.jpg', 'Combo bundle ready', '0'],
    ['draft article', true, 'draft', '', '', true, 'cover.jpg', 'Combo bundle inactive', '0'],
    ['combo disabled', true, 'published', '', '', false, 'cover.jpg', 'Combo Campaign off', '0'],
    ['missing image', true, 'published', '', '', true, '', 'Combo bundle ready', '0'],
  ])('uses saved-card combo eligibility in performance: %s', async (_name, isActive, status, startAt, endAt, comboCampaignIsActive, coverImage, label, count) => {
    vi.mocked(listSponsoredFeatures).mockResolvedValue([{
      id: 'combo-status', headline: 'Status Feature', isActive, startAt, endAt, comboCampaignIsActive, coverImage,
      destinationUrl: 'https://sponsor.example', optionalLinkedSponsoredArticleId: 'status-article',
      linkedSponsoredArticleUrl: '/news/status-article',
    } as any]);
    vi.mocked(listSponsoredArticleInventory).mockResolvedValue([{ id: 'status-article', title: 'Status Article', status: String(status) }]);
    render(<AdsManager />);
    await screen.findByRole('button', { name: 'Edit Sponsored Feature' });
    fireEvent.click(screen.getByRole('button', { name: 'Ad Performance' }));
    const section = await screen.findByLabelText('Sponsored Content Status');
    expect(await within(section).findByText(`Combo: ${label}`)).toBeInTheDocument();
    expect(within(section).getByText('Active combos').parentElement).toHaveTextContent(String(count));
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
    expect(await screen.findByText('Source: Saved')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Saved Media Kit' })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/admin/media-kit');
    expect(screen.getByRole('button', { name: /Refresh|Loading/ })).toBeInTheDocument();
  });

  it('adds a separate Top Home Billboard 970x250 Media Kit product without altering existing prices', async () => {
    render(<AdsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Media Kit' }));
    await screen.findByText('Internal / Confidential');

    const newCardHeading = await screen.findByText('Top Home Billboard 970×250 (Premium)');
    const newCard = newCardHeading.closest('div.rounded.border') as HTMLElement;
    expect(within(newCard).getByText('TOP_HOME_BILLBOARD_970x250')).toBeInTheDocument();
    expect(within(newCard).getByText('₹900')).toBeInTheDocument();
    expect(within(newCard).getByText('₹5,350')).toBeInTheDocument();
    expect(within(newCard).getByText('₹10,800')).toBeInTheDocument();
    expect(within(newCard).getByText('₹18,900')).toBeInTheDocument();

    // Existing premium billboard remains present, separate, and unchanged.
    const existingHeading = screen.getByText('Home Billboard 970×250 (Premium)');
    const existingCard = existingHeading.closest('div.rounded.border') as HTMLElement;
    expect(within(existingCard).getByText('HOME_BILLBOARD_970x250')).toBeInTheDocument();
    expect(within(existingCard).getByText('₹900')).toBeInTheDocument();
    expect(within(existingCard).getByText('₹5,350')).toBeInTheDocument();
    expect(within(existingCard).getByText('₹10,800')).toBeInTheDocument();
    expect(within(existingCard).getByText('₹18,900')).toBeInTheDocument();

    // Unrelated existing product prices are untouched.
    const bannerHeading = screen.getByText('Home Banner 728×90');
    const bannerCard = bannerHeading.closest('div.rounded.border') as HTMLElement;
    expect(within(bannerCard).getByText('₹500')).toBeInTheDocument();
  });

  it('renders the new Ad Performance tab from the existing ad-performance helper', async () => {
    render(<AdsManager />);

    fireEvent.click(screen.getByRole('button', { name: 'Ad Performance' }));

    expect(await screen.findByRole('heading', { name: 'Ad Performance' })).toBeInTheDocument();
    expect(getAdminAnalyticsAdPerformance).toHaveBeenCalledTimes(1);
    expect(vi.mocked(getAdminAnalyticsAdPerformance).mock.calls[0]).toEqual([]);
    expect(screen.getByText('Monitor ad delivery, impressions, clicks, CTR, placements and sponsored campaigns.')).toBeInTheDocument();
    expect(screen.getByText('Current impression and click counters are lifetime metrics.')).toBeInTheDocument();
    expect(screen.getByText('API connected')).toBeInTheDocument();
    expect(within(screen.getByText('API Source').closest('.rounded') as HTMLElement).getByText('Ads Manager')).toBeInTheDocument();
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
        coverImage: 'https://cdn.example/feature.jpg',
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

    const filters = within(perAdSection).getAllByRole('combobox');
    fireEvent.change(filters[0], { target: { value: 'Inactive / Off' } });
    expect(within(perAdSection).getByText('Paused Banner')).toBeInTheDocument();
    expect(within(perAdSection).queryByText('Hero Banner')).toBeNull();
    fireEvent.change(filters[0], { target: { value: 'all' } });
    fireEvent.change(filters[1], { target: { value: 'FOOTER_BANNER_728x90' } });
    expect(within(perAdSection).getByText('Ended Footer')).toBeInTheDocument();
    expect(within(perAdSection).queryByText('Hero Banner')).toBeNull();
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

    expect(await screen.findByText('API connected')).toBeInTheDocument();
    expect(screen.getByText('No ad activity yet.')).toBeInTheDocument();
    expect(screen.getByText('No ad performance data yet.')).toBeInTheDocument();
    expect(screen.queryByText(/50K|87%|500K|sample|placeholder/i)).toBeNull();
  });

  it('distinguishes missing connected counters from measured zeroes', async () => {
    mockAdsManagerRecords([{ id: 'unknown', slot: 'HOME_728x90', title: 'Unknown counters', isActive: true }]);
    vi.mocked(getAdminAnalyticsAdPerformance).mockResolvedValueOnce({
      connected: true,
      source: 'Ads Manager',
      scope: 'lifetime',
      dateRangeSupported: false,
      metrics: {},
    });

    render(<AdsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Ad Performance' }));

    const overview = await screen.findByLabelText('Ad Performance Overview');
    expect(within(overview).getAllByText('Not reported')).toHaveLength(5);
    expect(screen.getByText('API connected')).toBeInTheDocument();
    const section = screen.getByLabelText('Per-Ad Performance');
    const row = await within(section).findByText('Unknown counters');
    expect(within(row.closest('tr') as HTMLElement).getAllByText('Not reported')).toHaveLength(3);
    expect(screen.queryByText('Active ad has no recorded impressions.')).toBeNull();
    expect(screen.queryByText('No ad activity yet.')).toBeNull();
    expect(screen.getByText('Ad activity counters not reported.')).toBeInTheDocument();
  });

  it.each([
    { dateRangeSupported: false },
    { dateRangeSupported: true, scope: 'lifetime' },
  ])('does not label unsupported/lifetime responses as dated metrics: %j', async (capability) => {
    vi.mocked(getAdminAnalyticsAdPerformance).mockResolvedValue({
      connected: true, ...capability, metrics: { impressions: 987654, clicks: 12345 },
    });
    render(<AdsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Ad Performance' }));
    await screen.findByLabelText('Ad Performance Overview');
    fireEvent.change(screen.getByLabelText('Range'), { target: { value: '7d' } });
    expect(await screen.findByText('Date-range performance is not supported by this response. Use Lifetime for available counters.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Period Performance Overview')).toBeNull();
    expect(screen.queryByText('9,87,654')).toBeNull();
    expect(screen.getByText('API connected')).toBeInTheDocument();
  });

  it('keeps missing period counters distinct from explicit zeroes', async () => {
    vi.mocked(getAdminAnalyticsAdPerformance).mockResolvedValue({
      connected: true, dateRangeSupported: true, metrics: { clicks: 0 },
      perAd: [{ id: 'partial', title: 'Partial period', clicks: 0 }],
    });
    render(<AdsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Ad Performance' }));
    await screen.findByLabelText('Ad Performance Overview');
    fireEvent.change(screen.getByLabelText('Range'), { target: { value: 'today' } });
    const section = await screen.findByLabelText('Period Performance Overview');
    expect(within(section).getAllByText('Not reported')).toHaveLength(3);
    expect(within(section).getByText('Clicks').parentElement).toHaveTextContent('0');
    const row = within(screen.getByLabelText('Period Per-Ad Performance')).getByText('Partial period').closest('tr') as HTMLElement;
    expect(within(row).getAllByText('Not reported')).toHaveLength(2);
    expect(within(row).getByText('0')).toBeInTheDocument();
  });
});
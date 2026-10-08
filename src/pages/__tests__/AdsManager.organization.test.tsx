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

describe('Auto Creative Fit', () => {
  const sourceUrl = 'https://cdn.example/source.jpg';
  const hostedUrl = 'https://cdn.example/prepared.jpg';
  const categorySlot = 'CATEGORY_TOP_970x90';

  function preparation(slot = categorySlot, width = 970, height = 90) {
    return { data: { hostedUrl, slot, width, height, originalImageUrl: sourceUrl,
      sourceWidth: 1920, sourceHeight: 885, fit: 'cover', warnings: [] as unknown[] } };
  }

  function verifyPreview(width: number, height: number) {
    const image = screen.getByRole('img', { name: 'Prepared ad creative' });
    Object.defineProperties(image, { naturalWidth: { value: width, configurable: true }, naturalHeight: { value: height, configurable: true } });
    fireEvent.load(image);
    return image;
  }

  async function preparePreview(slot = categorySlot, width = 970, height = 90) {
    mockCreativeImage(1920, 885);
    vi.mocked(api.post).mockResolvedValue(preparation(slot, width, height));
    render(<AdsManager />);
    const dialog = openDisplayCreate(slot, sourceUrl);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Auto Fit to Selected Slot' }));
    await within(dialog).findByRole('region', { name: 'Prepared Creative' });
    verifyPreview(width, height);
    return dialog;
  }

  it.each([
    ['CATEGORY_TOP_970x90', 970, 90], ['HOME_728x90', 728, 90], ['FOOTER_BANNER_728x90', 728, 90],
    ['HOME_BILLBOARD_970x250', 970, 250], ['TOP_HOME_BILLBOARD_970x250', 970, 250],
    ['HOME_LEFT_300x250', 300, 250], ['HOME_RIGHT_300x250', 300, 250],
    ['HOME_LEFT_300x600', 300, 600], ['HOME_RIGHT_300x600', 300, 600],
    ['ARTICLE_INLINE', 300, 250], ['ARTICLE_END', 300, 250],
  ])('prepares an HTTPS source for %s and saves only after explicit acceptance and create', async (slot, width, height) => {
    const dialog = await preparePreview(String(slot), Number(width), Number(height));
    expect(api.post).toHaveBeenCalledExactlyOnceWith('/ads/upload-image', { slot, imageUrl: sourceUrl, fit: 'cover' });
    const preview = within(dialog).getByRole('region', { name: 'Prepared Creative' });
    expect(within(preview).getByText('Original: 1920 × 885')).toBeInTheDocument();
    expect(within(preview).getByText(`Prepared: ${width} × ${height}`)).toBeInTheDocument();
    expect(within(preview).getByRole('img')).toHaveAttribute('src', hostedUrl);
    expect(within(preview).getByRole('img')).toHaveClass('object-contain');
    expect(within(preview).getByRole('img').parentElement).toHaveStyle({ aspectRatio: `${width} / ${height}` });
    expect(within(dialog).getAllByPlaceholderText('https://...')[0]).toHaveValue(sourceUrl);
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeDisabled();
    expect(adminApi.post).not.toHaveBeenCalled();
    expect(adminApi.put).not.toHaveBeenCalled();
    expect(adminApi.patch).not.toHaveBeenCalled();
    mockCreativeImage(Number(width), Number(height));
    fireEvent.click(within(preview).getByRole('button', { name: 'Use Prepared Creative' }));
    expect(within(dialog).getAllByPlaceholderText('https://...')[0]).toHaveValue(hostedUrl);
    expect(within(preview).getByText(`Original image: ${sourceUrl}`)).toBeInTheDocument();
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeEnabled());
    expect(adminApi.post).not.toHaveBeenCalled();
    vi.mocked(adminApi.post).mockResolvedValue({ data: {} });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create Ad' }));
    await waitFor(() => expect(adminApi.post).toHaveBeenCalledExactlyOnceWith('/admin/ads', {
      slot, title: 'Display Sponsor', imageUrl: hostedUrl, targetUrl: 'https://sponsor.example/display',
      clickable: true, isClickable: true, priority: 0, startAt: null, endAt: null,
      isActive: true, active: true, productType: 'STANDARD_AD',
    }));
  });

  it.each([categorySlot, 'ARTICLE_INLINE', 'ARTICLE_END'])('prepares a selected file for %s with multipart slot and fit fields, retaining warnings after acceptance', async (slot) => {
    const width = slot === categorySlot ? 970 : 300;
    const height = slot === categorySlot ? 90 : 250;
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:source-image');
      static revokeObjectURL = vi.fn();
    });
    mockCreativeImage(1920, 885);
    const response = preparation(slot, width, height);
    response.data.warnings = ['ANIMATED_SOURCE_CONVERTED_TO_STATIC', { message: 'The image was cropped to fill the placement.' }];
    vi.mocked(api.post).mockResolvedValue(response);
    render(<AdsManager />);
    const dialog = openDisplayCreate(slot, '');
    const file = new File(['source-image'], 'source.jpg', { type: 'image/jpeg' });
    fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Auto Fit to Selected Slot' }));
    const preview = await within(dialog).findByRole('region', { name: 'Prepared Creative' });
    expect(api.post).toHaveBeenCalledWith('/ads/upload-image', expect.any(FormData));
    const body = vi.mocked(api.post).mock.calls[0][1] as FormData;
    expect(Array.from(body.keys()).sort()).toEqual(['file', 'fit', 'slot']);
    expect(body.get('file')).toBe(file);
    expect(body.get('slot')).toBe(slot);
    expect(body.get('fit')).toBe('cover');
    expect(within(preview).getByText('Original: 1920 × 885')).toBeInTheDocument();
    expect(within(preview).getByText(`Prepared: ${width} × ${height}`)).toBeInTheDocument();
    verifyPreview(width, height);
    mockCreativeImage(width, height);
    fireEvent.click(within(preview).getByRole('button', { name: 'Use Prepared Creative' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeEnabled());
    expect(within(preview).getByText('Animated or multipage source was converted to a static creative.')).toBeInTheDocument();
    expect(within(preview).getByText('The image was cropped to fill the placement.')).toBeInTheDocument();
    expect(within(dialog).getAllByPlaceholderText('https://...')[0]).toHaveValue(hostedUrl);
    expect(adminApi.post).not.toHaveBeenCalled();
    expect(adminApi.put).not.toHaveBeenCalled();
    expect(adminApi.patch).not.toHaveBeenCalled();
  });

  it.each([
    ['LOW_SOURCE_RESOLUTION', 400, 'This image is too small for this ad placement. Please use a higher-resolution image.'],
    ['INVALID_URL', 400, 'This image URL cannot be used.'],
    ['PRIVATE_URL', 400, 'This image URL cannot be used.'],
    ['UNSUPPORTED_TYPE', 415, 'Use JPEG, PNG, WebP, or GIF.'],
    ['IMAGE_TOO_LARGE', 413, 'This image is too large to prepare. Please use a smaller file or lower-resolution image.'],
    ['PROVIDER_FAILURE', 502, 'Unable to prepare this image. Please try again. Your current form has been kept.'],
    ['ERR_NETWORK', 0, 'Unable to prepare this image. Please try again. Your current form has been kept.'],
  ])('handles %s without losing the form or exposing backend details', async (code, status, message) => {
    vi.mocked(api.post).mockRejectedValue({ response: { status, data: { code, message: 'SECRET_STACK_TRACE', stack: 'SECRET_STACK_TRACE' } } });
    render(<AdsManager />);
    const dialog = openDisplayCreate(categorySlot, sourceUrl);
    fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '9' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Auto Fit to Selected Slot' }));
    expect(await within(dialog).findByText(String(message))).toBeInTheDocument();
    expect(within(dialog).getAllByPlaceholderText('https://...')[0]).toHaveValue(sourceUrl);
    expect(within(dialog).getByPlaceholderText('e.g. Sponsor: ACME')).toHaveValue('Display Sponsor');
    expect(within(dialog).getByRole('spinbutton')).toHaveValue(9);
    expect(within(dialog).queryByText(/SECRET_STACK_TRACE/)).toBeNull();
    expect(adminApi.post).not.toHaveBeenCalled();
    expect(adminApi.put).not.toHaveBeenCalled();
  });

  it.each(['http://example.com/image.jpg', 'not-a-url', 'https://user:password@example.com/image.jpg'])('rejects unsafe remote source %s before requesting preparation', async (imageUrl) => {
    render(<AdsManager />);
    const dialog = openDisplayCreate(categorySlot, imageUrl);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Auto Fit to Selected Slot' }));
    expect(await within(dialog).findByText('This image URL cannot be used.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it.each(['BREAKING_SPONSOR', 'LIVE_UPDATE_SPONSOR'])('leaves unsupported %s on the existing upload/save path', async (slot) => {
    render(<AdsManager />);
    const dialog = openDisplayCreate(slot, sourceUrl);
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeEnabled());
    expect(within(dialog).queryByRole('button', { name: 'Auto Fit to Selected Slot' })).toBeNull();
    expect(within(dialog).queryByText(/Target:.*px/)).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Upload Image' })).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it.each([
    ['HOME_728x90', 728, 90, 'FOOTER_BANNER_728x90'],
    ['CATEGORY_TOP_970x90', 970, 90, 'HOME_LEFT_300x600'],
    ['ARTICLE_INLINE', 300, 250, 'ARTICLE_END'],
    ['ARTICLE_END', 300, 250, 'HOME_LEFT_300x600'],
    ['HOME_RIGHT_300x250', 300, 250, 'ARTICLE_INLINE'],
    ['CATEGORY_TOP_970x90', 970, 90, 'ARTICLE_END'],
  ])('invalidates an accepted %s creative after selecting %s', async (slot, width, height, nextSlot) => {
    const dialog = await preparePreview(String(slot), Number(width), Number(height));
    mockCreativeImage(Number(width), Number(height));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use Prepared Creative' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeEnabled());
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: nextSlot } });
    expect(await within(dialog).findByText('Slot changed. Auto Fit again for the selected slot or choose a new source.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeDisabled();
    fireEvent.submit(dialog.querySelector('form')!);
    expect(adminApi.post).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Auto Fit to Selected Slot' }));
    await waitFor(() => expect(api.post).toHaveBeenLastCalledWith('/ads/upload-image', { slot: nextSlot, imageUrl: sourceUrl, fit: 'cover' }));
  });

  it.each(['slot', 'source', 'close'])('ignores a late preparation response after changing %s', async (change) => {
    let resolvePreparation!: (value: unknown) => void;
    vi.mocked(api.post).mockImplementationOnce(() => new Promise((resolve) => { resolvePreparation = resolve; }));
    render(<AdsManager />);
    const dialog = openDisplayCreate(categorySlot, sourceUrl);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Auto Fit to Selected Slot' }));
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeDisabled();
    if (change === 'slot') fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'HOME_728x90' } });
    if (change === 'source') fireEvent.change(within(dialog).getAllByPlaceholderText('https://...')[0], { target: { value: 'https://cdn.example/replacement.jpg' } });
    if (change === 'close') fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    await act(async () => resolvePreparation(preparation()));
    expect(screen.queryByRole('region', { name: 'Prepared Creative' })).toBeNull();
    expect(adminApi.post).not.toHaveBeenCalled();
    expect(adminApi.put).not.toHaveBeenCalled();
  });

  it.each(['wrong-slot', 'wrong-ratio', 'invalid-url'])('rejects an invalid prepared response: %s', async (failure) => {
    const response = preparation();
    if (failure === 'wrong-slot') response.data.slot = 'HOME_728x90';
    if (failure === 'wrong-ratio') response.data.height = 250;
    if (failure === 'invalid-url') response.data.hostedUrl = 'javascript:alert(1)';
    vi.mocked(api.post).mockResolvedValue(response);
    render(<AdsManager />);
    const dialog = openDisplayCreate(categorySlot, sourceUrl);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Auto Fit to Selected Slot' }));
    expect(await within(dialog).findByText('The prepared image does not match the selected slot. Please try Auto Fit again.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Use Prepared Creative' })).toBeNull();
  });

  it.each(['unreadable', 'wrong-ratio'])('cannot accept an actual prepared image that is %s', async (failure) => {
    const dialog = await preparePreview();
    const image = within(dialog).getByRole('img', { name: 'Prepared ad creative' });
    if (failure === 'unreadable') fireEvent.error(image);
    else verifyPreview(970, 250);
    expect(await within(dialog).findByText('The prepared image could not be verified for this slot. Please try Auto Fit again.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Use Prepared Creative' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeDisabled();
  });

  it('can discard a preparation and retain a correctly sized direct creative', async () => {
    const dialog = await preparePreview();
    mockCreativeImage(970, 90);
    fireEvent.change(within(dialog).getAllByPlaceholderText('https://...')[0], { target: { value: 'https://cdn.example/correct.jpg' } });
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeEnabled());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Auto Fit to Selected Slot' }));
    await within(dialog).findByRole('region', { name: 'Prepared Creative' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard Preview' }));
    expect(within(dialog).getAllByPlaceholderText('https://...')[0]).toHaveValue('https://cdn.example/correct.jpg');
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeEnabled();
  });

  it('keeps the accepted slot binding after discarding a retry for another slot with the same ratio', async () => {
    const dialog = await preparePreview('HOME_728x90', 728, 90);
    mockCreativeImage(728, 90);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use Prepared Creative' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeEnabled());
    fireEvent.change(within(dialog).getByRole('combobox'), { target: { value: 'FOOTER_BANNER_728x90' } });
    vi.mocked(api.post).mockResolvedValue(preparation('FOOTER_BANNER_728x90', 728, 90));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Auto Fit to Selected Slot' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Discard Preview' }));
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeDisabled();
    fireEvent.submit(dialog.querySelector('form')!);
    expect(adminApi.post).not.toHaveBeenCalled();
    expect(within(dialog).getByText(/Slot changed/)).toBeInTheDocument();
  });

  it.each(['HOME_728x90', 'HOME_RIGHT_RAIL', 'ARTICLE_INLINE', 'ARTICLE_END'])('leaves an existing %s campaign untouched until explicitly prepared and saved', async (slot) => {
    const width = slot === 'HOME_728x90' ? 728 : 300;
    const height = slot === 'HOME_728x90' ? 90 : 250;
    mockCreativeImage(width, height);
    const record = { id: 'existing', slot, title: 'Existing campaign', imageUrl: sourceUrl,
      targetUrl: 'https://sponsor.example', clickable: true, priority: 4, isActive: false,
      startAt: '2026-10-01T00:00:00.000Z', endAt: '2026-11-01T00:00:00.000Z' };
    mockAdsManagerRecords([record]);
    vi.mocked(api.post).mockResolvedValue(preparation(slot, width, height));
    vi.mocked(adminApi.put).mockResolvedValue({ data: {} });
    render(<AdsManager />);
    fireEvent.click(within((await screen.findByText(record.title)).closest('tr')!).getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByPlaceholderText('https://...')[0]).toHaveValue(sourceUrl);
    expect(within(dialog).getByRole('button', { name: 'Save Changes' })).toBeEnabled();
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Auto Fit to Selected Slot' }));
    await within(dialog).findByRole('region', { name: 'Prepared Creative' });
    verifyPreview(width, height);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use Prepared Creative' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Save Changes' })).toBeEnabled());
    expect(adminApi.put).not.toHaveBeenCalled();
    expect(adminApi.patch).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(adminApi.put).toHaveBeenCalledExactlyOnceWith('/admin/ads/existing', {
      slot, title: record.title, imageUrl: hostedUrl, targetUrl: record.targetUrl,
      clickable: true, isClickable: true, priority: 4, isActive: false, active: false,
      startAt: record.startAt, endAt: record.endAt, productType: 'STANDARD_AD',
    }));
    expect(adminApi.post).not.toHaveBeenCalled();
  });
});

describe('Category top banner inventory', () => {
  const slot = 'CATEGORY_TOP_970x90';
  const label = 'Category Top Banner 970×90 (All Categories; Excludes Home)';
  const existingSlots = [
    'HOME_728x90', 'FOOTER_BANNER_728x90', 'HOME_RIGHT_300x250', 'HOME_LEFT_300x250',
    'HOME_RIGHT_300x600', 'HOME_LEFT_300x600', 'HOME_BILLBOARD_970x250',
    'TOP_HOME_BILLBOARD_970x250', 'LIVE_UPDATE_SPONSOR', 'BREAKING_SPONSOR',
    'ARTICLE_INLINE', 'ARTICLE_END',
  ];

  it('adds exactly one single-slot option without renaming or aliasing existing products', async () => {
    render(<AdsManager />);
    await waitFor(() => expect(adminApi.get).toHaveBeenCalledWith('/admin/ad-settings'));
    const filter = screen.getByRole('combobox') as HTMLSelectElement;
    expect(Array.from(filter.options, (option) => option.value).sort()).toEqual(['ALL', slot, ...existingSlots].sort());
    expect(within(filter).getByRole('option', { name: label })).toHaveValue(slot);
    fireEvent.click(screen.getByRole('button', { name: 'Create Ad' }));
    const selector = within(screen.getByRole('dialog')).getByRole('combobox') as HTMLSelectElement;
    expect(selector.multiple).toBe(false);
    expect(Array.from(selector.options, (option) => option.value).sort()).toEqual(['', slot, ...existingSlots].sort());
    expect(within(selector).getByRole('option', { name: label })).toHaveValue(slot);
    expect(adminApi.post).not.toHaveBeenCalled();
    expect(adminApi.put).not.toHaveBeenCalled();
    expect(adminApi.patch).not.toHaveBeenCalled();
  });

  it.each([[728, 90], [970, 250], [970, 91]])('rejects a %sx%s creative for the category slot', async (width, height) => {
    mockCreativeImage(width, height);
    render(<AdsManager />);
    const dialog = openDisplayCreate(slot);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(`Selected creative is ${width} × ${height}.`);
    expect(within(dialog).getByRole('button', { name: 'Create Ad' })).toBeDisabled();
    fireEvent.submit(dialog.querySelector('form')!);
    expect(adminApi.post).not.toHaveBeenCalled();
  });

  it.each([
    ['create', true], ['create', false], ['edit', true], ['edit', false],
  ] as const)('preserves the scalar slot and campaign fields on %s with clickable=%s', async (mode, clickable) => {
    mockCreativeImage(970, 90);
    const record = {
      id: 'category', slot: 'CATEGORY_TOP_970X90', title: 'Display Sponsor',
      imageUrl: 'https://cdn.example/display.jpg', targetUrl: 'https://sponsor.example/display',
      clickable: true, priority: 7, isActive: false,
      startAt: '2026-10-01T08:30:00.000Z', endAt: '2026-11-01T18:15:00.000Z',
    };
    mockAdsManagerRecords(mode === 'edit' ? [record] : []);
    vi.mocked(adminApi.post).mockResolvedValue({ data: {} });
    vi.mocked(adminApi.put).mockResolvedValue({ data: {} });
    render(<AdsManager />);
    if (mode === 'edit') {
      const row = (await screen.findByText(record.title)).closest('tr')!;
      expect(within(row).getByText(label)).toBeInTheDocument();
      fireEvent.click(within(row).getByRole('button', { name: 'Edit' }));
    } else {
      openDisplayCreate(slot);
    }
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('combobox')).toHaveValue(slot);
    if (mode === 'create') {
      fireEvent.change(within(dialog).getByRole('spinbutton'), { target: { value: '7' } });
      fireEvent.click(within(dialog).getByText('Is Active').previousElementSibling!);
    }
    const schedules = dialog.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]');
    if (mode === 'edit') {
      expect(new Date(schedules[0].value).toISOString()).toBe(record.startAt);
      expect(new Date(schedules[1].value).toISOString()).toBe(record.endAt);
    } else {
      fireEvent.change(schedules[0], { target: { value: '2026-10-01T14:00' } });
      fireEvent.change(schedules[1], { target: { value: '2026-11-01T23:45' } });
    }
    if (!clickable) fireEvent.click(within(dialog).getByText('Clickable', { exact: true }).previousElementSibling!);
    const payload = {
      slot, title: record.title, imageUrl: record.imageUrl,
      targetUrl: clickable ? record.targetUrl : null, clickable, isClickable: clickable,
      priority: 7, startAt: new Date(schedules[0].value).toISOString(), endAt: new Date(schedules[1].value).toISOString(),
      isActive: false, active: false, productType: 'STANDARD_AD',
    };
    const save = within(dialog).getByRole('button', { name: mode === 'edit' ? 'Save Changes' : 'Create Ad' });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    if (mode === 'edit') {
      await waitFor(() => expect(adminApi.put).toHaveBeenCalledWith('/admin/ads/category', payload));
      expect(adminApi.post).not.toHaveBeenCalled();
    } else {
      await waitFor(() => expect(adminApi.post).toHaveBeenCalledWith('/admin/ads', payload));
      expect(adminApi.put).not.toHaveBeenCalled();
    }
    expect(adminApi.patch).not.toHaveBeenCalled();
    expect(adminApi.delete).not.toHaveBeenCalled();
  });

  it.each([slot, 'HOME_728x90', 'TOP_HOME_BILLBOARD_970x250', 'HOME_BILLBOARD_970x250'])('filters %s without reassigning campaigns', async (selectedSlot) => {
    const records = [slot, 'HOME_728x90', 'TOP_HOME_BILLBOARD_970x250', 'HOME_BILLBOARD_970x250']
      .map((recordSlot) => ({ id: recordSlot, slot: recordSlot, title: `Campaign ${recordSlot}`, isActive: true }));
    mockAdsManagerRecords(records);
    render(<AdsManager />);
    await screen.findByText(`Campaign ${slot}`);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: selectedSlot } });
    await waitFor(() => expect(adminApi.get).toHaveBeenCalledWith('/admin/ads', { params: { slot: selectedSlot } }));
    expect(await screen.findByText(`Campaign ${selectedSlot}`)).toBeInTheDocument();
    for (const record of records.filter((record) => record.slot !== selectedSlot)) {
      expect(screen.queryByText(record.title)).toBeNull();
    }
    expect(adminApi.post).not.toHaveBeenCalled();
    expect(adminApi.put).not.toHaveBeenCalled();
    expect(adminApi.patch).not.toHaveBeenCalled();
  });

  it.each(['boolean', 'enabled', 'isEnabled'] as const)('preserves all placement flags with %s values and a partial save response', async (shape) => {
    const shapeValue = (value: boolean) => shape === 'boolean' ? value : { [shape]: value };
    const existingFlags = Object.fromEntries(existingSlots.map((key, index) => [key, shapeValue(index % 2 === 0)]));
    const flags = shape === 'boolean' ? existingFlags : { ...existingFlags, [slot]: shapeValue(false) };
    vi.mocked(adminApi.get).mockImplementation(async (path: string) => path === '/admin/ad-settings'
      ? { data: { slotEnabled: flags } } : { data: { ads: [] } });
    vi.mocked(adminApi.put).mockImplementation(async (_path, payload: any) => ({ data: { slotEnabled: { [slot]: payload.slotEnabled[slot] } } }));
    render(<AdsManager />);
    const card = screen.getByText(slot).parentElement!.parentElement!;
    const toggle = within(card).getByRole('button', { name: 'OFF' });
    await waitFor(() => expect(toggle).toBeEnabled());
    const assertExistingFlags = () => {
      existingSlots.forEach((key, index) => {
        const existingCard = screen.getByText(key).parentElement!.parentElement!;
        expect(within(existingCard).getByRole('button', { name: index % 2 === 0 ? 'ON' : 'OFF' })).toBeEnabled();
      });
    };
    assertExistingFlags();
    expect(adminApi.put).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    await waitFor(() => expect(adminApi.put).toHaveBeenCalledWith('/admin/ad-settings', {
      slotEnabled: { ...existingFlags, [slot]: shapeValue(true) },
    }));
    const enabledToggle = await within(card).findByRole('button', { name: 'ON' });
    assertExistingFlags();
    fireEvent.click(enabledToggle);
    await waitFor(() => expect(adminApi.put).toHaveBeenLastCalledWith('/admin/ad-settings', {
      slotEnabled: { ...existingFlags, [slot]: shapeValue(false) },
    }));
    await within(card).findByRole('button', { name: 'OFF' });
    assertExistingFlags();
    expect(adminApi.patch).not.toHaveBeenCalled();
  });

  it('toggles only the category campaign without changing Home campaigns or placements', async () => {
    const category = { id: 'category', slot, title: 'Category campaign', isActive: false };
    mockAdsManagerRecords([category, { id: 'home', slot: 'HOME_728x90', title: 'Home campaign', isActive: true }]);
    vi.mocked(adminApi.patch).mockResolvedValue({ data: { ad: { ...category, isActive: true } } });
    render(<AdsManager />);
    const row = (await screen.findByText(category.title)).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'OFF' }));
    await waitFor(() => expect(adminApi.patch).toHaveBeenCalledExactlyOnceWith('/admin/ads/category/toggle', { isActive: true }));
    expect(await within(row).findByRole('button', { name: 'ON' })).toBeEnabled();
    expect(within(screen.getByText('Home campaign').closest('tr')!).getByRole('button', { name: 'ON' })).toBeEnabled();
    expect(adminApi.put).not.toHaveBeenCalled();
    expect(adminApi.post).not.toHaveBeenCalled();
  });

  it.each([false, true])('shows category-only pricing in Display Slots with saved override=%s', async (savedOverride) => {
    if (savedOverride) vi.mocked(api.get).mockResolvedValue({ data: { mediaKit: {
      title: 'Saved Media Kit', rateCards: [{ placementKey: slot, placementLabel: label,
        prices: { day: 800, week: 4600, month: 16000 }, rate15Days: 9000 }],
    } } });
    render(<AdsManager />);
    fireEvent.click(screen.getByRole('button', { name: 'Media Kit' }));
    const heading = await screen.findByText(label);
    const card = heading.closest('div.rounded.border') as HTMLElement;
    expect(within(card).getByText(slot)).toBeInTheDocument();
    const displayGroup = screen.getByText('Display Slots').parentElement!.parentElement!;
    expect(displayGroup).toContainElement(card);
    const prices = savedOverride ? ['₹800', '₹4,600', '₹9,000', '₹16,000'] : ['₹700', '₹4,200', '₹8,400', '₹14,700'];
    for (const price of prices) expect(within(card).getByText(price)).toBeInTheDocument();
    if (!savedOverride) {
      expect(within(card).getByText('All Categories; Excludes Home')).toBeInTheDocument();
      expect(within(card).getByText('Specs: 970×90 image')).toBeInTheDocument();
      expect(within(card).getByText('One linked destination')).toBeInTheDocument();
    }
    expect(adminApi.put).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
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
    ['CATEGORY_TOP_970x90', 970, 90],
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
    ['CATEGORY_TOP_970x90', 1940, 180],
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

  it.each(['HOME_728x90', 'CATEGORY_TOP_970x90'])('blocks an unreadable new creative for %s without treating it as valid', async (slot) => {
    mockCreativeImage(0, 0, true);
    render(<AdsManager />);
    const dialog = openDisplayCreate(slot);
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

  it.each([
    ['HOME_728x90', 728],
    ['CATEGORY_TOP_970x90', 970],
  ])('measures a selected file for %s, then rechecks the uploaded URL before create', async (slot, width) => {
    mockCreativeImage(Number(width), 90);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:local-creative');
      static revokeObjectURL = revokeObjectURL;
    });
    vi.mocked(api.post).mockResolvedValue({ data: { hostedUrl: 'https://cdn.example/uploaded.jpg' } });
    vi.mocked(adminApi.post).mockResolvedValue({ data: {} });
    render(<AdsManager />);
    const dialog = openDisplayCreate(String(slot));
    await within(dialog).findByText(`Uploaded creative: ${width} × 90 px`);
    const file = new File(['image'], 'banner.png', { type: 'image/png' });
    fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [file] } });
    await within(dialog).findByText(`Selected creative: ${width} × 90 px`);
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
    expect(within(bannerCard).getByText('₹3,000')).toBeInTheDocument();
    expect(within(bannerCard).getByText('₹6,000')).toBeInTheDocument();
    expect(within(bannerCard).getByText('₹10,500')).toBeInTheDocument();
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
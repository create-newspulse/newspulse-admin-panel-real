import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadAdsInquiriesApi() {
  vi.resetModules();
  return import('@/lib/adsInquiriesApi');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Ads Inquiries API base', () => {
  it('stays on /admin-api when legacy env values contain an absolute production backend', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('VITE_ADMIN_API_BASE', 'https://newspulse-prod.onrender.com');
    vi.stubEnv('VITE_API_URL', 'https://newspulse-prod.onrender.com/api');

    const { ADS_INQUIRIES_BASE, getAdsInquiriesAdminApiTarget } = await loadAdsInquiriesApi();

    expect(ADS_INQUIRIES_BASE).toBe('/admin-api/ads/inquiries');
    expect(getAdsInquiriesAdminApiTarget()).toBe('http://localhost:5000');
  });
});
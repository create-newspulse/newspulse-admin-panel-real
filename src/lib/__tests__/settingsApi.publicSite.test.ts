import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DEFAULT_SETTINGS } from '@/types/siteSettings';

const calls: Array<{ path: string; init?: any }> = [];

vi.mock('@/lib/http/adminFetch', async () => {
  const actual = await vi.importActual<any>('@/lib/http/adminFetch');
  return {
    ...actual,
    adminJson: vi.fn(async (path: string, init?: any) => {
      calls.push({ path, init });

      // Simulate successful endpoints
      if (path === '/admin/settings/public') {
        return {
          draft: { ui: { showBreakingTicker: true } },
          published: { ui: { showBreakingTicker: false } },
        };
      }
      return {};
    }),
  };
});

describe('settingsApi public-site publish wiring', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
  });

  it('publish calls POST /settings/public/publish and then re-fetches /settings/public', async () => {
    const { default: settingsApi } = await import('@/lib/settingsApi');

    const result = await settingsApi.publishPublicSiteSettings(DEFAULT_SETTINGS, { action: 'publish-public-site-settings' });

    expect(calls.length).toBeGreaterThanOrEqual(3);

    expect(calls[0].path).toBe('/admin/public-settings/draft');
    expect(String(calls[0].init?.method || 'GET').toUpperCase()).toBe('PUT');

    expect(calls[1].path).toBe('/admin/public-settings/publish');
    expect(String(calls[1].init?.method || 'GET').toUpperCase()).toBe('POST');

    // Confirm re-fetch
    expect(calls.some((c) => c.path === '/admin/settings/public' && (!c.init || c.init.method === undefined || String(c.init.method).toUpperCase() === 'GET'))).toBe(true);

    // And the function returns the bundle used to refresh UI
    expect(result.published).toBeTruthy();
  });
});

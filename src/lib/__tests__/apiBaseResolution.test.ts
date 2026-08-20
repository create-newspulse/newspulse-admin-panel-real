import { afterEach, describe, expect, it, vi } from 'vitest';

async function loadApi() {
  vi.resetModules();
  return import('@/lib/api');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('admin API base resolution', () => {
  it('keeps localhost admin dev on the same-origin /admin-api proxy even if VITE_BACKEND_ORIGIN is set', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_BACKEND_ORIGIN', 'https://newspulse-prod.onrender.com');

    const { getApiBase, apiUrl, adminUrl } = await loadApi();

    expect(getApiBase()).toBe('/admin-api');
    expect(apiUrl('/system/health')).toBe('/admin-api/system/health');
    expect(adminUrl('/community-reporter/queue')).toBe('/admin-api/admin/community-reporter/queue');
  });

  it('uses /admin-api when local env config is missing', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_ADMIN_API_BASE', '');
    vi.stubEnv('VITE_API_URL', '');

    const { getApiBase } = await loadApi();

    expect(getApiBase()).toBe('/admin-api');
  });

  it('preserves production same-origin proxy behavior', async () => {
    vi.stubEnv('DEV', false);
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_ADMIN_API_BASE', '/admin-api');

    const { getApiBase, adminUrl } = await loadApi();

    expect(getApiBase()).toBe('/admin-api');
    expect(adminUrl('/settings/community-reporter')).toBe('/admin-api/admin/settings/community-reporter');
  });
});
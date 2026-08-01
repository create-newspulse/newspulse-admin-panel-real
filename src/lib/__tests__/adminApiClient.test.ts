import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const state: any = {
    requestFulfilled: null,
    responseRejected: null,
    dispatch: vi.fn(),
    refreshRequest: vi.fn(),
    getAuthToken: vi.fn(),
    setAuthToken: vi.fn(),
  };
  const client: any = {
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn((fulfilled) => { state.requestFulfilled = fulfilled; }) },
      response: { use: vi.fn((_fulfilled, rejected) => { state.responseRejected = rejected; }) },
    },
    request: vi.fn(async (config: any) => {
      const nextConfig = state.requestFulfilled ? await state.requestFulfilled({ ...config }) : { ...config };
      try {
        return await state.dispatch(nextConfig);
      } catch (error: any) {
        if (!error.config) error.config = nextConfig;
        if (state.responseRejected) return state.responseRejected(error);
        throw error;
      }
    }),
    get: vi.fn((url: string, config: any = {}) => client.request({ ...config, method: 'get', url })),
    post: vi.fn((url: string, data?: unknown, config: any = {}) => client.request({ ...config, method: 'post', url, data })),
    put: vi.fn((url: string, data?: unknown, config: any = {}) => client.request({ ...config, method: 'put', url, data })),
    patch: vi.fn((url: string, data?: unknown, config: any = {}) => client.request({ ...config, method: 'patch', url, data })),
    delete: vi.fn((url: string, config: any = {}) => client.request({ ...config, method: 'delete', url })),
  };
  state.client = client;
  return state;
});

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mocks.client),
    request: mocks.refreshRequest,
  },
}));

vi.mock('@/lib/api', () => ({
  getAuthToken: mocks.getAuthToken,
  setAuthToken: mocks.setAuthToken,
}));

vi.mock('@/lib/http/adminFetch', () => ({
  adminFetch: vi.fn(),
  adminJson: vi.fn(),
}));

import { adminApiClient } from '@/lib/adminApiClient';

function axiosError(status: number, message = 'Request failed') {
  const error: any = new Error(message);
  error.response = { status, data: { message } };
  return error;
}

beforeEach(() => {
  mocks.dispatch.mockReset();
  mocks.refreshRequest.mockReset();
  mocks.getAuthToken.mockReset();
  mocks.setAuthToken.mockReset();
  mocks.client.request.mockClear();
  mocks.client.get.mockClear();
  mocks.client.post.mockClear();
  mocks.client.put.mockClear();
  mocks.client.patch.mockClear();
  mocks.client.delete.mockClear();
  localStorage.clear();
});

describe('adminApiClient authentication', () => {
  it('sends authenticated SEO requests with bearer token and cookie credentials', async () => {
    mocks.getAuthToken.mockReturnValue('current-token');
    mocks.dispatch.mockResolvedValueOnce({ data: { ok: true } });

    await adminApiClient.get('seo/audit/history');

    const config = mocks.dispatch.mock.calls[0][0];
    expect(config.url).toBe('seo/audit/history');
    expect(config.headers.Authorization).toBe('Bearer current-token');
    expect(config.withCredentials).toBe(true);
  });

  it('refreshes an expired token and retries the original SEO request once', async () => {
    mocks.getAuthToken.mockReturnValue('old-token');
    localStorage.setItem('admin_refresh_token', 'refresh-token');
    mocks.dispatch.mockRejectedValueOnce(axiosError(401, 'Token expired')).mockResolvedValueOnce({ data: { ok: true } });
    mocks.refreshRequest.mockResolvedValueOnce({ data: { accessToken: 'new-token' } });

    const response = await adminApiClient.get('seo/audit/history');

    expect(response.data.ok).toBe(true);
    expect(mocks.refreshRequest).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin-api/admin/refresh', method: 'POST', withCredentials: true, data: { refreshToken: 'refresh-token' } }));
    expect(mocks.setAuthToken).toHaveBeenCalledWith('new-token');
    expect(mocks.dispatch).toHaveBeenCalledTimes(2);
    expect(mocks.dispatch.mock.calls[1][0].headers.Authorization).toBe('Bearer new-token');
  });

  it('prevents multiple simultaneous refresh calls', async () => {
    mocks.getAuthToken.mockReturnValue('old-token');
    localStorage.setItem('admin_refresh_token', 'refresh-token');
    let refreshResolve: ((value: any) => void) | undefined;
    mocks.refreshRequest.mockImplementation(() => new Promise((resolve) => { refreshResolve = resolve; }));
    let requestCount = 0;
    mocks.dispatch.mockImplementation(async () => {
      requestCount += 1;
      if (requestCount <= 2) throw axiosError(401, 'Token expired');
      return { data: { ok: true } };
    });

    const first = adminApiClient.get('seo/audit/history');
    const second = adminApiClient.get('seo/audit/status');
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.refreshRequest).toHaveBeenCalledTimes(1);
    expect(mocks.refreshRequest).toHaveBeenCalledWith(expect.objectContaining({ url: '/admin-api/admin/refresh', data: { refreshToken: 'refresh-token' } }));
    refreshResolve?.({ data: { token: 'new-token' } });

    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(mocks.dispatch).toHaveBeenCalledTimes(4);
  });

  it('clears authentication and emits logout when refresh fails', async () => {
    mocks.getAuthToken.mockReturnValue('expired-token');
    localStorage.setItem('admin_refresh_token', 'bad-refresh-token');
    const logoutListener = vi.fn();
    window.addEventListener('np:logout', logoutListener);
    mocks.dispatch.mockRejectedValueOnce(axiosError(401, 'Token expired'));
    mocks.refreshRequest.mockRejectedValueOnce(axiosError(401, 'Refresh failed'));

    await expect(adminApiClient.get('seo/audit/history')).rejects.toMatchObject({ response: { status: 401 } });

    expect(mocks.setAuthToken).toHaveBeenCalledWith(null);
  expect(localStorage.getItem('admin_refresh_token')).toBeNull();
    expect(logoutListener).toHaveBeenCalledTimes(1);
    window.removeEventListener('np:logout', logoutListener);
  });

  it('keeps missing-token backend rejections as 401 after refresh fails', async () => {
    mocks.getAuthToken.mockReturnValue(null);
    mocks.dispatch.mockRejectedValueOnce(axiosError(401, 'Unauthorized'));
    mocks.refreshRequest.mockRejectedValueOnce(axiosError(401, 'Refresh failed'));

    await expect(adminApiClient.get('seo/audit/history')).rejects.toMatchObject({ response: { status: 401 } });

    expect(mocks.refreshRequest).toHaveBeenCalledTimes(1);
    expect(mocks.setAuthToken).toHaveBeenCalledWith(null);
  });

  it('does not convert SEO permission failures into refresh or session expiry', async () => {
    mocks.getAuthToken.mockReturnValue('valid-token');
    mocks.dispatch.mockRejectedValueOnce(axiosError(403, 'Forbidden'));

    await expect(adminApiClient.get('seo/audit/history')).rejects.toMatchObject({ response: { status: 403 } });

    expect(mocks.refreshRequest).not.toHaveBeenCalled();
    expect(mocks.setAuthToken).not.toHaveBeenCalledWith(null);
  });
});
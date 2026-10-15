import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api', () => ({
  getAuthToken: () => 'synthetic-access',
  hasLikelyAdminSession: () => true,
}));

const fetchMock = vi.fn<typeof fetch>();
const offline = vi.fn();
const logout = vi.fn();
const ownerKeyRequired = vi.fn();
const unreadPath = '/admin-api/ads/inquiries/unread-count';

function countResponse(count: number) {
  return new Response(JSON.stringify({ count }), { headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubEnv('VITE_ADMIN_API_BASE', '/admin-api');
  vi.stubEnv('VITE_ADMIN_API_URL', '/admin-api');
  vi.stubEnv('VITE_ADMIN_API_PROXY_BASE', '/admin-api');
  vi.stubGlobal('fetch', fetchMock);
  window.addEventListener('np:backend-offline', offline);
  window.addEventListener('np:logout', logout);
  window.addEventListener('np:ownerkey-required', ownerKeyRequired);
});

afterEach(() => {
  window.removeEventListener('np:backend-offline', offline);
  window.removeEventListener('np:logout', logout);
  window.removeEventListener('np:ownerkey-required', ownerKeyRequired);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('unread-count fetch authentication', () => {
  it('preserves the proxy URL, bearer header, cookies, and caller signal', async () => {
    fetchMock.mockResolvedValueOnce(countResponse(4));
    const controller = new AbortController();
    const { getAdInquiriesUnreadCount } = await import('../adsInquiriesApi');

    await expect(getAdInquiriesUnreadCount({ signal: controller.signal })).resolves.toBe(4);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(unreadPath, expect.objectContaining({
      method: 'GET', credentials: 'include', signal: controller.signal,
    }));
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers);
    expect(headers.get('Authorization')).toBe('Bearer synthetic-access');
  });

  it.each([401, 403, 419])('keeps a real HTTP %s as an error without a fake count or global logout', async (status) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'AUTH_REJECTED' }), {
      status, headers: { 'Content-Type': 'application/json' },
    }));
    const { getAdInquiriesUnreadCount } = await import('../adsInquiriesApi');

    await expect(getAdInquiriesUnreadCount()).rejects.toMatchObject({
      status,
      code: 'AUTH_REJECTED',
      url: unreadPath,
      message: status === 403
        ? 'Access denied. You do not have permission for this action.'
        : 'Your session has expired. Please sign in again.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logout).not.toHaveBeenCalled();
    expect(offline).not.toHaveBeenCalled();
    expect(ownerKeyRequired).toHaveBeenCalledTimes(status === 403 ? 1 : 0);
  });

  it('retains the existing logout rule for an admin-scoped 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } }));
    const { adminJson } = await import('../http/adminFetch');
    await expect(adminJson('/settings')).rejects.toMatchObject({ status: 401 });
    expect(logout).toHaveBeenCalledTimes(1);
    expect(offline).not.toHaveBeenCalled();
  });
});

describe('adminFetch cancellation', () => {
  it.each(['AbortError', 'custom abort reason'] as const)('passes through %s without offline handling or cooldown', async (kind) => {
    const controller = new AbortController();
    const reason = kind === 'AbortError' ? new DOMException('Aborted', 'AbortError') : new Error('Cancelled by caller');
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warningLog = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(reason), { once: true });
    }));
    const { getAdInquiriesUnreadCount } = await import('../adsInquiriesApi');
    const request = getAdInquiriesUnreadCount({ signal: controller.signal });
    const rejected = expect(request).rejects.toBe(reason);
    controller.abort(reason);
    await rejected;

    expect(offline).not.toHaveBeenCalled();
    expect(logout).not.toHaveBeenCalled();
    expect(errorLog).not.toHaveBeenCalled();
    expect(warningLog).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(countResponse(2));
    await expect(getAdInquiriesUnreadCount()).resolves.toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('recognizes AbortError even without a caller signal', async () => {
    const reason = new DOMException('Aborted', 'AbortError');
    fetchMock.mockRejectedValueOnce(reason);
    const { getAdInquiriesUnreadCount } = await import('../adsInquiriesApi');
    await expect(getAdInquiriesUnreadCount()).rejects.toBe(reason);
    expect(offline).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(countResponse(1));
    await expect(getAdInquiriesUnreadCount()).resolves.toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('still reports and cools down genuine network failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { getAdInquiriesUnreadCount } = await import('../adsInquiriesApi');
    await expect(getAdInquiriesUnreadCount()).rejects.toMatchObject({ status: 0, code: 'BACKEND_OFFLINE' });
    expect(offline).toHaveBeenCalledTimes(1);
    await expect(getAdInquiriesUnreadCount()).rejects.toMatchObject({ status: 0, code: 'BACKEND_OFFLINE', body: { blocked: true } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

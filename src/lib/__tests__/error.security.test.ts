import { afterEach, describe, expect, it, vi } from 'vitest';
import { normalizeError, safeErrorMessage } from '../error';

vi.mock('@/lib/api', () => ({
  getAuthToken: () => 'synthetic-access',
  hasLikelyAdminSession: () => true,
}));

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('safe API errors', () => {
  it.each([400, 403, 409, 429, 500])('does not surface arbitrary response content for HTTP %s', status => {
    const marker = 'synthetic-private-marker';
    const error = { message: marker, response: { status, data: { message: marker, details: marker, stack: marker } } };
    expect(safeErrorMessage(error, 'Request failed').includes(marker)).toBe(false);
    expect(normalizeError(error).message.includes(marker)).toBe(false);
  });

  it('preserves the established Founder denial message', () => {
    const message = 'Access Denied. Founder permission is required.';
    expect(safeErrorMessage({ response: { status: 403, data: { message } } }, 'Request failed')).toBe(message);
  });

  it.each(['application/json', 'text/html'])('does not display or log a %s backend error body', async contentType => {
    vi.resetModules();
    const marker = 'synthetic-private-marker';
    const spies = ['log', 'debug', 'warn', 'error'].map(method => vi.spyOn(console, method as 'log').mockImplementation(() => {}));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(contentType === 'application/json' ? JSON.stringify({ message: marker, stack: marker }) : `<pre>${marker}</pre>`, { status: 500, headers: { 'Content-Type': contentType } })));
    const { adminJson } = await import('../http/adminFetch');
    const error = await adminJson('/dpdp/privacy-requests').catch(error => error);
    expect(error.status).toBe(500);
    expect(error.message.includes(marker)).toBe(false);
    expect(spies.some(spy => JSON.stringify(spy.mock.calls).includes(marker))).toBe(false);
  });
});
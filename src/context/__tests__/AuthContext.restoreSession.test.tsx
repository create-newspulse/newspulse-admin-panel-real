import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  request: vi.fn(),
  setAuthToken: vi.fn(),
  clearEffectiveAccess: vi.fn(),
  clearFeatureVisibility: vi.fn(),
  likelySession: false,
  clearOwnerUnlock: vi.fn(),
}));

vi.mock('@/lib/adminApi', () => ({
  adminApi: { get: mocks.get, request: mocks.request, defaults: { baseURL: 'http://localhost:5173' } },
}));

vi.mock('@/lib/api', () => ({
  hasLikelyAdminSession: () => mocks.likelySession || Boolean(localStorage.getItem('admin_token')),
  setAuthToken: mocks.setAuthToken,
}));

vi.mock('@/lib/http/adminFetch', () => ({ ADMIN_API_BASE: '/admin-api' }));
vi.mock('@/lib/http', () => ({ clearOwnerUnlockToken: mocks.clearOwnerUnlock }));
vi.mock('@/hooks/useAdminEffectiveAccess', () => ({ clearAdminEffectiveAccessCache: mocks.clearEffectiveAccess }));
vi.mock('@/hooks/useAdminFeatureVisibility', () => ({ clearAdminFeatureVisibilityCache: mocks.clearFeatureVisibility }));

import AuthProvider, { useAuth } from '@/context/AuthContext';

function AuthState() {
  const auth = useAuth();
  const [error, setError] = useState('');
  return <><button onClick={() => void auth.login('', '').catch(error => setError(error.message))}>Login</button>
  <button onClick={() => auth.logout()}>Logout</button>
  <span>{error}</span><output>{JSON.stringify({
    resolved: auth.isSessionResolved,
    restoring: auth.isRestoring,
    authenticated: auth.isAuthenticated,
    role: auth.user?.role || null,
  })}</output></>;
}

function renderAuth(path = '/') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[path]}><AuthProvider><AuthState /></AuthProvider></MemoryRouter></QueryClientProvider>);
  return queryClient;
}

function currentState() {
  return JSON.parse(screen.getByRole('status').textContent || '{}');
}

describe('AuthProvider session restoration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.likelySession = false;
    localStorage.setItem('admin_token', 'cached-token');
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it.each(['founder', 'admin', 'editor'])('authenticates %s only after /me and clears local state on logout', async role => {
    localStorage.clear();
    mocks.request.mockResolvedValueOnce({ data: { ok: true, token: 'synthetic-access', refreshToken: 'synthetic-refresh', user: { id: 'test-user', role } } });
    mocks.get.mockResolvedValueOnce({ data: { user: { id: 'test-user', role } } });
    const queryClient = renderAuth('/login');
    fireEvent.click(screen.getByText('Login'));
    await waitFor(() => expect(currentState()).toMatchObject({ authenticated: true, role }));
    expect(Object.keys(JSON.parse(localStorage.getItem('newsPulseAdminAuth') || '{}'))).toEqual(['ts']);
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(currentState().resolved).toBe(true);
    queryClient.setQueryData(['synthetic-private-cache'], { note: 'synthetic-private-marker' });
    localStorage.setItem('np:dpdp-founder-review:synthetic', 'synthetic-private-marker');
    sessionStorage.setItem('cr:synthetic:name', 'synthetic-private-marker');
    sessionStorage.setItem('np_admin_password_changed', 'true');
    fireEvent.click(screen.getByText('Logout'));
    await waitFor(() => expect(currentState()).toMatchObject({ authenticated: false, role: null }));
    expect(['admin_token', 'admin_refresh_token', 'newsPulseAdminAuth'].every(key => localStorage.getItem(key) === null)).toBe(true);
    expect(mocks.setAuthToken).toHaveBeenLastCalledWith(null);
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(mocks.clearOwnerUnlock).toHaveBeenCalled();
    expect(localStorage.getItem('np:dpdp-founder-review:synthetic')).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it('rejects login when the authoritative session is revoked', async () => {
    localStorage.clear();
    mocks.request.mockResolvedValueOnce({ data: { ok: true, token: 'synthetic-access', user: { id: 'test-user', role: 'founder' } } });
    mocks.get.mockRejectedValueOnce({ response: { status: 401 } });
    renderAuth('/login');
    fireEvent.click(screen.getByText('Login'));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(localStorage.getItem('admin_token')).toBeNull());
    expect(currentState()).toMatchObject({ authenticated: false, role: null });
  });

  it('does not log login credentials, response payloads, or backend errors', async () => {
    localStorage.clear();
    const marker = 'synthetic-private-marker';
    const spies = ['log', 'debug', 'warn', 'error'].map(method => vi.spyOn(console, method as 'log').mockImplementation(() => {}));
    mocks.request.mockResolvedValueOnce({ data: { ok: true, token: marker, refreshToken: marker, user: { id: 'test-user', email: marker, role: 'editor' } } });
    mocks.get.mockResolvedValueOnce({ data: { user: { id: 'test-user', email: marker, role: 'editor' } } });
    renderAuth('/login');
    fireEvent.click(screen.getByText('Login'));
    await waitFor(() => expect(currentState().authenticated).toBe(true));
    fireEvent.click(screen.getByText('Logout'));
    mocks.request.mockRejectedValueOnce({ message: marker, response: { status: 500, data: { message: marker, details: marker } } });
    fireEvent.click(screen.getByText('Login'));
    await screen.findByText('Login failed. Please try again.');
    expect(document.body.textContent?.includes(marker)).toBe(false);
    expect(spies.some(spy => JSON.stringify(spy.mock.calls).includes(marker))).toBe(false);
  });

  it.each([
    ['founder', { user: { id: 'founder-id', email: 'founder@example.com', role: 'founder' } }],
    ['staff', { user: { id: 'staff-id', email: 'staff@example.com', role: 'editor' } }],
  ])('releases bootstrap after a successful %s /me response', async (_kind, payload) => {
    mocks.get.mockResolvedValueOnce({ data: payload });
    renderAuth();

    await waitFor(() => expect(currentState().resolved).toBe(true));
    expect(currentState()).toMatchObject({ restoring: false, authenticated: true, role: payload.user.role });
    expect(mocks.get).toHaveBeenCalledWith('/me', expect.objectContaining({ timeout: 10_000 }));
  }, 15_000);

  it.each([
    ['401 response', { response: { status: 401 } }],
    ['500 response', { response: { status: 500 } }],
    ['network failure', Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })],
  ])('clears cached credentials and releases bootstrap after a %s', async (_kind, error) => {
    mocks.get.mockRejectedValueOnce(error);
    renderAuth();

    await waitFor(() => expect(currentState().resolved).toBe(true));
    expect(currentState()).toMatchObject({ restoring: false, authenticated: false, role: null });
    expect(localStorage.getItem('admin_token')).toBeNull();
  });

  it('does not treat a stale cookie-session hint as authenticated after a 401', async () => {
    mocks.likelySession = true;
    localStorage.removeItem('admin_token');
    mocks.get.mockRejectedValueOnce({ response: { status: 401 } });
    renderAuth();

    await waitFor(() => expect(currentState().resolved).toBe(true));
    expect(mocks.get).toHaveBeenCalledWith('/me', expect.any(Object));
    expect(currentState()).toMatchObject({ restoring: false, authenticated: false, role: null });
  });

  it('does not trust a cached identity without a restorable session', async () => {
    localStorage.removeItem('admin_token');
    localStorage.setItem('newsPulseAdminAuth', JSON.stringify({ email: 'previous@example.com', role: 'founder', ts: Date.now() }));
    renderAuth();

    await waitFor(() => expect(currentState().resolved).toBe(true));
    expect(currentState()).toMatchObject({ authenticated: false, role: null });
    expect(mocks.get).not.toHaveBeenCalled();
  });
});
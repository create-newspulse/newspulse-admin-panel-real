import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  setAuthToken: vi.fn(),
  clearEffectiveAccess: vi.fn(),
  clearFeatureVisibility: vi.fn(),
  likelySession: false,
}));

vi.mock('@/lib/adminApi', () => ({
  adminApi: { get: mocks.get, defaults: { baseURL: 'http://localhost:5173' } },
}));

vi.mock('@/lib/api', () => ({
  hasLikelyAdminSession: () => mocks.likelySession || Boolean(localStorage.getItem('admin_token')),
  setAuthToken: mocks.setAuthToken,
}));

vi.mock('@/lib/http/adminFetch', () => ({ ADMIN_API_BASE: '/admin-api' }));
vi.mock('@/hooks/useAdminEffectiveAccess', () => ({ clearAdminEffectiveAccessCache: mocks.clearEffectiveAccess }));
vi.mock('@/hooks/useAdminFeatureVisibility', () => ({ clearAdminFeatureVisibilityCache: mocks.clearFeatureVisibility }));

import AuthProvider, { useAuth } from '@/context/AuthContext';

function AuthState() {
  const auth = useAuth();
  return <output>{JSON.stringify({
    resolved: auth.isSessionResolved,
    restoring: auth.isRestoring,
    authenticated: auth.isAuthenticated,
    role: auth.user?.role || null,
  })}</output>;
}

function renderAuth() {
  render(<MemoryRouter initialEntries={['/']}><AuthProvider><AuthState /></AuthProvider></MemoryRouter>);
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
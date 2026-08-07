import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Navbar from '@/components/Navbar';
import { clearAdminEffectiveAccessCache } from '@/hooks/useAdminEffectiveAccess';

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  authUser: { id: 'staff-1', email: 'staff-1@example.com', role: 'admin' },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: mocks.authUser,
    logout: vi.fn(),
  }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: mocks.authUser,
    logout: vi.fn(),
  }),
}));

vi.mock('@/context/DarkModeContext', () => ({
  useDarkMode: () => ({
    isDark: false,
    toggleDark: vi.fn(),
  }),
}));

vi.mock('../context/DarkModeContext', () => ({
  useDarkMode: () => ({
    isDark: false,
    toggleDark: vi.fn(),
  }),
}));

beforeEach(() => {
  mocks.authUser = { id: `staff-${Date.now()}-${Math.random()}`, email: 'staff@example.com', role: 'admin', moduleAccess: ['dashboard', 'manage_news'] };
  clearAdminEffectiveAccessCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearAdminEffectiveAccessCache();
});

describe('Navbar owner feature visibility', () => {
  it('renders confirmed Founder navigation without lock icons or staff access fetches', () => {
    mocks.authUser = { id: 'founder-1', email: 'founder@newspulse.co.in', role: 'founder' };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /add news/i })).toHaveAttribute('href', '/admin/add-news');
    expect(screen.getByRole('link', { name: /safe zone/i })).toHaveAttribute('href', '/admin/safe-owner-zone');
    expect(screen.getByRole('link', { name: /founder my account/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Locked module')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not flash locked modules while the authenticated user profile is restoring', () => {
    mocks.authUser = null as any;
    vi.stubGlobal('fetch', vi.fn());

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText('Locked module')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /add news/i })).not.toBeInTheDocument();
  });

  it('uses legacy visibility fallback by hiding hidden staff modules', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, visibility: { addNews: false, manageNews: true, complianceReports: false, settings: false } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    const manageNews = await screen.findByRole('link', { name: /manage news/i });

    expect(screen.queryByRole('link', { name: /add news/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/locked/i)).not.toBeInTheDocument();
    expect(manageNews).toHaveAttribute('href', '/admin/articles');
    expect(within(manageNews).queryByLabelText('Locked module')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /compliance reports/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /settings/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/safe-owner-zone/feature-visibility'), expect.anything());
  });

  it('shows icon-only locks and mapped denial messages for globally locked modules', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ success: true, modulePolicy: { add_news: 'staff_locked', manage_news: 'available' } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: /add news/i })).toHaveAttribute('aria-disabled', 'true'));
    const addNews = screen.getByRole('button', { name: /add news/i });
    expect(addNews).toHaveAttribute('aria-disabled', 'true');
    expect(within(addNews).getByLabelText('Locked module')).toBeInTheDocument();
    expect(within(addNews).getByTitle('This module is currently locked for all staff.')).toBeInTheDocument();
    expect(screen.queryByText(/locked/i)).not.toBeInTheDocument();
    fireEvent.click(addNews);
    expect(mocks.toastError).toHaveBeenCalledWith('This module is currently locked for all staff.');
  });

  it('does not flash locked modules while current-user access is still loading', async () => {
    let resolveFetch: (response: Response) => void = () => undefined;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal('fetch', vi.fn(() => fetchPromise));

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.queryByLabelText('Locked module')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dashboard/i })).not.toBeInTheDocument();

    await act(async () => {
      resolveFetch(new Response(JSON.stringify({ success: true, modulePolicy: { manage_news: 'available' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
      await fetchPromise;
    });

    expect(await screen.findByRole('link', { name: /manage news/i })).toBeInTheDocument();
  });

  it('renders Shailesh Add News without a lock from current-user effective access', async () => {
    mocks.authUser = {
      id: 'staff-3',
      email: 'shailesh.rathod@newspulse.co.in',
      role: 'editor',
      staffId: 'NP-2026-0003',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({
          success: true,
          access: {
            effectiveModuleAccess: {
              addNews: { allowed: true, visible: true, reasonCode: 'ALLOWED', globalState: 'available', individualState: 'enabled' },
              communityReporterQueue: { allowed: false, visible: true, reasonCode: 'GLOBAL_STAFF_LOCK', globalState: 'staff_locked', individualState: 'enabled' },
              dashboard: { allowed: true, visible: true, reasonCode: 'ALLOWED', globalState: 'available', individualState: 'enabled' },
              manageNews: { allowed: true, visible: true, reasonCode: 'ALLOWED', globalState: 'available', individualState: 'enabled' },
            },
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    const addNews = await screen.findByRole('link', { name: /add news/i });
    expect(addNews).toHaveAttribute('href', '/admin/add-news');
    expect(within(addNews).queryByLabelText('Locked module')).not.toBeInTheDocument();

    const queue = screen.getByRole('button', { name: /community reporter queue/i });
    expect(queue).toHaveAttribute('aria-disabled', 'true');
    expect(within(queue).getByLabelText('Locked module')).toBeInTheDocument();
  });

  it('switching Editor to Founder does not reuse Editor locked access', async () => {
    mocks.authUser = { id: 'editor-1', email: 'editor@newspulse.co.in', role: 'editor' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ success: true, modulePolicy: { add_news: 'staff_locked' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })),
    );

    const view = render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /add news/i })).toHaveAttribute('aria-disabled', 'true');

    mocks.authUser = { id: 'founder-1', email: 'founder@newspulse.co.in', role: 'founder' };
    view.rerender(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /add news/i })).toHaveAttribute('href', '/admin/add-news');
    expect(screen.getByRole('link', { name: /founder my account/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('Locked module')).not.toBeInTheDocument();
  });

  it('switching Founder to Editor does not reuse Founder unlocked access', async () => {
    mocks.authUser = { id: 'founder-1', email: 'founder@newspulse.co.in', role: 'founder' };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, modulePolicy: { add_news: 'staff_locked' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const view = render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /add news/i })).toHaveAttribute('href', '/admin/add-news');

    mocks.authUser = { id: 'editor-1', email: 'editor@newspulse.co.in', role: 'editor' };
    view.rerender(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Navbar />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('button', { name: /add news/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByRole('link', { name: /founder my account/i })).not.toBeInTheDocument();
  });
});
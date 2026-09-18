import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Navbar from '@/components/Navbar';
import { clearAdminEffectiveAccessCache } from '@/hooks/useAdminEffectiveAccess';

beforeEach(() => {
  clearAdminEffectiveAccessCache();
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      new Response(JSON.stringify({
        success: true,
        access: {
          effectiveModuleAccess: {
            dashboard: { allowed: true, visible: true, reasonCode: 'ALLOWED', globalState: 'available', individualState: 'enabled' },
            communityReporterQueue: { allowed: true, visible: true, reasonCode: 'ALLOWED', globalState: 'available', individualState: 'enabled' },
          },
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearAdminEffectiveAccessCache();
});

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'community-admin', email: 'community-admin@newspulse.co.in', role: 'admin', moduleAccess: ['dashboard', 'community_reporter_queue'] },
    logout: vi.fn(),
  }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: 'community-admin', email: 'community-admin@newspulse.co.in', role: 'admin', moduleAccess: ['dashboard', 'community_reporter_queue'] },
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

describe('Navbar community links', () => {
  it('hides Community Hub from the top navbar and keeps Community Reporter Queue', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: /community hub/i })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /community reporter queue/i })).toHaveAttribute('href', '/community/reporter');
  });
});
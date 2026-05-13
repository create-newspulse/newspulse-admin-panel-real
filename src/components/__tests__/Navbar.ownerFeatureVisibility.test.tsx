import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Navbar from '@/components/Navbar';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { role: 'admin' },
    logout: vi.fn(),
  }),
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { role: 'admin' },
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Navbar owner feature visibility', () => {
  it('hides disabled modules and Safe Zone for non-owner users', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ success: true, visibility: { addNews: false, manageNews: true, complianceReports: false, settings: false } }), {
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

    await waitFor(() => {
      expect(screen.queryByRole('link', { name: /add news/i })).not.toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: /manage news/i })).toHaveAttribute('href', '/admin/articles');
    expect(screen.queryByRole('link', { name: /compliance reports/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /settings/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /safe zone/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });
});
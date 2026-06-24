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
  it('shows disabled modules as locked for non-owner users', async () => {
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
      expect(screen.getByRole('button', { name: /add news/i })).toHaveAttribute('aria-disabled', 'true');
    });

    expect(screen.getByRole('link', { name: /manage news/i })).toHaveAttribute('href', '/admin/articles');
    expect(screen.getByRole('button', { name: /compliance reports/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /settings/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /safe zone/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });
});
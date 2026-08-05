import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Navbar from '@/components/Navbar';

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: mocks.toastError,
  },
}));

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
  it('shows locked modules with icon-only indicators and keeps them inaccessible', async () => {
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

    const addNews = screen.getByRole('button', { name: /add news/i });
    const manageNews = screen.getByRole('link', { name: /manage news/i });

    expect(within(addNews).getByLabelText('Locked module')).toBeInTheDocument();
    expect(within(addNews).getByTitle('Access restricted. Founder permission is required.')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Locked module').length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/locked/i)).not.toBeInTheDocument();
    expect(manageNews).toHaveAttribute('href', '/admin/articles');
    expect(within(manageNews).queryByLabelText('Locked module')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /compliance reports/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /settings/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /safe zone/i })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(addNews);
    expect(mocks.toastError).toHaveBeenCalledWith('Access Denied. Founder permission is required.');
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument();
  });
});
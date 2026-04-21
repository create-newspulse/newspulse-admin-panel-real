import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
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

describe('Navbar community links', () => {
  it('hides Community Hub from the top navbar and keeps Community Reporter Queue', () => {
    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <Navbar />
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: /community hub/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /community reporter queue/i })).toHaveAttribute('href', '/community/reporter');
  });
});
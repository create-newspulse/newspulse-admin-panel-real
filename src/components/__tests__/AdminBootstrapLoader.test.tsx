import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminBootstrapLoader, { AdminShellBootstrapGate } from '@/components/AdminBootstrapLoader';

describe('AdminBootstrapLoader', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a neutral app-level loading state without permission language', () => {
    render(<AdminBootstrapLoader />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByText('Loading News Pulse Admin')).toBeInTheDocument();
    expect(screen.queryByText(/Restoring session/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Access Denied/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Locked/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Founder permission/i)).not.toBeInTheDocument();
  });

  it('does not use an artificial loading delay', () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    render(<AdminBootstrapLoader />);

    expect(setTimeoutSpy).not.toHaveBeenCalled();
  });
});

describe('AdminShellBootstrapGate', () => {
  it('does not render navbar, breadcrumbs, locks, or protected content while auth is unresolved', () => {
    render(
      <AdminShellBootstrapGate pending>
        <nav>AdminNavbar</nav>
        <div>Home &gt; Dashboard</div>
        <svg aria-label="Locked module" />
        <main>Founder dashboard</main>
      </AdminShellBootstrapGate>,
    );

    expect(screen.getByText('Loading News Pulse Admin')).toBeInTheDocument();
    expect(screen.queryByText('AdminNavbar')).not.toBeInTheDocument();
    expect(screen.queryByText('Home > Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Locked module')).not.toBeInTheDocument();
    expect(screen.queryByText('Founder dashboard')).not.toBeInTheDocument();
  });

  it('renders the authenticated shell atomically after auth is ready', () => {
    render(
      <AdminShellBootstrapGate pending={false}>
        <nav>Founder Navbar</nav>
        <div>Home &gt; Dashboard</div>
        <main>Founder dashboard</main>
      </AdminShellBootstrapGate>,
    );

    expect(screen.queryByText('Loading News Pulse Admin')).not.toBeInTheDocument();
    expect(screen.getByText('Founder Navbar')).toBeInTheDocument();
    expect(screen.getByText('Home > Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Founder dashboard')).toBeInTheDocument();
  });
});

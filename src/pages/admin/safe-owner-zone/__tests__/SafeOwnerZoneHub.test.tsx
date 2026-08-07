import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminModuleRoute from '@/components/AdminModuleRoute';
import SafeOwnerZoneHub from '@/pages/admin/safe-owner-zone/SafeOwnerZoneHub';
import SafeOwnerZoneShell from '@/pages/admin/safe-owner-zone/SafeOwnerZoneShell';

const mocks = vi.hoisted(() => ({
  authUser: { id: 'founder-1', email: 'founder@newspulse.co.in', role: 'founder', moduleAccess: [] as string[] },
  getRecentAudit: vi.fn(),
}));

vi.mock('@context/AuthContext', () => ({
  useAuth: () => ({
    user: mocks.authUser,
    isAuthenticated: true,
    isFounder: String(mocks.authUser.role).toLowerCase() === 'founder',
    isLoading: false,
    isReady: true,
    isRestoring: false,
    restoreSession: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAdminEffectiveAccess', () => ({
  useAdminEffectiveAccess: () => ({
    modulePolicy: undefined,
    backendAccess: undefined,
    isLoading: false,
  }),
}));

vi.mock('@/api/ownerZone', () => ({
  getRecentAudit: mocks.getRecentAudit,
}));

afterEach(() => {
  vi.clearAllMocks();
  mocks.authUser = { id: 'founder-1', email: 'founder@newspulse.co.in', role: 'founder', moduleAccess: [] };
});

function renderSafeZone() {
  mocks.getRecentAudit.mockResolvedValue({ audit: [] });
  return render(
    <MemoryRouter initialEntries={['/admin/safe-owner-zone']}>
      <Routes>
        <Route path="/admin/safe-owner-zone" element={<SafeOwnerZoneShell />}>
          <Route index element={<SafeOwnerZoneHub />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('SafeOwnerZoneHub', () => {
  it('renders the Safe Zone heading and introduction once', async () => {
    renderSafeZone();

    expect(screen.getAllByRole('heading', { name: 'Safe Zone' })).toHaveLength(1);
    expect(screen.getByText('Founder-only emergency, recovery, audit and protection area.')).toBeInTheDocument();
    expect(screen.queryByText(/Preview only/i)).not.toBeInTheDocument();
    expect(await screen.findByText('No emergency actions recorded.')).toBeInTheDocument();
  });

  it('keeps normal module and staff access settings out of Safe Zone', async () => {
    renderSafeZone();

    expect(screen.queryByLabelText(/add news global state/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Available to Staff')).not.toBeInTheDocument();
    expect(screen.queryByText('Role Presets')).not.toBeInTheDocument();
    expect(screen.queryByText('Special Rights')).not.toBeInTheDocument();
    expect(screen.queryByText('Staff Access')).not.toBeInTheDocument();
    expect(await screen.findByText('No emergency actions recorded.')).toBeInTheDocument();
  });

  it('shows future emergency controls as inactive text only', async () => {
    renderSafeZone();

    expect(screen.getByRole('heading', { name: 'Emergency Controls' })).toBeInTheDocument();
    expect(screen.getByText('Emergency controls are not configured yet.')).toBeInTheDocument();
    expect(screen.getByText('Emergency Staff Lockdown')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Emergency Staff Lockdown/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Publishing Freeze/i })).not.toBeInTheDocument();
    expect(await screen.findByText('No emergency actions recorded.')).toBeInTheDocument();
  });

  it('does not display fake backup data', async () => {
    renderSafeZone();

    expect(screen.getByRole('heading', { name: 'Backup & Recovery' })).toBeInTheDocument();
    expect(screen.getByText('Backup and recovery status is not connected yet.')).toBeInTheDocument();
    expect(screen.queryByText(/last backup/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/backup successful/i)).not.toBeInTheDocument();
    expect(await screen.findByText('No emergency actions recorded.')).toBeInTheDocument();
  });

  it('links to Founder Access Control for normal module policy', async () => {
    renderSafeZone();

    const link = screen.getByRole('link', { name: 'Open Founder Access Control' });
    expect(link).toHaveAttribute('href', '/admin/settings/admin-panel/founder-access-control');
    expect(screen.getByText('Normal Admin Panel module availability, staff locks and Founder-only module policy are managed separately under Founder Access Control.')).toBeInTheDocument();
    expect(await screen.findByText('No emergency actions recorded.')).toBeInTheDocument();
  });

  it('shows real emergency audit events and an empty state when none exist', async () => {
    mocks.getRecentAudit.mockResolvedValueOnce({ audit: [{ id: 'audit-1', action: 'EMERGENCY_LOCKDOWN_STARTED', actor: 'founder@newspulse.co.in', reason: 'Security drill' }] });
    render(
      <MemoryRouter initialEntries={['/admin/safe-owner-zone']}>
        <Routes>
          <Route path="/admin/safe-owner-zone" element={<SafeOwnerZoneShell />}>
            <Route index element={<SafeOwnerZoneHub />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('EMERGENCY_LOCKDOWN_STARTED')).toBeInTheDocument();
    expect(screen.getByText('Actor: founder@newspulse.co.in')).toBeInTheDocument();
    expect(screen.getByText('Reason: Security drill')).toBeInTheDocument();
    expect(screen.queryByText('No emergency actions recorded.')).not.toBeInTheDocument();
  });

  it('keeps Safe Zone denied for non-Founder direct route access', async () => {
    mocks.authUser = { id: 'staff-1', email: 'staff@newspulse.co.in', role: 'admin', moduleAccess: ['safe_zone'] };
    mocks.getRecentAudit.mockResolvedValue({ audit: [] });

    render(
      <MemoryRouter initialEntries={['/admin/safe-owner-zone']}>
        <Routes>
          <Route
            path="/admin/safe-owner-zone"
            element={(
              <AdminModuleRoute moduleKey="safe_zone">
                <SafeOwnerZoneShell />
              </AdminModuleRoute>
            )}
          >
            <Route index element={<SafeOwnerZoneHub />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Access Denied')).toBeInTheDocument());
    expect(screen.getByText('This module is restricted to the Founder.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Safe Zone' })).not.toBeInTheDocument();
    expect(mocks.getRecentAudit).not.toHaveBeenCalled();
  });
});
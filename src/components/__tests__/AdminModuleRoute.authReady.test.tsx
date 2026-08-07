import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AdminModuleRoute from '@/components/AdminModuleRoute';

const mocks = vi.hoisted(() => ({
  auth: {
    user: null as any,
    isAuthenticated: true,
    isFounder: false,
    isLoading: false,
    isReady: true,
    isRestoring: false,
    restoreSession: vi.fn(),
  },
  effectiveAccess: {
    modulePolicy: undefined as any,
    backendAccess: undefined as any,
    isLoading: false,
  },
  useAdminEffectiveAccess: vi.fn(),
}));

vi.mock('@context/AuthContext', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('@/hooks/useAdminEffectiveAccess', () => ({
  useAdminEffectiveAccess: (options: any) => {
    mocks.useAdminEffectiveAccess(options);
    return mocks.effectiveAccess;
  },
}));

function renderRoute(moduleKey: any = 'safe_zone') {
  return render(
    <MemoryRouter initialEntries={['/admin/safe-owner-zone']}>
      <AdminModuleRoute moduleKey={moduleKey}>
        <div>Protected Founder Content</div>
      </AdminModuleRoute>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = null;
  mocks.auth.isAuthenticated = true;
  mocks.auth.isFounder = false;
  mocks.auth.isLoading = false;
  mocks.auth.isReady = true;
  mocks.auth.isRestoring = false;
  mocks.effectiveAccess.modulePolicy = undefined;
  mocks.effectiveAccess.backendAccess = undefined;
  mocks.effectiveAccess.isLoading = false;
});

describe('AdminModuleRoute auth/access readiness', () => {
  it('does not treat authenticated-but-unresolved user profile as Access Denied', () => {
    mocks.auth.user = { id: '', email: 'founder@newspulse.co.in', role: '' };

    renderRoute('safe_zone');

    expect(screen.getByText(/Loading News Pulse Admin/i)).toBeInTheDocument();
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    expect(screen.queryByText('Protected Founder Content')).not.toBeInTheDocument();
  });

  it('lets confirmed Founder direct refresh render protected content without staff access checks', () => {
    mocks.auth.user = { id: 'founder-1', email: 'founder@newspulse.co.in', role: 'founder' };
    mocks.auth.isFounder = true;

    renderRoute('safe_zone');

    expect(screen.getByText('Protected Founder Content')).toBeInTheDocument();
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
    expect(mocks.useAdminEffectiveAccess).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it('waits for staff effective access instead of denying during staff refresh', () => {
    mocks.auth.user = { id: 'staff-1', email: 'editor@newspulse.co.in', role: 'editor' };
    mocks.effectiveAccess.isLoading = true;

    renderRoute('add_news');

    expect(screen.getByText(/Loading News Pulse Admin/i)).toBeInTheDocument();
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
  });

  it('allows staff content only after effective access resolves allowed', () => {
    mocks.auth.user = { id: 'staff-1', email: 'editor@newspulse.co.in', role: 'editor' };
    mocks.effectiveAccess.modulePolicy = {
      add_news: { moduleKey: 'add_news', state: 'available' },
    };
    mocks.effectiveAccess.backendAccess = {
      add_news: {
        moduleKey: 'add_news',
        visible: true,
        allowed: true,
        locked: false,
        policyState: 'available',
        reasonCode: 'ALLOWED',
        reason: 'Allowed',
        individualAccess: 'enabled',
      },
    };

    renderRoute('add_news');

    expect(screen.getByText('Protected Founder Content')).toBeInTheDocument();
    expect(screen.queryByText('Access Denied')).not.toBeInTheDocument();
  });

  it('still denies genuinely locked staff modules after access resolves', () => {
    mocks.auth.user = { id: 'staff-1', email: 'editor@newspulse.co.in', role: 'editor' };
    mocks.effectiveAccess.modulePolicy = {
      community_reporter_queue: { moduleKey: 'community_reporter_queue', state: 'staff_locked' },
    };
    mocks.effectiveAccess.backendAccess = {
      community_reporter_queue: {
        moduleKey: 'community_reporter_queue',
        visible: true,
        allowed: false,
        locked: true,
        policyState: 'staff_locked',
        reasonCode: 'GLOBAL_STAFF_LOCK',
        reason: 'This module is currently locked for all staff.',
        individualAccess: 'enabled',
      },
    };

    renderRoute('community_reporter_queue');

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText('This module is currently locked for all staff.')).toBeInTheDocument();
  });
});

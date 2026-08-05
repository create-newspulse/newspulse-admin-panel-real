import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TeamManagement, { createAccessSnapshot, getStaffAccessSaveDisabledReason, hasStaffAccessChanges, type StaffAccessSnapshot } from '@/pages/admin/settings/admin-panel/TeamManagement';

const mocks = vi.hoisted(() => ({
  authUser: { id: 'founder-1', email: 'kiran@newspulse.co.in', role: 'founder' },
  getTeamUsers: vi.fn(),
  getTeamRoles: vi.fn(),
  getTeamTasks: vi.fn(),
  getNextTeamStaffIdPreview: vi.fn(),
  saveStaffAccessOverride: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  },
}));

vi.mock('@/pages/admin/settings/admin-panel/AuditLogsView', () => ({
  default: () => <div>Audit logs</div>,
}));

vi.mock('@/api/teamManagementApi', () => ({
  TEAM_ROLE_API_UNAVAILABLE_MESSAGE: 'Team role API is not available yet.',
  archiveUser: vi.fn(),
  changeTeamUserEmail: vi.fn(),
  createTeamRole: vi.fn(),
  createTeamTask: vi.fn(),
  createTeamUser: vi.fn(),
  deleteTestUserOnly: vi.fn(),
  extendAccessUser: vi.fn(),
  forceChangePasswordUser: vi.fn(),
  generateTemporaryPasswordUser: vi.fn(),
  getNextTeamStaffIdPreview: mocks.getNextTeamStaffIdPreview,
  getTeamRoles: mocks.getTeamRoles,
  getTeamTasks: mocks.getTeamTasks,
  getTeamUsers: mocks.getTeamUsers,
  isTeamApiUnauthorized: vi.fn(() => false),
  isTeamRoleApiUnavailable: vi.fn(() => false),
  lockUser: vi.fn(),
  logTeamApiError: vi.fn(),
  logoutAllTeamUserDevices: vi.fn(),
  markTestAccountUser: vi.fn(),
  reactivateUser: vi.fn(),
  resetPasswordUser: vi.fn(),
  restoreUser: vi.fn(),
  saveStaffAccessOverride: mocks.saveStaffAccessOverride,
  suspendUser: vi.fn(),
  toTeamApiErrorMessage: vi.fn((err: any, fallback: string) => err?.message || fallback),
  updateTeamRole: vi.fn(),
  updateTeamUser: vi.fn(),
}));

const initialSnapshot: StaffAccessSnapshot = createAccessSnapshot(['dashboard'], [], []);
const changedSnapshot: StaffAccessSnapshot = createAccessSnapshot([], [], []);

const staffUser = {
  id: 'staff-1',
  _id: 'staff-1',
  email: 'reporter@newspulse.co.in',
  fullName: 'Reporter One',
  staffId: 'NP-2026-0002',
  role: 'reporter',
  accountStatus: 'active',
  status: 'active',
  isActive: true,
  moduleAccess: ['dashboard'],
  specialRights: [],
};

function disabledReason(overrides: Partial<Parameters<typeof getStaffAccessSaveDisabledReason>[0]> = {}) {
  const currentAccessState = overrides.hasAccessChanges === false ? initialSnapshot : changedSnapshot;
  return getStaffAccessSaveDisabledReason({
    selectedStaffId: 'staff-1',
    selectedStaffIsFounder: false,
    isFounder: true,
    hasAccessChanges: hasStaffAccessChanges(initialSnapshot, currentAccessState),
    auditReason: 'Routine review',
    isSaving: false,
    ...overrides,
  });
}

async function renderAccessEditor() {
  render(
    <MemoryRouter initialEntries={['/admin/settings/admin-panel/team']}>
      <TeamManagement />
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole('button', { name: 'Staff Access & Special Rights' }));
  await waitFor(() => expect(screen.getAllByText('Reporter One').length).toBeGreaterThan(0));
  return screen.findByRole('button', { name: 'Save Access Changes' });
}

beforeEach(() => {
  mocks.authUser = { id: 'founder-1', email: 'kiran@newspulse.co.in', role: 'founder' };
  mocks.getTeamUsers.mockResolvedValue([staffUser]);
  mocks.getTeamRoles.mockResolvedValue([]);
  mocks.getTeamTasks.mockResolvedValue([]);
  mocks.getNextTeamStaffIdPreview.mockResolvedValue('NP-2026-0003');
  mocks.saveStaffAccessOverride.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TeamManagement staff access save validation', () => {
  it('disables save when no selected staff exists', () => {
    expect(disabledReason({ selectedStaffId: null })).toBe('Select a staff member.');
  });

  it('disables save when selected staff has no changes', () => {
    expect(disabledReason({ hasAccessChanges: false })).toBe('Make at least one access change.');
  });

  it('disables save when access changed without an audit reason', () => {
    expect(disabledReason({ auditReason: '' })).toBe('Enter an audit reason.');
  });

  it('enables save when selected staff has access changes and audit reason', () => {
    expect(disabledReason()).toBeNull();
  });

  it('keeps Founder accounts protected', () => {
    expect(disabledReason({ selectedStaffIsFounder: true })).toBe('Founder account is protected.');
  });

  it('returns to disabled when changes are reset to the saved snapshot', () => {
    expect(hasStaffAccessChanges(initialSnapshot, changedSnapshot)).toBe(true);
    expect(disabledReason({ hasAccessChanges: hasStaffAccessChanges(initialSnapshot, initialSnapshot) })).toBe('Make at least one access change.');
  });

  it('normalizes access values before comparing permissions', () => {
    const saved = createAccessSnapshot({ dashboard: 'enabled', safe_zone: 'disabled' }, { can_publish_news: true, can_delete_news: false }, []);
    const current = createAccessSnapshot(['dashboard'], ['can_publish_news'], []);

    expect(hasStaffAccessChanges(saved, current)).toBe(false);
  });
});

describe('TeamManagement staff access save button', () => {
  it('saves access changes through the existing API and disables again on success', async () => {
    const saveButton = await renderAccessEditor();
    expect(saveButton).toBeDisabled();

    const moduleControl = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    fireEvent.change(moduleControl, { target: { value: 'disabled' } });
    fireEvent.change(screen.getByLabelText('Audit Reason'), { target: { value: 'Routine access review' } });

    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mocks.saveStaffAccessOverride).toHaveBeenCalledWith('staff-1', expect.objectContaining({
        moduleAccess: [],
        specialRights: expect.any(Array),
        reason: 'Routine access review',
        temporaryGrants: [],
      }));
    });
    expect(await screen.findByText('Staff access updated successfully.')).toBeInTheDocument();
    await waitFor(() => expect(saveButton).toBeDisabled());
  });

  it('keeps unsaved selections visible and shows backend errors on failure', async () => {
    mocks.saveStaffAccessOverride.mockRejectedValueOnce(new Error('Backend rejected access change'));
    const saveButton = await renderAccessEditor();
    const moduleControl = screen.getAllByRole('combobox')[0] as HTMLSelectElement;

    fireEvent.change(moduleControl, { target: { value: 'disabled' } });
    fireEvent.change(screen.getByLabelText('Audit Reason'), { target: { value: 'Routine access review' } });
    fireEvent.click(saveButton);

    expect(await screen.findByText('Backend rejected access change')).toBeInTheDocument();
    expect(moduleControl.value).toBe('disabled');
    expect(screen.getByLabelText('Audit Reason')).toHaveValue('Routine access review');
  });
});
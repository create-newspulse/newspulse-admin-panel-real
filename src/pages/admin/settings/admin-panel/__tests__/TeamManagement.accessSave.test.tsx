import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TeamManagement, { createAccessSnapshot, getStaffAccessSaveDisabledReason, hasStaffAccessChanges, type StaffAccessSnapshot } from '@/pages/admin/settings/admin-panel/TeamManagement';

const mocks = vi.hoisted(() => ({
  authUser: { id: 'founder-1', email: 'kiran@newspulse.co.in', role: 'founder' },
  getTeamUsers: vi.fn(),
  getTeamRoles: vi.fn(),
  getTeamTasks: vi.fn(),
  getNextTeamStaffIdPreview: vi.fn(),
  createTeamRole: vi.fn(),
  createTeamUser: vi.fn(),
  saveStaffAccessOverride: vi.fn(),
  saveFounderDelegation: vi.fn(),
  clearAdminEffectiveAccessCache: vi.fn(),
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

vi.mock('@/hooks/useAdminEffectiveAccess', () => ({
  clearAdminEffectiveAccessCache: mocks.clearAdminEffectiveAccessCache,
}));

vi.mock('@/hooks/useFounderModulePolicy', () => ({
  useFounderModulePolicy: () => ({
    policy: {
      dashboard: { moduleKey: 'dashboard', state: 'available' },
      add_news: { moduleKey: 'add_news', state: 'available' },
    },
  }),
}));

vi.mock('@/api/teamManagementApi', () => ({
  TEAM_ROLE_API_UNAVAILABLE_MESSAGE: 'Team role API is not available yet.',
  archiveUser: vi.fn(),
  changeTeamUserEmail: vi.fn(),
  createTeamRole: mocks.createTeamRole,
  createTeamTask: vi.fn(),
  createTeamUser: mocks.createTeamUser,
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
  saveFounderDelegation: mocks.saveFounderDelegation,
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

const expiredStaffUser = {
  id: 'staff-3',
  _id: 'staff-3',
  email: 'shailesh.rathod@newspulse.co.in',
  fullName: 'Shailesh Rathod',
  staffId: 'NP-2026-0003',
  role: 'editor',
  position: 'Editorial Head',
  designation: 'Editorial Head',
  accountGroup: 'Staff Account / Newsroom Staff',
  accountStatus: 'expired',
  status: 'active',
  isActive: true,
  accessExpiryDate: '2026-01-01T00:00:00.000Z',
  moduleAccess: ['dashboard'],
  specialRights: ['can_publish_news'],
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

async function openRolePresets() {
  renderTeamRoute('/admin/settings/admin-panel/team');
  fireEvent.click(await screen.findByRole('button', { name: 'Role Presets' }));
  return screen.findByText('Save common permission suggestions for different staff jobs. A preset does not give access automatically. You review and approve each staff member\'s actual access separately.');
}

function renderTeamRoute(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/settings/admin-panel/team" element={<TeamManagement />} />
        <Route path="/admin/settings/admin-panel/team/create" element={<TeamManagement />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function goToCreateReviewStep() {
  fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
}

beforeEach(() => {
  mocks.authUser = { id: 'founder-1', email: 'kiran@newspulse.co.in', role: 'founder' };
  mocks.getTeamUsers.mockResolvedValue([staffUser]);
  mocks.getTeamRoles.mockResolvedValue([]);
  mocks.getTeamTasks.mockResolvedValue([]);
  mocks.getNextTeamStaffIdPreview.mockResolvedValue('NP-2026-0003');
  mocks.createTeamRole.mockResolvedValue({ ok: true });
  mocks.createTeamUser.mockResolvedValue({ temporaryPassword: 'Temp#12345', staffId: 'NP-2026-0003' });
  mocks.saveStaffAccessOverride.mockResolvedValue([]);
  mocks.saveFounderDelegation.mockResolvedValue({ ok: true });
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

    const moduleControl = screen.getAllByRole('combobox')[1] as HTMLSelectElement;
    fireEvent.change(moduleControl, { target: { value: 'enabled' } });
    fireEvent.change(screen.getByLabelText('Audit Reason'), { target: { value: 'Routine access review' } });

    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mocks.saveStaffAccessOverride).toHaveBeenCalledWith('staff-1', expect.objectContaining({
        moduleAccess: ['dashboard', 'add_news'],
        specialRights: expect.any(Array),
        reason: 'Routine access review',
        temporaryGrants: [],
      }));
    });
    expect(await screen.findByText('Staff access updated successfully.')).toBeInTheDocument();
    expect(mocks.clearAdminEffectiveAccessCache).toHaveBeenCalled();
    await waitFor(() => expect(saveButton).toBeDisabled());
  }, 20000);

  it('saves Ads Manager draft changes through the shared serializer without fixed modules', async () => {
    const { serializeStaffAccessPayload } = await import('@/lib/staffAccessSerializer');
    const payload = serializeStaffAccessPayload({
      moduleAccess: ['dashboard', 'ads_manager'],
      auditReason: 'Founder enabled Ads Manager for active staff',
    });

    expect(payload.moduleAccessStates).toEqual({ adsManager: 'enabled' });
    expect(payload.moduleAccessOverride).toEqual(['ads_manager']);
    expect(payload.moduleAccessStates).not.toHaveProperty('dashboard');
    expect(payload.moduleAccessStates).not.toHaveProperty('safeZone');
  });

  it('keeps unsaved selections visible and shows backend errors on failure', async () => {
    mocks.saveStaffAccessOverride.mockRejectedValueOnce(new Error('Backend rejected access change'));
    const saveButton = await renderAccessEditor();
    const moduleControl = screen.getAllByRole('combobox')[1] as HTMLSelectElement;

    fireEvent.change(moduleControl, { target: { value: 'enabled' } });
    fireEvent.change(screen.getByLabelText('Audit Reason'), { target: { value: 'Routine access review' } });
    fireEvent.click(saveButton);

    expect(await screen.findByText('Backend rejected access change')).toBeInTheDocument();
    expect(moduleControl.value).toBe('enabled');
    const addNewsRow = screen.getByText('Add News').closest('tr') as HTMLElement;
    expect(within(addNewsRow).getAllByText('Disabled').length).toBeGreaterThan(0);
    expect(within(addNewsRow).getByText('Locked')).toBeInTheDocument();
    expect(within(addNewsRow).getByText('Would become Allowed')).toBeInTheDocument();
    expect(screen.getByLabelText('Audit Reason')).toHaveValue('Routine access review');
  }, 15000);
});

describe('TeamManagement route organization', () => {
  it('/team renders Staff Control Center only', async () => {
    renderTeamRoute('/admin/settings/admin-panel/team');

    expect(await screen.findByRole('heading', { name: 'Staff Control Center' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Staff Account' })).toBeInTheDocument();
    expect(screen.queryByText('New Staff Account')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Full Name')).not.toBeInTheDocument();
  });

  it('Create Staff Account navigates to /team/create', async () => {
    renderTeamRoute('/admin/settings/admin-panel/team');

    fireEvent.click(await screen.findByRole('button', { name: 'Create Staff Account' }));

    expect(await screen.findByText('New Staff Account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to staff control center/i })).toBeInTheDocument();
  });

  it('/team/create renders the four-step creation wizard and protected Founder account option', async () => {
    renderTeamRoute('/admin/settings/admin-panel/team/create');

    expect(await screen.findByText('New Staff Account')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1\s*Account Type/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /2\s*Staff Details/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3\s*Role & Work/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /4\s*Password & Create/i })).toBeInTheDocument();
    expect(screen.getByText(/Founder account cannot be created here/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Founder Account/i })).toBeDisabled();
  });

  it('Back to Staff Control Center returns to /team', async () => {
    renderTeamRoute('/admin/settings/admin-panel/team/create');

    fireEvent.click(await screen.findByRole('button', { name: /back to staff control center/i }));

    expect(await screen.findByRole('heading', { name: 'Staff Control Center' })).toBeInTheDocument();
    expect(screen.queryByText('New Staff Account')).not.toBeInTheDocument();
  });

  it('keeps existing create validation on the dedicated page', async () => {
    renderTeamRoute('/admin/settings/admin-panel/team/create');
    await screen.findByText('New Staff Account');
    await goToCreateReviewStep();

    fireEvent.click(screen.getByRole('button', { name: 'Create Staff Account' }));

    expect(mocks.toastError).toHaveBeenCalledWith("Enter the team member's real name.");
    expect(mocks.createTeamUser).not.toHaveBeenCalled();
  });

  it('keeps the existing staff creation API payload shape', async () => {
    renderTeamRoute('/admin/settings/admin-panel/team/create');
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Reporter' } });
    fireEvent.change(screen.getByLabelText('Email / Login ID'), { target: { value: 'new.reporter@newspulse.co.in' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Staff Account' }));

    await waitFor(() => expect(mocks.createTeamUser).toHaveBeenCalledWith(expect.objectContaining({
      email: 'new.reporter@newspulse.co.in',
      fullName: 'New Reporter',
      accountGroup: 'Staff Account / Newsroom Staff',
      moduleAccess: expect.any(Array),
      specialRights: expect.any(Array),
      temporaryGrants: expect.any(Array),
      generateTemporaryPassword: true,
      mustChangePassword: true,
    })));
  }, 10000);

  it('successful creation shows next-action buttons', async () => {
    renderTeamRoute('/admin/settings/admin-panel/team/create');
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'New Reporter' } });
    fireEvent.change(screen.getByLabelText('Email / Login ID'), { target: { value: 'new.reporter@newspulse.co.in' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create Staff Account' }));

    expect(await screen.findByRole('button', { name: 'View Staff Profile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Configure Staff Access' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Another Staff Account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to Staff Control Center' })).toBeInTheDocument();
  }, 10000);

  it('unsaved create form data triggers a leave warning', async () => {
    renderTeamRoute('/admin/settings/admin-panel/team/create');
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Draft Staff' } });

    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });
});

describe('TeamManagement role presets', () => {
  it('renames Roles & Workflow to Role Presets and explains presets are suggestions only', async () => {
    await openRolePresets();

    expect(screen.getByText('Preset = suggestion only. Staff Access & Special Rights = actual permission.')).toBeInTheDocument();
    expect(screen.getByText('Founder')).toBeInTheDocument();
    expect(screen.getByText('Protected system role')).toBeInTheDocument();
    expect(screen.getByText('Not editable')).toBeInTheDocument();
    expect(screen.queryByText('Roles & Workflow')).not.toBeInTheDocument();
  });

  it('keeps role cards simple and removes duplicate access-control sections', async () => {
    await openRolePresets();

    expect(screen.getByLabelText('Preset Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Role Category')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeInTheDocument();
    expect(screen.getByText('Suggested Modules')).toBeInTheDocument();
    expect(screen.getByText('Suggested Actions')).toBeInTheDocument();
    expect(screen.queryByLabelText(/sort order/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Access Matrix')).not.toBeInTheDocument();
    expect(screen.queryByText('Apply Role Template to Staff')).not.toBeInTheDocument();
  });

  it('does not offer Founder-only or account-control permissions in presets', async () => {
    await openRolePresets();

    expect(screen.queryByLabelText('Safe Zone')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Settings')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Team Management')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Can control Founder account')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Can give/remove account-control rights')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Can reset staff password')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Can suspend account')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Can change bank details')).not.toBeInTheDocument();
  });

  it('groups suggested actions instead of showing one permission wall', async () => {
    await openRolePresets();

    ['Editorial', 'Live TV', 'Ads', 'Analytics', 'Finance', 'Compliance', 'Tasks'].forEach((group) => {
      expect(screen.getAllByText(group).length).toBeGreaterThan(0);
    });
  });

  it('saving a preset does not modify existing staff access', async () => {
    await openRolePresets();

    expect(screen.getByText('Changes to a preset affect future use only. Existing staff permissions remain unchanged.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Preset Name'), { target: { value: 'Reporter Preset' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Role Preset' }));

    await waitFor(() => expect(mocks.createTeamRole).toHaveBeenCalled());
    expect(mocks.saveStaffAccessOverride).not.toHaveBeenCalled();
    expect(mocks.createTeamUser).not.toHaveBeenCalled();
  });
});

describe('TeamManagement role preset suggestions in staff access', () => {
  it('loads matching preset suggestions into the unsaved Staff Access draft only', async () => {
    const saveButton = await renderAccessEditor();

    expect(screen.getByText('Role Preset')).toBeInTheDocument();
    expect(screen.getByText('Reporter Preset')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load Suggestions' })).toBeInTheDocument();
    expect(screen.getByText('Loads suggestions only. Nothing is saved yet.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Load Suggestions' }));

    expect(await screen.findByText('Suggestions loaded. Review the permissions below and save when ready.')).toBeInTheDocument();
    expect(mocks.saveStaffAccessOverride).not.toHaveBeenCalled();
    expect(saveButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Audit Reason'), { target: { value: 'Review reporter preset suggestions' } });
    await waitFor(() => expect(saveButton).toBeEnabled());
  });

  it('grants loaded suggestions only through Save Access Changes', async () => {
    const saveButton = await renderAccessEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Load Suggestions' }));
    expect(mocks.saveStaffAccessOverride).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Audit Reason'), { target: { value: 'Approve reporter preset suggestions' } });
    fireEvent.click(saveButton);

    await waitFor(() => expect(mocks.saveStaffAccessOverride).toHaveBeenCalledWith('staff-1', expect.objectContaining({
      moduleAccess: ['dashboard', 'add_news', 'draft_desk', 'media'],
      specialRights: ['can_pin_breaking_news'],
      reason: 'Approve reporter preset suggestions',
      temporaryGrants: [],
    })));
  }, 15000);

  it('keeps Role Presets inside the admin Staff Control Center and away from public website UI', async () => {
    await openRolePresets();

    expect(screen.getByRole('heading', { name: 'Staff Control Center' })).toBeInTheDocument();
    expect(screen.queryByText('Public Site Settings')).not.toBeInTheDocument();
    expect(screen.queryByText('Public Website')).not.toBeInTheDocument();
  });
});

describe('TeamManagement account lifecycle and founder delegation', () => {
  async function openAccountControlWith(users = [expiredStaffUser]) {
    mocks.getTeamUsers.mockResolvedValue(users);
    renderTeamRoute('/admin/settings/admin-panel/team');
    fireEvent.click(await screen.findByRole('button', { name: 'Account Control' }));
    await screen.findByText('STAFF IDENTITY');
  }

  it('shows expired staff with the original Staff ID and lifecycle notice', async () => {
    await openAccountControlWith([expiredStaffUser]);

    expect(screen.getAllByText('Shailesh Rathod').length).toBeGreaterThan(0);
    expect(screen.getAllByText('NP-2026-0003').length).toBeGreaterThan(0);
    expect(screen.getByText('Account access has expired. Login is disabled. Staff identity, Staff ID, permissions and audit history are preserved.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Extend + Reactivate' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reactivate + Reset Password' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep Expired' })).toBeInTheDocument();
    expect(screen.queryByText(/Duplicate Account|Create replacement Staff ID|New Staff ID/i)).not.toBeInTheDocument();
  });

  it('reactivation review supports No Expiry and preserves Staff ID', async () => {
    await openAccountControlWith([expiredStaffUser]);

    fireEvent.click(screen.getByRole('button', { name: 'Reactivate' }));

    expect(await screen.findByText('Reactivate Staff Account')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog', { name: 'Reactivate Staff Account' });
    expect(within(dialog).getByText(/Staff ID:/).parentElement).toHaveTextContent('NP-2026-0003');
    expect(within(dialog).getByLabelText('Access Duration')).toHaveValue('no_expiry');
    fireEvent.change(within(dialog).getByLabelText('Audit Reason'), { target: { value: 'Permanent staff reactivation' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Review Reactivation' }));

    expect(within(dialog).getByText('Staff ID remains unchanged.')).toBeInTheDocument();
    expect(within(dialog).getByText('Existing Staff Access remains stored.')).toBeInTheDocument();
    expect(within(dialog).getByText('Existing Special Rights remain stored.')).toBeInTheDocument();
    expect(within(dialog).getByText('Existing audit history remains stored.')).toBeInTheDocument();
  });

  it('shows Founder as protected with no invalid account actions', async () => {
    await openAccountControlWith([expiredStaffUser]);

    fireEvent.click(screen.getByRole('button', { name: /Founder Admin.*Protected/i }));

    expect(screen.getByText('Protected Founder Account')).toBeInTheDocument();
    expect(screen.getByText(/Permanent · No Expiry/)).toBeInTheDocument();
    const founderActions = screen.getByText('FOUNDER ACTIONS').closest('div')?.parentElement as HTMLElement;
    expect(within(founderActions).queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument();
    expect(within(founderActions).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
  });

  it('keeps Founder Delegation separate and saves only after review', async () => {
    await openAccountControlWith([expiredStaffUser, staffUser]);

    expect(screen.getByText('Founder Delegation')).toBeInTheDocument();
    expect(screen.getByText('Appoint a trusted staff member to manage selected staff-account functions without granting Founder status.')).toBeInTheDocument();
    expect(screen.getByLabelText('Appointed Staff')).not.toHaveTextContent('Founder Admin');
    expect(screen.getByLabelText('View Staff Registry')).toBeInTheDocument();
    expect(screen.getByLabelText('Extend Account Expiry')).toBeInTheDocument();
    expect(screen.getByText('Founder Only — Cannot Be Delegated')).toBeInTheDocument();
    expect(screen.getByText(/Modify Founder Account/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Appointed Staff'), { target: { value: 'staff-3' } });
    fireEvent.click(screen.getByLabelText('Extend Account Expiry'));
    fireEvent.click(screen.getByLabelText('Reactivate Expired Account'));
    fireEvent.click(screen.getByLabelText('Management Staff'));
    fireEvent.change(screen.getByLabelText('Audit Reason'), { target: { value: 'Trusted account-control backup' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review Delegation' }));
    expect(mocks.saveFounderDelegation).not.toHaveBeenCalled();

    expect(screen.getByText('Granted Rights: Extend Account Expiry, Reactivate Expired Account')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Delegation' }));

    await waitFor(() => expect(mocks.saveFounderDelegation).toHaveBeenCalledWith(expect.objectContaining({
      appointedStaffId: 'staff-3',
      rights: ['extend_account_expiry', 'reactivate_expired_account'],
      manageableAccountTypes: ['Management Staff'],
      validity: 'no_expiry',
      reason: 'Trusted account-control backup',
    })));
  }, 15000);

  it('delegated users only see permitted account-control actions', async () => {
    mocks.authUser = { id: 'delegate-1', email: 'delegate@newspulse.co.in', role: 'editor', permissions: ['extend_account_expiry'] } as any;
    await openAccountControlWith([expiredStaffUser]);

    expect(screen.queryByText('Founder Delegation')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Extend Access' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reactivate' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suspend' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Safe Zone/)).not.toBeInTheDocument();
  });

  it('failed delegation saves preserve form values', async () => {
    mocks.saveFounderDelegation.mockRejectedValueOnce(new Error('Delegation API rejected'));
    await openAccountControlWith([expiredStaffUser]);

    fireEvent.change(screen.getByLabelText('Appointed Staff'), { target: { value: 'staff-3' } });
    fireEvent.click(screen.getByLabelText('View Staff Registry'));
    fireEvent.click(screen.getByLabelText('Management Staff'));
    fireEvent.change(screen.getByLabelText('Audit Reason'), { target: { value: 'Temporary backup control' } });
    fireEvent.click(screen.getByRole('button', { name: 'Review Delegation' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Delegation' }));

    expect(await screen.findByText('Delegation API rejected')).toBeInTheDocument();
    expect(screen.getByLabelText('Appointed Staff')).toHaveValue('staff-3');
    expect(screen.getByLabelText('View Staff Registry')).toBeChecked();
    expect(screen.getByLabelText('Audit Reason')).toHaveValue('Temporary backup control');
  }, 15000);
});
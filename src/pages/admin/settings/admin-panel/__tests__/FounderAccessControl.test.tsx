import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import FounderRoute from '@/components/FounderRoute';
import FounderAccessControl from '@/pages/admin/settings/admin-panel/FounderAccessControl';
import { DEFAULT_ADMIN_MODULE_POLICY, createFounderOnlyModulePolicy, type AdminModulePolicyMap } from '@/lib/adminModulePolicy';

const apiMocks = vi.hoisted(() => ({
  authUser: { id: 'founder-1', email: 'founder@newspulse.co.in', role: 'founder' },
  isFounder: true,
  getFounderModulePolicySnapshot: vi.fn(),
  previewFounderModulePolicy: vi.fn(),
  putFounderModulePolicy: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@context/AuthContext', () => ({
  useAuth: () => ({
    user: apiMocks.authUser,
    isFounder: apiMocks.isFounder,
    isAuthenticated: true,
    isLoading: false,
    isReady: true,
    isRestoring: false,
    restoreSession: vi.fn(),
  }),
}));

vi.mock('@/api/ownerZone', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/ownerZone')>();
  return {
    ...actual,
    getFounderModulePolicySnapshot: apiMocks.getFounderModulePolicySnapshot,
    previewFounderModulePolicy: apiMocks.previewFounderModulePolicy,
    putFounderModulePolicy: apiMocks.putFounderModulePolicy,
  };
});

vi.mock('react-hot-toast', () => ({
  default: { success: apiMocks.toastSuccess, error: apiMocks.toastError },
  toast: { success: apiMocks.toastSuccess, error: apiMocks.toastError },
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  apiMocks.authUser = { id: 'founder-1', email: 'founder@newspulse.co.in', role: 'founder' };
  apiMocks.isFounder = true;
});

function mixedPolicy(): AdminModulePolicyMap {
  return {
    ...DEFAULT_ADMIN_MODULE_POLICY,
    add_news: { moduleKey: 'add_news', state: 'available' },
    manage_news: { moduleKey: 'manage_news', state: 'staff_locked' },
    draft_desk: { moduleKey: 'draft_desk', state: 'hidden' },
    seo: { moduleKey: 'seo', state: 'founder_only' },
  };
}

function summaryValue(label: string) {
  const labelElement = screen.getAllByText(label).find((item) => /^\d+/.test(item.parentElement?.textContent || ''));
  if (!labelElement?.parentElement) throw new Error(`Missing summary card for ${label}`);
  return labelElement.parentElement.textContent || '';
}

async function openBulkApplyDialog() {
  fireEvent.click(await screen.findByRole('button', { name: 'Set All Modules to Founder Only' }));
  const dialog = screen.getByRole('dialog', { name: 'Emergency Access Restriction' });
  expect(dialog).toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Continue to Typed Confirmation' }));
  return screen.getByRole('dialog', { name: 'Emergency Access Restriction' });
}

describe('FounderAccessControl', () => {
  it('shows mixed policy summary counts from the loaded policy', async () => {
    apiMocks.getFounderModulePolicySnapshot.mockResolvedValue(snapshot(mixedPolicy(), 13));
    render(<FounderAccessControl />);

    await screen.findByLabelText(/add news global state/i);

    await waitFor(() => expect(summaryValue('Available to Staff')).toMatch(/^1/));
    await waitFor(() => expect(summaryValue('Locked for Staff')).toMatch(/^1/));
    await waitFor(() => expect(summaryValue('Hidden from Staff')).toMatch(/^1/));
    await waitFor(() => expect(summaryValue('Founder Only')).toMatch(/^17/));
    expect(summaryValue('Unsaved Changes')).toMatch(/^0/);
    expect(screen.getByText('Policy version: 13')).toBeInTheDocument();
  });

  it('keeps module controls visible when the saved policy fails to load', async () => {
    apiMocks.getFounderModulePolicySnapshot.mockRejectedValue(new Error('Failed to load Founder module policy'));
    render(<FounderAccessControl />);

    expect(await screen.findByLabelText(/add news global state/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set All Modules to Founder Only' })).toBeInTheDocument();
    expect(await screen.findByText('Failed to load Founder module policy')).toBeInTheDocument();
  });

  it('requires an audit reason before review and save', async () => {
    apiMocks.getFounderModulePolicySnapshot.mockResolvedValue(snapshot(DEFAULT_ADMIN_MODULE_POLICY, 13));
    render(<FounderAccessControl />);

    const addNews = await screen.findByLabelText(/add news global state/i);
    await waitFor(() => expect(screen.queryByText(/Loading saved Founder access policy/i)).not.toBeInTheDocument());
    fireEvent.change(addNews, { target: { value: 'staff_locked' } });
    expect(screen.getByRole('button', { name: /save founder policy/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }));

    expect(await screen.findByText(/audit reason is required/i)).toBeInTheDocument();
    expect(apiMocks.previewFounderModulePolicy).not.toHaveBeenCalled();
    expect(apiMocks.putFounderModulePolicy).not.toHaveBeenCalled();
  });

  it('disables save when the backend version is missing', async () => {
    apiMocks.getFounderModulePolicySnapshot.mockRejectedValue(new Error('Founder policy version could not be loaded. Refresh the latest policy.'));
    render(<FounderAccessControl />);

    const addNews = await screen.findByLabelText(/add news global state/i);
    expect(await screen.findByText('Founder policy version could not be loaded. Refresh the latest policy.')).toBeInTheDocument();
    expect(addNews).toBeDisabled();
    expect(screen.getByRole('button', { name: /save founder policy/i })).toBeDisabled();
    expect(screen.getByText('Policy version: Unavailable')).toBeInTheDocument();
  });

  it('saves with loaded expectedVersion and uses the returned incremented version on the second save', async () => {
    const initial = mixedPolicy();
    const savedOnce = { ...initial, add_news: { moduleKey: 'add_news' as const, state: 'staff_locked' as const } };
    const savedTwice = { ...savedOnce, manage_news: { moduleKey: 'manage_news' as const, state: 'available' as const } };
    apiMocks.getFounderModulePolicySnapshot.mockResolvedValue(snapshot(initial, 13));
    apiMocks.previewFounderModulePolicy.mockResolvedValue({ ok: true });
    apiMocks.putFounderModulePolicy
      .mockResolvedValueOnce(snapshot(savedOnce, 14))
      .mockResolvedValueOnce(snapshot(savedTwice, 15));
    render(<FounderAccessControl />);

    const addNews = await screen.findByLabelText(/add news global state/i) as HTMLSelectElement;
    fireEvent.change(addNews, { target: { value: 'staff_locked' } });
    fireEvent.change(screen.getByLabelText(/audit reason/i), { target: { value: 'First version save' } });
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }));
    await screen.findByText(/Add News:/);
    fireEvent.click(screen.getByRole('button', { name: /save founder policy/i }));

    await waitFor(() => expect(apiMocks.putFounderModulePolicy).toHaveBeenCalledWith(expect.objectContaining({
      expectedVersion: 13,
      auditReason: 'First version save',
      modulePolicies: { addNews: 'staff_locked' },
    })));
    expect(await screen.findByText('Policy version: 14')).toBeInTheDocument();

    const manageNews = screen.getByLabelText(/manage news global state/i) as HTMLSelectElement;
    fireEvent.change(manageNews, { target: { value: 'available' } });
    fireEvent.change(screen.getByLabelText(/audit reason/i), { target: { value: 'Second version save' } });
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }));
    await screen.findByText(/Manage News:/);
    fireEvent.click(screen.getByRole('button', { name: /save founder policy/i }));

    await waitFor(() => expect(apiMocks.putFounderModulePolicy).toHaveBeenLastCalledWith(expect.objectContaining({
      expectedVersion: 14,
      auditReason: 'Second version save',
      modulePolicies: { manageNews: 'available' },
    })));
  }, 15000);

  it('preview uses the same loaded version and reset does not change it', async () => {
    apiMocks.getFounderModulePolicySnapshot.mockResolvedValue(snapshot(mixedPolicy(), 13));
    apiMocks.previewFounderModulePolicy.mockResolvedValue({ ok: true });
    render(<FounderAccessControl />);

    const addNews = await screen.findByLabelText(/add news global state/i) as HTMLSelectElement;
    fireEvent.change(addNews, { target: { value: 'staff_locked' } });
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }));

    fireEvent.change(screen.getByLabelText(/audit reason/i), { target: { value: 'Preview audit reason' } });
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }));

    await waitFor(() => expect(apiMocks.previewFounderModulePolicy).toHaveBeenCalledWith(expect.objectContaining({
      expectedVersion: 13,
      auditReason: 'Preview audit reason',
      modulePolicies: { addNews: 'staff_locked' },
    })));
    fireEvent.click(screen.getByRole('button', { name: /reset changes/i }));
    expect(screen.getByText('Policy version: 13')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save founder policy/i })).toBeDisabled();
  });

  it('preserves unsaved changes and surfaces backend errors after failed save', async () => {
    apiMocks.getFounderModulePolicySnapshot.mockResolvedValue(snapshot(DEFAULT_ADMIN_MODULE_POLICY, 13));
    apiMocks.previewFounderModulePolicy.mockResolvedValue({ ok: true });
    apiMocks.putFounderModulePolicy.mockRejectedValue(new Error('Backend policy write failed'));
    render(<FounderAccessControl />);

    const addNews = await screen.findByLabelText(/add news global state/i) as HTMLSelectElement;
    fireEvent.change(addNews, { target: { value: 'staff_locked' } });
    fireEvent.change(screen.getByLabelText(/audit reason/i), { target: { value: 'Founder rollout test' } });
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }));
    await screen.findByText(/Add News:/);
    fireEvent.click(screen.getByRole('button', { name: /save founder policy/i }));

    await waitFor(() => expect(apiMocks.toastError).toHaveBeenCalledWith('Backend policy write failed'));
    expect(addNews.value).toBe('staff_locked');
    expect(screen.getByText('Backend policy write failed')).toBeInTheDocument();
  });

  it('does not enable save before a successful review and invalidates review after another dropdown change', async () => {
    apiMocks.getFounderModulePolicySnapshot.mockResolvedValue(snapshot(mixedPolicy(), 13));
    apiMocks.previewFounderModulePolicy.mockResolvedValue({ ok: true });
    render(<FounderAccessControl />);

    const addNews = await screen.findByLabelText(/add news global state/i) as HTMLSelectElement;
    fireEvent.change(addNews, { target: { value: 'staff_locked' } });
    fireEvent.change(screen.getByLabelText(/audit reason/i), { target: { value: 'Review invalidation test' } });

    expect(screen.getByRole('button', { name: /save founder policy/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }));
    await screen.findByText(/Add News:/);
    expect(screen.getByRole('button', { name: /save founder policy/i })).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText(/manage news global state/i), { target: { value: 'available' } });
    expect(screen.getByRole('button', { name: /save founder policy/i })).toBeDisabled();
    expect(apiMocks.putFounderModulePolicy).not.toHaveBeenCalled();
  });

  it('shows backend-contract validation errors without falsely showing success', async () => {
    apiMocks.getFounderModulePolicySnapshot.mockResolvedValue(snapshot(mixedPolicy(), 13));
    apiMocks.previewFounderModulePolicy.mockRejectedValue({ status: 400, body: { code: 'MODULE_POLICY_VALIDATION_FAILED', message: 'Invalid module policy payload' } });
    render(<FounderAccessControl />);

    const addNews = await screen.findByLabelText(/add news global state/i) as HTMLSelectElement;
    fireEvent.change(addNews, { target: { value: 'staff_locked' } });
    fireEvent.change(screen.getByLabelText(/audit reason/i), { target: { value: 'Invalid payload test' } });
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }));

    expect(await screen.findByText('The Founder policy data did not match the backend contract.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save founder policy/i })).toBeDisabled();
    expect(apiMocks.toastSuccess).not.toHaveBeenCalled();
    expect(apiMocks.putFounderModulePolicy).not.toHaveBeenCalled();
  });

  it('409 conflict never overwrites unsaved changes and offers review or refresh actions', async () => {
    apiMocks.getFounderModulePolicySnapshot.mockResolvedValue(snapshot(mixedPolicy(), 13));
    apiMocks.previewFounderModulePolicy.mockResolvedValue({ ok: true });
    apiMocks.putFounderModulePolicy.mockRejectedValue({ status: 409, body: { code: 'MODULE_POLICY_VERSION_CONFLICT' } });
    render(<FounderAccessControl />);

    const addNews = await screen.findByLabelText(/add news global state/i) as HTMLSelectElement;
    fireEvent.change(addNews, { target: { value: 'staff_locked' } });
    fireEvent.change(screen.getByLabelText(/audit reason/i), { target: { value: 'Conflict test save' } });
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }));
    await screen.findByText(/Add News:/);
    fireEvent.click(screen.getByRole('button', { name: /save founder policy/i }));

    expect(await screen.findByText('Founder Access Control changed since this page was loaded. Refresh the latest policy.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review My Unsaved Changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh Latest Policy' })).toBeInTheDocument();
    expect(addNews.value).toBe('staff_locked');
  }, 15000);

  it('refresh loads policy and version as one snapshot after warning before discarding changes', async () => {
    const latest = { ...mixedPolicy(), add_news: { moduleKey: 'add_news' as const, state: 'hidden' as const } };
    apiMocks.getFounderModulePolicySnapshot
      .mockResolvedValueOnce(snapshot(mixedPolicy(), 13))
      .mockResolvedValueOnce(snapshot(latest, 16));
    apiMocks.previewFounderModulePolicy.mockResolvedValue({ ok: true });
    apiMocks.putFounderModulePolicy.mockRejectedValue({ status: 409, body: { code: 'MODULE_POLICY_VERSION_CONFLICT' } });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<FounderAccessControl />);

    const addNews = await screen.findByLabelText(/add news global state/i) as HTMLSelectElement;
    fireEvent.change(addNews, { target: { value: 'staff_locked' } });
    fireEvent.change(screen.getByLabelText(/audit reason/i), { target: { value: 'Conflict refresh test' } });
    fireEvent.click(screen.getByRole('button', { name: /review changes/i }));
    await screen.findByText(/Add News:/);
    fireEvent.click(screen.getByRole('button', { name: /save founder policy/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Refresh Latest Policy' }));

    await waitFor(() => expect(apiMocks.getFounderModulePolicySnapshot).toHaveBeenLastCalledWith({ force: true }));
    expect(await screen.findByText('Policy version: 16')).toBeInTheDocument();
    expect((screen.getByLabelText(/add news global state/i) as HTMLSelectElement).value).toBe('hidden');
  }, 15000);

  it('keeps current settings when the bulk Founder-only dialog is cancelled', async () => {
    apiMocks.getFounderModulePolicySnapshot.mockResolvedValue(snapshot(mixedPolicy(), 13));
    apiMocks.previewFounderModulePolicy.mockResolvedValue({ ok: true });
    render(<FounderAccessControl />);

    const addNews = await screen.findByLabelText(/add news global state/i) as HTMLSelectElement;
    const manageNews = screen.getByLabelText(/manage news global state/i) as HTMLSelectElement;
    fireEvent.click(screen.getByRole('button', { name: 'Set All Modules to Founder Only' }));
    const dialog = screen.getByRole('dialog', { name: 'Emergency Access Restriction' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(addNews.value).toBe('available');
    expect(manageNews.value).toBe('staff_locked');
    expect(summaryValue('Unsaved Changes')).toMatch(/^0/);
    expect(apiMocks.putFounderModulePolicy).not.toHaveBeenCalled();
  });

  it('validates and applies the bulk Founder-only typed confirmation without changing fixed controls', async () => {
    apiMocks.getFounderModulePolicySnapshot.mockResolvedValue(snapshot(mixedPolicy(), 13));
    apiMocks.previewFounderModulePolicy.mockResolvedValue({ ok: true });
    apiMocks.putFounderModulePolicy.mockResolvedValue(snapshot(createFounderOnlyModulePolicy(mixedPolicy()), 14));
    render(<FounderAccessControl />);

    let dialog = await openBulkApplyDialog();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));

    expect(await within(dialog).findByText('Audit Reason is required.')).toBeInTheDocument();
    expect(within(dialog).getByText('Typed confirmation must match exactly.')).toBeInTheDocument();
    expect(apiMocks.putFounderModulePolicy).not.toHaveBeenCalled();

    const [auditReasonField, typedConfirmationField] = within(dialog).getAllByRole('textbox');
    fireEvent.change(auditReasonField, { target: { value: 'Emergency founder restriction' } });
    fireEvent.change(typedConfirmationField, { target: { value: 'SET ALL MODULES FOUNDER ONLY' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(apiMocks.putFounderModulePolicy).toHaveBeenCalledTimes(1));
    const [payload] = apiMocks.putFounderModulePolicy.mock.calls[0];
    expect(payload.auditReason).toBe('Emergency founder restriction');
    expect(payload.expectedVersion).toBe(13);
    expect(Object.values(payload.modulePolicies).every((state) => state === 'founder_only')).toBe(true);
    expect(payload.modulePolicies).not.toHaveProperty('dashboard');
    expect(payload.modulePolicies).not.toHaveProperty('safeZone');
    expect(apiMocks.previewFounderModulePolicy).toHaveBeenCalledWith(payload);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Emergency Access Restriction' })).not.toBeInTheDocument());
  });

  it('keeps Founder authorization required before loading policy management', async () => {
    apiMocks.authUser = { id: 'staff-1', email: 'staff@newspulse.co.in', role: 'editor' };
    apiMocks.isFounder = false;
    render(
      <MemoryRouter initialEntries={['/admin/settings/admin-panel/founder-access-control']}>
        <Routes>
          <Route path="/admin/settings/admin-panel/founder-access-control" element={<FounderRoute><FounderAccessControl /></FounderRoute>} />
          <Route path="/unauthorized" element={<div>Unauthorized</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('Unauthorized')).toBeInTheDocument();
    expect(apiMocks.getFounderModulePolicySnapshot).not.toHaveBeenCalled();
  });
});

function snapshot(policy: AdminModulePolicyMap, version = 13) {
  return { policy, version };
}
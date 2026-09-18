import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ComplianceReportsPage from '@/pages/admin/ComplianceReportsPage';
import {
  DEFAULT_COMPLIANCE_SETTINGS,
  getComplianceSettings,
  renewSrbRegistration,
  updateComplianceSettings,
  type ComplianceSettings,
} from '@/lib/adminComplianceSettingsApi';

const mocks = vi.hoisted(() => ({
  savedComplianceSettings: undefined as ComplianceSettings | undefined,
  authUser: { id: 'staff-1', email: 'staff@example.com', role: 'admin' },
  getComplianceSettings: vi.fn(),
  renewSrbRegistration: vi.fn(),
  updateComplianceSettings: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/adminComplianceSettingsApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/adminComplianceSettingsApi')>();
  return {
    ...actual,
    getComplianceSettings: mocks.getComplianceSettings,
    renewSrbRegistration: mocks.renewSrbRegistration,
    updateComplianceSettings: mocks.updateComplianceSettings,
  };
});

vi.mock('@/lib/adminComplianceReportsApi', () => ({
  createComplianceReport: vi.fn(),
  deleteComplianceReport: vi.fn(),
  listComplianceReports: vi.fn(async () => []),
  updateComplianceReport: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isFounder: String(mocks.authUser.role || '').toLowerCase() === 'founder',
    user: mocks.authUser,
    logout: vi.fn(),
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
  mocks.savedComplianceSettings = undefined;
  mocks.authUser = { id: 'staff-1', email: 'staff@example.com', role: 'admin' };
});

describe('ComplianceReportsPage SRB registration display', () => {
  function mockSavedComplianceSettings(settings: ComplianceSettings = DEFAULT_COMPLIANCE_SETTINGS) {
    mocks.savedComplianceSettings = JSON.parse(JSON.stringify(settings));
    mocks.getComplianceSettings.mockImplementation(async () => mocks.savedComplianceSettings);
    mocks.updateComplianceSettings.mockImplementation(async (input: ComplianceSettings) => {
      mocks.savedComplianceSettings = JSON.parse(JSON.stringify(input));
      return input;
    });
    mocks.renewSrbRegistration.mockImplementation(async (input: ComplianceSettings) => {
      mocks.savedComplianceSettings = JSON.parse(JSON.stringify(input));
      return input;
    });
  }

  function mockFounder() {
    mocks.authUser = { id: 'founder-1', email: 'founder@example.com', role: 'founder' };
  }

  it('keeps Level II SRB registration read-only for non-Founder staff', async () => {
    mockSavedComplianceSettings();

    render(<ComplianceReportsPage />);

    await screen.findByText('No monthly compliance reports found yet.');

    const heading = screen.getByRole('heading', { name: 'Level II – Self-Regulatory Body' });
    const section = heading.closest('section');

    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByText('Working Journalist Media Council (WJMC)')).toBeInTheDocument();
    expect(within(section as HTMLElement).getByText('News Pulse (Digital)')).toBeInTheDocument();
    expect(within(section as HTMLElement).getByText('Registered')).toBeInTheDocument();
    expect(within(section as HTMLElement).getByText('WJMC/7489/462-26')).toBeInTheDocument();
    expect(within(section as HTMLElement).getByText('14-09-2026')).toBeInTheDocument();
    expect(within(section as HTMLElement).getByText('14-09-2027')).toBeInTheDocument();
    expect(within(section as HTMLElement).queryByText('14 September 2026')).not.toBeInTheDocument();
    expect(within(section as HTMLElement).getByText(/is registered with/i).textContent).toContain('Working Journalist Media Council');
    expect(within(section as HTMLElement).getByText('Read-only')).toBeInTheDocument();
    expect(within(section as HTMLElement).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(section as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
    expect(within(section as HTMLElement).queryByText('SRB Registration History')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue(DEFAULT_COMPLIANCE_SETTINGS.publisherEntity)).toBeInTheDocument();
    expect(screen.queryByLabelText('Location')).not.toBeInTheDocument();
    expect(screen.getByText('Grievance Officer and Official Grievance Email are always shown on the public Grievance Redressal page for compliance clarity.')).toBeInTheDocument();
  });

  it('shows Founder edit controls for the existing SRB section', async () => {
    mockFounder();
    mockSavedComplianceSettings();

    render(<ComplianceReportsPage />);

    await screen.findByText('No monthly compliance reports found yet.');

    const section = screen.getByRole('heading', { name: 'Level II – Self-Regulatory Body' }).closest('section') as HTMLElement;
    expect(within(section).getByText('Editable')).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(section).getByRole('button', { name: 'Renew / Replace Registration' })).toBeInTheDocument();
    expect(within(section).getByText('SRB Registration History')).toBeInTheDocument();

    fireEvent.click(within(section).getByRole('button', { name: 'Edit' }));
    expect(within(section).getByLabelText('Issue Date')).toHaveValue('14-09-2026');
    expect(within(section).getByLabelText('Valid Until')).toHaveValue('14-09-2027');
  });

  it('allows Founder to save current SRB values through compliance settings', async () => {
    mockFounder();
    mockSavedComplianceSettings();

    render(<ComplianceReportsPage />);

    await screen.findByText('No monthly compliance reports found yet.');
    const section = screen.getByRole('heading', { name: 'Level II – Self-Regulatory Body' }).closest('section') as HTMLElement;

    fireEvent.click(within(section).getByRole('button', { name: 'Edit' }));
    fireEvent.change(within(section).getByLabelText('Organization'), {
      target: { value: 'Working Journalist Media Council - Updated' },
    });
    fireEvent.click(within(section).getByRole('button', { name: 'Save SRB Details' }));

    await waitFor(() => expect(updateComplianceSettings).toHaveBeenCalledTimes(1));
    const savedPayload = vi.mocked(updateComplianceSettings).mock.calls[0][0] as ComplianceSettings & { srbRegistrationAction?: string };
    expect(savedPayload).toEqual(expect.objectContaining({
      srbRegistration: expect.objectContaining({
        organization: 'Working Journalist Media Council - Updated',
        publisher: 'News Pulse (Digital)',
        registrationNumber: 'WJMC/7489/462-26',
        issueDate: '2026-09-14',
        validUntil: '2027-09-14',
      }),
      srbRegistrationHistory: [],
      showPublisherEntity: true,
      showFounderPublisher: false,
      showChiefEditor: true,
    }));
    expect(savedPayload).not.toHaveProperty('srbRegistrationAction');
    expect(savedPayload.srbRegistration).not.toHaveProperty('registrationNo');
  });

  it('restores current saved SRB values when Founder cancels editing', async () => {
    mockFounder();
    mockSavedComplianceSettings();

    render(<ComplianceReportsPage />);

    await screen.findByText('No monthly compliance reports found yet.');
    const section = screen.getByRole('heading', { name: 'Level II – Self-Regulatory Body' }).closest('section') as HTMLElement;

    fireEvent.click(within(section).getByRole('button', { name: 'Edit' }));
    fireEvent.change(within(section).getByLabelText('Registration No.'), {
      target: { value: 'UNSAVED-SRB' },
    });
    fireEvent.click(within(section).getByRole('button', { name: 'Cancel' }));

    expect(within(section).queryByText('UNSAVED-SRB')).not.toBeInTheDocument();
    expect(within(section).getByText('WJMC/7489/462-26')).toBeInTheDocument();
  });

  it('allows Founder to renew or replace SRB registration through backend history', async () => {
    mockFounder();
    mockSavedComplianceSettings();

    render(<ComplianceReportsPage />);

    await screen.findByText('No monthly compliance reports found yet.');
    const section = screen.getByRole('heading', { name: 'Level II – Self-Regulatory Body' }).closest('section') as HTMLElement;

    fireEvent.click(within(section).getByRole('button', { name: 'Renew / Replace Registration' }));
    expect(within(section).getByLabelText('Organization')).toHaveValue('Working Journalist Media Council (WJMC)');
    expect(within(section).getByLabelText('Publisher')).toHaveValue('News Pulse (Digital)');
    expect(within(section).getByLabelText('Registration No.')).toHaveValue('');

    fireEvent.change(within(section).getByLabelText('Registration No.'), { target: { value: 'WJMC/NEW/2027' } });
    fireEvent.change(within(section).getByLabelText('Issue Date'), { target: { value: '15-09-2027' } });
    fireEvent.change(within(section).getByLabelText('Valid Until'), { target: { value: '15-09-2028' } });
    fireEvent.change(within(section).getByLabelText('Status'), { target: { value: 'Renewed' } });
    mocks.renewSrbRegistration.mockImplementationOnce(async (input: ComplianceSettings) => {
      const refreshed = {
        ...input,
        srbRegistrationHistory: [{
          organization: 'Backend Archived SRB',
          publisher: 'News Pulse (Digital)',
          status: 'Replaced',
          registrationNumber: 'BACKEND-ARCHIVED-001',
          issueDate: '2026-09-14',
          validUntil: '2027-09-14',
          archivedAt: '2027-09-15T10:00:00.000Z',
        }],
      };
      mocks.savedComplianceSettings = JSON.parse(JSON.stringify(refreshed));
      return refreshed;
    });
    fireEvent.click(within(section).getByRole('button', { name: 'Save Renewal' }));

    await waitFor(() => expect(renewSrbRegistration).toHaveBeenCalledTimes(1));
    expect(updateComplianceSettings).not.toHaveBeenCalled();
    expect(renewSrbRegistration).toHaveBeenCalledWith(expect.objectContaining({
      srbRegistration: expect.objectContaining({
        status: 'Renewed',
        registrationNumber: 'WJMC/NEW/2027',
        issueDate: '2027-09-15',
        validUntil: '2028-09-15',
      }),
      srbRegistrationHistory: [],
    }));
    const renewalPayload = vi.mocked(renewSrbRegistration).mock.calls[0][0] as ComplianceSettings & { srbRegistrationAction?: string };
    expect(renewalPayload).not.toHaveProperty('srbRegistrationAction');
    expect(renewalPayload.srbRegistration).not.toHaveProperty('registrationNo');

    await waitFor(() => expect(within(section).getByText('BACKEND-ARCHIVED-001')).toBeInTheDocument());
    expect(within(section).getByText('Backend Archived SRB')).toBeInTheDocument();
    expect(within(section).queryByText('WJMC/7489/462-26')).not.toBeInTheDocument();
  });

  it('renders SRB registration history for Founder without deletion controls', async () => {
    mockFounder();
    mockSavedComplianceSettings({
      ...DEFAULT_COMPLIANCE_SETTINGS,
      srbRegistrationHistory: [{
        organization: 'Previous Self-Regulatory Body',
        publisher: 'News Pulse (Digital)',
        status: 'Replaced',
        registrationNumber: 'OLD-SRB-001',
        issueDate: '2025-01-01',
        validUntil: '2025-12-31',
      }],
    });

    render(<ComplianceReportsPage />);

    await screen.findByText('No monthly compliance reports found yet.');
    const section = screen.getByRole('heading', { name: 'Level II – Self-Regulatory Body' }).closest('section') as HTMLElement;

    fireEvent.click(within(section).getByText('SRB Registration History'));

    expect(within(section).getByText('Previous Self-Regulatory Body')).toBeInTheDocument();
    expect(within(section).getByText('OLD-SRB-001')).toBeInTheDocument();
    expect(within(section).getByText('01-01-2025')).toBeInTheDocument();
    expect(within(section).getByText('31-12-2025')).toBeInTheDocument();
    expect(within(section).queryByText('2025-01-01')).not.toBeInTheDocument();
    expect(within(section).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('persists public display control booleans using existing compliance setting keys', async () => {
    mockSavedComplianceSettings({
      ...DEFAULT_COMPLIANCE_SETTINGS,
      showPublisherEntity: true,
      showFounderPublisher: false,
      showChiefEditor: true,
    });

    const { unmount } = render(<ComplianceReportsPage />);

    const publisherToggle = await screen.findByRole('checkbox', { name: /Show Publisher \/ Entity/i });
    const founderToggle = screen.getByRole('checkbox', { name: /Show Founder \/ Publisher/i });
    const chiefEditorToggle = screen.getByRole('checkbox', { name: /Show Chief Editor/i });

    expect(publisherToggle).toBeChecked();
    expect(founderToggle).not.toBeChecked();
    expect(chiefEditorToggle).toBeChecked();

    fireEvent.click(publisherToggle);
    fireEvent.click(founderToggle);
    fireEvent.click(chiefEditorToggle);
    fireEvent.click(screen.getByRole('button', { name: 'Save Details' }));

    await waitFor(() => expect(updateComplianceSettings).toHaveBeenCalledTimes(1));
    expect(updateComplianceSettings).toHaveBeenCalledWith(expect.objectContaining({
      showPublisherEntity: false,
      showFounderPublisher: true,
      showChiefEditor: false,
    }));

    unmount();
    render(<ComplianceReportsPage />);

    expect(await screen.findByRole('checkbox', { name: /Show Publisher \/ Entity/i })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Show Founder \/ Publisher/i })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Show Chief Editor/i })).not.toBeChecked();
    expect(getComplianceSettings).toHaveBeenCalled();
  });
});
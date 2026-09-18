import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ComplianceReportsPage from '@/pages/admin/ComplianceReportsPage';
import {
  DEFAULT_COMPLIANCE_SETTINGS,
  getComplianceSettings,
  updateComplianceSettings,
  type ComplianceSettings,
} from '@/lib/adminComplianceSettingsApi';

const mocks = vi.hoisted(() => ({
  savedComplianceSettings: undefined as ComplianceSettings | undefined,
  getComplianceSettings: vi.fn(),
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
    updateComplianceSettings: mocks.updateComplianceSettings,
  };
});

vi.mock('@/lib/adminComplianceReportsApi', () => ({
  createComplianceReport: vi.fn(),
  deleteComplianceReport: vi.fn(),
  listComplianceReports: vi.fn(async () => []),
  updateComplianceReport: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
  mocks.savedComplianceSettings = undefined;
});

describe('ComplianceReportsPage SRB registration display', () => {
  function mockSavedComplianceSettings(settings: ComplianceSettings = DEFAULT_COMPLIANCE_SETTINGS) {
    mocks.savedComplianceSettings = settings;
    mocks.getComplianceSettings.mockImplementation(async () => mocks.savedComplianceSettings);
    mocks.updateComplianceSettings.mockImplementation(async (input: ComplianceSettings) => {
      mocks.savedComplianceSettings = input;
      return input;
    });
  }

  it('shows Level II SRB registration as read-only compliance information', async () => {
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
    expect(within(section as HTMLElement).getByText('14 September 2026')).toBeInTheDocument();
    expect(within(section as HTMLElement).getByText('14 September 2027')).toBeInTheDocument();
    expect(within(section as HTMLElement).getByText(/registered with the Working Journalist Media Council/i)).toBeInTheDocument();
    expect(within(section as HTMLElement).getByText('Read-only')).toBeInTheDocument();
    expect(within(section as HTMLElement).queryByRole('textbox')).not.toBeInTheDocument();
    expect(within(section as HTMLElement).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue(DEFAULT_COMPLIANCE_SETTINGS.publisherEntity)).toBeInTheDocument();
    expect(screen.queryByLabelText('Location')).not.toBeInTheDocument();
    expect(screen.getByText('Grievance Officer and Official Grievance Email are always shown on the public Grievance Redressal page for compliance clarity.')).toBeInTheDocument();
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
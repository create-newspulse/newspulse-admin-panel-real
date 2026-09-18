import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_COMPLIANCE_SETTINGS,
  getComplianceSettings,
  renewSrbRegistration,
  updateComplianceSettings,
} from '@/lib/adminComplianceSettingsApi';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('adminComplianceSettingsApi', () => {
  it('sends public display control booleans with the existing compliance settings keys', async () => {
    localStorage.setItem('admin_token', 'test-token');
    const input = {
      ...DEFAULT_COMPLIANCE_SETTINGS,
      showPublisherEntity: false,
      showFounderPublisher: true,
      showChiefEditor: false,
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ item: input }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await updateComplianceSettings(input);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/admin-api/admin/compliance-settings');
    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(requestInit.method).toBe('PUT');
    expect(JSON.parse(String(requestInit.body))).toEqual(expect.objectContaining({
      showPublisherEntity: false,
      showFounderPublisher: true,
      showChiefEditor: false,
      srbRegistration: expect.objectContaining({
        registrationNumber: 'WJMC/7489/462-26',
        issueDate: '2026-09-14',
        validUntil: '2027-09-14',
      }),
      srbRegistrationHistory: input.srbRegistrationHistory,
    }));
    expect(JSON.parse(String(requestInit.body))).not.toHaveProperty('srbRegistrationAction');
    expect(JSON.parse(String(requestInit.body)).srbRegistration).not.toHaveProperty('registrationNo');
  });

  it('normalizes backend SRB registrationNumber values and history from compliance settings', async () => {
    localStorage.setItem('admin_token', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      item: {
        ...DEFAULT_COMPLIANCE_SETTINGS,
        srbRegistration: {
          organization: 'Backend SRB',
          publisher: 'Backend Publisher',
          status: 'Renewed',
          registrationNumber: 'BACKEND-SRB-2027',
          issueDate: '2027-09-15',
          validUntil: '2028-09-15',
        },
        srbRegistrationHistory: [{
          organization: 'Previous SRB',
          publisher: 'News Pulse (Digital)',
          status: 'Replaced',
          registrationNo: 'OLD-SRB-001',
          issueDate: '2025-01-01',
          validUntil: '2025-12-31',
        }],
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const settings = await getComplianceSettings();

    expect(settings.srbRegistration).toEqual({
      organization: 'Backend SRB',
      publisher: 'Backend Publisher',
      status: 'Renewed',
      registrationNumber: 'BACKEND-SRB-2027',
      issueDate: '2027-09-15',
      validUntil: '2028-09-15',
    });
    expect(settings.srbRegistrationHistory).toEqual([{
      organization: 'Previous SRB',
      publisher: 'News Pulse (Digital)',
      status: 'Replaced',
      registrationNumber: 'OLD-SRB-001',
      issueDate: '2025-01-01',
      validUntil: '2025-12-31',
    }]);
  });

  it('still reads legacy SRB registration number keys into registrationNumber', async () => {
    localStorage.setItem('admin_token', 'test-token');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({
      item: {
        ...DEFAULT_COMPLIANCE_SETTINGS,
        srbRegistration: {
          organization: 'Legacy SRB',
          publisher: 'Legacy Publisher',
          status: 'Registered',
          registrationNo: 'LEGACY-REG-NO',
          issueDate: '2026-09-14',
          validUntil: '2027-09-14',
        },
        srbRegistrationHistory: [{
          organization: 'Legacy History SRB',
          publisher: 'News Pulse (Digital)',
          status: 'Replaced',
          srbRegistrationNo: 'LEGACY-HISTORY-SRB-NO',
          issueDate: '2025-01-01',
          validUntil: '2025-12-31',
          archivedAt: '2026-09-14T10:00:00.000Z',
        }],
      },
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    const settings = await getComplianceSettings();

    expect(settings.srbRegistration.registrationNumber).toBe('LEGACY-REG-NO');
    expect(settings.srbRegistration).not.toHaveProperty('registrationNo');
    expect(settings.srbRegistrationHistory[0]).toEqual(expect.objectContaining({
      registrationNumber: 'LEGACY-HISTORY-SRB-NO',
      archivedAt: '2026-09-14T10:00:00.000Z',
    }));
  });

  it('sends explicit backend SRB renewal action with ISO dates', async () => {
    localStorage.setItem('admin_token', 'test-token');
    const input = {
      ...DEFAULT_COMPLIANCE_SETTINGS,
      srbRegistration: {
        ...DEFAULT_COMPLIANCE_SETTINGS.srbRegistration,
        registrationNumber: 'WJMC/NEW/2027',
        issueDate: '2027-09-15',
        validUntil: '2028-09-15',
      },
      srbRegistrationHistory: [],
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ item: input }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }));

    await renewSrbRegistration(input);

    const requestInit = fetchMock.mock.calls[0][1] as RequestInit;
    expect(requestInit.method).toBe('PUT');
    expect(JSON.parse(String(requestInit.body))).toEqual(expect.objectContaining({
      srbRegistrationAction: 'renew',
      srbRegistration: expect.objectContaining({
        registrationNumber: 'WJMC/NEW/2027',
        issueDate: '2027-09-15',
        validUntil: '2028-09-15',
      }),
      srbRegistrationHistory: [],
    }));
  });
});
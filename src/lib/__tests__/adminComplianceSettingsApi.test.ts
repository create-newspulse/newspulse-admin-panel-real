import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_COMPLIANCE_SETTINGS,
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
    }));
  });
});
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adminJson: vi.fn(),
}));

vi.mock('@/lib/http/adminFetch', () => ({
  adminJson: mocks.adminJson,
  AdminApiError: class AdminApiError extends Error {},
}));

import { getStaffAccessRecord, saveStaffAccessOverride } from '@/api/teamManagementApi';

describe('teamManagementApi Staff Access save', () => {
  beforeEach(() => {
    mocks.adminJson.mockReset();
    mocks.adminJson.mockResolvedValue({ ok: true });
  });

  it('sends backend-contract module, rights, and temporary payloads through the shared serializer', async () => {
    await saveStaffAccessOverride('staff-1', {
      moduleAccess: ['dashboard', 'ads_manager', 'dpdp_privacy_requests', 'settings', 'ai_engine', 'team_management'],
      specialRights: ['can_publish_news', 'can_control_ai_engine', 'can_create_task', 'can_view_staff_details'],
      temporaryGrants: [
        { targetType: 'module', key: 'ai_engine', expiresAt: '2026-09-01T10:00:00.000Z', reason: 'Temporary AI support' },
      ],
      auditReason: 'Founder approved access review',
      accessVersion: 3,
    });

    expect(mocks.adminJson).toHaveBeenCalledWith('/admin-api/admin/team/access/staff/staff-1/modules', expect.objectContaining({
      method: 'PATCH',
      json: expect.objectContaining({
        moduleAccessStates: {
          adsManager: 'enabled',
          dpdpCompliance: 'enabled',
          settings: 'enabled',
          aiEngine: 'temporary',
        },
        auditReason: 'Founder approved access review',
        accessVersion: 3,
      }),
    }));
    expect(mocks.adminJson.mock.calls.find(([path]) => path === '/admin-api/admin/team/access/staff/staff-1/modules')?.[1].json).not.toHaveProperty('moduleAccess');
    expect(mocks.adminJson.mock.calls.find(([path]) => path === '/admin-api/admin/team/access/staff/staff-1/modules')?.[1].json).not.toHaveProperty('modules');
    expect(mocks.adminJson.mock.calls.find(([path]) => path === '/admin-api/admin/team/access/staff/staff-1/modules')?.[1].json).not.toHaveProperty('moduleAccessOverride');
    expect(mocks.adminJson).toHaveBeenCalledWith('/admin-api/admin/team/access/staff/staff-1/rights', expect.objectContaining({
      method: 'PATCH',
      json: expect.objectContaining({
        specialRights: ['ai_engine_control', 'news_publish', 'staff_view_details', 'task_create'],
        specialRightsOverride: ['ai_engine_control', 'news_publish', 'staff_view_details', 'task_create'],
        auditReason: 'Founder approved access review',
      }),
    }));
    expect(mocks.adminJson).toHaveBeenCalledWith('/admin-api/admin/team/access/staff/staff-1/task-rights', expect.objectContaining({
      json: expect.objectContaining({ taskRights: ['task_create'] }),
    }));
    expect(mocks.adminJson).toHaveBeenCalledWith('/admin-api/admin/team/access/staff/staff-1/account-control-rights', expect.objectContaining({
      json: expect.objectContaining({ accountControlRights: ['staff_view_details'] }),
    }));
    expect(mocks.adminJson).toHaveBeenCalledWith('/admin-api/admin/team/access/staff/staff-1/temporary', expect.objectContaining({
      method: 'POST',
      json: expect.objectContaining({ moduleKey: 'aiEngine', expiresAt: '2026-09-01T10:00:00.000Z' }),
    }));
  });

  it('rejects forbidden module grants before sending any partial save request', async () => {
    await expect(saveStaffAccessOverride('staff-1', {
      moduleAccess: ['ads_manager'],
      temporaryGrants: [{ targetType: 'module', key: 'safe_zone', expiresAt: '2026-09-01T10:00:00.000Z', reason: 'Should not be allowed' }],
      auditReason: 'Founder approved access review',
    })).rejects.toThrow(/FORBIDDEN_MODULE/);

    expect(mocks.adminJson).not.toHaveBeenCalled();
  });

  it('sends an explicit empty permanent selection without the server-controlled marker', async () => {
    await saveStaffAccessOverride('staff-1', { specialRights: [], auditReason: 'Remove all permanent rights' });

    expect(mocks.adminJson).toHaveBeenCalledWith('/admin-api/admin/team/access/staff/staff-1/rights', {
      method: 'PATCH',
      json: {
        specialRights: [],
        rights: [],
        specialRightsOverride: [],
        auditReason: 'Remove all permanent rights',
        reason: 'Remove all permanent rights',
      },
    });
    for (const [, options] of mocks.adminJson.mock.calls) {
      expect(options.json).not.toHaveProperty('specialRightsConfigured');
    }
  });

  it('does not configure permanent rights when only modules are supplied', async () => {
    await saveStaffAccessOverride('staff-1', { moduleAccess: [], auditReason: 'Remove individual modules only' });

    expect(mocks.adminJson).toHaveBeenCalledTimes(1);
    expect(mocks.adminJson).toHaveBeenCalledWith('/admin-api/admin/team/access/staff/staff-1/modules', expect.objectContaining({
      json: expect.objectContaining({ moduleAccessStates: {} }),
    }));
  });

  it('sends a temporary right separately without a permanent rights PATCH', async () => {
    await saveStaffAccessOverride('staff-1', {
      temporaryGrants: [{ targetType: 'right', key: 'can_publish_news', expiresAt: '2030-01-01T00:00:00.000Z', reason: 'Temporary publishing cover' }],
      auditReason: 'Temporary publishing cover',
    });

    expect(mocks.adminJson).toHaveBeenCalledTimes(1);
    expect(mocks.adminJson).toHaveBeenCalledWith('/admin-api/admin/team/access/staff/staff-1/temporary', expect.objectContaining({
      method: 'POST',
      json: expect.objectContaining({ rightKey: 'news_publish', enabled: true }),
    }));
  });

  it('surfaces temporary endpoint failures rather than returning a success-shaped fallback', async () => {
    mocks.adminJson.mockRejectedValueOnce(Object.assign(new Error('Temporary endpoint unavailable'), { status: 404 }));

    await expect(saveStaffAccessOverride('staff-1', {
      temporaryGrants: [{ targetType: 'right', key: 'can_publish_news', expiresAt: '2030-01-01T00:00:00.000Z' }],
      auditReason: 'Temporary publishing cover',
    })).rejects.toThrow('Temporary endpoint unavailable');
  });

  it.each(['top-level', 'data'])('reloads authoritative configured empty rights from the %s envelope', async (envelope) => {
    const record = {
      user: { id: 'staff-1', specialRightsOverride: [], specialRightsConfigured: true, specialRights: ['news_publish'] },
      effectiveAccess: { accessVersion: 4, specialRights: [{ key: 'news_publish', allowed: true, state: 'temporary' }] },
    };
    mocks.adminJson.mockResolvedValueOnce(envelope === 'data' ? { data: record } : record);

    await expect(getStaffAccessRecord('staff-1')).resolves.toEqual(record);
    expect(mocks.adminJson).toHaveBeenCalledWith('/admin-api/admin/team/access/staff/staff-1', { cache: 'no-store' });
  });

  it.each([
    { id: 'staff-1', specialRights: ['news_publish'] },
    { id: 'staff-1', specialRightsOverride: [], specialRightsConfigured: null },
    { id: 'different-staff', specialRightsOverride: [], specialRightsConfigured: true },
  ])('rejects an incompatible or wrong-staff reload instead of inventing a permanent selection', async (user) => {
    mocks.adminJson.mockResolvedValueOnce({ user, effectiveAccess: { specialRights: [] } });
    await expect(getStaffAccessRecord('staff-1')).rejects.toThrow('Backend did not return authoritative saved Special Rights and configured state.');
  });

  it('accepts a legacy record explicitly reported as unconfigured', async () => {
    const record = {
      user: { id: 'staff-1', specialRightsOverride: [], specialRightsConfigured: false, specialRights: ['news_publish'] },
      effectiveAccess: { specialRights: [{ key: 'news_publish', allowed: false, state: 'locked' }] },
    };
    mocks.adminJson.mockResolvedValueOnce(record);
    await expect(getStaffAccessRecord('staff-1')).resolves.toEqual(record);
  });

  it('rejects malformed per-right effective decisions instead of interpreting them as allowed', async () => {
    mocks.adminJson.mockResolvedValueOnce({
      user: { id: 'staff-1', specialRightsOverride: [], specialRightsConfigured: true },
      effectiveAccess: { specialRights: [{ key: 'news_publish', allowed: 'false', state: 'disabled' }] },
    });
    await expect(getStaffAccessRecord('staff-1')).rejects.toThrow('Backend did not return authoritative saved Special Rights and configured state.');
  });
});

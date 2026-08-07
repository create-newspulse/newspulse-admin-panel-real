import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  adminJson: vi.fn(),
}));

vi.mock('@/lib/http/adminFetch', () => ({
  adminJson: mocks.adminJson,
  AdminApiError: class AdminApiError extends Error {},
}));

import { saveStaffAccessOverride } from '@/api/teamManagementApi';

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
});

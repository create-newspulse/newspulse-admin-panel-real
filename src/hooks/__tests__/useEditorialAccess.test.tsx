import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ADMIN_MODULE_POLICY, type AdminModulePolicyMap } from '@/lib/adminModulePolicy';
import { useEditorialAccess } from '../useEditorialAccess';

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true, isReady: true, isLoading: false, isRestoring: false,
    user: { id: 'synthetic-staff', role: 'editor', moduleAccess: ['manage_news'], specialRights: [] as string[],
      specialRightsOverride: [] as string[], specialRightsConfigured: undefined as boolean | undefined,
      temporaryAccess: [] as Array<{ rightKey: string; enabled: boolean }>, newsPublishGrantRecorded: false },
  },
  effective: { modulePolicy: {} as AdminModulePolicyMap, backendAccess: {}, isLoading: false, error: null as Error | null },
  get: vi.fn(),
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useAdminEffectiveAccess', async importOriginal => ({
  ...await importOriginal<typeof import('@/hooks/useAdminEffectiveAccess')>(),
  useAdminEffectiveAccess: () => mocks.effective,
}));
vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: { get: mocks.get } }));

beforeEach(() => {
  Object.assign(mocks.auth, { isAuthenticated: true, isReady: true, isLoading: false, isRestoring: false });
  Object.assign(mocks.auth.user, { id: 'synthetic-staff', role: 'editor', moduleAccess: ['manage_news'], specialRights: [],
    specialRightsOverride: [], specialRightsConfigured: undefined, temporaryAccess: [], newsPublishGrantRecorded: false });
  mocks.effective.modulePolicy = {
    ...DEFAULT_ADMIN_MODULE_POLICY,
    manage_news: { moduleKey: 'manage_news', state: 'available' },
    add_news: { moduleKey: 'add_news', state: 'available' },
    draft_desk: { moduleKey: 'draft_desk', state: 'available' },
  };
  mocks.effective.isLoading = false;
  mocks.effective.error = null;
  mocks.effective.backendAccess = {};
  mocks.get.mockReset();
});

describe('Create and permanent Restore eligibility', () => {
  it.each([
    ['founder', [], [], true],
    ['editor', ['add_news'], [], true],
    ['editor', ['draft_desk'], [], true],
    ['editor', ['manage_news'], ['news_edit'], true],
    ['editor', ['manage_news'], ['can_edit_news'], true],
    ['admin', ['manage_news'], [], false],
    ['editor', [], ['news_edit'], false],
    ['staff', [], [], false],
  ] as const)('resolves creation for %s with %j and %j', (role, modules, rights, allowed) => {
    Object.assign(mocks.auth.user, { role, moduleAccess: [...modules], specialRights: [...rights] });
    expect(renderHook(useEditorialAccess).result.current.canCreateNews).toBe(allowed);
  });

  it('does not use a permanent edit selection instead of effective news_edit for creation', () => {
    mocks.auth.user.specialRightsOverride = ['news_edit'];
    expect(renderHook(useEditorialAccess).result.current.canCreateNews).toBe(false);
  });

  it.each(['news_restore', 'can_restore_news'])('recognizes configured permanent and effective %s only with Manage News', right => {
    mocks.auth.user.specialRightsConfigured = true;
    mocks.auth.user.specialRightsOverride = [right];
    mocks.auth.user.specialRights = [right];
    const mounted = renderHook(useEditorialAccess);
    expect(mounted.result.current.canRestoreNews).toBe(true);
    mocks.auth.user.moduleAccess = ['draft_desk'];
    mounted.rerender();
    expect(mounted.result.current.canRestoreNews).toBe(false);
  });

  it.each([undefined, false])('does not infer permanent restore provenance from configured=%s', configured => {
    mocks.auth.user.specialRightsConfigured = configured;
    mocks.auth.user.specialRightsOverride = ['news_restore'];
    mocks.auth.user.specialRights = ['news_restore'];
    expect(renderHook(useEditorialAccess).result.current.canRestoreNews).toBe(false);
  });

  it('rejects temporary-only and merged restore rights even for an Admin role', () => {
    Object.assign(mocks.auth.user, {
      role: 'admin', specialRightsConfigured: true, specialRightsOverride: [],
      specialRights: ['news_restore'], temporaryAccess: [{ rightKey: 'news_restore', enabled: true }],
    });
    expect(renderHook(useEditorialAccess).result.current.canRestoreNews).toBe(false);
  });

  it('requires verified module access even with configured permanent restore rights', () => {
    Object.assign(mocks.auth.user, {
      specialRightsConfigured: true, specialRightsOverride: ['news_restore'], specialRights: ['news_restore'],
    });
    mocks.effective.backendAccess = {
      manage_news: { moduleKey: 'manage_news', allowed: false, visible: true, policyState: 'staff_locked', reasonCode: 'GLOBAL_STAFF_LOCK' },
    };
    expect(renderHook(useEditorialAccess).result.current).toMatchObject({ canRestoreNews: false, canCreateNews: false });
  });

  it('honors an effective temporary denial despite a configured permanent Restore selection', () => {
    Object.assign(mocks.auth.user, {
      specialRightsConfigured: true, specialRightsOverride: ['news_restore'], specialRights: [],
      temporaryAccess: [{ rightKey: 'news_restore', enabled: false }],
    });
    expect(renderHook(useEditorialAccess).result.current.canRestoreNews).toBe(false);
  });

  it.each(['news_edit', 'news_delete', 'news_publish'])('does not substitute %s for effective Restore permission', right => {
    Object.assign(mocks.auth.user, {
      specialRightsConfigured: true, specialRightsOverride: ['news_restore'], specialRights: [right],
    });
    expect(renderHook(useEditorialAccess).result.current.canRestoreNews).toBe(false);
  });

  it('retains verified Founder creation/restore but rejects an unauthenticated Founder claim', () => {
    mocks.auth.user.role = 'founder';
    const mounted = renderHook(useEditorialAccess);
    expect(mounted.result.current).toMatchObject({ canCreateNews: true, canRestoreNews: true });
    mocks.auth.isAuthenticated = false;
    mounted.rerender();
    expect(mounted.result.current).toMatchObject({ canCreateNews: false, canRestoreNews: false });
  });
});

describe('Action-scoped permission refresh', () => {
  function refreshedProfile(rights = ['news_edit']) {
    return { data: { user: { id: 'synthetic-staff', role: 'editor', specialRights: rights } } };
  }
  function refreshedModules(allowed: boolean) {
    return { data: { effectiveModuleAccess: {
      manageNews: { allowed, visible: true, policyState: 'available', reasonCode: allowed ? 'ALLOWED' : 'STAFF_ACCESS_DISABLED' },
    } } };
  }

  it('refreshes current profile and effective modules without changing the shared auth snapshot', async () => {
    mocks.get.mockResolvedValueOnce(refreshedProfile()).mockResolvedValueOnce(refreshedModules(true));
    const mounted = renderHook(useEditorialAccess);
    expect(mounted.result.current.canCreateNews).toBe(false);
    await act(async () => { await mounted.result.current.refreshPermissions(); });
    expect(mounted.result.current).toMatchObject({ canCreateNews: true, canPublish: false, canSchedule: false });
    expect(mocks.auth.user.specialRights).toEqual([]);
    expect(mocks.effective.backendAccess).toEqual({});
    expect(mocks.get.mock.calls.map(([url]) => url)).toEqual(['admin/me', 'access/me']);
  });

  it('does not convert a fresh module denial into access from the old profile', async () => {
    mocks.auth.user.moduleAccess = ['add_news'];
    mocks.get.mockResolvedValueOnce(refreshedProfile()).mockResolvedValueOnce(refreshedModules(false));
    const mounted = renderHook(useEditorialAccess);
    expect(mounted.result.current.canCreateNews).toBe(true);
    await act(async () => { await mounted.result.current.refreshPermissions(); });
    expect(mounted.result.current.canCreateNews).toBe(false);
  });

  it.each([401, 403, 503])('surfaces permission-refresh HTTP %s without changing auth or retrying', async status => {
    mocks.get.mockRejectedValueOnce({ response: { status, data: {} } });
    const mounted = renderHook(useEditorialAccess);
    await act(async () => {
      await expect(mounted.result.current.refreshPermissions()).rejects.toMatchObject({ response: { status } });
    });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.auth.isAuthenticated).toBe(true);
  });

  it.each([
    { user: { id: 'another-account', role: 'editor' } },
    { user: { id: 'synthetic-staff', role: 'founder' } },
    { user: { role: 'editor' } },
    { ok: false, user: { id: 'synthetic-staff', role: 'editor' } },
  ])('rejects an unverified profile %j before reading effective modules', async data => {
    mocks.get.mockResolvedValueOnce({ data });
    const mounted = renderHook(useEditorialAccess);
    await act(async () => { await expect(mounted.result.current.refreshPermissions()).rejects.toThrow(); });
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mounted.result.current.canCreateNews).toBe(false);
  });

  it('ignores a permission receipt after the active account changes', async () => {
    let finish!: (value: ReturnType<typeof refreshedModules>) => void;
    mocks.get.mockResolvedValueOnce(refreshedProfile()).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const mounted = renderHook(useEditorialAccess);
    const request = mounted.result.current.refreshPermissions();
    const rejected = expect(request).rejects.toThrow(/changed/i);
    await act(async () => {});
    mocks.auth.user.id = 'different-staff';
    mounted.rerender();
    await act(async () => { finish(refreshedModules(true)); await rejected; });
    expect(mounted.result.current.canCreateNews).toBe(false);
  });
});
afterEach(cleanup);

describe('Existing effective editorial access', () => {
  it('preserves authenticated Founder controls without staff grants', () => {
    mocks.auth.user.role = 'founder';
    mocks.auth.user.moduleAccess = [];
    expect(renderHook(useEditorialAccess).result.current).toMatchObject({
      canManageNews: true, canEditNews: true, canReadOwnDrafts: true, canPublish: true, canSchedule: true,
    });
  });

  it('preserves full Manage News for an authorized Editor without granting publication', () => {
    expect(renderHook(useEditorialAccess).result.current).toMatchObject({
      canManageNews: true, canEditNews: false, canPublish: false, canSchedule: false,
    });
  });

  it.each(['add_news', 'draft_desk'])('limits staff with %s access to own drafts', (module) => {
    mocks.auth.user.role = 'intern';
    mocks.auth.user.moduleAccess = [module];
    expect(renderHook(useEditorialAccess).result.current).toMatchObject({
      canManageNews: false, canEditNews: false, canReadOwnDrafts: true, canPublish: false, canSchedule: false,
    });
  });

  it.each(['news_publish', 'can_publish_news'])('recognizes the existing effective %s special right', (right) => {
    mocks.auth.user.specialRights = ['news_edit', right];
    mocks.auth.user.newsPublishGrantRecorded = true;
    expect(renderHook(useEditorialAccess).result.current).toMatchObject({ canPublish: true, canSchedule: false });
  });

  it.each(['news_edit', 'can_edit_news'])('recognizes the computed %s right only with Manage News access', right => {
    mocks.auth.user.specialRights = [right];
    const mounted = renderHook(useEditorialAccess);
    expect(mounted.result.current.canEditNews).toBe(true);
    mocks.auth.user.moduleAccess = ['draft_desk'];
    mounted.rerender();
    expect(mounted.result.current.canEditNews).toBe(false);
  });

  it('does not authorize full-news editing from permanent selections alone', () => {
    mocks.auth.user.specialRightsOverride = ['news_edit'];
    expect(renderHook(useEditorialAccess).result.current.canEditNews).toBe(false);
  });

  it('never treats a recorded or permanent selection as an effective grant', () => {
    mocks.auth.user.newsPublishGrantRecorded = true;
    mocks.auth.user.specialRightsOverride = ['news_publish'];
    expect(renderHook(useEditorialAccess).result.current.canPublish).toBe(false);
  });

  it('requires content-edit eligibility for Manage News publication, but permits eligible own-draft staff', () => {
    mocks.auth.user.specialRights = ['news_publish'];
    mocks.auth.user.newsPublishGrantRecorded = true;
    const mounted = renderHook(useEditorialAccess);
    expect(mounted.result.current.canPublish).toBe(false);
    mocks.auth.user.moduleAccess = ['draft_desk'];
    mounted.rerender();
    expect(mounted.result.current.canPublish).toBe(true);
    expect(mounted.result.current.canSchedule).toBe(false);
  });

  it('does not publish from a role default, a right alone, or a right without workspace access', () => {
    mocks.auth.user.specialRights = ['news_publish'];
    const mounted = renderHook(useEditorialAccess);
    expect(mounted.result.current.canPublish).toBe(false);
    mocks.auth.user.newsPublishGrantRecorded = true;
    mocks.auth.user.moduleAccess = [];
    mounted.rerender();
    expect(mounted.result.current.canPublish).toBe(false);
    expect(mounted.result.current.canReadOwnDrafts).toBe(false);
  });

  it('fails closed while permissions are loading or unavailable', () => {
    mocks.effective.isLoading = true;
    const mounted = renderHook(useEditorialAccess);
    expect(mounted.result.current).toMatchObject({ loading: true, canManageNews: false, canEditNews: false });
    mocks.effective.isLoading = false;
    mocks.effective.error = new Error('Synthetic access failure');
    mounted.rerender();
    expect(mounted.result.current.canManageNews).toBe(false);
    expect(mounted.result.current.canEditNews).toBe(false);
  });

  it('does not use a logged-out Founder hint', () => {
    mocks.auth.isAuthenticated = false;
    mocks.auth.user.role = 'founder';
    expect(renderHook(useEditorialAccess).result.current).toMatchObject({
      canManageNews: false, canEditNews: false, canReadOwnDrafts: false, canPublish: false, canSchedule: false,
    });
  });
});

import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ADMIN_MODULE_POLICY, type AdminModulePolicyMap } from '@/lib/adminModulePolicy';
import { useEditorialAccess } from '../useEditorialAccess';

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true, isReady: true, isLoading: false, isRestoring: false,
    user: { id: 'synthetic-staff', role: 'editor', moduleAccess: ['manage_news'], specialRights: [] as string[],
      specialRightsOverride: [] as string[], newsPublishGrantRecorded: false },
  },
  effective: { modulePolicy: {} as AdminModulePolicyMap, backendAccess: {}, isLoading: false, error: null as Error | null },
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useAdminEffectiveAccess', () => ({ useAdminEffectiveAccess: () => mocks.effective }));

beforeEach(() => {
  Object.assign(mocks.auth, { isAuthenticated: true, isReady: true, isLoading: false, isRestoring: false });
  Object.assign(mocks.auth.user, { role: 'editor', moduleAccess: ['manage_news'], specialRights: [],
    specialRightsOverride: [], newsPublishGrantRecorded: false });
  mocks.effective.modulePolicy = {
    ...DEFAULT_ADMIN_MODULE_POLICY,
    manage_news: { moduleKey: 'manage_news', state: 'available' },
    add_news: { moduleKey: 'add_news', state: 'available' },
    draft_desk: { moduleKey: 'draft_desk', state: 'available' },
  };
  mocks.effective.isLoading = false;
  mocks.effective.error = null;
});
afterEach(cleanup);

describe('Existing effective editorial access', () => {
  it('preserves authenticated Founder controls without staff grants', () => {
    mocks.auth.user.role = 'founder';
    mocks.auth.user.moduleAccess = [];
    expect(renderHook(useEditorialAccess).result.current).toMatchObject({
      canManageNews: true, canReadOwnDrafts: true, canPublish: true, canSchedule: true,
    });
  });

  it('preserves full Manage News for an authorized Editor without granting publication', () => {
    expect(renderHook(useEditorialAccess).result.current).toMatchObject({
      canManageNews: true, canPublish: false, canSchedule: false,
    });
  });

  it.each(['add_news', 'draft_desk'])('limits staff with %s access to own drafts', (module) => {
    mocks.auth.user.role = 'intern';
    mocks.auth.user.moduleAccess = [module];
    expect(renderHook(useEditorialAccess).result.current).toMatchObject({
      canManageNews: false, canReadOwnDrafts: true, canPublish: false, canSchedule: false,
    });
  });

  it.each(['news_publish', 'can_publish_news'])('recognizes the existing effective %s special right', (right) => {
    mocks.auth.user.specialRights = ['news_edit', right];
    mocks.auth.user.newsPublishGrantRecorded = true;
    expect(renderHook(useEditorialAccess).result.current).toMatchObject({ canPublish: true, canSchedule: false });
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
    expect(mounted.result.current).toMatchObject({ loading: true, canManageNews: false });
    mocks.effective.isLoading = false;
    mocks.effective.error = new Error('Synthetic access failure');
    mounted.rerender();
    expect(mounted.result.current.canManageNews).toBe(false);
  });

  it('does not use a logged-out Founder hint', () => {
    mocks.auth.isAuthenticated = false;
    mocks.auth.user.role = 'founder';
    expect(renderHook(useEditorialAccess).result.current).toMatchObject({
      canManageNews: false, canReadOwnDrafts: false, canPublish: false, canSchedule: false,
    });
  });
});

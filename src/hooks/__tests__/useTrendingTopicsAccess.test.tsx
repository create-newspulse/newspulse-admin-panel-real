import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTrendingTopicsAccess } from '@/hooks/useTrendingTopicsAccess';
import { DEFAULT_ADMIN_MODULE_POLICY, type AdminModulePolicyMap } from '@/lib/adminModulePolicy';

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: 'staff-1', role: 'editor', moduleAccess: ['manage_news'], specialRights: [] as string[],
      accessOverrides: { denySpecialRights: [] as string[] } },
    isAuthenticated: true, isFounder: false, isReady: true, isLoading: false, isRestoring: false,
  },
  effective: { modulePolicy: {} as AdminModulePolicyMap, backendAccess: {}, isLoading: false, error: null as Error | null },
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useAdminEffectiveAccess', () => ({ useAdminEffectiveAccess: () => mocks.effective }));

beforeEach(() => {
  Object.assign(mocks.auth, { isAuthenticated: true, isFounder: false, isReady: true, isLoading: false, isRestoring: false,
    user: { id: 'staff-1', role: 'editor', moduleAccess: ['manage_news'], specialRights: [], accessOverrides: { denySpecialRights: [] } } });
  mocks.effective.modulePolicy = { ...DEFAULT_ADMIN_MODULE_POLICY, manage_news: { moduleKey: 'manage_news', state: 'available' } };
  mocks.effective.isLoading = false;
  mocks.effective.error = null;
});
afterEach(cleanup);

describe('Trending Topics existing Staff Access and Special Rights', () => {
  it('gives authenticated Founder access without a staff grant', () => {
    Object.assign(mocks.auth, { isFounder: true, user: { ...mocks.auth.user, role: 'founder', moduleAccess: [] } });
    mocks.effective.modulePolicy = DEFAULT_ADMIN_MODULE_POLICY;
    expect(renderHook(useTrendingTopicsAccess).result.current).toMatchObject({ canRead: true, canEdit: true, isFounder: true });
  });

  it('allows manage_news reads without granting mutations', () => {
    expect(renderHook(useTrendingTopicsAccess).result.current).toMatchObject({ canRead: true, canEdit: false });
  });

  it('requires the existing can_edit_news right for membership mutations', () => {
    mocks.auth.user.specialRights = ['can_edit_news'];
    expect(renderHook(useTrendingTopicsAccess).result.current).toMatchObject({ canRead: true, canEdit: true, isFounder: false });
  });

  it('does not grant module access from the edit right or a staff role', () => {
    mocks.auth.user.moduleAccess = ['editorial'];
    mocks.auth.user.specialRights = ['can_edit_news'];
    expect(renderHook(useTrendingTopicsAccess).result.current).toMatchObject({ canRead: false, canEdit: false });
  });

  it('honors Founder global module policy and explicit right denials', () => {
    mocks.auth.user.specialRights = ['can_edit_news'];
    mocks.auth.user.accessOverrides.denySpecialRights = ['can_edit_news'];
    const mounted = renderHook(useTrendingTopicsAccess);
    expect(mounted.result.current.canEdit).toBe(false);
    mocks.effective.modulePolicy = DEFAULT_ADMIN_MODULE_POLICY;
    mounted.rerender();
    expect(mounted.result.current.canRead).toBe(false);
    expect(mounted.result.current.reason).toBe('This module is restricted to the Founder.');
  });

  it.each(['isReady', 'isLoading', 'isRestoring'] as const)('waits for authentication readiness: %s', (flag) => {
    mocks.auth[flag] = flag !== 'isReady';
    expect(renderHook(useTrendingTopicsAccess).result.current).toMatchObject({ loading: true, canRead: false, canEdit: false });
  });

  it('does not use pending or failed effective access as unrestricted access', () => {
    mocks.effective.isLoading = true;
    const mounted = renderHook(useTrendingTopicsAccess);
    expect(mounted.result.current.canRead).toBe(false);
    mocks.effective.isLoading = false;
    mocks.effective.error = new Error('Synthetic access failure');
    mounted.rerender();
    expect(mounted.result.current.canRead).toBe(false);
    expect(mounted.result.current.reason).toMatch(/could not be verified/);
  });

  it('does not admit an unauthenticated Founder hint', () => {
    mocks.auth.isAuthenticated = false;
    mocks.auth.isFounder = true;
    expect(renderHook(useTrendingTopicsAccess).result.current).toMatchObject({ canRead: false, canEdit: false });
  });
});

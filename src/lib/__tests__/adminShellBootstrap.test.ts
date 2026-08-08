import { describe, expect, it } from 'vitest';
import { shouldBlockAdminShell, shouldRedirectUnauthenticatedAdmin, type AdminShellBootstrapState } from '@/lib/adminShellBootstrap';

const readyFounder: AdminShellBootstrapState = {
  isAdminPanelPath: true,
  isAuthPage: false,
  isReady: true,
  isSessionResolved: true,
  isRestoring: false,
  isLoading: false,
  isAuthenticated: true,
  hasVerifiedUserRole: true,
};

describe('shouldBlockAdminShell', () => {
  it('keeps the root shell hidden until a founder session is resolved', () => {
    expect(shouldBlockAdminShell({ ...readyFounder, isSessionResolved: false })).toBe(true);
    expect(shouldBlockAdminShell(readyFounder)).toBe(false);
  });

  it('keeps the root shell hidden until an unauthenticated session outcome is known', () => {
    expect(shouldBlockAdminShell({
      ...readyFounder,
      isSessionResolved: false,
      isAuthenticated: false,
      hasVerifiedUserRole: false,
    })).toBe(true);
  });

  it('redirects a resolved unauthenticated root visit before the shell renders', () => {
    expect(shouldRedirectUnauthenticatedAdmin({
      ...readyFounder,
      isAuthenticated: false,
    })).toBe(true);
    expect(shouldRedirectUnauthenticatedAdmin({
      ...readyFounder,
      isAuthenticated: false,
      isSessionResolved: false,
    })).toBe(false);
  });

  it('redirects a resolved unauthenticated dashboard visit before the shell renders', () => {
    expect(shouldRedirectUnauthenticatedAdmin({
      ...readyFounder,
      isAuthenticated: false,
    })).toBe(true);
  });

  it('keeps role-less authenticated sessions hidden while effective identity is loading', () => {
    expect(shouldBlockAdminShell({ ...readyFounder, hasVerifiedUserRole: false })).toBe(true);
  });

  it('holds a staff shell only until its minimum access map resolves', () => {
    expect(shouldBlockAdminShell({ ...readyFounder, isMinimumAccessLoading: true })).toBe(true);
    expect(shouldBlockAdminShell({ ...readyFounder, isMinimumAccessLoading: false })).toBe(false);
  });

  it('does not block the public login page while session resolution is pending', () => {
    expect(shouldBlockAdminShell({
      ...readyFounder,
      isAdminPanelPath: false,
      isAuthPage: true,
      isSessionResolved: false,
      isAuthenticated: false,
      hasVerifiedUserRole: false,
    })).toBe(false);
  });
});
import { describe, expect, it } from 'vitest';
import { leftNavWithAccess } from '@/config/nav';
import { getEffectiveModuleAccess, resolveAdminModuleAccess, resolveAnyAdminModuleAccess } from '@/lib/adminAccessControl';
import { DEFAULT_ADMIN_MODULE_POLICY, createFounderOnlyModulePolicy, createModulePolicyPayload, normalizeAdminModulePolicy } from '@/lib/adminModulePolicy';

const staff = { role: 'editor', moduleAccess: ['add_news'] };
const expectedVersion = 1;

describe('admin module policy resolver', () => {
  it('defaults new or missing configurable module policies to Founder Only', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicies: {} });
    expect(modulePolicy.add_news.state).toBe('founder_only');
    expect(createModulePolicyPayload(modulePolicy, 'secure default', expectedVersion).modulePolicies.addNews).toBe('founder_only');
  });

  it('preserves explicit saved policy states from the backend', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicies: {
      addNews: 'available',
      manageNews: 'staff_locked',
      draftDesk: 'hidden',
      seo: 'founder_only',
    } });
    expect(modulePolicy.add_news.state).toBe('available');
    expect(modulePolicy.manage_news.state).toBe('staff_locked');
    expect(modulePolicy.draft_desk.state).toBe('hidden');
    expect(modulePolicy.seo.state).toBe('founder_only');
  });

  it('bulk Founder-only policy excludes fixed controls and keeps Safe Zone Founder Only', () => {
    const policy = createFounderOnlyModulePolicy({
      ...DEFAULT_ADMIN_MODULE_POLICY,
      dashboard: { moduleKey: 'dashboard', state: 'available' },
      safe_zone: { moduleKey: 'safe_zone', state: 'founder_only' },
      add_news: { moduleKey: 'add_news', state: 'available' },
    });
    const payload = createModulePolicyPayload(policy, 'emergency restriction', expectedVersion);
    expect(policy.dashboard.state).toBe('available');
    expect(policy.safe_zone.state).toBe('founder_only');
    expect(policy.add_news.state).toBe('founder_only');
    expect(payload).toEqual(expect.objectContaining({ expectedVersion, auditReason: 'emergency restriction' }));
    expect(payload.modulePolicies.addNews).toBe('founder_only');
    expect(payload.modulePolicies).not.toHaveProperty('dashboard');
    expect(payload.modulePolicies).not.toHaveProperty('safeZone');
  });

  it('allows available global policy when individual access is enabled', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicies: { addNews: 'available' } });
    expect(resolveAdminModuleAccess(staff, 'add_news', { modulePolicy }).allowed).toBe(true);
  });

  it('keeps Founder fully accessible regardless of saved global policy', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicies: { addNews: 'founder_only' } });
    const result = resolveAdminModuleAccess({ role: 'founder', moduleAccess: [] }, 'add_news', { modulePolicy });
    expect(result.visible).toBe(true);
    expect(result.allowed).toBe(true);
  });

  it('does not let individual staff access override Founder Only', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicies: { addNews: 'founder_only' } });
    const result = resolveAdminModuleAccess(staff, 'add_news', { modulePolicy });
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('FOUNDER_ONLY');
  });

  it('locks available global policy when individual access is disabled', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicies: { financeDesk: 'available' } });
    const result = resolveAdminModuleAccess({ role: 'finance_accounts_manager', moduleAccess: [] }, 'finance_desk', { modulePolicy });
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('STAFF_ACCESS_DISABLED');
  });

  it('hides hidden modules and denies route access', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicies: { addNews: 'hidden' } });
    const result = resolveAdminModuleAccess(staff, 'add_news', { modulePolicy });
    expect(result.visible).toBe(false);
    expect(result.allowed).toBe(false);
  });

  it('locks staff_locked modules for navbar and direct route guards', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicies: { addNews: 'staff_locked' } });
    const navItem = leftNavWithAccess(staff, { modulePolicy }).find((item) => item.moduleKey === 'add_news');
    const routeResult = resolveAnyAdminModuleAccess(staff, ['add_news'], { modulePolicy });
    expect(navItem?.locked).toBe(true);
    expect(routeResult.allowed).toBe(false);
    expect(navItem?.lockedReason).toBe(routeResult.reason);
  });

  it('keeps Founder-only and Safe Zone inaccessible to staff', () => {
    const result = resolveAdminModuleAccess({ role: 'admin', moduleAccess: ['safe_zone'] }, 'safe_zone');
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('FOUNDER_ONLY');
  });

  it('does not let role defaults override an explicit empty saved access list', () => {
    expect(getEffectiveModuleAccess({ role: 'editor', moduleAccess: [] })).not.toContain('add_news');
  });
});
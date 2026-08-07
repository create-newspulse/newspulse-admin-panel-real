import { describe, expect, it } from 'vitest';
import { leftNavWithAccess } from '@/config/nav';
import { getEffectiveModuleAccess, resolveAdminModuleAccess, resolveAnyAdminModuleAccess } from '@/lib/adminAccessControl';
import { DEFAULT_ADMIN_MODULE_POLICY, createFounderOnlyModulePolicy, normalizeAdminModulePolicy, serializeModulePolicyPayload } from '@/lib/adminModulePolicy';

const staff = { role: 'editor', moduleAccess: ['add_news'] };

describe('admin module policy resolver', () => {
  it('defaults new or missing configurable module policies to Founder Only', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicy: {} });
    expect(modulePolicy.add_news.state).toBe('founder_only');
    expect(serializeModulePolicyPayload({} as any, 'secure default', 1).modulePolicies.addNews).toBe('founder_only');
  });

  it('preserves explicit saved policy states from the backend', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicy: {
      add_news: 'available',
      manage_news: 'staff_locked',
      draft_desk: 'hidden',
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
    const payload = serializeModulePolicyPayload(policy, 'emergency restriction', 1);
    expect(policy.dashboard.state).toBe('available');
    expect(policy.safe_zone.state).toBe('founder_only');
    expect(policy.add_news.state).toBe('founder_only');
    expect(payload.modulePolicies.addNews).toBe('founder_only');
    expect(payload.modulePolicies).not.toHaveProperty('dashboard');
    expect(payload.modulePolicies).not.toHaveProperty('safeZone');
  });

  it('normalizes backend canonical module-policy keys into local module keys', () => {
    const modulePolicy = normalizeAdminModulePolicy({ policy: { modulePolicies: { addNews: 'available', manageNews: 'staff_locked', dpdpCompliance: 'hidden' } } });
    expect(modulePolicy.add_news.state).toBe('available');
    expect(modulePolicy.manage_news.state).toBe('staff_locked');
    expect(modulePolicy.dpdp_privacy_requests.state).toBe('hidden');
  });

  it('allows available global policy when individual access is enabled', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicy: { add_news: 'available' } });
    expect(resolveAdminModuleAccess(staff, 'add_news', { modulePolicy }).allowed).toBe(true);
  });

  it('allows Shailesh Add News when saved staff access and global policy both allow it', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicy: { add_news: 'available' } });
    const shailesh = {
      id: 'staff-3',
      email: 'shailesh.rathod@newspulse.co.in',
      staffId: 'NP-2026-0003',
      role: 'editor',
      position: 'Editorial Head',
      accountStatus: 'active',
      moduleAccess: ['add_news'],
    };
    const staffResult = resolveAdminModuleAccess(shailesh, 'add_news', { modulePolicy });
    const navItem = leftNavWithAccess(shailesh, { modulePolicy }).find((item) => item.moduleKey === 'add_news');

    expect(staffResult.allowed).toBe(true);
    expect(navItem?.locked).toBe(false);
    expect(navItem?.lockedReason).toBe('Allowed');
  });

  it('keeps Founder fully accessible regardless of saved global policy', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicy: { add_news: 'founder_only' } });
    const result = resolveAdminModuleAccess({ role: 'founder', moduleAccess: [] }, 'add_news', { modulePolicy });
    expect(result.visible).toBe(true);
    expect(result.allowed).toBe(true);
  });

  it('does not let individual staff access override Founder Only', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicy: { add_news: 'founder_only' } });
    const result = resolveAdminModuleAccess(staff, 'add_news', { modulePolicy });
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('FOUNDER_ONLY');
  });

  it('locks available global policy when individual access is disabled', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicy: { finance_desk: 'available' } });
    const result = resolveAdminModuleAccess({ role: 'finance_accounts_manager', moduleAccess: [] }, 'finance_desk', { modulePolicy });
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('STAFF_ACCESS_DISABLED');
  });

  it('unlocks Ads Manager DPDP and Settings after saved individual access is enabled and global policy is available', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicy: {
      ads_manager: 'available',
      dpdp_privacy_requests: 'available',
      settings: 'available',
    } });
    const beforeSave = { role: 'editor', accountStatus: 'active', moduleAccess: [] };
    const afterSave = { role: 'editor', accountStatus: 'active', moduleAccess: ['ads_manager', 'dpdp_privacy_requests', 'settings'] };

    (['ads_manager', 'dpdp_privacy_requests', 'settings'] as const).forEach((moduleKey) => {
      expect(resolveAdminModuleAccess(beforeSave, moduleKey, { modulePolicy }).reasonCode).toBe('STAFF_ACCESS_DISABLED');
      const finalAccess = resolveAdminModuleAccess(afterSave, moduleKey, { modulePolicy });
      const navItem = leftNavWithAccess(afterSave, { modulePolicy }).find((item) => item.moduleKey === moduleKey);

      expect(finalAccess.allowed).toBe(true);
      expect(finalAccess.reasonCode).toBe('ALLOWED');
      expect(navItem?.locked).toBe(false);
      expect(navItem?.lockedReason).toBe('Allowed');
    });
  });

  it('hides hidden modules and denies route access', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicy: { add_news: 'hidden' } });
    const result = resolveAdminModuleAccess(staff, 'add_news', { modulePolicy });
    expect(result.visible).toBe(false);
    expect(result.allowed).toBe(false);
  });

  it('locks staff_locked modules for navbar and direct route guards', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicy: { add_news: 'staff_locked' } });
    const navItem = leftNavWithAccess(staff, { modulePolicy }).find((item) => item.moduleKey === 'add_news');
    const routeResult = resolveAnyAdminModuleAccess(staff, ['add_news'], { modulePolicy });
    expect(navItem?.locked).toBe(true);
    expect(routeResult.allowed).toBe(false);
    expect(navItem?.lockedReason).toBe(routeResult.reason);
  });

  it('uses backend allowed=true as the navbar and route source of truth', () => {
    const user = { role: 'editor', moduleAccess: [] };
    const backendAccess = {
      add_news: {
        moduleKey: 'add_news' as const,
        visible: true,
        allowed: true,
        locked: false,
        policyState: 'available' as const,
        reasonCode: 'ALLOWED' as const,
        reason: 'Allowed',
        individualAccess: 'enabled' as const,
      },
    };
    const navItem = leftNavWithAccess(user, { backendAccess }).find((item) => item.moduleKey === 'add_news');
    const routeResult = resolveAnyAdminModuleAccess(user, ['add_news'], { backendAccess });

    expect(resolveAdminModuleAccess(user, 'add_news', { backendAccess }).allowed).toBe(true);
    expect(navItem?.locked).toBe(false);
    expect(routeResult.allowed).toBe(true);
  });

  it('unlocks Ads Manager, DPDP Privacy Requests, and Settings from saved backend effective access', () => {
    const user = { role: 'admin', accountStatus: 'active', moduleAccess: [] };
    const backendAccess = {
      ads_manager: {
        moduleKey: 'ads_manager' as const,
        visible: true,
        allowed: true,
        locked: false,
        policyState: 'available' as const,
        reasonCode: 'ALLOWED' as const,
        reason: 'Allowed',
        individualAccess: 'enabled' as const,
      },
      dpdp_privacy_requests: {
        moduleKey: 'dpdp_privacy_requests' as const,
        visible: true,
        allowed: true,
        locked: false,
        policyState: 'available' as const,
        reasonCode: 'ALLOWED' as const,
        reason: 'Allowed',
        individualAccess: 'enabled' as const,
      },
      settings: {
        moduleKey: 'settings' as const,
        visible: true,
        allowed: true,
        locked: false,
        policyState: 'available' as const,
        reasonCode: 'ALLOWED' as const,
        reason: 'Allowed',
        individualAccess: 'enabled' as const,
      },
    };
    const nav = leftNavWithAccess(user, { backendAccess });

    expect(nav.find((item) => item.moduleKey === 'ads_manager')?.locked).toBe(false);
    expect(nav.find((item) => item.moduleKey === 'dpdp_privacy_requests')?.locked).toBe(false);
    expect(nav.find((item) => item.moduleKey === 'settings')?.locked).toBe(false);
    expect(resolveAdminModuleAccess(user, 'ads_manager', { backendAccess }).allowed).toBe(true);
    expect(resolveAdminModuleAccess(user, 'dpdp_privacy_requests', { backendAccess }).allowed).toBe(true);
    expect(resolveAdminModuleAccess(user, 'settings', { backendAccess }).allowed).toBe(true);
  });

  it('uses backend allowed=false as the navbar and route source of truth', () => {
    const user = { role: 'editor', moduleAccess: ['add_news'] };
    const backendAccess = {
      add_news: {
        moduleKey: 'add_news' as const,
        visible: true,
        allowed: false,
        locked: true,
        policyState: 'available' as const,
        reasonCode: 'STAFF_ACCESS_DISABLED' as const,
        reason: 'This module is not enabled for your staff account.',
        individualAccess: 'disabled' as const,
      },
    };
    const navItem = leftNavWithAccess(user, { backendAccess }).find((item) => item.moduleKey === 'add_news');
    const routeResult = resolveAnyAdminModuleAccess(user, ['add_news'], { backendAccess });

    expect(resolveAdminModuleAccess(user, 'add_news', { backendAccess }).allowed).toBe(false);
    expect(navItem?.locked).toBe(true);
    expect(routeResult.allowed).toBe(false);
    expect(navItem?.lockedReason).toBe(routeResult.reason);
  });

  it('keeps Dashboard unlocked for active staff as a fixed control', () => {
    const result = resolveAdminModuleAccess({ role: 'reporter', accountStatus: 'active', moduleAccess: [] }, 'dashboard');
    const navItem = leftNavWithAccess({ role: 'reporter', accountStatus: 'active', moduleAccess: [] }, {}).find((item) => item.moduleKey === 'dashboard');

    expect(result.allowed).toBe(true);
    expect(navItem?.locked).toBe(false);
  });

  it('keeps Founder-only and Safe Zone inaccessible to staff', () => {
    const result = resolveAdminModuleAccess({ role: 'admin', moduleAccess: ['safe_zone'] }, 'safe_zone');
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('FOUNDER_ONLY');
  });

  it('uses precise denial messages for locked accounts', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicy: { add_news: 'available' } });
    const result = resolveAdminModuleAccess({ role: 'editor', accountStatus: 'locked', moduleAccess: ['add_news'] }, 'add_news', { modulePolicy });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('ACCOUNT_LOCKED');
    expect(result.reason).toBe('Your staff account is locked.');
  });

  it('does not let role defaults override an explicit empty saved access list', () => {
    expect(getEffectiveModuleAccess({ role: 'editor', moduleAccess: [] })).not.toContain('add_news');
  });

  it('does not let role, role preset, or position grant runtime access without saved individual access', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicy: { add_news: 'available', finance_desk: 'available' } });
    const editorialHead = { role: 'editor', position: 'Editorial Head', roleAccess: { modules: ['add_news'] } };
    const financeManager = { role: 'finance_accounts_manager', designation: 'Finance & Accounts Manager' };

    expect(resolveAdminModuleAccess(editorialHead, 'add_news', { modulePolicy }).reasonCode).toBe('STAFF_ACCESS_DISABLED');
    expect(resolveAdminModuleAccess(financeManager, 'finance_desk', { modulePolicy }).reasonCode).toBe('STAFF_ACCESS_DISABLED');
  });

  it('keeps Staff Access final result, navbar, and route guard on the same resolver decision', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicy: { community_reporter_queue: 'staff_locked' } });
    const user = { role: 'editor', moduleAccess: ['community_reporter_queue'] };
    const staffAccessResult = resolveAdminModuleAccess(user, 'community_reporter_queue', { modulePolicy });
    const navItem = leftNavWithAccess(user, { modulePolicy }).find((item) => item.moduleKey === 'community_reporter_queue');
    const routeResult = resolveAnyAdminModuleAccess(user, ['community_reporter_queue'], { modulePolicy });

    expect(staffAccessResult.allowed).toBe(false);
    expect(staffAccessResult.reasonCode).toBe('GLOBAL_STAFF_LOCK');
    expect(navItem?.locked).toBe(true);
    expect(navItem?.lockedReason).toBe(staffAccessResult.reason);
    expect(routeResult.reason).toBe(staffAccessResult.reason);
  });

  it('denies suspended and expired staff accounts with simple final reasons', () => {
    const modulePolicy = normalizeAdminModulePolicy({ modulePolicy: { add_news: 'available' } });

    expect(resolveAdminModuleAccess({ role: 'editor', accountStatus: 'suspended', moduleAccess: ['add_news'] }, 'add_news', { modulePolicy }).reason).toBe('Your staff account is suspended.');
    expect(resolveAdminModuleAccess({ role: 'editor', accountStatus: 'active', accessExpiryDate: '2000-01-01T00:00:00.000Z', moduleAccess: ['add_news'] }, 'add_news', { modulePolicy }).reason).toBe('Your staff account access period has expired.');
  });
});
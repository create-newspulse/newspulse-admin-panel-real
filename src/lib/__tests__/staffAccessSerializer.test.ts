import { describe, expect, it } from 'vitest';
import {
  backendCanonicalStaffModuleKey,
  backendLegacyStaffModuleKey,
  backendSpecialRightKey,
  localStaffModuleKey,
  localSpecialRightKey,
  serializeStaffAccessPayload,
} from '@/lib/staffAccessSerializer';

describe('staff access serializer', () => {
  it('serializes a valid Staff Access payload using backend canonical keys and no labels', () => {
    const payload = serializeStaffAccessPayload({
      moduleAccess: ['dashboard', 'add_news', 'settings', 'team_management'],
      moduleStates: { ai_engine: 'temporary', safe_zone: 'disabled' },
      specialRights: ['can_publish_news', 'can_change_settings'],
      temporaryGrants: [{ targetType: 'module', key: 'ai_engine', expiresAt: '2026-09-01T10:00:00.000Z', reason: 'Temporary AI support' }],
      auditReason: 'Founder approved access review',
      accessVersion: 7,
    });

    expect(payload).toEqual(expect.objectContaining({
      auditReason: 'Founder approved access review',
      reason: 'Founder approved access review',
      accessVersion: 7,
      moduleAccessStates: {
        addNews: 'enabled',
        settings: 'enabled',
        aiEngine: 'temporary',
      },
      moduleAccessOverride: ['add_news', 'ai_engine', 'settings'],
      moduleAccess: ['add_news', 'ai_engine', 'settings'],
      modules: ['add_news', 'ai_engine', 'settings'],
      specialRightsOverride: ['news_publish', 'settings_change'],
      specialRights: ['news_publish', 'settings_change'],
      rights: ['news_publish', 'settings_change'],
    }));
    expect(JSON.stringify(payload)).not.toMatch(/Add News|Settings|AI Engine/);
    expect(payload.moduleAccessStates).not.toHaveProperty('dashboard');
    expect(payload.moduleAccessStates).not.toHaveProperty('safeZone');
    expect(payload.moduleAccessStates).not.toHaveProperty('team_management');
  });

  it('serializes Ads Manager enabled without fixed or label fields', () => {
    const payload = serializeStaffAccessPayload({
      moduleAccess: ['dashboard', 'ads_manager'],
      auditReason: 'Founder enabled ads module access',
    });

    expect(payload.moduleAccessStates).toEqual({ adsManager: 'enabled' });
    expect(payload.moduleAccess).toEqual(['ads_manager']);
    expect(payload.moduleAccessOverride).toEqual(['ads_manager']);
    expect(Object.keys(payload.moduleAccessStates)).not.toContain('dashboard');
    expect(Object.keys(payload.moduleAccessStates)).not.toContain('safeZone');
    expect(Object.keys(payload.moduleAccessStates)).not.toContain('team_management');
  });

  it('rejects Safe Zone temporary grants before any save request can be sent', () => {
    expect(() => serializeStaffAccessPayload({
      temporaryGrants: [{ targetType: 'module', key: 'safe_zone', expiresAt: '2026-09-01T10:00:00.000Z', reason: 'not allowed' }],
      auditReason: 'Attempted forbidden grant',
    })).toThrow(/temporaryAccess\[0\]\.moduleKey: FORBIDDEN_MODULE/);
  });

  it('serializes DPDP Privacy Requests and Settings with backend canonical keys', () => {
    const payload = serializeStaffAccessPayload({
      moduleAccess: ['DPDP Privacy Requests', 'Settings'],
      auditReason: 'Founder enabled privacy and settings access',
    });

    expect(payload.moduleAccessStates).toEqual({ dpdpCompliance: 'enabled', settings: 'enabled' });
    expect(payload.moduleAccess).toEqual(['dpdp_compliance', 'settings']);
    expect(JSON.stringify(payload)).not.toMatch(/DPDP Privacy Requests|Settings/);
  });

  it('serializes DPDP, Settings, and AI Engine with the real backend module keys', () => {
    expect(backendCanonicalStaffModuleKey('dpdp_privacy_requests')).toBe('dpdpCompliance');
    expect(backendLegacyStaffModuleKey('dpdp_privacy_requests')).toBe('dpdp_compliance');
    expect(backendCanonicalStaffModuleKey('settings')).toBe('settings');
    expect(backendCanonicalStaffModuleKey('ai_engine')).toBe('aiEngine');
    expect(localStaffModuleKey('dpdpCompliance')).toBe('dpdp_privacy_requests');
  });

  it('normalizes enabled, disabled, and temporary states plus temporary expiry', () => {
    const payload = serializeStaffAccessPayload({
      moduleStates: {
        add_news: true,
        manage_news: false,
        dpdp_privacy_requests: 'temporary',
        dashboard: true,
        safe_zone: 'enabled',
      },
      temporaryGrants: [{ targetType: 'module', key: 'dpdp_privacy_requests', expiresAt: '2026-10-01T00:00:00.000Z', reason: 'DPDP review window' }],
      reason: 'Temporary privacy review',
    });

    expect(payload.moduleAccessStates).toEqual({
      addNews: 'enabled',
      manageNews: 'disabled',
      dpdpCompliance: 'temporary',
    });
    expect(payload.temporaryAccess).toEqual([{ moduleKey: 'dpdpCompliance', expiresAt: '2026-10-01T00:00:00.000Z', reason: 'DPDP review window', enabled: true }]);
  });

  it('serializes Special Rights to backend keys and can normalize them back to UI keys', () => {
    expect(backendSpecialRightKey('can_publish_news')).toBe('news_publish');
    expect(backendSpecialRightKey('can_control_ai_engine')).toBe('ai_engine_control');
    expect(backendSpecialRightKey('create_advertiser')).toBe('marketing_create_advertiser');
    expect(backendSpecialRightKey('send_to_ads_manager')).toBe('marketing_send_to_ads_manager');
    expect(localSpecialRightKey('news_publish')).toBe('can_publish_news');
    expect(localSpecialRightKey('ai_engine_control')).toBe('can_control_ai_engine');
    expect(localSpecialRightKey('marketing_create_advertiser')).toBe('create_advertiser');
    expect(localSpecialRightKey('marketing_send_to_ads_manager')).toBe('send_to_ads_manager');
    expect(backendSpecialRightKey('view_marketing_performance')).toBe('marketing_view_performance');
    expect(backendSpecialRightKey('delete_campaign_report')).toBe('marketing_delete_campaign_report');
    expect(localSpecialRightKey('marketing_view_performance')).toBe('view_marketing_performance');
    expect(localSpecialRightKey('marketing_delete_campaign_report')).toBe('delete_campaign_report');
  });

  it('serializes Marketing CRM rights without Ads Manager delivery rights', () => {
    const payload = serializeStaffAccessPayload({
      moduleAccess: ['marketing'],
      specialRights: ['view_marketing', 'create_advertiser', 'create_proposal', 'send_to_ads_manager'],
      auditReason: 'Founder enabled Marketing sales operations',
    });

    expect(payload.moduleAccessStates).toEqual({ marketing: 'enabled' });
    expect(payload.specialRights).toEqual([
      'marketing_create_advertiser',
      'marketing_create_proposal',
      'marketing_send_to_ads_manager',
      'marketing_view',
    ]);
    expect(payload.specialRights).not.toContain('ads_manage_campaigns');
  });

  it('serializes Marketing Phase 4 performance and renewal rights', () => {
    const payload = serializeStaffAccessPayload({
      moduleAccess: ['marketing'],
      specialRights: ['view_marketing_performance', 'view_campaign_performance', 'view_promotion_performance', 'view_renewals', 'manage_renewals', 'create_campaign_report', 'view_growth_performance'],
      auditReason: 'Founder enabled Marketing performance operations',
    });

    expect(payload.specialRights).toEqual([
      'marketing_create_campaign_report',
      'marketing_manage_renewals',
      'marketing_view_campaign_performance',
      'marketing_view_growth_performance',
      'marketing_view_performance',
      'marketing_view_promotion_performance',
      'marketing_view_renewals',
    ]);
    expect(payload.specialRights).not.toContain('finance_view');
  });
});

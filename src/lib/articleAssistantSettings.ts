import type { SiteSettings } from '@/types/siteSettings';

export const DEFAULT_ARTICLE_ASSISTANT_FOR_STAFF = true;

export function getArticleAssistantForStaff(settings: SiteSettings | null | undefined): boolean {
  return settings?.adminPanel?.articleAssistantForStaff ?? DEFAULT_ARTICLE_ASSISTANT_FOR_STAFF;
}

export function setArticleAssistantForStaff(settings: SiteSettings, enabled: boolean): SiteSettings {
  return {
    ...settings,
    adminPanel: {
      ...(settings.adminPanel || {}),
      articleAssistantForStaff: enabled,
    },
  };
}

export function createArticleAssistantForStaffPatch(enabled: boolean): Partial<SiteSettings> {
  return {
    adminPanel: {
      articleAssistantForStaff: enabled,
    },
  } as Partial<SiteSettings>;
}

export function isFounderRole(role: unknown): boolean {
  return String(role || '').trim().toLowerCase() === 'founder';
}

export function canUseArticleAssistant(role: unknown, articleAssistantForStaff: boolean): boolean {
  return isFounderRole(role) || articleAssistantForStaff;
}

export function getArticleAssistantUnavailableReason(role: unknown, articleAssistantForStaff: boolean): string | null {
  return canUseArticleAssistant(role, articleAssistantForStaff) ? null : 'Article Assistant for Staff is currently off.';
}
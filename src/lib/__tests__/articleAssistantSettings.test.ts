import { describe, expect, it } from 'vitest';
import { canUseArticleAssistant, createArticleAssistantForStaffPatch, getArticleAssistantForStaff, getArticleAssistantUnavailableReason, setArticleAssistantForStaff } from '@/lib/articleAssistantSettings';
import { DEFAULT_SETTINGS } from '@/types/siteSettings';

describe('articleAssistantSettings', () => {
  it('defaults Article Assistant for Staff to on for backward compatibility', () => {
    expect(getArticleAssistantForStaff(DEFAULT_SETTINGS)).toBe(true);
  });

  it('persists the staff toggle into the existing adminPanel settings shape', () => {
    const next = setArticleAssistantForStaff(DEFAULT_SETTINGS, false);

    expect(next.adminPanel.articleAssistantForStaff).toBe(false);
  });

  it('creates a minimal Founder-only patch for settings saves', () => {
    expect(createArticleAssistantForStaffPatch(false)).toEqual({
      adminPanel: {
        articleAssistantForStaff: false,
      },
    });
  });

  it('keeps Founder access when staff access is off', () => {
    expect(canUseArticleAssistant('founder', false)).toBe(true);
    expect(getArticleAssistantUnavailableReason('founder', false)).toBeNull();
  });

  it('blocks non-Founder staff when staff access is off', () => {
    expect(canUseArticleAssistant('editor', false)).toBe(false);
    expect(getArticleAssistantUnavailableReason('editor', false)).toBe('Article Assistant for Staff is currently off.');
  });

  it('does not grant staff access to News Pulse Engine modules', () => {
    const next = setArticleAssistantForStaff(DEFAULT_SETTINGS, true);

    expect(next.adminPanel.articleAssistantForStaff).toBe(true);
    expect(JSON.stringify(next)).not.toMatch(/ai_engine|aiEngine|can_control_ai_engine/);
  });
});
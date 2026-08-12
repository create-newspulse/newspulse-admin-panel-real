import { describe, expect, it } from 'vitest';

import { DEFAULT_PUBLIC_SITE_SETTINGS, normalizePublicSiteLanguageCode, normalizePublicSiteLanguageCodes, normalizePublicSiteSettings, normalizePublicSiteSettingsPatch } from '../publicSiteSettings';

describe('public site language normalization', () => {
  it('keeps only canonical English, Hindi, and Gujarati codes in input order', () => {
    expect(normalizePublicSiteLanguageCodes(' en, hi, gu, hi ')).toEqual(['en', 'hi', 'gu']);
  });

  it('normalizes Gujarati aliases to gu without storing noncanonical codes', () => {
    expect(normalizePublicSiteLanguageCode('Gujarati')).toBe('gu');
    expect(normalizePublicSiteLanguageCode('gu-IN')).toBe('gu');
    expect(normalizePublicSiteLanguageCode('gj')).toBe('gu');
    expect(normalizePublicSiteLanguageCodes(['en', 'Gujarati', 'gu-IN', 'gj'])).toEqual(['en', 'gu']);
  });

  it('drops unsupported codes safely', () => {
    expect(normalizePublicSiteLanguageCode('fr')).toBe('');
    expect(normalizePublicSiteLanguageCodes('en,fr,hi')).toEqual(['en', 'hi']);
  });

  it('does not create an empty languages list when the setting is absent', () => {
    const normalized = normalizePublicSiteSettings({ languageTheme: { themePreset: 'system' } } as any);
    expect((normalized as any).languageTheme.languages).toBeUndefined();
  });

  it('adds push notification defaults without adding homepage module entries', () => {
    expect((DEFAULT_PUBLIC_SITE_SETTINGS as any).pushNotifications).toEqual({
      enabled: true,
      types: {
        breakingNewsAlerts: true,
        topStories: true,
        newArticleAlerts: true,
        categoryAlerts: true,
        allArticles: false,
      },
    });

    expect((DEFAULT_PUBLIC_SITE_SETTINGS as any).homepage.modules.pushNotifications).toBeUndefined();
  });

  it('normalizes push notification patches with safe defaults', () => {
    const normalized = normalizePublicSiteSettingsPatch({ pushNotifications: { types: { allArticles: true } } } as any);

    expect((normalized as any).pushNotifications).toEqual({
      enabled: true,
      types: {
        breakingNewsAlerts: true,
        topStories: true,
        newArticleAlerts: true,
        categoryAlerts: true,
        allArticles: true,
      },
    });
  });
});
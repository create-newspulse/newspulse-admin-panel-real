import type { SiteSettings } from '@/types/siteSettings';

export type TranslationQualityMode = 'standard' | 'strict';

export function getTranslationQualityMode(settings: SiteSettings | null | undefined): TranslationQualityMode {
  const raw = (settings as any)?.translation?.qualityMode;
  return raw === 'strict' ? 'strict' : 'standard';
}

export function isTranslationStrict(settings: SiteSettings | null | undefined): boolean {
  return getTranslationQualityMode(settings) === 'strict';
}

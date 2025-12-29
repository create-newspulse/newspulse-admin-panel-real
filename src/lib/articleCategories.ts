export type ArticleCategoryKey =
  | 'breaking'
  | 'regional'
  | 'national'
  | 'international'
  | 'business'
  | 'tech'
  | 'sports'
  | 'lifestyle'
  | 'glamour'
  | 'web-stories'
  | 'viral-videos'
  | 'editorial'
  | 'youth-pulse'
  | 'inspiration-hub';

export const ARTICLE_CATEGORY_KEYS: readonly ArticleCategoryKey[] = [
  'breaking',
  'regional',
  'national',
  'international',
  'business',
  'tech',
  'sports',
  'lifestyle',
  'glamour',
  'web-stories',
  'viral-videos',
  'editorial',
  'youth-pulse',
  'inspiration-hub',
] as const;

export const ARTICLE_CATEGORY_LABELS: Record<ArticleCategoryKey, string> = {
  breaking: 'Breaking',
  regional: 'Regional',
  national: 'National',
  international: 'International',
  business: 'Business',
  tech: 'Tech',
  sports: 'Sports',
  lifestyle: 'Lifestyle',
  glamour: 'Glamour',
  'web-stories': 'Web Stories',
  'viral-videos': 'Viral Video',
  editorial: 'Editorial',
  'youth-pulse': 'Youth Pulse',
  'inspiration-hub': 'Inspiration Hub',
};

export const ARTICLE_CATEGORY_OPTIONS: ReadonlyArray<{ key: ArticleCategoryKey; label: string }> =
  ARTICLE_CATEGORY_KEYS.map((key) => ({ key, label: ARTICLE_CATEGORY_LABELS[key] }));

const KEY_SET = new Set<string>(ARTICLE_CATEGORY_KEYS as readonly string[]);

export function isAllowedArticleCategoryKey(value: string | undefined | null): value is ArticleCategoryKey {
  const v = String(value || '').trim();
  return !!v && KEY_SET.has(v);
}

export function normalizeArticleCategoryKey(value: string | undefined | null): ArticleCategoryKey | '' {
  const v = String(value || '').trim();
  return isAllowedArticleCategoryKey(v) ? v : '';
}

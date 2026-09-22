import { describe, expect, it } from 'vitest';
import { ARTICLE_CATEGORY_KEYS, ARTICLE_CATEGORY_LABELS, ARTICLE_CATEGORY_OPTIONS } from '@/lib/articleCategories';

describe('articleCategories', () => {
  it('keeps existing categories and adds the requested workflow categories', () => {
    expect(ARTICLE_CATEGORY_KEYS).toEqual([
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
      'editorial',
      'youth-pulse',
      'inspiration-hub',
      'faith-culture',
      'pulse-dialogue',
      'tech-gadgets',
    ]);

    expect(ARTICLE_CATEGORY_LABELS['faith-culture']).toBe('Faith & Culture');
    expect(ARTICLE_CATEGORY_LABELS['pulse-dialogue']).toBe('Pulse Dialogue');
    expect(ARTICLE_CATEGORY_LABELS['tech-gadgets']).toBe('Tech & Gadgets');

    expect(ARTICLE_CATEGORY_OPTIONS).toEqual(
      ARTICLE_CATEGORY_KEYS.map((key) => ({ key, label: ARTICLE_CATEGORY_LABELS[key] })),
    );
  });
});
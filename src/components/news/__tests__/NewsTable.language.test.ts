import { describe, expect, it } from 'vitest';

import { getArticleLanguageInfo } from '../NewsTable';
import type { Article } from '@/lib/api/articles';

function article(input: Partial<Article>): Article {
  return {
    _id: String(input._id || 'article-1'),
    title: String(input.title || 'Test article'),
    ...input,
  } as Article;
}

describe('Manage News compact language badge', () => {
  it('shows EN for an English-only article', () => {
    const row = article({ language: 'en' });

    expect(getArticleLanguageInfo(row, [row]).badge).toBe('EN');
  });

  it('shows EN+GU for linked English and Gujarati article records', () => {
    const rows = [
      article({ _id: 'en-1', language: 'en', translationGroupId: 'group-1' }),
      article({ _id: 'gu-1', language: 'gu', translationGroupId: 'group-1' }),
    ];

    expect(getArticleLanguageInfo(rows[0], rows).badge).toBe('EN+GU');
  });

  it('shows EN+HI+GU from existing translation metadata keys', () => {
    const row = article({
      language: 'gu',
      translations: {
        en: { title: 'English' },
        hi: { title: 'Hindi' },
        gu: { title: 'Gujarati' },
      },
    });

    expect(getArticleLanguageInfo(row, [row]).badge).toBe('EN+HI+GU');
  });
});
import { describe, expect, it } from 'vitest';

import { buildArticlePushPayload, getArticleLanguageInfo } from '../NewsTable';
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

describe('Manage News article push payload', () => {
  it('builds a confirmed push payload for a published article', () => {
    const result = buildArticlePushPayload(article({
      _id: 'article-1',
      status: 'published',
      slug: 'published-story',
      title: 'Published story',
      summary: 'A concise summary',
      category: 'World',
      language: 'hi',
    }));

    expect(result).toEqual({
      ok: true,
      payload: {
        articleId: 'article-1',
        slug: 'published-story',
        title: 'Published story',
        body: 'A concise summary',
        url: 'https://www.newspulse.co.in/news/published-story',
        category: 'world',
        language: 'hi',
        confirmSend: true,
      },
    });
  });

  it('does not build a push payload for drafts', () => {
    const result = buildArticlePushPayload(article({ status: 'draft', slug: 'draft-story', summary: 'Summary' }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/published articles/i);
  });

  it('uses a fallback body when a published article has no summary', () => {
    const result = buildArticlePushPayload(article({
      _id: 'article-2',
      status: 'published',
      slug: 'no-summary-story',
      title: 'Published story without summary',
      summary: '',
    }));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.body).toBe('Tap to read the full story on News Pulse.');
  });

  it('uses a public URL when slug is missing', () => {
    const result = buildArticlePushPayload(article({
      _id: 'article-3',
      status: 'published',
      title: 'Public URL story',
      summary: 'Summary',
      publicUrl: 'https://www.newspulse.co.in/news/public-url-story',
    } as any));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.slug).toBe('public-url-story');
      expect(result.payload.url).toBe('https://www.newspulse.co.in/news/public-url-story');
    }
  });

  it('requires existing title and public URL data', () => {
    const result = buildArticlePushPayload(article({ status: 'published', title: 'Published story', summary: '' }));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('Article push unavailable: missing public URL.');
  });
});
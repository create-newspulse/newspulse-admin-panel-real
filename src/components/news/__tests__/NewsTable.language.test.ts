import { describe, expect, it } from 'vitest';

import { buildArticlePushPayload, getArticleLanguageInfo, groupManageNewsArticleRows } from '../NewsTable';
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

describe('Manage News logical translation grouping', () => {
  it('renders linked EN/HI/GU records as one logical group with EN+HI+GU', () => {
    const rows = [
      article({ _id: 'gu-1', title: 'Gujarati title', language: 'gu', translationGroupId: 'group-1', sourceLanguage: 'en' }),
      article({ _id: 'hi-1', title: 'Hindi title', language: 'hi', translationGroupId: 'group-1', sourceLanguage: 'en' }),
      article({ _id: 'en-1', title: 'English source title', language: 'en', translationGroupId: 'group-1', sourceLanguage: 'en' }),
    ];

    const groups = groupManageNewsArticleRows(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0].primary._id).toBe('en-1');
    expect(groups[0].primary.title).toBe('English source title');
    expect(getArticleLanguageInfo(groups[0].primary, rows).badge).toBe('EN+HI+GU');
  });

  it('keeps an English-only article as one EN row', () => {
    const rows = [article({ _id: 'en-only', language: 'en' })];

    const groups = groupManageNewsArticleRows(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0].primary._id).toBe('en-only');
    expect(getArticleLanguageInfo(groups[0].primary, rows).badge).toBe('EN');
  });

  it('keeps linked EN+HI records as one EN+HI row', () => {
    const rows = [
      article({ _id: 'hi-1', language: 'hi', translationGroupId: 'group-1', sourceLanguage: 'en' }),
      article({ _id: 'en-1', language: 'en', translationGroupId: 'group-1', sourceLanguage: 'en' }),
    ];

    const groups = groupManageNewsArticleRows(rows);

    expect(groups).toHaveLength(1);
    expect(getArticleLanguageInfo(groups[0].primary, rows).badge).toBe('EN+HI');
  });

  it('keeps two multilingual stories as exactly two logical groups', () => {
    const rows = [
      article({ _id: 'story-a-hi', language: 'hi', translationGroupId: 'story-a', sourceLanguage: 'en' }),
      article({ _id: 'story-b-gu', language: 'gu', translationGroupId: 'story-b', sourceLanguage: 'hi' }),
      article({ _id: 'story-a-en', language: 'en', translationGroupId: 'story-a', sourceLanguage: 'en' }),
      article({ _id: 'story-b-hi', language: 'hi', translationGroupId: 'story-b', sourceLanguage: 'hi' }),
    ];

    const groups = groupManageNewsArticleRows(rows);

    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.primary._id).sort()).toEqual(['story-a-en', 'story-b-hi']);
  });

  it('prefers the explicit source language over English when choosing the display record', () => {
    const rows = [
      article({ _id: 'en-1', title: 'English translation', language: 'en', translationGroupId: 'group-1', sourceLanguage: 'hi' }),
      article({ _id: 'gu-1', title: 'Gujarati translation', language: 'gu', translationGroupId: 'group-1', sourceLanguage: 'hi' }),
      article({ _id: 'hi-source', title: 'Hindi source title', language: 'hi', translationGroupId: 'group-1', sourceLanguage: 'hi' }),
    ];

    const groups = groupManageNewsArticleRows(rows);

    expect(groups[0].primary._id).toBe('hi-source');
    expect(groups[0].primary.title).toBe('Hindi source title');
  });

  it('does not depend on random API ordering when source hints are missing', () => {
    const firstOrder = [
      article({ _id: 'gu-1', language: 'gu', translationGroupId: 'group-1', createdAt: '2026-01-03T00:00:00.000Z' }),
      article({ _id: 'hi-1', language: 'hi', translationGroupId: 'group-1', createdAt: '2026-01-02T00:00:00.000Z' }),
      article({ _id: 'en-1', language: 'en', translationGroupId: 'group-1', createdAt: '2026-01-01T00:00:00.000Z' }),
    ];
    const secondOrder = [firstOrder[1], firstOrder[2], firstOrder[0]];

    expect(groupManageNewsArticleRows(firstOrder)[0].primary._id).toBe('en-1');
    expect(groupManageNewsArticleRows(secondOrder)[0].primary._id).toBe('en-1');
  });

  it('uses the source row status as the logical group status', () => {
    const rows = [
      article({ _id: 'en-stale', language: 'en', status: 'published', translationGroupId: 'group-1', sourceLanguage: 'hi' }),
      article({ _id: 'hi-source', language: 'hi', status: 'draft', translationGroupId: 'group-1', sourceLanguage: 'hi' }),
      article({ _id: 'gu-1', language: 'gu', status: 'published', translationGroupId: 'group-1', sourceLanguage: 'hi' }),
    ];

    const groups = groupManageNewsArticleRows(rows);

    expect(groups[0].primary._id).toBe('hi-source');
    expect(groups[0].primary.status).toBe('draft');
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
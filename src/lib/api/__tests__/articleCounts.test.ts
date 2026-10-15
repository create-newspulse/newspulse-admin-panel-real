import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getArticleLogicalCounts, normalizeArticleCountsError, type ArticleLogicalCounts,
} from '@/lib/api/articleCounts';
import { listArticles } from '@/lib/api/articles';
import type { ManageNewsParams } from '@/types/api';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: { get: mocks.get } }));

function response(overrides: Partial<ArticleLogicalCounts['counts']> = {}) {
  const counts = { published: 0, draft: 0, scheduled: 0, deleted: 0, archived: 0, mixed: 0, ...overrides };
  return {
    ok: true,
    success: true,
    data: { unit: 'logical-story', total: Object.values(counts).reduce((sum, count) => sum + count, 0), counts },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue({ data: response() });
});

describe('logical-story count API contract', () => {
  it('uses the existing Admin client and supported filters, not list pagination or sorting', async () => {
    const filters: ManageNewsParams = {
      status: 'published', category: 'regional', language: 'hi',
      from: '2026-01-01', to: '2026-02-01', q: 'Source story',
      page: 9, limit: 3, sort: '-publishedAt',
    };
    const controller = new AbortController();
    await getArticleLogicalCounts(filters, controller.signal);
    expect(mocks.get.mock.calls).toEqual([['articles/counts', {
      params: {
        status: 'published', category: 'regional', language: 'hi',
        from: '2026-01-01', to: '2026-02-01', q: 'Source story',
      },
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-store' },
    }]]);
  });

  it('omits the All status exactly as the article-list helper does', async () => {
    await getArticleLogicalCounts({ status: 'all' });
    expect(mocks.get.mock.calls[0][1].params).toEqual({
      status: undefined, category: undefined, language: undefined, from: undefined, to: undefined, q: undefined,
    });
  });

  it('keeps all six exclusive buckets and the full logical total', async () => {
    const body = response({ published: 12, draft: 4, scheduled: 2, deleted: 2, archived: 1, mixed: 1 });
    mocks.get.mockResolvedValue({ data: body });
    expect(await getArticleLogicalCounts()).toEqual(body.data);
    expect(body.data.total).toBe(22);
  });

  it('accepts real zeros only from an authoritative successful empty response', async () => {
    expect(await getArticleLogicalCounts()).toEqual({
      unit: 'logical-story', total: 0,
      counts: { published: 0, draft: 0, scheduled: 0, deleted: 0, archived: 0, mixed: 0 },
    });
  });

  it('accepts the largest safe integer without coercion or rounding', async () => {
    mocks.get.mockResolvedValue({ data: response({ published: Number.MAX_SAFE_INTEGER }) });
    expect(await getArticleLogicalCounts()).toMatchObject({
      total: Number.MAX_SAFE_INTEGER, counts: { published: Number.MAX_SAFE_INTEGER },
    });
  });

  it('does not replace language-record totals or pagination with the logical-story total', async () => {
    const editions = ['en', 'hi', 'gu'].map((language) => ({
      _id: language, language, title: 'One story', translationGroupId: 'one-story', status: 'published',
    }));
    mocks.get.mockResolvedValueOnce({
      data: { items: editions, total: 300, page: 2, limit: 3 },
    }).mockResolvedValueOnce({ data: response({ published: 1 }) });
    const list = await listArticles({ page: 2, limit: 3 });
    const logical = await getArticleLogicalCounts();
    expect(list).toMatchObject({ rows: editions, total: 300, page: 2, pages: 100 });
    expect(logical).toMatchObject({ total: 1, counts: { published: 1 } });
    expect(list.total).toBe(300);
    expect(mocks.get).toHaveBeenCalledTimes(2);
  });

  it.each([
    undefined,
    null,
    {},
    '<html>private upstream diagnostic</html>',
    { ...response(), ok: false },
    { ...response(), success: false },
    { ok: true, data: response().data },
    { success: true, data: response().data },
    { ...response(), data: { ...response().data, unit: 'language-record' } },
    { ...response(), data: { ...response().data, counts: [] } },
    { ...response(), data: { ...response().data, total: 1 } },
  ])('rejects malformed or unsuccessful envelopes safely: %j', async (data) => {
    mocks.get.mockResolvedValue({ data });
    await expect(getArticleLogicalCounts()).rejects.toMatchObject({
      code: 'INVALID_ARTICLE_COUNTS_RESPONSE',
      message: 'Logical story counts response could not be read. Please retry.',
    });
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  const invalidNumbers = [-1, 0.5, '1', null, undefined, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1];
  for (const bucket of ['published', 'draft', 'scheduled', 'deleted', 'archived', 'mixed'] as const) {
    it.each(invalidNumbers)(`rejects invalid ${bucket} values without inventing zeros: %s`, async (value) => {
      const body = response();
      mocks.get.mockResolvedValue({
        data: { ...body, data: { ...body.data, counts: { ...body.data.counts, [bucket]: value } } },
      });
      await expect(getArticleLogicalCounts()).rejects.toMatchObject({ code: 'INVALID_ARTICLE_COUNTS_RESPONSE' });
    });
  }

  it.each(invalidNumbers)('rejects invalid logical totals: %s', async (total) => {
    const body = response();
    mocks.get.mockResolvedValue({ data: { ...body, data: { ...body.data, total } } });
    await expect(getArticleLogicalCounts()).rejects.toMatchObject({ code: 'INVALID_ARTICLE_COUNTS_RESPONSE' });
  });

  it.each([401, 403, 409, 419, 500, 503])('preserves the original HTTP %s error instead of returning counts', async (status) => {
    const error = {
      response: { status, data: { code: 'ARTICLE_LOGICAL_IDENTITY_CONFLICT', message: 'Private Backend diagnostic' } },
    };
    mocks.get.mockRejectedValue(error);
    await expect(getArticleLogicalCounts()).rejects.toBe(error);
    const failure = normalizeArticleCountsError(error);
    expect(failure).toMatchObject({ status, code: 'ARTICLE_LOGICAL_IDENTITY_CONFLICT' });
    expect(failure.message).not.toContain('Private Backend diagnostic');
    if (status === 409) {
      expect(failure).toMatchObject({ retriable: false, message: expect.stringContaining('article identities conflict') });
    }
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it('preserves network errors without creating an empty selection', async () => {
    const error = { code: 'BACKEND_OFFLINE' };
    mocks.get.mockRejectedValue(error);
    await expect(getArticleLogicalCounts()).rejects.toBe(error);
    expect(normalizeArticleCountsError(error)).toMatchObject({
      network: true, message: expect.stringContaining('Cannot reach the Backend'),
    });
  });
});

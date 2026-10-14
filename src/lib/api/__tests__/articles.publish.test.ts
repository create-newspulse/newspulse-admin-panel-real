import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/lib/adminApiClient', () => ({
  adminApiClient: {
    get: mocks.get,
    post: mocks.post,
    put: mocks.put,
    patch: mocks.patch,
    delete: mocks.delete,
  },
}));

import {
  bulkHardDeleteArticles, deleteArticle, getArticle, hardDeleteArticle, listArticles,
  publishArticle, restoreArticle, unpublishArticle, updateArticle, updateArticleStatus,
} from '@/lib/api/articles';

describe('article lifecycle API contract', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.post.mockResolvedValue({ data: { ok: true } });
    mocks.put.mockResolvedValue({ data: { ok: true } });
    mocks.patch.mockResolvedValue({ data: { ok: true } });
    mocks.delete.mockResolvedValue({ data: { ok: true } });
  });

  it('publishes the whole story once, without a client timestamp or status payload', async () => {
    await publishArticle('article 1');

    expect(mocks.post.mock.calls).toEqual([['articles/article%201/publish']]);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it('routes Manage News status publish through the same request contract', async () => {
    await updateArticleStatus('article-2', 'published');

    expect(mocks.post.mock.calls).toEqual([['articles/article-2/publish']]);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('uses one supported update for non-publish status changes, with no fallback mutation', async () => {
    await updateArticleStatus('article-3', 'draft');

    expect(mocks.put.mock.calls).toEqual([['articles/article-3', { status: 'draft' }]]);
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it('unpublishes the whole story without clearing publishedAt', async () => {
    await unpublishArticle('article 1');
    expect(mocks.post.mock.calls).toEqual([['articles/article%201/unpublish', { toStatus: 'draft' }]]);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('soft-deletes once through DELETE, without rewriting status or timestamps', async () => {
    await deleteArticle('article 1');
    expect(mocks.delete.mock.calls).toEqual([['articles/article%201']]);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('restores with no assumed target status and preserves the authoritative response', async () => {
    const restored = {
      ok: true,
      article: { _id: 'article-1', title: 'Restored', status: 'published', publishedAt: '2026-01-01T10:00:00.000Z' },
      restoredStatuses: ['published'],
    };
    mocks.post.mockResolvedValue({ data: restored });
    expect(await restoreArticle('article-1')).toBe(restored);
    expect(mocks.post.mock.calls).toEqual([['articles/article-1/restore']]);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('uses the confirmed permanent-delete endpoint exactly once', async () => {
    await hardDeleteArticle('article 1');
    expect(mocks.post.mock.calls).toEqual([['articles/article%201/hard-delete']]);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('uses the confirmed bulk contract rather than deleting editions one by one', async () => {
    const result = { ok: true, deletedCount: 6, deletedIds: ['en-1', 'hi-1', 'gu-1', 'en-2', 'hi-2', 'gu-2'] };
    mocks.post.mockResolvedValue({ data: result });
    expect(await bulkHardDeleteArticles(['source-1', 'source-2', 'source-1'])).toBe(result);
    expect(mocks.post.mock.calls).toEqual([['articles/forever/bulk', { ids: ['source-1', 'source-2'] }]]);
  });

  it.each([400, 401, 403, 404, 405, 409, 500, 503])('does not retry or guess hard-delete routes after HTTP %s', async (status) => {
    const failure = { response: { status, data: { message: 'Rejected' } } };
    mocks.post.mockRejectedValue(failure);
    await expect(hardDeleteArticle('article-1')).rejects.toBe(failure);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.delete).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('preserves Backend conflict information and does not retry Publish', async () => {
    const failure = { response: { status: 409, data: { message: 'Slug already exists', code: 'SLUG_CONFLICT' } } };
    mocks.post.mockRejectedValue(failure);
    await expect(publishArticle('article-1')).rejects.toBe(failure);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('does not retry a failed non-publish status mutation through a different method', async () => {
    const failure = new Error('Network error');
    mocks.put.mockRejectedValue(failure);
    await expect(updateArticleStatus('article-1', 'draft')).rejects.toBe(failure);
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.patch).not.toHaveBeenCalled();
  });

  it('does not convert a failure envelope into a successful lifecycle action', async () => {
    mocks.post.mockResolvedValue({ data: { ok: false, status: 409, message: 'Article group changed. Reload and retry.' } });
    await expect(restoreArticle('article-1')).rejects.toMatchObject({ response: { status: 409 } });
  });

  it.each([undefined, {}, '<html>upstream page</html>'])('rejects a malformed mutation response', async (data) => {
    mocks.post.mockResolvedValue({ data });
    await expect(publishArticle('article-1')).rejects.toThrow('Invalid article operation response');
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it('rejects an unsuccessful Save Update envelope rather than claiming a successful content update', async () => {
    mocks.put.mockResolvedValue({ data: { ok: false, status: 409, message: 'Article lifecycle changed. Reload and retry the edit.' } });
    await expect(updateArticle('article-1', { title: 'Edit' })).rejects.toMatchObject({ response: { status: 409 } });
  });

  it('keeps publishedAt on reads without synthesizing it on content updates', async () => {
    const article = { _id: 'article-1', title: 'Story', status: 'published', publishedAt: '2026-01-01T10:00:00.000Z' };
    mocks.get.mockResolvedValue({ data: { ok: true, article } });
    expect(await getArticle('article-1')).toMatchObject(article);
    await updateArticle('article-1', { title: 'Updated' });
    expect(mocks.put.mock.calls).toEqual([['articles/article-1', { title: 'Updated' }]]);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('preserves language-record list totals rather than treating a page as a global story count', async () => {
    mocks.get.mockResolvedValue({
      data: { items: [{ _id: 'en-1', title: 'Story', translationGroupId: 'group-1' }], total: 300, page: 1, limit: 20 },
    });
    expect(await listArticles({ limit: 20 })).toMatchObject({ total: 300, pages: 15 });
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it.each([{ ok: false, status: 503 }, {}, { data: '<html>upstream failure</html>' }])(
    'rejects malformed or failed lists instead of presenting an empty newsroom',
    async (data) => {
      mocks.get.mockResolvedValue({ data });
      await expect(listArticles({})).rejects.toThrow();
      expect(mocks.get).toHaveBeenCalledTimes(1);
    },
  );

  it('accepts an authoritative successful empty list', async () => {
    mocks.get.mockResolvedValue({ data: { ok: true, items: [], total: 0, page: 1 } });
    expect(await listArticles({})).toMatchObject({ rows: [], total: 0 });
  });
});
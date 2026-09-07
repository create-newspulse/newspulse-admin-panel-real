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

import { publishArticle, updateArticleStatus } from '@/lib/api/articles';

describe('article publish API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.put.mockResolvedValue({ data: { ok: true } });
    mocks.patch.mockResolvedValue({ data: { ok: true } });
  });

  it('uses the canonical minimal publish request', async () => {
    const publishedAt = '2026-09-08T10:00:00.000Z';

    await publishArticle('article 1', publishedAt);

    expect(mocks.put).toHaveBeenCalledWith('articles/article%201', {
      status: 'published',
      publishedAt,
    });
  });

  it('routes Manage News status publish through the same request contract', async () => {
    await updateArticleStatus('article-2', 'published');

    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.put).toHaveBeenCalledWith('articles/article-2', {
      status: 'published',
      publishedAt: expect.any(String),
    });
  });

  it('does not change the non-publish status contract', async () => {
    await updateArticleStatus('article-3', 'draft');

    expect(mocks.patch).toHaveBeenCalledWith('articles/article-3', { status: 'draft' });
    expect(mocks.put).not.toHaveBeenCalled();
  });
});
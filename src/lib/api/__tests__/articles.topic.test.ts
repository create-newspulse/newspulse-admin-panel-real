import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: mocks }));

import { createArticle, getArticle, updateArticle } from '@/lib/api/articles';

describe('canonical article topic transport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({ data: { ok: true } });
    mocks.put.mockResolvedValue({ data: { ok: true } });
  });

  it('sends the topic code unchanged through the existing create helper', async () => {
    await createArticle({ title: 'Heritage report', category: 'faith-culture', topic: 'living-heritage' });
    expect(mocks.post).toHaveBeenCalledWith('articles', expect.objectContaining({ topic: 'living-heritage' }));
  });

  it('retains explicit null on the canonical update request', async () => {
    await updateArticle('article 1', { topic: null });
    expect(mocks.put).toHaveBeenCalledWith('articles/article%201', { topic: null });
  });

  it('does not add topic when an update omits it', async () => {
    await updateArticle('article-1', { title: 'Unrelated edit' });
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('topic');
  });

  it.each(['living-heritage', 'legacy-topic', null])('preserves canonical topic %s on Edit fetch', async (topic) => {
    mocks.get.mockResolvedValue({ data: { article: { _id: 'article-1', title: 'Heritage report', category: 'faith-culture', topic } } });
    expect(await getArticle('article-1')).toHaveProperty('topic', topic);
  });

  it('propagates ownership HTTP 409 without a fallback or success-shaped response', async () => {
    const error = Object.assign(new Error('Source article required'), { response: { status: 409 } });
    mocks.put.mockRejectedValueOnce(error);
    await expect(updateArticle('child-1', { topic: null })).rejects.toBe(error);
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.post).not.toHaveBeenCalled();
  });
});

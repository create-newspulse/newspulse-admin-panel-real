import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock('@/lib/adminApiClient', () => ({
  adminApiClient: {
    post: mocks.post,
  },
}));

import { requeueArticleTranslations } from '@/lib/api/articles';

function apiError(status: number, message: string) {
  const error: any = new Error(message);
  error.response = { status, data: { message } };
  return error;
}

describe('article translation generation API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({ data: { ok: true } });
  });

  it('uses the canonical admin translation generation endpoint with requested languages', async () => {
    await requeueArticleTranslations('article 1', { languages: ['hi', 'gu'] });

    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledWith('admin/articles/article%201/translations/generate', { languages: ['hi', 'gu'] });
    const path = String(mocks.post.mock.calls[0][0]);
    expect(path).not.toContain('queue-translations');
    expect(path).not.toContain('requeue-translations');
  });

  it('omits the payload when no target languages are requested', async () => {
    await requeueArticleTranslations('article-2');

    expect(mocks.post).toHaveBeenCalledWith('admin/articles/article-2/translations/generate', undefined);
  });

  it.each([
    [401, 'Unauthorized'],
    [403, 'Forbidden'],
    [400, 'Select at least one target language'],
    [500, 'Translation generation failed'],
  ])('surfaces backend status %s without fallback endpoints', async (status, message) => {
    mocks.post.mockRejectedValueOnce(apiError(status, message));

    await expect(requeueArticleTranslations('article-3', { languages: ['hi'] })).rejects.toMatchObject({
      response: { status, data: { message } },
    });

    expect(mocks.post).toHaveBeenCalledTimes(1);
    const path = String(mocks.post.mock.calls[0][0]);
    expect(path).toBe('admin/articles/article-3/translations/generate');
    expect(path).not.toContain('queue-translations');
    expect(path).not.toContain('requeue-translations');
  });
});
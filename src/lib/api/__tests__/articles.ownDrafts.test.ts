import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }));
vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: mocks }));
import { getOwnDraft, listOwnDrafts, updateArticlePartial } from '../articles';

const draft = { _id: 'cms-1', id: 'cms-1', title: 'Synthetic draft', status: 'draft',
  summary: null, description: null, language: 'gu', lang: 'gu', coverImageUrl: null,
  content: 'Synthetic text', tags: [] };
beforeEach(() => vi.resetAllMocks());

describe('Restricted own-draft contracts', () => {
  it('uses the existing authenticated client and only supported pagination parameters', async () => {
    mocks.get.mockResolvedValue({ data: { ok: true, items: [draft], total: 1, page: 1, pages: 1 } });
    const result = await listOwnDrafts();
    expect(mocks.get.mock.calls).toEqual([['articles/own-drafts', { params: { page: 1, limit: 20, sort: '-createdAt' } }]]);
    expect(result.items[0]).toBe(draft);
    expect(result.items[0]).not.toHaveProperty('translationGroupId');
  });

  it('reads one CMS ID without localization, sibling reads or a full-article fallback', async () => {
    mocks.get.mockResolvedValue({ data: { ok: true, article: draft } });
    expect(await getOwnDraft('cms 1')).toBe(draft);
    expect(mocks.get.mock.calls).toEqual([['articles/own-drafts/cms%201']]);
  });

  it.each([401, 403, 404, 409, 503])('preserves HTTP %s without trying a permissive route', async (status) => {
    const error = { response: { status, data: { code: 'DRAFT_READ_FORBIDDEN' } } };
    mocks.get.mockRejectedValue(error);
    await expect(getOwnDraft('cms-1')).rejects.toBe(error);
    expect(mocks.get).toHaveBeenCalledTimes(1);
  });

  it('distinguishes a verified empty list from malformed and failure responses', async () => {
    mocks.get.mockResolvedValueOnce({ data: { ok: true, items: [], total: 0, page: 1, pages: 0 } });
    expect(await listOwnDrafts()).toMatchObject({ items: [], total: 0 });
    mocks.get.mockResolvedValueOnce({ data: {} });
    await expect(listOwnDrafts()).rejects.toThrow('Invalid own-draft response');
    mocks.get.mockResolvedValueOnce({ data: { ok: false, status: 403 } });
    await expect(listOwnDrafts()).rejects.toMatchObject({ response: { status: 403 } });
  });

  it('sends only an intentional patch and never reads or merges omitted article fields', async () => {
    mocks.put.mockResolvedValue({ data: { ok: true, article: { ...draft, title: 'Changed' } } });
    await updateArticlePartial('cms-1', { title: 'Changed', summary: 'Updated summary' });
    expect(mocks.put.mock.calls).toEqual([['articles/cms-1', {
      title: 'Changed', summary: 'Updated summary', description: 'Updated summary',
    }]]);
    expect(mocks.get).not.toHaveBeenCalled();
  });
});

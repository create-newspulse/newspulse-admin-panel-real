import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApiClient } from '@/lib/adminApiClient';
import {
  attachTopicStories, detachTopicStories, listAvailableTopics, listTopicCandidates,
  listTopicStories, loadAvailableTopics, searchTopicStories, topicStoryErrorMessage,
} from '@/lib/api/trendingTopics';
import { articleFollowUpWarning } from '@/lib/articleLifecycle';
import {
  availableTopic, membershipResult, pageResult, syntheticId, topicStory, STORY_ID, TOPIC_ID,
} from '@/tests/fixtures/trendingTopics';

vi.mock('@/lib/adminApiClient', () => ({
  adminApiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));
const client = vi.mocked(adminApiClient, { deep: true });
const available = { ...pageResult([availableTopic()]), lang: 'gu' };
const stories = { ...pageResult([topicStory()]), unit: 'logical-story', lang: 'gu', topicId: TOPIC_ID };

beforeEach(() => {
  vi.resetAllMocks();
  client.get.mockResolvedValue({ data: available });
  client.post.mockResolvedValue({ data: membershipResult() });
});

describe('Trending Topic Story Management V2 API', () => {
  it('loads available topics using the existing relative Admin base and authoritative fields', async () => {
    const params = { lang: 'gu' as const, active: 'all' as const, page: 1, limit: 20 };
    await expect(listAvailableTopics(params)).resolves.toEqual(available);
    expect(client.get).toHaveBeenCalledExactlyOnceWith('admin/topics/available', {
      params, headers: { 'Cache-Control': 'no-store' },
    });
  });

  it('loads current memberships using a CMS News ID, not tags, category, or SEO', async () => {
    const response = { ...available, lang: 'en', logicalStoryId: STORY_ID, items: [availableTopic({ attached: true, membershipConsistent: false })] };
    client.get.mockResolvedValue({ data: response });
    await expect(listAvailableTopics({ lang: 'en', storyId: STORY_ID })).resolves.toMatchObject(response);
    expect(client.get.mock.calls[0][1]?.params).toEqual({ lang: 'en', storyId: STORY_ID });
  });

  it.each([
    { ...available, logicalStoryId: STORY_ID },
    { ...available, items: [availableTopic({ attached: true, membershipConsistent: true })] },
    { ...available, logicalStoryId: STORY_ID, items: [availableTopic({ attached: true })] },
  ])('rejects an incomplete membership response rather than clearing selections', async (data) => {
    client.get.mockResolvedValue({ data });
    await expect(listAvailableTopics({ lang: 'gu', storyId: STORY_ID })).rejects.toThrow();
  });

  it('accepts a successful empty topic list', async () => {
    client.get.mockResolvedValue({ data: { ...pageResult([]), lang: 'gu' } });
    await expect(loadAvailableTopics({ lang: 'gu' })).resolves.toEqual({ items: [], logicalStoryId: undefined });
  });

  it('loads every available-topic page without capping selection at the first 100 topics', async () => {
    const options = Array.from({ length: 101 }, (_, index) => availableTopic({ id: syntheticId(1000 + index) }));
    client.get.mockResolvedValueOnce({ data: { ...pageResult(options.slice(0, 100), { limit: 100, total: 101 }), lang: 'gu' } });
    client.get.mockResolvedValueOnce({ data: { ...pageResult(options.slice(100), { page: 2, limit: 100, total: 101 }), lang: 'gu' } });
    await expect(loadAvailableTopics({ lang: 'gu' })).resolves.toMatchObject({ items: options });
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(client.get.mock.calls[1][1]?.params).toEqual({ lang: 'gu', active: 'all', page: 2, limit: 100 });
  });

  it.each([{}, '<html>unavailable</html>', { ...available, ok: false }, { ...available, count: 5 }])(
    'rejects failed or malformed responses instead of returning empty success', async (data) => {
      client.get.mockResolvedValue({ data });
      await expect(listAvailableTopics({ lang: 'gu' })).rejects.toThrow();
    },
  );

  it('consumes the Backend logical-story rows without expanding translation variants', async () => {
    client.get.mockResolvedValue({ data: stories });
    const result = await listTopicStories(TOPIC_ID, { lang: 'gu', page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].variantIds).toHaveLength(3);
    expect(result.total).toBe(1);
    expect(client.get).toHaveBeenCalledWith(`admin/topics/${TOPIC_ID}/stories`, expect.objectContaining({
      params: { lang: 'gu', page: 1, limit: 20 },
    }));
  });

  it.each([2, 120])('sends bounded Backend search at the %i-character boundary', async (length) => {
    const q = 'a'.repeat(length);
    client.get.mockResolvedValue({ data: { ...stories, ...pageResult(stories.items, { page: 2, limit: 20, total: 21 }), q } });
    await searchTopicStories(TOPIC_ID, { lang: 'gu', q, page: 2, limit: 20 });
    expect(client.get).toHaveBeenCalledExactlyOnceWith(`admin/topics/${TOPIC_ID}/stories/search`, {
      params: { lang: 'gu', q, page: 2, limit: 20 }, headers: { 'Cache-Control': 'no-store' },
    });
  });

  it.each(['a', 'a'.repeat(121), 'ab\ncd'])('rejects invalid search text without a request', async (q) => {
    await expect(searchTopicStories(TOPIC_ID, { lang: 'gu', q })).rejects.toThrow();
    expect(client.get).not.toHaveBeenCalled();
  });

  it('requires suggestionOnly and preserves structured match reasons without writing', async () => {
    const candidate = topicStory({ attached: false, matchReasons: [{ field: 'seo.keywords', term: 'navratri' }] });
    const response = { ...stories, lang: 'en', items: [candidate], suggestionOnly: true, terms: ['navratri'] };
    client.get.mockResolvedValue({ data: response });
    await expect(listTopicCandidates(TOPIC_ID, { lang: 'en' })).resolves.toEqual(response);
    expect(client.get).toHaveBeenCalledWith(`admin/topics/${TOPIC_ID}/candidates`, expect.anything());
    expect(client.post).not.toHaveBeenCalled();
    client.get.mockResolvedValue({ data: { ...response, suggestionOnly: false } });
    await expect(listTopicCandidates(TOPIC_ID, { lang: 'gu' })).rejects.toThrow();
  });

  it.each(['attach', 'detach'] as const)('uses only the canonical %s endpoint and CMS storyIds body', async (action) => {
    client.post.mockResolvedValue({ data: membershipResult(action) });
    const request = action === 'attach' ? attachTopicStories : detachTopicStories;
    await expect(request(TOPIC_ID, [STORY_ID])).resolves.toMatchObject({ committed: true, action, count: 1 });
    expect(client.post).toHaveBeenCalledExactlyOnceWith(`admin/topics/${TOPIC_ID}/stories/${action}`, { storyIds: [STORY_ID] });
    expect(client.put).not.toHaveBeenCalled();
    expect(client.patch).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
  });

  it.each(['attach', 'detach'] as const)('confirms %s with canonical CMS IDs when input uses uppercase hexadecimal', async (action) => {
    const topicId = 'ab'.repeat(12);
    const logicalStoryId = 'cd'.repeat(12);
    const articleId = 'ef'.repeat(12);
    client.post.mockResolvedValue({ data: membershipResult(action, {
      topicId,
      items: [topicStory({ logicalStoryId, articleId, variantIds: [logicalStoryId, articleId], attached: action === 'attach' })],
    }) });
    const request = action === 'attach' ? attachTopicStories : detachTopicStories;
    await expect(request(topicId.toUpperCase(), [articleId.toUpperCase()])).resolves.toMatchObject({ committed: true });
    expect(client.post).toHaveBeenCalledExactlyOnceWith(`admin/topics/${topicId}/stories/${action}`, { storyIds: [articleId] });
  });

  it('supports a full 50-story mutation but rejects 0 or 51 IDs', async () => {
    const ids = Array.from({ length: 50 }, (_, index) => syntheticId(500 + index));
    const items = ids.map((id) => topicStory({ logicalStoryId: id, articleId: id, variantIds: [id] }));
    client.post.mockResolvedValue({ data: membershipResult('attach', { count: 50, items, changedVariants: 50 }) });
    await expect(attachTopicStories(TOPIC_ID, ids)).resolves.toMatchObject({ count: 50 });
    await expect(attachTopicStories(TOPIC_ID, [])).rejects.toThrow();
    await expect(attachTopicStories(TOPIC_ID, [...ids, syntheticId(600)])).rejects.toThrow();
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it.each(['public-article-id', 'group-slug', ''])('rejects non-CMS identifiers before sending %s', async (id) => {
    await expect(attachTopicStories(TOPIC_ID, [id])).rejects.toThrow();
    expect(client.post).not.toHaveBeenCalled();
  });

  it.each([
    { ...membershipResult(), ok: false },
    { ...membershipResult(), committed: false },
    { ...membershipResult(), committed: undefined },
    { ...membershipResult(), action: 'detach' },
    { ...membershipResult(), items: [topicStory({ attached: false })] },
    { ...membershipResult(), items: [topicStory({ variantIds: [syntheticId(900)], logicalStoryId: syntheticId(900) })] },
  ])('never accepts an unconfirmed mutation as success', async (data) => {
    client.post.mockResolvedValue({ data });
    await expect(attachTopicStories(TOPIC_ID, [STORY_ID])).rejects.toThrow();
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it.each([attachTopicStories, detachTopicStories])('propagates UNSAFE_TOPIC_TAGS without retries or tag fallback', async (request) => {
    const error = { response: { status: 409, data: { ok: false, code: 'UNSAFE_TOPIC_TAGS' } } };
    client.post.mockRejectedValue(error);
    await expect(request(TOPIC_ID, [STORY_ID])).rejects.toBe(error);
    expect(topicStoryErrorMessage(error)).toMatch(/UNSAFE_TOPIC_TAGS.*did not change membership.*Founder review/);
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.put).not.toHaveBeenCalled();
    expect(client.patch).not.toHaveBeenCalled();
  });

  it('accepts confirmed persistence with an explicit failed-revalidation warning', async () => {
    client.post.mockResolvedValue({ data: membershipResult('attach', { revalidation: { ok: false, code: 'PUBLIC_REVALIDATION_FAILED' } }) });
    const saved = await attachTopicStories(TOPIC_ID, [STORY_ID]);
    expect(saved.committed).toBe(true);
    expect(articleFollowUpWarning(saved)).toMatch(/saved.*follow-up failed.*do not repeat/);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApiClient } from '@/lib/adminApiClient';
import {
  createTopic, getTopic, listTopics, topicErrorMessage, updateTopic,
  type CreateEditorialTopicPayload, type EditorialTopic,
} from '@/lib/api/trendingTopics';

vi.mock('@/lib/adminApiClient', () => ({
  adminApiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
const client = vi.mocked(adminApiClient, { deep: true });
const id = '000000000000000000000101';
const newsId = '000000000000000000000201';
const topic: EditorialTopic = {
  id, slug: 'navratri-2026',
  name: { gu: 'નવરાત્રી', hi: 'नवरात्रि', en: 'Navratri' },
  description: { gu: '', hi: '', en: '' },
  active: false, order: 0, startsAt: '2026-10-15T04:00:00.000Z', expiresAt: null,
  articleTags: ['topic:navratri-2026'], pinnedArticleId: null,
};
const payload: CreateEditorialTopicPayload = {
  slug: topic.slug, name: topic.name, description: topic.description,
  active: false, order: 0, startsAt: topic.startsAt, expiresAt: null,
  articleTags: topic.articleTags, pinnedArticleId: null,
};
const list = { ok: true, items: [topic], total: 1, count: 1, page: 1, limit: 20, totalPages: 1, hasNextPage: false };

beforeEach(() => {
  vi.resetAllMocks();
  client.get.mockResolvedValue({ data: list });
  client.post.mockResolvedValue({ data: { ok: true, topic } });
  client.patch.mockResolvedValue({ data: { ok: true, topic } });
});

describe('Editorial Topics API contract', () => {
  it('uses the exact admin/topics resource and top-level backend pagination', async () => {
    await expect(listTopics({ active: 'all', page: 1, limit: 20 })).resolves.toEqual(list);
    expect(client.get).toHaveBeenCalledExactlyOnceWith('admin/topics', {
      params: { active: 'all', page: 1, limit: 20 }, headers: { 'Cache-Control': 'no-store' },
    });
    expect(client.post).not.toHaveBeenCalled();
    expect(client.patch).not.toHaveBeenCalled();
  });

  it('accepts a genuinely empty list, including zero totalPages', async () => {
    const empty = { ...list, items: [], total: 0, count: 0, totalPages: 0 };
    client.get.mockResolvedValue({ data: empty });
    await expect(listTopics()).resolves.toEqual(empty);
  });

  it('gets one topic by the backend id', async () => {
    client.get.mockResolvedValue({ data: { ok: true, topic } });
    await expect(getTopic(id)).resolves.toEqual(topic);
    expect(client.get).toHaveBeenCalledExactlyOnceWith(`admin/topics/${id}`, { headers: { 'Cache-Control': 'no-store' } });
  });

  it('keeps one multilingual record and strips unused backend actor metadata', async () => {
    client.get.mockResolvedValue({ data: { ok: true, topic: { ...topic, createdBy: 'actor-1', updatedBy: 'actor-2', href: '/topic/navratri-2026' } } });
    const result = await getTopic(id);
    expect(result.name).toEqual(topic.name);
    expect(result).not.toHaveProperty('createdBy');
    expect(result).not.toHaveProperty('updatedBy');
    expect(result).not.toHaveProperty('href');
  });

  it('creates through POST, retaining exact tag codes and all three languages', async () => {
    await expect(createTopic(payload)).resolves.toEqual(topic);
    expect(client.post).toHaveBeenCalledExactlyOnceWith('admin/topics', payload);
    expect(client.patch).not.toHaveBeenCalled();
  });

  it('defaults omitted create controls to inactive, order zero, and null expiry/pin', async () => {
    await createTopic({ slug: topic.slug, name: topic.name, articleTags: topic.articleTags, startsAt: topic.startsAt });
    expect(client.post).toHaveBeenCalledExactlyOnceWith('admin/topics', {
      slug: topic.slug, name: topic.name, articleTags: topic.articleTags, startsAt: topic.startsAt,
      active: false, order: 0, expiresAt: null, pinnedArticleId: null,
    });
  });

  it('trims names/descriptions and deduplicates tags without changing tag case or colon syntax', async () => {
    await createTopic({
      ...payload,
      name: { gu: ' ગુજરાતી ', hi: ' हिन्दी ', en: ' English ' },
      description: { en: ' Description ' },
      articleTags: [' topic:Navratri-2026 ', 'topic:Navratri-2026', 'festival'],
    });
    expect(client.post.mock.calls[0][1]).toMatchObject({
      name: { gu: 'ગુજરાતી', hi: 'हिन्दी', en: 'English' },
      description: { en: 'Description' },
      articleTags: ['topic:Navratri-2026', 'festival'],
    });
  });

  it('uses PATCH for partial edits and explicit null clearing', async () => {
    const patch = { name: { gu: 'નવી નવરાત્રી' }, description: { hi: '' }, order: -2, expiresAt: null, pinnedArticleId: null };
    await updateTopic(id, patch);
    expect(client.patch).toHaveBeenCalledExactlyOnceWith(`admin/topics/${id}`, patch);
    expect(client.put).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
  });

  it.each([true, false])('sends only active:%s for a row action', async (active) => {
    await updateTopic(id, { active });
    expect(client.patch).toHaveBeenCalledExactlyOnceWith(`admin/topics/${id}`, { active });
  });

  it('sends a pin as a CMS News ObjectId string', async () => {
    await updateTopic(id, { pinnedArticleId: newsId });
    expect(client.patch).toHaveBeenCalledWith(`admin/topics/${id}`, { pinnedArticleId: newsId });
  });

  it('rejects attempts to edit the immutable slug before making a request', async () => {
    // @ts-expect-error The immutable slug is intentionally not an update field.
    await expect(updateTopic(id, { slug: 'changed-slug' })).rejects.toThrow();
    expect(client.patch).not.toHaveBeenCalled();
  });

  it('rejects unsupported list query parameters rather than inventing backend search', async () => {
    // @ts-expect-error The backend accepts active/page/limit, not q.
    await expect(listTopics({ q: 'festival' })).rejects.toThrow();
    expect(client.get).not.toHaveBeenCalled();
  });

  it('rejects an invalid id or empty patch before any request', async () => {
    await expect(getTopic('not-a-topic-id')).rejects.toThrow();
    await expect(updateTopic(id, {})).rejects.toThrow();
    expect(client.get).not.toHaveBeenCalled();
    expect(client.patch).not.toHaveBeenCalled();
  });

  it.each([null, {}, '<html>Not deployed</html>', { ...list, ok: false }, { ...list, items: undefined }, { ...list, totalPages: undefined }])(
    'rejects malformed lists instead of fake empty success: %j', async (data) => {
      client.get.mockResolvedValue({ data });
      await expect(listTopics()).rejects.toThrow();
      expect(client.get).toHaveBeenCalledTimes(1);
    },
  );

  it.each([getTopic, () => createTopic(payload), () => updateTopic(id, { active: true })])(
    'rejects a malformed single-topic response', async (request) => {
      client.get.mockResolvedValue({ data: { ok: true } });
      client.post.mockResolvedValue({ data: { ok: true } });
      client.patch.mockResolvedValue({ data: { ok: true } });
      await expect(request(id)).rejects.toThrow();
    },
  );

  it.each([400, 401, 403, 404, 409, 503, 500])('propagates HTTP %i across all operations without fallback requests', async (status) => {
    const failure = { response: { status, data: { ok: false, code: status === 409 ? 'SLUG_CONFLICT' : 'REQUEST_FAILED' } } };
    client.get.mockRejectedValue(failure);
    client.post.mockRejectedValue(failure);
    client.patch.mockRejectedValue(failure);
    await expect(listTopics()).rejects.toBe(failure);
    await expect(getTopic(id)).rejects.toBe(failure);
    await expect(createTopic(payload)).rejects.toBe(failure);
    await expect(updateTopic(id, { active: false })).rejects.toBe(failure);
    expect(client.get).toHaveBeenCalledTimes(2);
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(client.patch).toHaveBeenCalledTimes(1);
    expect(client.put).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
  });

  it('does not turn a network error into success', async () => {
    const failure = new Error('Network Error');
    client.get.mockRejectedValue(failure);
    await expect(listTopics()).rejects.toBe(failure);
  });

  it.each([
    [400, 'INVALID_INPUT', 'Check the topic fields'],
    [401, 'UNAUTHORIZED', 'session has expired'],
    [403, 'FORBIDDEN', 'Access denied'],
    [404, 'TOPIC_NOT_FOUND', 'Topic not found'],
    [409, 'SLUG_CONFLICT', 'canonical slug already exists'],
    [409, 'EDIT_CONFLICT', 'topic has changed'],
    [503, 'TOPICS_UNAVAILABLE', 'temporarily unavailable'],
    [500, 'INTERNAL_ERROR', 'Unable to process'],
  ])('maps HTTP %i/%s to an explicit safe message', (status, code, text) => {
    expect(topicErrorMessage({ response: { status, data: { code, message: 'internal details must not leak' } } })).toContain(text);
  });
});

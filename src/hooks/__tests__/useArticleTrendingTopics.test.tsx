import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopicMembershipSaveError, useArticleTrendingTopics } from '@/hooks/useArticleTrendingTopics';
import type { AvailableTopicsParams, TopicMembershipResponse } from '@/lib/api/trendingTopics';
import {
  availableTopic, membershipResult, otherTopic, pageResult, syntheticId, topicStory,
  OTHER_TOPIC_ID, STORY_ID, TOPIC_ID,
} from '@/tests/fixtures/trendingTopics';

const mocks = vi.hoisted(() => ({
  access: { canRead: true, canEdit: true, isFounder: true, loading: false, reason: '' },
  get: vi.fn<(path: string, config?: { params?: AvailableTopicsParams }) => Promise<{ data: unknown }>>(),
  post: vi.fn<(path: string, body: { storyIds: string[] }) => Promise<{ data: TopicMembershipResponse }>>(),
}));
vi.mock('@/hooks/useTrendingTopicsAccess', () => ({ useTrendingTopicsAccess: () => ({ ...mocks.access }) }));
vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: { get: mocks.get, post: mocks.post } }));

type HookProps = Parameters<typeof useArticleTrendingTopics>[0];
const editProps: HookProps = { storyId: STORY_ID, lang: 'en', resetKey: STORY_ID };
const clients: QueryClient[] = [];
const memberships = new Map<string, Set<string>>();
const unsafe = { response: { status: 409, data: { ok: false, code: 'UNSAFE_TOPIC_TAGS' } } };

async function handlePost(path: string, body: { storyIds: string[] }) {
  const match = /^admin\/topics\/([^/]+)\/stories\/(attach|detach)$/.exec(path);
  if (!match) throw new Error(`Unexpected topic mutation: ${path}`);
  const topicId = match[1];
  const action = match[2] === 'attach' ? 'attach' : 'detach';
  for (const id of body.storyIds) {
    const selected = memberships.get(id) ?? new Set<string>();
    if (action === 'attach') selected.add(topicId);
    else selected.delete(topicId);
    memberships.set(id, selected);
  }
  return { data: membershipResult(action, {
    topicId, count: body.storyIds.length,
    items: body.storyIds.map((id) => topicStory({
      logicalStoryId: id, articleId: id, variantIds: [id], attached: action === 'attach',
    })),
  }) };
}

function renderTopics(props: HookProps = editProps) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...renderHook((options: HookProps) => useArticleTrendingTopics(options), { initialProps: props, wrapper }), client };
}

beforeEach(() => {
  vi.resetAllMocks();
  memberships.clear();
  Object.assign(mocks.access, { canRead: true, canEdit: true, isFounder: true, loading: false, reason: '' });
  mocks.get.mockImplementation(async (path, config) => {
    const params = config?.params;
    if (path !== 'admin/topics/available' || !params) throw new Error(`Unexpected topic read: ${path}`);
    const selected = memberships.get(params.storyId ?? '') ?? new Set<string>();
    const items = [availableTopic(), otherTopic()].map((topic) => ({
      ...topic,
      ...(params.storyId ? { attached: selected.has(topic.id), membershipConsistent: true } : {}),
    }));
    return { data: { ...pageResult(items, { limit: 100 }), lang: params.lang, ...(params.storyId ? { logicalStoryId: params.storyId } : {}) } };
  });
  mocks.post.mockImplementation(handlePost);
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
});

describe('Article Trending Topics selection and save state', () => {
  it('preserves pending logical-story choices across language changes without attaching', async () => {
    const { result, rerender } = renderTopics();
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    act(() => result.current.setSelected(TOPIC_ID, true));
    rerender({ ...editProps, lang: 'hi' });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(result.current.isSelected(TOPIC_ID)).toBe(true);
    expect(result.current.snapshotChanges()).toEqual({ [TOPIC_ID]: true });
    expect(mocks.get).toHaveBeenLastCalledWith('admin/topics/available', expect.objectContaining({
      params: { lang: 'hi', storyId: STORY_ID, active: 'all', page: 1, limit: 100 },
    }));
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('cancels a staged choice when the user returns to authoritative membership', async () => {
    const { result } = renderTopics();
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    act(() => {
      result.current.setSelected(TOPIC_ID, true);
      result.current.setSelected(TOPIC_ID, false);
    });
    expect(result.current.isDirty).toBe(false);
    await act(async () => { await result.current.saveChanges(STORY_ID, result.current.snapshotChanges()); });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('keeps new-story choices when Save Draft obtains an ID, then confirms membership once', async () => {
    const { result, rerender } = renderTopics({ storyId: null, lang: 'gu', resetKey: null });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    act(() => result.current.setSelected(TOPIC_ID, true));
    rerender({ storyId: STORY_ID, lang: 'gu', resetKey: null });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(result.current.hasPendingChanges()).toBe(true);
    await act(async () => { await result.current.saveChanges(STORY_ID, result.current.snapshotChanges()); });
    expect(result.current.isSelected(TOPIC_ID)).toBe(true);
    expect(result.current.hasPendingChanges()).toBe(false);
    await act(async () => { await result.current.saveChanges(STORY_ID, result.current.snapshotChanges()); });
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(`admin/topics/${TOPIC_ID}/stories/attach`, { storyIds: [STORY_ID] });
  });

  it('clears pending choices and conflict state when opening a different article', async () => {
    const nextStory = syntheticId(301);
    memberships.set(nextStory, new Set([OTHER_TOPIC_ID]));
    const { result, rerender } = renderTopics();
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    act(() => result.current.setSelected(TOPIC_ID, true));
    mocks.post.mockRejectedValueOnce(unsafe);
    await act(async () => {
      await expect(result.current.saveChanges(STORY_ID, result.current.snapshotChanges())).rejects.toBeInstanceOf(TopicMembershipSaveError);
    });
    expect(result.current.saveError).toContain('UNSAFE_TOPIC_TAGS');
    rerender({ storyId: nextStory, lang: 'en', resetKey: nextStory });
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    expect(result.current.isDirty).toBe(false);
    expect(result.current.saveError).toBe('');
    expect(result.current.isSelected(TOPIC_ID)).toBe(false);
    expect(result.current.isSelected(OTHER_TOPIC_ID)).toBe(true);
  });

  it('keeps only unconfirmed changes pending after partial success and retries only those changes', async () => {
    const { result } = renderTopics();
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    act(() => {
      result.current.setSelected(TOPIC_ID, true);
      result.current.setSelected(OTHER_TOPIC_ID, true);
    });
    mocks.post.mockImplementationOnce(handlePost).mockRejectedValueOnce(unsafe);
    await act(async () => {
      await expect(result.current.saveChanges(STORY_ID, result.current.snapshotChanges())).rejects.toThrow(/Some topic changes were saved/);
    });
    expect(result.current.snapshotChanges()).toEqual({ [OTHER_TOPIC_ID]: true });
    expect(result.current.isSelected(TOPIC_ID)).toBe(true);
    expect(memberships.get(STORY_ID)).toEqual(new Set([TOPIC_ID]));
    await act(async () => { await result.current.saveChanges(STORY_ID, result.current.snapshotChanges()); });
    expect(mocks.post.mock.calls.map(([path]) => path)).toEqual([
      `admin/topics/${TOPIC_ID}/stories/attach`,
      `admin/topics/${OTHER_TOPIC_ID}/stories/attach`,
      `admin/topics/${OTHER_TOPIC_ID}/stories/attach`,
    ]);
    expect(result.current.isDirty).toBe(false);
    expect(memberships.get(STORY_ID)).toEqual(new Set([TOPIC_ID, OTHER_TOPIC_ID]));
  });

  it('reports a failed refresh after commitment without retaining or repeating the confirmed mutation', async () => {
    const { result, client } = renderTopics();
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    act(() => result.current.setSelected(TOPIC_ID, true));
    mocks.get.mockRejectedValueOnce(new Error('Refresh unavailable'));
    await act(async () => {
      const warning = await result.current.saveChanges(STORY_ID, result.current.snapshotChanges());
      expect(warning).toMatch(/Membership was saved.*do not repeat confirmed changes/);
    });
    expect(result.current.hasPendingChanges()).toBe(false);
    expect(result.current.query.isError).toBe(true);
    await act(async () => {
      await result.current.saveChanges(STORY_ID, result.current.snapshotChanges());
      await client.invalidateQueries({ queryKey: ['trending-topics'] });
    });
    expect(result.current.isSelected(TOPIC_ID)).toBe(true);
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it('surfaces Backend follow-up warnings without treating committed membership as a failed write', async () => {
    const { result } = renderTopics();
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    act(() => result.current.setSelected(TOPIC_ID, true));
    mocks.post.mockImplementationOnce(async (path, body) => {
      const response = await handlePost(path, body);
      return { data: { ...response.data, revalidation: { ok: false } } };
    });
    await act(async () => {
      const warning = await result.current.saveChanges(STORY_ID, result.current.snapshotChanges());
      expect(warning).toMatch(/saved.*Backend follow-up failed/);
    });
    expect(result.current.saveError).toBe('');
    expect(result.current.isSelected(TOPIC_ID)).toBe(true);
    expect(result.current.hasPendingChanges()).toBe(false);
  });

  it('rechecks existing mutation access without discarding pending choices', async () => {
    const { result, rerender } = renderTopics();
    await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
    act(() => result.current.setSelected(TOPIC_ID, true));
    mocks.access.canEdit = false;
    rerender(editProps);
    await act(async () => {
      await expect(result.current.saveChanges(STORY_ID, result.current.snapshotChanges())).rejects.toThrow(/Edit news special right/);
    });
    expect(result.current.isDirty).toBe(true);
    expect(mocks.post).not.toHaveBeenCalled();
  });
});

import apiClient from '@/lib/api';
import type { ArticleStatus } from '@/types/articles';
import type { CommunityStoryListResponse } from '@/types/community';

const MY_STORIES_PATH = '/community/stories/my';

export async function listMyStories(params?: {
  status?: ArticleStatus | 'all';
  q?: string;
  page?: number;
  limit?: number;
}) {
  const query = { ...(params || {}) } as any;
  if (query.status === 'all') delete query.status;

  const res = await apiClient.get<CommunityStoryListResponse>(MY_STORIES_PATH, {
    params: query,
  });

  const data = res.data as CommunityStoryListResponse;
  if (!data?.ok) {
    throw new Error('Failed to load my stories');
  }

  return data;
}

export async function withdrawStory(id: string) {
  const res = await apiClient.post(`/community/stories/${id}/withdraw`);
  return res.data;
}

export async function deleteMyStory(id: string) {
  try {
    const res = await apiClient.delete(`/articles/${id}`);
    return res.data;
  } catch (err) {
    throw err;
  }
}

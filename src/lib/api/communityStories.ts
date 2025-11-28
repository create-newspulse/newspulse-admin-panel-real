import apiClient from '@/lib/api';
import type { ArticleStatus } from '@/types/articles';

export interface CommunityStory {
  _id: string;
  title: string;
  summary?: string;
  content?: string;
  status: ArticleStatus;        // reusing admin article statuses
  createdAt?: string;
  updatedAt?: string;
  language?: string;
  category?: string;
  city?: string;
  source?: string;
  submittedBy?: string;         // user id or email
}

export interface StoryListResponse {
  ok: boolean;
  items: CommunityStory[];
  total: number;
}

const MY_STORIES_PATH = '/community/stories/my';

export async function listMyStories(params?: {
  status?: ArticleStatus | 'all';
  q?: string;
  page?: number;
  limit?: number;
}) {
  const query = { ...(params || {}) } as any;
  if (query.status === 'all') delete query.status;

  const res = await apiClient.get<StoryListResponse>(MY_STORIES_PATH, {
    params: query,
  });

  const data = res.data as StoryListResponse;
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

import { adminApi } from '@/lib/adminApi';
import type { CommunityReporterStory } from './types';

export interface CommunityStoriesQuery {
  status?: string; // 'all' | 'pending' | 'approved' | 'rejected' | etc.
  search?: string; // title substring
}

export async function fetchCommunityStories(
  params: CommunityStoriesQuery = {}
): Promise<CommunityReporterStory[]> {
  const response = await adminApi.get('/community/reporter-stories', {
    params,
  });
  const data = response?.data || {};
  return Array.isArray(data.stories)
    ? (data.stories as CommunityReporterStory[])
    : Array.isArray(data.items)
      ? (data.items as CommunityReporterStory[])
      : [];
}

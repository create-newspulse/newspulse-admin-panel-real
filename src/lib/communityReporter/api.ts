import { adminApi } from '@/lib/adminApi';
import type { CommunityReporterStory } from './types';

export interface CommunityStoriesQuery {
  status?: string; // 'all' | 'pending' | 'approved' | 'rejected' | etc.
  search?: string; // title substring
}

export async function fetchCommunityStories(
  params: CommunityStoriesQuery = {}
): Promise<CommunityReporterStory[]> {
  const normalized: Record<string, any> = {};
  const statusVal = String(params.status || '').toLowerCase();
  if (statusVal && statusVal !== 'all') normalized.status = statusVal;
  if (params.search) normalized.search = params.search;
  const response = await adminApi.get('/community/my-stories', {
    params: normalized,
  });
  const data = response?.data || {};
  return Array.isArray(data.stories)
    ? (data.stories as CommunityReporterStory[])
    : Array.isArray(data.items)
      ? (data.items as CommunityReporterStory[])
      : [];
}

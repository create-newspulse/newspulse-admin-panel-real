import apiClient from '@/lib/api';

export type ReporterType = 'community' | 'journalist';
export type StoryStatus =
  | 'under_review'
  | 'draft'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export interface SubmitStoryResult {
  ok: boolean;
  message: string;
  storyId: string;
  referenceId: string;
  status: StoryStatus;
  reporterType: ReporterType;
  reporterName?: string;
}

export async function submitCommunityStory(payload: any): Promise<SubmitStoryResult> {
  // Public community endpoint (proxy mode: /admin-api/community/* -> backend /api/community/*)
  const res = await apiClient.post<SubmitStoryResult>('/community/stories/submit', payload);
  return res.data;
}

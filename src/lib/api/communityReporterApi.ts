import { adminApi } from '@/lib/adminApi';

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
  const res = await adminApi.post<SubmitStoryResult>('/api/community/stories/submit', payload);
  return res.data;
}

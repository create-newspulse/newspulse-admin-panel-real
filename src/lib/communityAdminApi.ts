import { adminApi } from '@/lib/adminApi';

export interface ReporterAdminStory {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  language: string;
  category: string | null;
  city: string | null;
  createdAt: string;
  updatedAt: string;
  aiRisk?: string | null;
  priority?: string | null;
}

export interface ReporterAdminStoryListResponse {
  ok: boolean;
  items: ReporterAdminStory[];
  total: number;
}

// TODO: Confirm backend path; using existing admin submissions list with reporter filter
export async function listReporterStoriesForAdmin(
  reporterKey: string,
  params?: { page?: number; limit?: number; status?: string }
) {
  // Try a canonical admin endpoint; adjust as needed when backend confirms
  const query = { reporterKey, ...(params || {}) };
  const { data } = await adminApi.get<ReporterAdminStoryListResponse>('/api/admin/community/submissions', { params: query });
  if (!data?.ok) throw new Error('Failed to load reporter stories');
  return data;
}

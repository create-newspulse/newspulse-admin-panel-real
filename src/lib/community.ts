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

// Fetch stories for a reporter (admin-only). Backend should implement /admin/community/reporter-stories.
// TODO: Confirm backend response shape and whether pagination will be added.
export async function listReporterStoriesForAdmin(
  reporterKey: string,
  _params?: { page?: number; limit?: number; status?: string }
) {
  // Try canonical path first, then fallback to /api/admin prefixed variant
  const paths = ['/admin/community/reporter-stories', '/api/admin/community/reporter-stories'];
  let lastErr: any = null;
  for (const p of paths) {
    try {
      const { data } = await adminApi.get<ReporterAdminStoryListResponse>(p, { params: { reporterKey } });
      if (data?.ok) return data;
      lastErr = new Error('Failed to load reporter stories');
    } catch (e: any) {
      lastErr = e;
      // continue to next path on 404/405; abort early on auth errors
      const status = e?.response?.status;
      if (status === 401 || status === 403) break;
      continue;
    }
  }
  throw lastErr || new Error('Reporter stories endpoint not available');
}

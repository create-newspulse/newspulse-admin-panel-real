import { adminApi, resolveAdminPath } from '@/lib/adminApi';

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

// New: Fetch stories by reporter email for admin view
// Preferred route: GET /api/admin/community/reporter-stories-by-email?email=...
// Fallback:      GET /api/community-reporter/my-stories?email=... (public alias)
export async function listReporterStoriesByEmail(
  email: string,
  params?: { page?: number; limit?: number; status?: string; q?: string }
): Promise<ReporterAdminStoryListResponse> {
  const cleanEmail = (email || '').trim();
  if (!cleanEmail) throw new Error('Email is required');

  const query = { ...(params || {}), email: cleanEmail } as Record<string, any>;
  // Some backends use different param names.
  query.reporterKey = query.reporterKey || cleanEmail;
  if (query.q && !query.search) query.search = query.q;

  const candidatePaths = [
    // Most common admin path (proxy mode => /admin-api/admin/...) 
    resolveAdminPath('/admin/community/reporter-stories'),
    // Legacy/non-admin public style (proxy mode => /admin-api/admin/community/... won't apply)
    resolveAdminPath('/community/reporter-stories'),
  ];

  let lastErr: any = null;
  for (const path of candidatePaths) {
    try {
      const { data } = await adminApi.get<any>(path, { params: query });
      // Normalize multiple known shapes into ReporterAdminStoryListResponse
      const items = (data?.items || data?.stories || data?.data?.items || data?.data?.stories) as any;
      if (Array.isArray(items)) {
        return {
          ok: true,
          items,
          total: typeof data?.total === 'number' ? data.total : items.length,
        };
      }
      if (data?.ok && Array.isArray(data?.items)) return data as ReporterAdminStoryListResponse;
      lastErr = new Error('Unexpected response shape');
      continue;
    } catch (e: any) {
      lastErr = e;
      const status = e?.response?.status;
      // Abort early on auth errors
      if (status === 401 || status === 403) break;
      continue;
    }
  }

  // Final fallback: treat email as reporterKey and use the reporterKey-based endpoint.
  try {
    return await listReporterStoriesForAdmin(cleanEmail, params);
  } catch (e: any) {
    lastErr = e;
  }

  throw lastErr || new Error('Failed to load reporter stories');
}

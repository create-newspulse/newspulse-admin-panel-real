// src/lib/api/communityReporterStories.ts
import { adminApi, resolveAdminPath } from '@/lib/adminApi';

// Shape for stories in the admin "My Community Stories" table
export interface AdminCommunityStory {
  id: string;
  headline: string;
  summary?: string;
  language?: string;
  category?: string;
  city?: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminCommunityStoryQuery {
  email?: string; // reporter email (optional)
  status?: string; // 'all' | 'pending' | 'approved' | 'rejected'
  search?: string; // title substring
}

// Fetch stories from the same endpoint used by the Community Reporter Queue.
// IMPORTANT: If your queue page uses a different path, copy that exact string
// instead of '/community/reporter-stories'.
export async function listAdminCommunityStories(
  params: AdminCommunityStoryQuery = {},
): Promise<AdminCommunityStory[]> {
  const email = (params.email || '').trim();
  // Try the reporter-stories path first (admin-style), then community path, then submissions fallback.
  const candidatePaths = [
    '/admin/community/reporter-stories',
    '/community/reporter-stories',
    '/community-reporter/submissions',
  ];

  let lastError: any = null;
  for (const p of candidatePaths) {
    try {
      const path = resolveAdminPath(p);
      const response = await adminApi.get(path, { params: { email: email || undefined, status: params.status, search: params.search } });
      const payload = response.data || {};
      // submissions fallback may return { submissions: [] }
      const raw =
        (payload as any).stories ||
        (payload as any).items ||
        (payload as any).submissions ||
        (payload as any)?.data?.stories ||
        (payload as any)?.data?.items ||
        (payload as any)?.data?.submissions ||
        (Array.isArray(payload) ? payload : []);

      if (!Array.isArray(raw)) {
        // Not the right shape; try next
        lastError = new Error('Unexpected response shape');
        continue;
      }

      // Normalize common field names so the table code is simple.
      return raw.map((story: any): AdminCommunityStory => ({
        id: story.id ?? story._id ?? String(story.refId ?? story.referenceId ?? Math.random()),
        headline: story.headline ?? story.title ?? '',
        summary: story.summary ?? story.storySummary ?? story.aiSummary ?? '',
        language: story.language ?? story.lang ?? '',
        category: story.category ?? story.categorySlug ?? story.topic ?? '',
        city: story.city ?? story.location?.city ?? story.cityName ?? '',
        status: story.status ?? story.reviewStatus ?? story.state ?? 'PENDING',
        createdAt: story.createdAt ?? story.created_at ?? story.created ?? new Date().toISOString(),
        updatedAt: story.updatedAt ?? story.updated_at ?? story.updated,
      }));
    } catch (e: any) {
      lastError = e;
      // Continue to next candidate unless it's an auth error
      const status = e?.response?.status;
      if (status === 401 || status === 403) break;
      continue;
    }
  }

  // If all attempts failed, throw the last error for the caller to handle.
  throw lastError || new Error('Reporter stories endpoint not available');
}

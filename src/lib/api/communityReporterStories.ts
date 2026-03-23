// src/lib/api/communityReporterStories.ts
import { adminApi, resolveAdminPath } from '@/lib/adminApi';

// Shape for stories in the admin "My Community Stories" table
export interface AdminCommunityStory {
  id: string;
  headline: string;
  // Summary intentionally not used by the Story Desk table, but may exist on the backend.
  summary?: string;
  language?: string;
  category?: string;
  city?: string;
  district?: string;
  state?: string;
  country?: string;
  reporterName?: string;
  reporterEmail?: string;
  reporterPhone?: string;
  reporterKey?: string;
  sourceId?: string;
  linkedArticleId?: string;
  linkedArticleSlug?: string;
  linkedArticleStatus?: string;
  published?: boolean;
  publishedAt?: string;
  views?: number;
  status: string;
  // Optional backend capability/state flags; when present, UI prefers these over status-string heuristics.
  isDeleted?: boolean;
  canSoftDelete?: boolean;
  canRestore?: boolean;
  canPermanentDelete?: boolean;
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
        id: story.id ?? story._id ?? String(story.refId ?? story.referenceId ?? story.sourceId ?? Math.random()),
        headline: story.headline ?? story.title ?? story.heading ?? '',
        summary: story.summary ?? story.storySummary ?? story.aiSummary ?? '',
        language: story.language ?? story.lang ?? story.locale ?? '',
        category: story.category ?? story.categorySlug ?? story.topic ?? story.section ?? '',
        city: story.city ?? story.location?.city ?? story.location?.town ?? story.cityName ?? '',
        district: story.district ?? story.location?.district ?? story.location?.area ?? '',
        state: story.state ?? story.location?.state ?? story.location?.region ?? '',
        country: story.country ?? story.location?.country ?? story.location?.nation ?? '',
        reporterName: story.reporterName ?? story.userName ?? story.name ?? story.contactName ?? story.authorName ?? '',
        reporterEmail: story.contactEmail ?? story.email ?? story.reporterEmail ?? story.authorEmail ?? '',
        reporterPhone: story.contactPhone ?? story.phone ?? story.whatsapp ?? story.reporterPhone ?? '',
        reporterKey: story.reporterKey ?? story.userId ?? story.ownerId ?? story.reporterId ?? '',
        sourceId: story.referenceId ?? story.refId ?? story.sourceId ?? story.externalId ?? '',
        linkedArticleId: story.linkedArticleId ?? story.articleId ?? story.draftArticleId ?? story.article?._id ?? story.article?.id ?? '',
        linkedArticleSlug: story.slug ?? story.articleSlug ?? story.article?.slug ?? '',
        linkedArticleStatus: story.articleStatus ?? story.publicationStatus ?? story.article?.status ?? '',
        published: Boolean(
          story.published
          ?? story.isPublished
          ?? (String(story.articleStatus ?? story.publicationStatus ?? story.article?.status ?? '').toLowerCase() === 'published')
        ),
        publishedAt: story.publishedAt ?? story.article?.publishedAt ?? story.liveAt ?? story.goLiveAt ?? '',
        views: Number(story.views ?? story.viewCount ?? story.article?.views ?? story.article?.viewCount ?? 0) || 0,
        status: story.status ?? story.reviewStatus ?? story.state ?? story.workflowStatus ?? 'PENDING',
        createdAt: story.createdAt ?? story.created_at ?? story.created ?? story.submittedAt ?? new Date().toISOString(),
        updatedAt: story.updatedAt ?? story.updated_at ?? story.updated ?? story.modifiedAt,
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

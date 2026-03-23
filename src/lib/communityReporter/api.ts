import { adminApi } from '@/lib/adminApi';
import { api } from '@/lib/api';
import type { CommunityReporterStory } from './types';

let loggedStoryShape = false;

export interface CommunityStoriesQuery {
  status?: string; // 'all' | 'pending' | 'approved' | 'rejected' | etc.
  search?: string; // title substring
  page?: number;
  limit?: number;
}

function normalizeCommunityStoriesQuery(params: CommunityStoriesQuery = {}): Record<string, any> {
  const normalized: Record<string, any> = {};

  const statusVal = String(params.status || '').toLowerCase().trim();
  if (statusVal && statusVal !== 'all') normalized.status = statusVal;

  const searchVal = String(params.search ?? '').trim();
  if (searchVal) normalized.search = searchVal;

  const page = typeof params.page === 'number' ? params.page : Number(params.page);
  if (Number.isFinite(page) && page >= 1) normalized.page = Math.floor(page);

  const limit = typeof params.limit === 'number' ? params.limit : Number(params.limit);
  if (Number.isFinite(limit) && limit >= 1) normalized.limit = Math.floor(limit);

  return normalized;
}

function extractStoriesPayload(data: any): CommunityReporterStory[] {
  if (Array.isArray(data)) return data as CommunityReporterStory[];
  const root = data || {};
  return Array.isArray(root.stories)
    ? (root.stories as CommunityReporterStory[])
    : Array.isArray(root.items)
      ? (root.items as CommunityReporterStory[])
      : Array.isArray(root.rows)
        ? (root.rows as CommunityReporterStory[])
        : [];
}

function logStoryShapeOnce(source: 'admin' | 'public', items: any[]) {
  if (!import.meta.env.DEV) return;
  if (loggedStoryShape) return;
  const first = Array.isArray(items) && items.length > 0 ? items[0] : null;
  if (!first || typeof first !== 'object') return;

  loggedStoryShape = true;

  const reporterObj = (first as any).reporter;
  const reporterKeys = reporterObj && typeof reporterObj === 'object' && !Array.isArray(reporterObj) ? Object.keys(reporterObj) : null;

  const f: any = first as any;
  const submittedByObj = f?.submittedBy && typeof f.submittedBy === 'object' && !Array.isArray(f.submittedBy) ? f.submittedBy : null;
  const userObj = f?.user && typeof f.user === 'object' && !Array.isArray(f.user) ? f.user : null;
  const authorObj = f?.author && typeof f.author === 'object' && !Array.isArray(f.author) ? f.author : null;
  const metaObj = f?.meta && typeof f.meta === 'object' && !Array.isArray(f.meta) ? f.meta : null;

  const candidateValues = {
    headline: f.headline ?? f.title ?? '',
    reporter: {
      'reporter.name': reporterObj?.name,
      reporterName: f.reporterName,
      submittedByName: f.submittedByName,
      authorName: f.authorName,
      'submittedBy.name': submittedByObj?.name,
      'user.name': userObj?.name,
      userName: f.userName,
      name: f.name,
      contactName: f.contactName,
      'author.name': authorObj?.name,
      'reporter.email': reporterObj?.email,
      reporterEmail: f.reporterEmail,
      contactEmail: f.contactEmail,
      email: f.email,
      authorEmail: f.authorEmail,
      'submittedBy.email': submittedByObj?.email,
      'user.email': userObj?.email,
    },
    category: {
      category: f.category,
      primaryCategory: f.primaryCategory,
      section: f.section,
      storyType: f.storyType,
      topic: f.topic,
      categoryName: f.categoryName,
      categorySlug: f.categorySlug,
      sectionName: f.sectionName,
      'meta.category': metaObj?.category,
      'meta.primaryCategory': metaObj?.primaryCategory,
      'meta.section': metaObj?.section,
      'meta.storyType': metaObj?.storyType,
    },
    language: {
      lang: f.lang,
      languageCode: f.languageCode,
      language: f.language,
      locale: f.locale,
      contentLanguage: f.contentLanguage,
      languageTag: f.languageTag,
      storyLanguage: f.storyLanguage,
      'meta.lang': metaObj?.lang,
      'meta.languageCode': metaObj?.languageCode,
      'meta.language': metaObj?.language,
      'meta.locale': metaObj?.locale,
    },
  };

  try {
    console.debug('[communityStories] response shape (first item keys)', {
      source,
      topLevelKeys: Object.keys(first),
      reporterKeys,
      candidateValues,
    });
  } catch {}
}

export async function fetchCommunityStories(
  params: CommunityStoriesQuery = {}
): Promise<CommunityReporterStory[]> {
  const normalized = normalizeCommunityStoriesQuery(params);

  if (import.meta.env.DEV) {
    try {
      console.debug('[communityStories] request', {
        primary: 'adminApi GET /admin/community/my-stories',
        fallback: 'api GET /community/my-stories',
        params: normalized,
      });
    } catch {}
  }

  // Primary (preferred): admin route. In proxy mode this becomes:
  //   GET /admin-api/admin/community/my-stories  -> backend /api/admin/community/my-stories
  // This endpoint has been unstable in some environments; fall back safely when it fails.
  try {
    const response = await adminApi.get('/community/my-stories', {
      params: normalized,
      // @ts-expect-error custom flag used by interceptors
      skipErrorLog: true,
    });
    const items = extractStoriesPayload(response?.data);
    logStoryShapeOnce('admin', items as any[]);
    return items;
  } catch (err: any) {
    const status = err?.response?.status;
    const shouldFallback = status === 404 || status === 405 || (typeof status === 'number' && status >= 500);

    if (import.meta.env.DEV) {
      try {
        console.warn('[communityStories] primary failed', {
          status,
          willFallback: shouldFallback,
        });
      } catch {}
    }

    if (!shouldFallback) throw err;

    const response2 = await api.get('/community/my-stories', {
      params: normalized,
      // @ts-expect-error custom flag used by interceptors
      skipErrorLog: true,
    });
    const items2 = extractStoriesPayload(response2?.data);
    logStoryShapeOnce('public', items2 as any[]);
    return items2;
  }
}

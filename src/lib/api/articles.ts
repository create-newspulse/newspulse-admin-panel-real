// Consolidated articles API helpers
// NOTE: This file previously had duplicated sections causing "Cannot redeclare" errors.
// We merge functionality into a single set of exports using the existing apiClient.

import apiClient, { adminApi, hasLikelyAdminSession } from '@/lib/api';
import type { ArticleStatus } from '@/types/articles';

export interface Article {
  _id: string;
  title: string;
  slug?: string;
  summary?: string;
  content?: string;
  imageUrl?: string;
  translationGroupId?: string;
  // Some environments/public site use coverImageUrl instead of imageUrl.
  coverImageUrl?: string;
  // Canonical field requested by admin publish contract
  coverImage?: string;
  category?: string;
  status?: ArticleStatus;
  author?: { name?: string };
  language?: string;
  // Publishing metadata
  publishedAt?: string;
  // Back-compat for older environments
  publishAt?: string;
  ptiCompliance?: string;
  trustScore?: number;
  // Flags + metadata used by frontend filters
  isBreaking?: boolean;
  tags?: string[];
  state?: string;
  district?: string;
  city?: string;
  // Optional editorial workflow state (admin backend may enrich articles with this)
  workflow?: {
    stage?: string;
    stageUpdatedAt?: string;
    locked?: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
  publishAt?: string;
  scheduledAt?: string;
}

export interface ListResponse {
  // Canonical shape used by UI tables
  rows: Article[];
  total: number;
  page: number;
  pages: number;
}

const ADMIN_ARTICLES_PATH = '/articles';
// Legacy/admin backend shape (some environments expose only /api/admin/articles/* routes)
const LEGACY_ADMIN_ARTICLES_PATH = '/admin/articles';

function isNotFoundOrMethodNotAllowed(err: any): boolean {
  const status = err?.response?.status;
  return status === 404 || status === 405;
}

function isAuthDenied(err: any): boolean {
  const status = err?.response?.status;
  return status === 401 || status === 403;
}

async function patchThenPut<T = any>(url: string, payload: any): Promise<T> {
  try {
    const res = await apiClient.patch(url, payload);
    return res.data as T;
  } catch (e: any) {
    const status = e?.response?.status;
    // Some backends don't implement PATCH; fall back to PUT for status updates.
    if (status && status !== 404 && status !== 405) throw e;
  }
  const res2 = await apiClient.put(url, payload);
  return res2.data as T;
}

async function tryLegacyAdminAction(path: string) {
  // path should be relative to /admin/articles
  const res = await apiClient.patch(`${LEGACY_ADMIN_ARTICLES_PATH}${path}`);
  return res.data;
}

function normalizeListResponse(payload: any, opts: { requestedPage: number; limit: number }): ListResponse {
  const rows: Article[] = Array.isArray(payload?.data)
    ? payload.data
    : (Array.isArray(payload?.items)
      ? payload.items
      : (Array.isArray(payload?.rows)
        ? payload.rows
        : (Array.isArray(payload?.articles)
          ? payload.articles
          : [])));

  const total: number = typeof payload?.total === 'number'
    ? payload.total
    : (typeof payload?.count === 'number'
      ? payload.count
      : (typeof payload?.totalCount === 'number'
        ? payload.totalCount
        : rows.length));

  const page = typeof payload?.page === 'number' ? payload.page : opts.requestedPage;
  const pagesFromPayload = typeof payload?.pages === 'number' ? payload.pages : undefined;

  const paginationSeemsMissing =
    payload?.page == null
    && payload?.pages == null
    && payload?.total == null
    && payload?.count == null
    && payload?.limit == null;

  const rowsForPage = (paginationSeemsMissing && rows.length > opts.limit)
    ? rows.slice((opts.requestedPage - 1) * opts.limit, (opts.requestedPage - 1) * opts.limit + opts.limit)
    : rows;

  const pages = pagesFromPayload ?? Math.max(1, Math.ceil(total / opts.limit));

  return {
    rows: rowsForPage,
    total,
    page,
    pages,
  };
}

// --- Core list & actions ---
export async function listArticles(params: {
  status?: 'all' | ArticleStatus;
  category?: string;
  language?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  limit?: number;
  sort?: string;
}): Promise<ListResponse> {
  const limit = params.limit || 20;
  const requestedPage = params.page || 1;

  const query: Record<string, any> = { ...params };
  // Contract: All view should not force legacy status lists; omit status filter.
  if (query.status === 'all') delete query.status;

  // Some backends restrict the PUBLIC articles list to published-only.
  // Prefer the admin route whenever we might need non-published items.
  // - status=draft/deleted/etc -> admin list
  // - status=all (or omitted)  -> try admin list first, then fall back
  const requestedStatus = String(query.status || '').toLowerCase();
  const wantsAll = params.status === 'all' || query.status == null;
  const preferAdminList = wantsAll || (!!requestedStatus && requestedStatus !== 'published');

  // Some backends use `lang` instead of `language`.
  if (query.language && !query.lang) query.lang = query.language;

  // If admin list is available, try it first.
  // Proxy mode:   GET /admin-api/admin/articles
  // Direct mode:  GET <origin>/api/admin/articles
  if (preferAdminList && hasLikelyAdminSession()) {
    try {
      const resAdmin = await adminApi.get(LEGACY_ADMIN_ARTICLES_PATH, {
        params: query,
        // @ts-expect-error custom flag read by interceptor
        skipErrorLog: true,
      });
      return normalizeListResponse(resAdmin.data, { requestedPage, limit });
    } catch (e: any) {
      // If the environment doesn't expose admin list routes (404/405), fall back.
      // If the user isn't authenticated yet (401/403), fall back to public list
      // so at least published content can load.
      if (!isNotFoundOrMethodNotAllowed(e) && !isAuthDenied(e)) throw e;
    }
  }

  // Prefer the normal (public) articles route:
  // Proxy mode:   GET /admin-api/articles  (proxy rewrites to backend /api/articles)
  // Direct mode:  GET <origin>/api/articles
  try {
    const res = await apiClient.get(ADMIN_ARTICLES_PATH, { params: query });
    return normalizeListResponse(res.data, { requestedPage, limit });
  } catch (e: any) {
    if (!isNotFoundOrMethodNotAllowed(e)) throw e;
  }

  // Final fallback: some backends only expose the admin-only list.
  const res2 = await adminApi.get(LEGACY_ADMIN_ARTICLES_PATH, {
    params: query,
    // @ts-expect-error custom flag read by interceptor
    skipErrorLog: true,
  });
  return normalizeListResponse(res2.data, { requestedPage, limit });
}
export async function getArticle(id: string): Promise<Article> {
  const encoded = encodeURIComponent(id);
  let raw: any;
  try {
    const res = await apiClient.get(`${ADMIN_ARTICLES_PATH}/${encoded}`);
    raw = res.data as any;
  } catch (e: any) {
    if (!isNotFoundOrMethodNotAllowed(e)) throw e;
    const res2 = await adminApi.get(`${LEGACY_ADMIN_ARTICLES_PATH}/${encoded}`, {
      // @ts-expect-error custom flag read by interceptor
      skipErrorLog: true,
    });
    raw = res2.data as any;
  }
  const ok = raw?.ok === true || raw?.success === true || !!raw?.article || !!raw?.data;
  const article = (raw?.article)
    || (raw?.data?.article)
    || (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : null);
  if (!ok || !article || !article._id) {
    throw new Error('Failed to get article');
  }
  return article as Article;
}
export async function archiveArticle(id: string) {
  const encoded = encodeURIComponent(id);
  const url = `${ADMIN_ARTICLES_PATH}/${encoded}`;
  try {
    return await patchThenPut(url, { status: 'archived' });
  } catch (e: any) {
    const status = e?.response?.status;
    if (status && status !== 404 && status !== 405) throw e;
  }
  // Legacy fallback: PATCH /api/admin/articles/:id/archive
  return tryLegacyAdminAction(`/${encoded}/archive`);
}
export async function restoreArticle(id: string) {
  const encoded = encodeURIComponent(id);
  const url = `${ADMIN_ARTICLES_PATH}/${encoded}`;
  try {
    return await patchThenPut(url, { status: 'draft' });
  } catch (e: any) {
    const status = e?.response?.status;
    if (status && status !== 404 && status !== 405) throw e;
  }
  // Legacy fallback: PATCH /api/admin/articles/:id/restore
  return tryLegacyAdminAction(`/${encoded}/restore`);
}
export async function deleteArticle(id: string) {
  // Soft delete in UI: mark as deleted (keeps data recoverable)
  const encoded = encodeURIComponent(id);
  const url = `${ADMIN_ARTICLES_PATH}/${encoded}`;
  try {
    return await patchThenPut(url, { status: 'deleted' });
  } catch (e: any) {
    const status = e?.response?.status;
    // If backend doesn't support status update on /articles/:id, fall back to legacy admin delete.
    if (status && status !== 404 && status !== 405) throw e;
  }
  // Legacy fallback: DELETE /api/admin/articles/:id
  const res = await adminApi.delete(`${LEGACY_ADMIN_ARTICLES_PATH}/${encoded}`, {
    // @ts-expect-error custom flag read by interceptor
    skipErrorLog: true,
  });
  return res.data;
}

// --- Control tower helpers ---
export async function updateArticleStatus(id: string, status: ArticleStatus) {
  const url = `${ADMIN_ARTICLES_PATH}/${encodeURIComponent(id)}`;
  try {
    const res = await adminApi.patch(url, { status });
    return res.data as Article;
  } catch (e: any) {
    if (!isNotFoundOrMethodNotAllowed(e)) throw e;
  }
  return patchThenPut<Article>(url, { status });
}

export async function scheduleArticle(id: string, publishAt: string) {
  const url = `${ADMIN_ARTICLES_PATH}/${encodeURIComponent(id)}`;
  try {
    const res = await adminApi.patch(url, { status: 'scheduled', publishAt });
    return res.data as Article;
  } catch (e: any) {
    if (!isNotFoundOrMethodNotAllowed(e)) throw e;
  }
  return patchThenPut<Article>(url, { status: 'scheduled', publishAt });
}

export async function unscheduleArticle(id: string) {
  // Clear schedule and revert to draft
  const url = `${ADMIN_ARTICLES_PATH}/${encodeURIComponent(id)}`;
  try {
    const res = await adminApi.patch(url, { status: 'draft', publishAt: null, scheduledAt: null });
    return res.data as Article;
  } catch (e: any) {
    if (!isNotFoundOrMethodNotAllowed(e)) throw e;
  }
  return patchThenPut<Article>(url, { status: 'draft', publishAt: null, scheduledAt: null });
}

export async function deleteArticleSoft(id: string) {
  await deleteArticle(id);
}

export async function deleteArticleHard(id: string) {
  try {
    await adminApi.delete(`${ADMIN_ARTICLES_PATH}/${encodeURIComponent(id)}`, { params: { hard: true } });
    return;
  } catch (e: any) {
    if (!isNotFoundOrMethodNotAllowed(e)) throw e;
  }
  await apiClient.delete(`${ADMIN_ARTICLES_PATH}/${encodeURIComponent(id)}`, { params: { hard: true } });
}

// New resilient helper: try canonical hard-delete route first, then fallbacks
export async function hardDeleteArticle(id: string) {
  // Contract path: use DELETE /articles/:id, optionally with hard=true.
  // Try hard=true first; fall back to plain delete.
  try {
    await deleteArticleHard(id);
    return;
  } catch (e: any) {
    const status = e?.response?.status;
    if (status && status !== 404 && status !== 405) throw e;
  }
  const res = await apiClient.delete(`${ADMIN_ARTICLES_PATH}/${encodeURIComponent(id)}`);
  const ok = res?.data?.ok === true || res?.data?.success === true || res.status === 200 || res.status === 204;
  if (!ok) throw new Error('Hard delete failed');
}

// Optional extra helpers (create/update/meta) if needed by other screens
export async function createArticle(data: Partial<Article>) {
  try {
    const res = await adminApi.post(ADMIN_ARTICLES_PATH, data);
    return res.data;
  } catch (e: any) {
    if (!isNotFoundOrMethodNotAllowed(e)) throw e;
  }
  const res2 = await apiClient.post(ADMIN_ARTICLES_PATH, data);
  return res2.data;
}
// Community Reporter wrapper: reuse createArticle and tag origin/source for badge detection
export async function createCommunityArticle(data: Partial<Article>) {
  // Draft Desk marks community items if any of: isCommunity, source/origin/submittedBy contains 'community'/'reporter'
  const payload = {
    ...data,
    // Ensure at least one explicit flag for reliable detection
    isCommunity: true,
    source: 'community-reporter',
    origin: 'community-reporter',
  } as Partial<Article & { isCommunity?: boolean; source?: string; origin?: string; submittedBy?: string }>;
  return createArticle(payload);
}
export async function updateArticle(id: string, data: Partial<Article>) {
  const url = `${ADMIN_ARTICLES_PATH}/${encodeURIComponent(id)}`;
  try {
    const res = await adminApi.put(url, data);
    return res.data;
  } catch (e: any) {
    if (!isNotFoundOrMethodNotAllowed(e)) throw e;
  }
  const res2 = await apiClient.put(url, data);
  return res2.data;
}

export async function updateArticlePartial(id: string, patch: Partial<Article>): Promise<Article> {
  const url = `${ADMIN_ARTICLES_PATH}/${encodeURIComponent(id)}`;

  // Prefer PATCH for Draft Workspace autosave.
  try {
    const res = await adminApi.patch(url, patch);
    const raw = res.data as any;
    const article = raw?.article || raw?.data?.article || raw?.data || raw;
    if (article && article._id) return article as Article;
  } catch (e: any) {
    if (!isNotFoundOrMethodNotAllowed(e)) throw e;
  }

  try {
    const res2 = await apiClient.patch(url, patch);
    const raw2 = res2.data as any;
    const article2 = raw2?.article || raw2?.data?.article || raw2?.data || raw2;
    if (article2 && article2._id) return article2 as Article;
  } catch (e: any) {
    if (!isNotFoundOrMethodNotAllowed(e)) throw e;
  }

  // Fallback: merge with current draft and PUT.
  const current = await getArticle(id);
  const merged = { ...current, ...patch } as Partial<Article>;
  const updated = await updateArticle(id, merged);
  const raw3 = updated as any;
  const article3 = raw3?.article || raw3?.data?.article || raw3?.data || raw3;
  if (article3 && article3._id) return article3 as Article;
  // If updateArticle already returns the article object
  if (raw3 && raw3._id) return raw3 as Article;
  throw new Error('Failed to update draft');
}
export async function metaCounts(): Promise<{ total: number }> {
  // Use the stable /articles list contract to compute counts without relying on /articles/meta.
  const [published, drafts] = await Promise.all([
    listArticles({ status: 'published', page: 1, limit: 1 }),
    listArticles({ status: 'draft', page: 1, limit: 1 }),
  ]);
  // Keep shape compatible with callers expecting { published, drafts, flagged }
  return {
    ...(published ? { published: published.total } : {}),
    ...(drafts ? { drafts: drafts.total } : {}),
    flagged: 0,
    total: (published?.total || 0) + (drafts?.total || 0),
  } as any;
}

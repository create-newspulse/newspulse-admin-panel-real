// Consolidated articles API helpers
// NOTE: This file previously had duplicated sections causing "Cannot redeclare" errors.
// We merge functionality into a single set of exports using the existing apiClient.

import apiClient from '@/lib/api';
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
  // Canonical field requested by admin publish contract.
  // Back-compat: some environments store this as a plain string URL.
  coverImage?: string | { url: string; publicId?: string };
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

function isNotFoundOrMethodNotAllowed(err: any): boolean {
  const status = err?.response?.status;
  return status === 404 || status === 405;
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

  // Canonical list endpoint (single source of truth).
  // Proxy mode:   GET /admin-api/articles
  // Direct mode:  GET <origin>/api/articles
  const res = await apiClient.get(ADMIN_ARTICLES_PATH, { params: query });
  return normalizeListResponse(res.data, { requestedPage, limit });
}
export async function getArticle(id: string): Promise<Article> {
  const encoded = encodeURIComponent(id);
  const res = await apiClient.get(`${ADMIN_ARTICLES_PATH}/${encoded}`);
  const raw: any = res.data as any;
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
  return patchThenPut(url, { status: 'archived' });
}
export async function restoreArticle(id: string) {
  const encoded = encodeURIComponent(id);
  const url = `${ADMIN_ARTICLES_PATH}/${encoded}`;
  return patchThenPut(url, { status: 'draft' });
}
export async function deleteArticle(id: string) {
  // Soft delete in UI: mark as deleted (keeps data recoverable)
  const encoded = encodeURIComponent(id);
  const url = `${ADMIN_ARTICLES_PATH}/${encoded}`;
  return patchThenPut(url, { status: 'deleted' });
}

// --- Control tower helpers ---
export async function updateArticleStatus(id: string, status: ArticleStatus) {
  const url = `${ADMIN_ARTICLES_PATH}/${encodeURIComponent(id)}`;
  return patchThenPut<Article>(url, { status });
}

export async function scheduleArticle(id: string, publishAt: string) {
  const url = `${ADMIN_ARTICLES_PATH}/${encodeURIComponent(id)}`;
  return patchThenPut<Article>(url, { status: 'scheduled', publishAt });
}

export async function unscheduleArticle(id: string) {
  // Clear schedule and revert to draft
  const url = `${ADMIN_ARTICLES_PATH}/${encodeURIComponent(id)}`;
  return patchThenPut<Article>(url, { status: 'draft', publishAt: null, scheduledAt: null });
}

export async function deleteArticleSoft(id: string) {
  await deleteArticle(id);
}

export async function deleteArticleHard(id: string) {
  try {
    await apiClient.delete(`${ADMIN_ARTICLES_PATH}/${encodeURIComponent(id)}`, { params: { hard: true } });
    return;
  } catch (e: any) {
    if (!isNotFoundOrMethodNotAllowed(e)) throw e;
  }
  await apiClient.delete(`${ADMIN_ARTICLES_PATH}/${encodeURIComponent(id)}`, { params: { hard: true } });
}

export async function bulkHardDeleteArticles(ids: string[]) {
  const cleanIds = Array.isArray(ids) ? ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (cleanIds.length === 0) return { ok: true, deletedCount: 0 } as any;

  // Standardize on per-id hard deletes via /articles/:id?hard=true.
  await Promise.all(cleanIds.map((id) => deleteArticleHard(id)));
  return { ok: true, deletedCount: cleanIds.length } as any;
}

// New resilient helper: try canonical hard-delete route first, then fallbacks
export async function hardDeleteArticle(id: string) {
  const encoded = encodeURIComponent(id);
  // Standard contract only.
  await deleteArticleHard(id);
  return;
}

// Optional extra helpers (create/update/meta) if needed by other screens
export async function createArticle(data: Partial<Article>) {
  // Canonical contract: POST /articles (proxy -> /admin-api/articles)
  const res = await apiClient.post(ADMIN_ARTICLES_PATH, data);
  return res.data;
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
  // Standard contract ONLY: PUT /articles/:id (proxy -> /admin-api/articles/:id)
  // Do NOT fall back to adminApi here: adminApi rewrites '/articles/*' into '/admin/articles/*'
  // which causes wrong URLs like '/admin-api/admin/articles/:id'.
  const res = await apiClient.put(url, data);
  return res.data;
}

export async function updateArticlePartial(id: string, patch: Partial<Article>): Promise<Article> {
  // Standardize partial update to the same single endpoint as full updates.
  // Requirement: ONLY PUT /admin-api/articles/:id (=> apiClient.put('/articles/:id')).
  const current = await getArticle(id);
  const merged = { ...current, ...patch } as Partial<Article>;
  const updated = await updateArticle(id, merged);
  const raw = updated as any;
  const article = raw?.article || raw?.data?.article || raw?.data || raw;
  if (article && article._id) return article as Article;
  if (raw && raw._id) return raw as Article;
  throw new Error('Failed to update article');
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

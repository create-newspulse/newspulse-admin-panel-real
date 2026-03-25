// Consolidated articles API helpers
// NOTE: This file previously had duplicated sections causing "Cannot redeclare" errors.
// We merge functionality into a single set of exports using the existing apiClient.

import { adminApiClient } from '@/lib/adminApiClient';
import type { ArticleStatus } from '@/types/articles';

export interface Article {
  _id: string;
  title: string;
  slug?: string;
  summary?: string;
  description?: string;
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
  // Some backends use alternate fields instead of `status`.
  state?: string;
  publishStatus?: string;
  isPublished?: boolean;
  author?: { name?: string };
  language?: string;
  // Some backends send language as `lang`.
  lang?: string;
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
  // Back-compat: scheduled publish timestamp.
  publishAt?: string;
}

export interface ListResponse {
  // Canonical shape used by UI tables
  rows: Article[];
  total: number;
  page: number;
  pages: number;
}

const ARTICLES_PATH = 'articles';

function normalizeArticleLanguage<T>(input: T): T {
  if (!input || typeof input !== 'object') return input;
  const a: any = input as any;
  const lang = String(a?.lang ?? a?.language ?? '').trim().toLowerCase();
  if (!lang) return input;

  // Fill both fields for maximum compatibility across UI/components.
  if (a.language == null || String(a.language).trim() === '') a.language = lang;
  if (a.lang == null || String(a.lang).trim() === '') a.lang = lang;
  return input;
}

function normalizeArticleStatus<T>(input: T): T {
  if (!input || typeof input !== 'object') return input;
  const a: any = input as any;

  const raw = (
    a?.status ??
    a?.state ??
    a?.publishStatus ??
    a?.workflowStatus ??
    a?.reviewStatus
  );

  const statusString = (typeof raw === 'string' ? raw : '').trim().toLowerCase();
  const isPublished = a?.isPublished === true || a?.published === true;

  const normalized = (() => {
    if (isPublished) return 'published';
    if (!statusString) return '';
    if (statusString === 'draft' || statusString === 'unpublished') return 'draft';
    if (statusString === 'scheduled' || statusString === 'schedule') return 'scheduled';
    if (statusString === 'published' || statusString === 'publish' || statusString === 'live' || statusString === 'public') return 'published';
    if (statusString === 'archived') return 'archived';
    if (statusString === 'deleted') return 'deleted';
    return '';
  })();

  if (normalized) {
    if (a.status == null || String(a.status).trim() === '') a.status = normalized;
    // Keep alternates in sync when present.
    if (a.state == null || String(a.state).trim() === '') a.state = normalized;
    if (a.publishStatus == null || String(a.publishStatus).trim() === '') a.publishStatus = normalized;
  }

  // Scheduling timestamp normalization (try to keep it stable on round-trips)
  const publishAt = typeof a?.publishAt === 'string' ? a.publishAt : undefined;
  const scheduledAt = typeof a?.scheduledAt === 'string' ? a.scheduledAt : undefined;
  if (!scheduledAt && publishAt) a.scheduledAt = publishAt;
  if (!publishAt && scheduledAt) a.publishAt = scheduledAt;

  return input;
}

function withDescriptionFallback<T extends Record<string, any>>(data: T): T {
  if (!data || typeof data !== 'object') return data;
  const summary = typeof (data as any).summary === 'string' ? String((data as any).summary).trim() : '';
  const description = typeof (data as any).description === 'string' ? String((data as any).description).trim() : '';
  if (!description && summary) {
    return { ...(data as any), description: summary } as T;
  }
  return data;
}

function isFallbackableHardDeleteError(err: any): boolean {
  const status = err?.response?.status;
  // Backends vary: some return 404/405 when the hard-delete route isn't implemented,
  // others return 400 for an unexpected query param or unsupported action.
  return status === 404 || status === 405 || status === 400;
}

async function tryHardDeleteAttempts<T = any>(attempts: Array<() => Promise<T>>): Promise<T> {
  let lastErr: any = null;
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (e: any) {
      lastErr = e;
      if (isFallbackableHardDeleteError(e)) continue;
      throw e;
    }
  }
  throw lastErr || new Error('Hard delete failed');
}

async function patchThenPut<T = any>(url: string, payload: any): Promise<T> {
  try {
    const res = await adminApiClient.patch(url, payload);
    return res.data as T;
  } catch (e: any) {
    const status = e?.response?.status;
    // Some backends don't implement PATCH; fall back to PUT for status updates.
    if (status && status !== 404 && status !== 405) throw e;
  }
  const res2 = await adminApiClient.put(url, payload);
  return res2.data as T;
}


function normalizeListResponse(payload: any, opts: { requestedPage: number; limit: number }): ListResponse {
  const rawRows: Article[] = Array.isArray(payload?.data)
    ? payload.data
    : (Array.isArray(payload?.items)
      ? payload.items
      : (Array.isArray(payload?.rows)
        ? payload.rows
        : (Array.isArray(payload?.articles)
          ? payload.articles
          : [])));

  const rows: Article[] = (rawRows || [])
    .map((a) => normalizeArticleStatus(normalizeArticleLanguage(a)));

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
  // We standardize on the canonical admin list route (proxy-safe).

  // Some backends use `lang` instead of `language`.
  if (query.language && !query.lang) query.lang = query.language;

  // Canonical list endpoint (single source of truth).
  // Browser should call: GET /admin-api/articles
  const res = await adminApiClient.get(ARTICLES_PATH, { params: query });
  return normalizeListResponse(res.data, { requestedPage, limit });
}

export async function listArticlesByTranslationGroupId(translationGroupId: string, opts?: { limit?: number }): Promise<ListResponse> {
  const gid = String(translationGroupId || '').trim();
  if (!gid) return { rows: [], total: 0, page: 1, pages: 1 };
  const limit = opts?.limit || 50;
  const res = await adminApiClient.get(ARTICLES_PATH, {
    params: {
      translationGroupId: gid,
      limit,
      page: 1,
      sort: '-updatedAt',
    },
  });
  return normalizeListResponse(res.data, { requestedPage: 1, limit });
}
export async function getArticle(id: string): Promise<Article> {
  const encoded = encodeURIComponent(id);
  const res = await adminApiClient.get(`${ARTICLES_PATH}/${encoded}`);
  const raw: any = res.data as any;
  const ok = raw?.ok === true || raw?.success === true || !!raw?.article || !!raw?.data;
  const article = (raw?.article)
    || (raw?.data?.article)
    || (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : null);
  if (!ok || !article || !article._id) {
    throw new Error('Failed to get article');
  }
  return normalizeArticleStatus(normalizeArticleLanguage(article as Article));
}
export async function archiveArticle(id: string) {
  const encoded = encodeURIComponent(id);
  const url = `${ARTICLES_PATH}/${encoded}`;
  return patchThenPut(url, { status: 'archived' });
}
export async function restoreArticle(id: string) {
  const encoded = encodeURIComponent(id);
  const url = `${ARTICLES_PATH}/${encoded}`;
  return patchThenPut(url, { status: 'draft' });
}
export async function deleteArticle(id: string) {
  // Soft delete in UI: mark as deleted (keeps data recoverable)
  const encoded = encodeURIComponent(id);
  const url = `${ARTICLES_PATH}/${encoded}`;
  return patchThenPut(url, { status: 'deleted' });
}

// --- Control tower helpers ---
export async function updateArticleStatus(id: string, status: ArticleStatus) {
  const url = `${ARTICLES_PATH}/${encodeURIComponent(id)}`;
  if (status === 'published') {
    const publishedAt = new Date().toISOString();
    // Prefer PUT for publish to avoid accidental calls to a /publish endpoint on the frontend host.
    const res = await adminApiClient.put(url, { status: 'published', publishedAt });
    return res.data as any;
  }
  return patchThenPut<Article>(url, { status });
}

export async function publishArticle(id: string, publishedAt?: string, extra?: Partial<Article>) {
  const url = `${ARTICLES_PATH}/${encodeURIComponent(id)}`;
  const ts = (publishedAt && String(publishedAt).trim()) ? String(publishedAt).trim() : new Date().toISOString();
  const payload = withDescriptionFallback({ ...(extra || {}), status: 'published', publishedAt: ts } as any);
  const res = await adminApiClient.put(url, payload);
  return res.data as any;
}

export async function retryArticleTranslation(id: string) {
  // Contract: POST /admin-api/articles/:id/retry-translation
  const encoded = encodeURIComponent(id);
  const res = await adminApiClient.post(`${ARTICLES_PATH}/${encoded}/retry-translation`);
  return res.data as any;
}

export async function scheduleArticle(id: string, publishAt: string) {
  const url = `${ARTICLES_PATH}/${encodeURIComponent(id)}`;
  return patchThenPut<Article>(url, { status: 'scheduled', publishAt });
}

export async function unscheduleArticle(id: string) {
  // Clear schedule and revert to draft
  const url = `${ARTICLES_PATH}/${encodeURIComponent(id)}`;
  return patchThenPut<Article>(url, { status: 'draft', publishAt: null, scheduledAt: null });
}

export async function deleteArticleSoft(id: string) {
  await deleteArticle(id);
}

export async function deleteArticleHard(id: string) {
  const encoded = encodeURIComponent(id);

  // Try multiple common hard-delete contracts for maximum compatibility:
  // - POST /api/articles/:id/hard-delete
  // - POST /api/admin/articles/:id/hard-delete
  // - DELETE /api/articles/:id?hard=true
  // - DELETE /api/admin/articles/:id?hard=true
  await tryHardDeleteAttempts([
    async () => {
      const res = await adminApiClient.post(`${ARTICLES_PATH}/${encoded}/hard-delete`);
      return res.data as any;
    },
    async () => {
      const res = await adminApiClient.post(`admin/articles/${encoded}/hard-delete`);
      return res.data as any;
    },
    async () => {
      const res = await adminApiClient.delete(`${ARTICLES_PATH}/${encoded}`, { params: { hard: 'true' } });
      return res.data as any;
    },
    async () => {
      const res = await adminApiClient.delete(`admin/articles/${encoded}`, { params: { hard: 'true' } });
      return res.data as any;
    },
  ]);
  return;
}

export async function bulkHardDeleteArticles(ids: string[]) {
  const cleanIds = Array.isArray(ids) ? ids.map((x) => String(x || '').trim()).filter(Boolean) : [];
  if (cleanIds.length === 0) return { ok: true, deletedCount: 0 } as any;

  // Standardize on per-id hard deletes via /articles/:id?hard=true.
  for (const id of cleanIds) {
    await deleteArticleHard(id);
  }
  return { ok: true, deletedCount: cleanIds.length } as any;
}

// New resilient helper: try canonical hard-delete route first, then fallbacks
export async function hardDeleteArticle(id: string) {
  // Standard contract only.
  await deleteArticleHard(id);
  return;
}

// Optional extra helpers (create/update/meta) if needed by other screens
export async function createArticle(data: Partial<Article>) {
  // Canonical contract: POST /articles (proxy -> /admin-api/articles)
  const res = await adminApiClient.post(ARTICLES_PATH, withDescriptionFallback(data as any));
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
  const url = `${ARTICLES_PATH}/${encodeURIComponent(id)}`;
  // Standard contract ONLY: PUT /admin-api/articles/:id
  const res = await adminApiClient.put(url, withDescriptionFallback(data as any));
  return res.data;
}

export async function updateArticlePartial(id: string, patch: Partial<Article>): Promise<Article> {
  // Standardize partial update to the same single endpoint as full updates.
  // Requirement: ONLY PUT /admin-api/articles/:id.
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

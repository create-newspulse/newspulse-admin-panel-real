// Consolidated articles API helpers
// NOTE: This file previously had duplicated sections causing "Cannot redeclare" errors.
// We merge functionality into a single set of exports using the existing apiClient.

import { adminApiClient } from '@/lib/adminApiClient';
import { z } from 'zod';
import { ArticleRestoreGuardError } from '@/lib/articleLifecycle';
import type { ArticleStatus } from '@/types/articles';
import type { PulseDialogueArticleMetadata } from '@/lib/pulseDialogue';
import type { AuthorByline } from '@/lib/authorByline';

export interface Article {
  _id: string;
  sourceNewsId?: string;
  authorByline?: AuthorByline;
  title: string;
  slug?: string;
  summary?: string;
  description?: string;
  content?: string;
  isSponsored?: boolean;
  sponsored?: boolean;
  sponsorBrandName?: string;
  sponsorName?: string;
  sponsorDisclosure?: string;
  sponsorCtaText?: string;
  sponsorCtaUrl?: string;
  sponsorFeatureLinkedId?: string | null;
  ctaText?: string;
  ctaUrl?: string;
  imageUrl?: string;
  translationGroupId?: string;
  translationKey?: string;
  // Some environments/public site use coverImageUrl instead of imageUrl.
  coverImageUrl?: string;
  // Canonical field requested by admin publish contract.
  // Back-compat: some environments store this as a plain string URL.
  coverImage?: string | { url: string; publicId?: string };
  category?: string;
  editorialType?: 'editorial' | 'special_story' | string;
  topic?: string | null;
  status?: ArticleStatus;
  // Some backends use alternate fields instead of `status`.
  state?: string;
  publishStatus?: string;
  isPublished?: boolean;
  author?: { name?: string };
  language?: string;
  // Some backends send language as `lang`.
  lang?: string;
  translations?: Record<string, any>;
  sourceLanguage?: string;
  originalLanguage?: string;
  baseLanguage?: string;
  sourceLang?: string;
  originalLang?: string;
  baseLang?: string;
  sourceArticle?: any;
  originalArticle?: any;
  baseArticle?: any;
  // Publishing metadata
  publishedAt?: string;
  // Back-compat for older environments
  publishAt?: string;
  ptiCompliance?: string;
  trustScore?: number;
  // Flags + metadata used by frontend filters
  isBreaking?: boolean;
  spotlightEnabled?: boolean;
  spotlightPinned?: boolean;
  spotlightPriority?: 'normal' | 'important' | 'top' | string;
  spotlightExpiryTime?: string;
  spotlightExpiresAt?: string;
  spotlightExpiry?: string;
  tags?: string[];
  track?: string;
  trackName?: string;
  pulseDialogue?: PulseDialogueArticleMetadata;
  subCategory?: string;
  subcategory?: string;
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
  deletedFromStatus?: ArticleStatus | null;
  deletedAt?: string | null;
}

export interface ArticleMutationResponse {
  ok?: boolean;
  success?: boolean;
  status?: number;
  article?: Article;
  data?: { article?: Article };
  restoredStatuses?: ArticleStatus[];
  changedIds?: string[];
  deletedIds?: string[];
  deletedCount?: number;
  publishedLanguages?: string[];
  translationGroupId?: string;
  committed?: boolean;
  revalidation?: { ok?: boolean };
  postCommitWarnings?: Array<{ code: string; message?: string }>;
}

const restoreEligibilitySchema = z.object({
  articleId: z.string().min(1),
  eligible: z.boolean(),
  decision: z.enum(['eligible', 'founder_required', 'blocked', 'incomplete']),
  complete: z.boolean(),
  requiresFounder: z.boolean(),
  reasonCodes: z.array(z.string()),
  members: z.array(z.object({
    id: z.string().min(1),
    language: z.string().nullable(),
    status: z.string().nullable(),
    restoreStatus: z.string().nullable(),
    historyKnown: z.boolean(),
  })),
  publicCopies: z.array(z.object({
    id: z.string().min(1),
    sourceNewsId: z.string().nullable(),
  })),
});

export type ArticleRestoreEligibility = z.infer<typeof restoreEligibilitySchema>;

const restoreEligibilityResponseSchema = z.object({
  ok: z.literal(true),
  success: z.literal(true),
  status: z.literal(200),
  data: restoreEligibilitySchema,
});

// Own-draft reads deliberately omit group, ownership, workflow and other editor fields.
// Never hydrate ArticleForm or build a full Article update from these DTOs.
export interface OwnDraftSummary {
  _id: string;
  id: string;
  title?: string | null;
  slug?: string | null;
  status: 'draft';
  category?: string | null;
  description: string | null;
  summary: string | null;
  language: string | null;
  lang: string | null;
  coverImageUrl: string | null;
  imageURL?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface OwnDraftDetail extends OwnDraftSummary {
  content: string | null;
  body: string | null;
  coverImage: { url: string | null; publicId: string | null; alt: string | null };
  tags: string[];
  editorialType?: string | null;
  track?: string | null;
  topic?: string | null;
  externalUrls: string[];
  embeds: string[];
  gallery: string[];
  stateTags: string[];
  stateNames: string[];
  seo: { metaTitle?: string | null; metaDescription?: string | null; canonicalUrl?: string | null };
  location: {
    state?: string | null; stateSlug?: string | null;
    district?: string | null; districtSlug?: string | null;
    city?: string | null; citySlug?: string | null;
    country?: string | null; isUT?: boolean | null;
  };
  geo: { state?: string | null; district?: string | null; city?: string | null };
}

export interface OwnDraftList {
  items: OwnDraftSummary[];
  total: number;
  page: number;
  pages: number;
}

export interface ListResponse {
  // Canonical shape used by UI tables
  rows: Article[];
  total: number;
  page: number;
  pages: number;
  translations?: Record<string, any>;
  sourceLanguage?: string;
  originalLanguage?: string;
  baseLanguage?: string;
  sourceLang?: string;
  originalLang?: string;
  baseLang?: string;
  sourceArticle?: any;
  originalArticle?: any;
  baseArticle?: any;
  [key: string]: any;
}

const ARTICLES_PATH = 'articles';

function validateOwnDraftEnvelope(raw: { ok?: boolean; success?: boolean; status?: number }) {
  if (raw?.ok === false || raw?.success === false) {
    throw Object.assign(new Error('Failed to load own drafts'), {
      response: { status: raw.status && raw.status >= 400 ? raw.status : 500, data: raw },
    });
  }
  if (raw?.ok !== true && raw?.success !== true) throw new Error('Invalid own-draft response');
}

function isOwnDraft(value: OwnDraftSummary): boolean {
  return !!value && typeof value._id === 'string' && !!value._id && value.status === 'draft';
}

export async function listOwnDrafts(params: { page?: number; limit?: number; sort?: '-createdAt' | '-updatedAt' } = {}): Promise<OwnDraftList> {
  const res = await adminApiClient.get<{
    ok?: boolean; success?: boolean; status?: number;
    items: OwnDraftSummary[]; total: number; page: number; pages: number;
  }>(`${ARTICLES_PATH}/own-drafts`, {
    params: { page: params.page || 1, limit: params.limit || 20, sort: params.sort || '-createdAt' },
  });
  const raw = res.data;
  validateOwnDraftEnvelope(raw);
  if (!Array.isArray(raw.items) || !raw.items.every(isOwnDraft)
    || !Number.isInteger(raw.total) || raw.total < 0
    || !Number.isInteger(raw.page) || raw.page < 1 || !Number.isInteger(raw.pages) || raw.pages < 0) {
    throw new Error('Invalid own-draft list response');
  }
  return { items: raw.items, total: raw.total, page: raw.page, pages: raw.pages };
}

export async function getOwnDraft(id: string): Promise<OwnDraftDetail> {
  const res = await adminApiClient.get<{
    ok?: boolean; success?: boolean; status?: number; article: OwnDraftDetail;
  }>(`${ARTICLES_PATH}/own-drafts/${encodeURIComponent(id)}`);
  const raw = res.data;
  validateOwnDraftEnvelope(raw);
  if (!isOwnDraft(raw.article) || !Array.isArray(raw.article.tags)
    || (raw.article.content !== null && typeof raw.article.content !== 'string')) {
    throw new Error('Invalid own-draft detail response');
  }
  return raw.article;
}

function isAdminArticleDebugEnabled(): boolean {
  try {
    const w: any = window as any;
    if (w && (w.__np_debug_article_editor || w.__np_debug_article_requests)) return true;
  } catch {}
  try {
    return localStorage.getItem('np_debug_article_editor') === '1'
      || localStorage.getItem('np_debug_article_requests') === '1';
  } catch {
    return false;
  }
}

function logAdminArticleRequest(label: string, payload: Record<string, any>): void {
  if (!isAdminArticleDebugEnabled()) return;
  console.log(`[articles.api] ${label}`, { payloadKeys: Object.keys(payload.payload || {}) });
}

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

function mutationResponse(data: ArticleMutationResponse): ArticleMutationResponse {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid article operation response');
  }
  if (data?.ok === false || data?.success === false) {
    throw Object.assign(new Error('Article operation failed'), {
      response: { status: data.status && data.status >= 400 ? data.status : 500, data },
    });
  }
  if (data.ok !== true && data.success !== true && !data.article?._id && !data.data?.article?._id) {
    throw new Error('Invalid article operation response');
  }
  return data;
}

async function putArticleState(url: string, payload: Record<string, unknown>): Promise<ArticleMutationResponse> {
  const res = await adminApiClient.put(url, payload);
  return mutationResponse(res.data);
}


function normalizeListResponse(payload: any, opts: { requestedPage: number; limit: number }): ListResponse {
  if (payload?.ok === false || payload?.success === false) {
    throw Object.assign(new Error('Failed to load articles'), {
      response: { status: payload.status >= 400 ? payload.status : 500, data: payload },
    });
  }
  if (![payload?.data, payload?.items, payload?.rows, payload?.articles].some(Array.isArray)) {
    throw new Error('Invalid articles response');
  }
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
    ...(payload && typeof payload === 'object' ? payload : {}),
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

type EditionLanguage = 'en' | 'hi' | 'gu';
const EDITION_LANGUAGES = ['en', 'hi', 'gu'] as const;

export interface ArticleTranslationEditions {
  anchorId: string;
  translationGroupId: string | null;
  rows: Article[];
  missingLanguages?: EditionLanguage[];
  generationSourceId?: string | null;
  generationUnavailableReason?: string | null;
  translationStates?: Partial<Record<EditionLanguage, string>>;
}

export class ArticleEditionIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArticleEditionIdentityError';
  }
}

function isEditionId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim()
    && !/[/\\?#\u0000-\u001f\u007f]/.test(value);
}

function editionCmsId(article: Article): string {
  if (!isEditionId(article._id)
    || (article.sourceNewsId != null && !isEditionId(article.sourceNewsId))) {
    throw new ArticleEditionIdentityError('Invalid language edition ID. No edition was selected.');
  }
  return article.sourceNewsId ?? article._id;
}

function editionLanguage(article: Article): 'en' | 'hi' | 'gu' {
  const language = article.lang ?? article.language;
  const code = typeof language === 'string' ? language.trim().toLowerCase() : '';
  if ((code !== 'en' && code !== 'hi' && code !== 'gu')
    || [article.lang, article.language].some(value =>
      value != null && (typeof value !== 'string' || value.trim().toLowerCase() !== code))) {
    throw new ArticleEditionIdentityError('Invalid or inconsistent language edition language. No edition was selected.');
  }
  return code;
}

function editionGroupId(article: { translationGroupId?: unknown; translationKey?: unknown }): string | null {
  const group = article.translationGroupId;
  const key = article.translationKey;
  if (key != null && key !== '' && (typeof key !== 'string' || !key.trim() || key !== key.trim())) {
    throw new ArticleEditionIdentityError('Invalid language edition translationKey. No edition was selected.');
  }
  if (group && key && group !== key) {
    throw new ArticleEditionIdentityError('translationKey and translationGroupId conflict. No edition was selected.');
  }
  if (group == null || group === '') return null;
  if (typeof group !== 'string' || !group.trim() || group !== group.trim()) {
    throw new ArticleEditionIdentityError('Invalid language edition group. No edition was selected.');
  }
  return group;
}

function isEditionRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function createdArticleCmsId(
  article: Article | undefined,
  expected: { language: EditionLanguage; translationGroupId: string | null },
): string {
  if (!article || article._id == null || article._id === '') {
    throw new ArticleEditionIdentityError('The created source returned no CMS News ID.');
  }
  const id = editionCmsId(article);
  if (article._id !== id) {
    throw new ArticleEditionIdentityError('The created source returned a different CMS News identity.');
  }
  // An accepted create supplies omitted metadata through its submitted payload, not a discovery lookup.
  if ((article.lang != null || article.language != null) && editionLanguage(article) !== expected.language) {
    throw new ArticleEditionIdentityError('The created source language does not match the submitted story.');
  }
  const group = editionGroupId(article);
  if ((article.translationGroupId !== undefined && group !== expected.translationGroupId)
    || (article.translationKey && article.translationKey !== expected.translationGroupId)) {
    throw new ArticleEditionIdentityError('The created source translation group does not match the submitted story.');
  }
  for (const value of [article.sourceLanguage, article.originalLanguage, article.baseLanguage, article.sourceLang, article.originalLang, article.baseLang]) {
    if (value != null && value !== '' && (typeof value !== 'string' || value.trim().toLowerCase() !== expected.language)) {
      throw new ArticleEditionIdentityError('The created article is not the submitted translation source.');
    }
  }
  for (const reference of [article.sourceArticle, article.originalArticle, article.baseArticle]) {
    if (reference == null) continue;
    if (!isEditionRecord(reference) || reference._id !== id
      || (reference.sourceNewsId != null && reference.sourceNewsId !== id)
      || (reference.translationGroupId !== undefined && editionGroupId(reference) !== expected.translationGroupId)
      || (reference.translationKey && reference.translationKey !== expected.translationGroupId)
      || [reference.lang, reference.language].some(value =>
        value != null && (typeof value !== 'string' || value.trim().toLowerCase() !== expected.language))) {
      throw new ArticleEditionIdentityError('The created article references a different translation source.');
    }
  }
  return id;
}

function editionGenerationSource(rows: Article[], groupId: string | null, verifiedLanguages: number, statusMetadata: Record<string, unknown>) {
  const unavailable = (reason: string) => ({ generationSourceId: null, generationUnavailableReason: reason });
  if (!groupId || verifiedLanguages !== EDITION_LANGUAGES.length) {
    return unavailable('The complete translation group is unverified. Duplicate editions cannot be ruled out safely.');
  }
  const sourceLanguages = new Set<EditionLanguage>();
  const sourceIds = new Set<string>();
  for (const row of [...rows, statusMetadata]) {
    if (row.status === 'deleted' || row.status === 'archived') {
      return unavailable('Restore the complete story before generating missing editions.');
    }
    for (const value of [row.sourceLanguage, row.originalLanguage, row.baseLanguage, row.sourceLang, row.originalLang, row.baseLang]) {
      if (value == null || value === '') continue;
      const code = typeof value === 'string' ? value.trim().toLowerCase() : '';
      if (code !== 'en' && code !== 'hi' && code !== 'gu') {
        return unavailable('The canonical source language is invalid. Missing-edition generation is blocked.');
      }
      sourceLanguages.add(code);
    }
    for (const reference of [row.sourceArticle, row.originalArticle, row.baseArticle]) {
      if (reference == null) continue;
      if (!isEditionRecord(reference) || !isEditionId(reference._id)
        || (reference.sourceNewsId != null && !isEditionId(reference.sourceNewsId))) {
        return unavailable('The canonical source article identity is unverified.');
      }
      const sourceId = typeof reference.sourceNewsId === 'string' ? reference.sourceNewsId : reference._id;
      const source = rows.find(candidate => editionCmsId(candidate) === sourceId);
      if (!source || (reference._id !== source._id && reference._id !== editionCmsId(source))
        || (reference.translationGroupId != null && editionGroupId(reference) !== groupId)
        || (reference.translationKey != null && reference.translationKey !== groupId)
        || [reference.lang, reference.language].some(value =>
          value != null && (typeof value !== 'string' || value.trim().toLowerCase() !== editionLanguage(source)))) {
        return unavailable('The canonical source article does not match the verified story.');
      }
      sourceIds.add(sourceId);
    }
  }
  if (sourceLanguages.size > 1 || sourceIds.size > 1 || (!sourceLanguages.size && !sourceIds.size)) {
    return unavailable('The canonical source identity is uncertain. Missing-edition generation is blocked.');
  }
  const candidates = rows.filter(row =>
    (!sourceLanguages.size || sourceLanguages.has(editionLanguage(row)))
    && (!sourceIds.size || sourceIds.has(editionCmsId(row))));
  if (candidates.length !== 1) {
    return unavailable('The canonical source identity is inconsistent or missing. Generation is blocked.');
  }
  return { generationSourceId: editionCmsId(candidates[0]), generationUnavailableReason: null };
}

export async function getArticleTranslationEditions(articleId: string): Promise<ArticleTranslationEditions> {
  if (!isEditionId(articleId)) throw new ArticleEditionIdentityError('A valid CMS article ID is required to verify language editions.');
  const anchor = await getArticle(articleId);
  if (editionCmsId(anchor) !== articleId) throw new ArticleEditionIdentityError('The requested article identity did not match. No edition was selected.');
  const anchorLanguage = editionLanguage(anchor);
  const groupId = editionGroupId(anchor);
  const response = await adminApiClient.get<unknown>(`${ARTICLES_PATH}/${encodeURIComponent(articleId)}/translation-status`);
  const body = response.data;
  const statusMetadata = isEditionRecord(body) && isEditionRecord(body.data) ? body.data : null;
  const perLang = statusMetadata?.perLang;
  if (!isEditionRecord(perLang) || !statusMetadata
    || statusMetadata.ok === false || statusMetadata.success === false
    || (isEditionRecord(body) && (body.ok === false || body.success === false || (typeof body.status === 'number' && body.status >= 400)))) {
    throw new ArticleEditionIdentityError('Language edition identity could not be verified from translation status.');
  }
  const statusGroupId = editionGroupId(statusMetadata);
  if ((statusGroupId && statusGroupId !== groupId)
    || (statusMetadata.translationKey && statusMetadata.translationKey !== groupId)) {
    throw new ArticleEditionIdentityError('Translation status group identity does not match this story.');
  }

  const identified: Array<{ language: EditionLanguage; id: string }> = [];
  const missingLanguages: EditionLanguage[] = [];
  const translationStates: Partial<Record<EditionLanguage, string>> = {};
  const ids = new Set<string>();
  for (const language of EDITION_LANGUAGES) {
    const entry = perLang[language];
    if (entry == null) continue;
    if (!isEditionRecord(entry)
      || [entry.lang, entry.language].some(value =>
        value != null && (typeof value !== 'string' || value.trim().toLowerCase() !== language))) {
      throw new ArticleEditionIdentityError('Invalid or ambiguous language edition identity. No edition was selected.');
    }
    const entryGroupId = editionGroupId(entry);
    if ((entryGroupId && entryGroupId !== groupId) || (entry.translationKey && entry.translationKey !== groupId)) {
      throw new ArticleEditionIdentityError('Language edition group identity does not match this story.');
    }
    const storedState = entry.status ?? entry.state;
    if (typeof storedState === 'string') translationStates[language] = storedState;
    if (entry.present === false && entry.presence === 'missing'
      && entry.articleId === null && entry.childArticleId === null) {
      missingLanguages.push(language);
      continue;
    }
    if (entry.articleId == null && entry.childArticleId == null && entry.present !== true
      && (entry.presence == null || entry.presence === 'missing')) continue;
    if (!isEditionId(entry.articleId) || ids.has(entry.articleId)
      || (entry.childArticleId != null && entry.childArticleId !== entry.articleId)
      || (entry.present != null && entry.present !== true)
      || (entry.presence != null && entry.presence !== 'present')) {
      throw new ArticleEditionIdentityError('Invalid or ambiguous language edition IDs. No edition was selected.');
    }
    ids.add(entry.articleId);
    identified.push({ language, id: entry.articleId });
  }
  if (!identified.some(entry => entry.language === anchorLanguage && entry.id === articleId)) {
    throw new ArticleEditionIdentityError('Translation status did not verify the current article. No edition was selected.');
  }

  const rows = await Promise.all(identified.map(async ({ language, id }) => {
    const article = id === articleId ? anchor : await getArticle(id);
    if (editionCmsId(article) !== id || editionLanguage(article) !== language
      || editionGroupId(article) !== groupId || (id !== articleId && !groupId)) {
      throw new ArticleEditionIdentityError('Language edition identity does not match this story. No edition was selected.');
    }
    return { ...article, language, lang: language };
  }));
  const recordIds = new Set<string>();
  for (const row of rows) {
    const aliases = new Set([row._id, editionCmsId(row)]);
    if ([...aliases].some(id => recordIds.has(id))) {
      throw new ArticleEditionIdentityError('Duplicate language edition identities. No edition was selected.');
    }
    aliases.forEach(id => recordIds.add(id));
  }
  return {
    anchorId: articleId, translationGroupId: groupId, rows, missingLanguages, translationStates,
    ...editionGenerationSource(rows, groupId, identified.length + missingLanguages.length, statusMetadata),
  };
}
export async function getArticle(id: string): Promise<Article> {
  const encoded = encodeURIComponent(id);
  const res = await adminApiClient.get(`${ARTICLES_PATH}/${encoded}`);
  const raw: any = res.data as any;
  const ok = raw?.ok === true || raw?.success === true || !!raw?.article || !!raw?.data;
  const article = (raw?.article)
    || (raw?.data?.article)
    || (raw?.data && typeof raw.data === 'object' && !Array.isArray(raw.data) ? raw.data : null);
  if (raw?.ok === false || raw?.success === false || !ok || !article || !article._id) {
    throw new Error('Failed to get article');
  }
  return normalizeArticleStatus(normalizeArticleLanguage(article as Article));
}
export async function archiveArticle(id: string) {
  const encoded = encodeURIComponent(id);
  const url = `${ARTICLES_PATH}/${encoded}`;
  return putArticleState(url, { status: 'archived' });
}
export async function getArticleRestoreEligibility(id: string, signal?: AbortSignal): Promise<ArticleRestoreEligibility> {
  if (!id || id !== id.trim()) throw new ArticleRestoreGuardError('Invalid article ID. Refresh the list before checking Restore.');
  const res = await adminApiClient.get<unknown>(`${ARTICLES_PATH}/${encodeURIComponent(id)}/restore-eligibility`, {
    signal,
    timeout: 10_000,
    headers: { 'Cache-Control': 'no-store, no-cache', Pragma: 'no-cache' },
  });
  const parsed = restoreEligibilityResponseSchema.safeParse(res.data);
  if (!parsed.success || parsed.data.data.articleId !== id) {
    throw new ArticleRestoreGuardError('Restore eligibility returned an invalid or mismatched assessment. No restore was authorized.');
  }
  return parsed.data.data;
}
export async function restoreArticle(id: string) {
  const encoded = encodeURIComponent(id);
  // A mutation must not be replayed by the client's authentication-refresh interceptor.
  const config = { skipAuthRefresh: true, timeout: 30_000 };
  const res = await adminApiClient.post<ArticleMutationResponse>(`${ARTICLES_PATH}/${encoded}/restore`, undefined, config);
  return mutationResponse(res.data);
}
export async function deleteArticle(id: string) {
  const encoded = encodeURIComponent(id);
  const res = await adminApiClient.delete<ArticleMutationResponse>(`${ARTICLES_PATH}/${encoded}`);
  return mutationResponse(res.data);
}

// --- Control tower helpers ---
export async function updateArticleStatus(id: string, status: ArticleStatus) {
  const url = `${ARTICLES_PATH}/${encodeURIComponent(id)}`;
  if (status === 'published') {
    return publishArticle(id);
  }
  logAdminArticleRequest('updateArticleStatus', {
    targetArticleId: id,
    route: `/admin-api/${url}`,
    payload: { status },
    relatedArticleIds: [],
  });
  return putArticleState(url, { status });
}

export async function publishArticle(id: string) {
  const url = `${ARTICLES_PATH}/${encodeURIComponent(id)}/publish`;
  logAdminArticleRequest('publishArticle', {
    targetArticleId: id,
    route: `/admin-api/${url}`,
    relatedArticleIds: [],
  });
  const res = await adminApiClient.post<ArticleMutationResponse>(url);
  return mutationResponse(res.data);
}

export async function unpublishArticle(id: string) {
  const res = await adminApiClient.post<ArticleMutationResponse>(
    `${ARTICLES_PATH}/${encodeURIComponent(id)}/unpublish`,
    { toStatus: 'draft' },
  );
  return mutationResponse(res.data);
}

export async function retryArticleTranslation(id: string, opts?: { languages?: string[] }) {
  const encoded = encodeURIComponent(id);
  const payload = Array.isArray(opts?.languages) && opts?.languages.length > 0
    ? { languages: opts.languages }
    : undefined;
  const res = await adminApiClient.post(`${ARTICLES_PATH}/${encoded}/retry-translation`, payload);
  return res.data as any;
}

export async function requeueArticleTranslations(id: string, opts?: { languages?: string[] }) {
  const encoded = encodeURIComponent(id);
  const payload = Array.isArray(opts?.languages) && opts?.languages.length > 0
    ? { languages: opts.languages }
    : undefined;
  const res = await adminApiClient.post(`admin/${ARTICLES_PATH}/${encoded}/translations/generate`, payload);
  return mutationResponse(res.data);
}

export async function generateMissingArticleTranslations(id: string, opts: { targetLanguages: EditionLanguage[] }) {
  if (!isEditionId(id)) throw new ArticleEditionIdentityError('A valid CMS source ID is required for translation generation.');
  const languages = opts.targetLanguages;
  if (!Array.isArray(languages) || !languages.length
    || languages.some(language => !EDITION_LANGUAGES.includes(language))
    || new Set(languages).size !== languages.length) {
    throw new ArticleEditionIdentityError('Select valid, distinct missing-edition languages.');
  }
  const res = await adminApiClient.post<ArticleMutationResponse>(
    `${ARTICLES_PATH}/${encodeURIComponent(id)}/translations/generate`,
    { targetLanguages: languages, overwrite: false },
  );
  if (!isEditionRecord(res.data)) throw new Error('Translation generation was not confirmed. Verify language editions before retrying.');
  return mutationResponse(res.data);
}

export async function scheduleArticle(id: string, publishAt: string) {
  const url = `${ARTICLES_PATH}/${encodeURIComponent(id)}`;
  logAdminArticleRequest('scheduleArticle', {
    targetArticleId: id,
    route: `/admin-api/${url}`,
    payload: { status: 'scheduled', publishAt },
    relatedArticleIds: [],
  });
  return putArticleState(url, { status: 'scheduled', publishAt });
}

export async function unscheduleArticle(id: string) {
  // Clear schedule and revert to draft
  const url = `${ARTICLES_PATH}/${encodeURIComponent(id)}`;
  logAdminArticleRequest('unscheduleArticle', {
    targetArticleId: id,
    route: `/admin-api/${url}`,
    payload: { status: 'draft', publishAt: null, scheduledAt: null },
    relatedArticleIds: [],
  });
  return putArticleState(url, { status: 'draft', publishAt: null, scheduledAt: null });
}

export async function deleteArticleSoft(id: string) {
  await deleteArticle(id);
}

export async function deleteArticleHard(id: string) {
  const encoded = encodeURIComponent(id);
  const res = await adminApiClient.post<ArticleMutationResponse>(`${ARTICLES_PATH}/${encoded}/hard-delete`);
  return mutationResponse(res.data);
}

export async function bulkHardDeleteArticles(ids: string[]) {
  const cleanIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!cleanIds.length) throw new Error('Select at least one deleted story');
  const res = await adminApiClient.post<ArticleMutationResponse>(`${ARTICLES_PATH}/forever/bulk`, { ids: cleanIds });
  return mutationResponse(res.data);
}

export async function hardDeleteArticle(id: string) {
  return deleteArticleHard(id);
}

// Optional extra helpers (create/update/meta) if needed by other screens
export async function createArticle(data: Partial<Article>) {
  // Canonical contract: POST /articles (proxy -> /admin-api/articles)
  const payload = withDescriptionFallback(data as any);
  logAdminArticleRequest('createArticle', {
    route: `/admin-api/${ARTICLES_PATH}`,
    payload,
    relatedArticleIds: [],
  });
  const res = await adminApiClient.post(ARTICLES_PATH, payload);
  mutationResponse(res.data);
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
  const payload = withDescriptionFallback(data as any);
  logAdminArticleRequest('updateArticle', {
    targetArticleId: id,
    route: `/admin-api/${url}`,
    payload,
    relatedArticleIds: [],
  });
  const res = await adminApiClient.put(url, payload);
  mutationResponse(res.data);
  return res.data;
}

export async function updateArticlePartial(id: string, patch: Partial<Article>): Promise<Article> {
  // PUT accepts field patches. Reading/merging a full record expands the write scope.
  const updated = await updateArticle(id, patch);
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

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import type { ManageNewsParams } from '@/types/api';
import type { ArticleStatus } from '@/types/articles';
import { adminJson } from '@/lib/http/adminFetch';
import {
  listArticles,
  archiveArticle,
  restoreArticle,
  deleteArticle,
  publishArticle,
  unpublishArticle,
  updateArticleStatus,
  scheduleArticle,
  unscheduleArticle,
  hardDeleteArticle,
  bulkHardDeleteArticles,
  requeueArticleTranslations,
  type Article,
  type ListResponse,
} from '@/lib/api/articles';
import { normalizeError } from '@/lib/error';
import { articleFollowUpWarning, normalizeArticleError, refreshArticleQueries } from '@/lib/articleLifecycle';
import { normalizeRoleId } from '@/lib/adminAccessControl';
import { ARTICLE_PUSH_SPAM_WARNING, pushSendErrorMessage } from '@/lib/pushSendFeedback';
import { useAuth } from '@/context/AuthContext';
import { usePublishFlag } from '@/context/PublishFlagContext';
import { ScheduleDialog } from './ScheduleDialog';
import type { QuickViewCounts, QuickViewKey, QuickViewLoadState } from './QuickViewsBar';
import { listAdminAnalyticsArticles, type ArticlesAnalyticsRow } from '@/lib/api/adminAnalytics';
import { formatDurationShort, formatNumberCompact, formatPercent } from '@/lib/formatDuration';

function norm(s: any): string {
  return String(s || '').trim().toLowerCase();
}

const ARTICLE_PUSH_FALLBACK_BODY = 'Tap to read the full story on News Pulse.';

function extractSlugFromPublicUrl(input: unknown): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw, 'https://www.newspulse.co.in');
    const parts = url.pathname.split('/').map((part) => part.trim()).filter(Boolean);
    const newsIndex = parts.findIndex((part) => part.toLowerCase() === 'news');
    const candidate = newsIndex >= 0 ? parts[newsIndex + 1] : parts[parts.length - 1];
    return decodeURIComponent(String(candidate || '')).trim();
  } catch {
    const parts = raw.split(/[/?#]/).map((part) => part.trim()).filter(Boolean);
    return parts[parts.length - 1] || '';
  }
}

export type ArticlePushBuildResult =
  | {
      ok: true;
      payload: {
        articleId: string;
        slug: string;
        title: string;
        body: string;
        url: string;
        category: string;
        language: string;
        confirmSend: true;
      };
    }
  | { ok: false; reason: string };

export function buildArticlePushPayload(article: Article): ArticlePushBuildResult {
  const status = norm((article as any)?.status ?? (article as any)?.state ?? (article as any)?.publishStatus);
  if (status !== 'published') return { ok: false, reason: 'Article push is available only for published articles.' };

  const articleId = String((article as any)?._id || (article as any)?.id || '').trim();
  const publicUrl = (article as any)?.publicUrl ?? (article as any)?.publicURL ?? (article as any)?.public_url ?? (article as any)?.canonicalUrl ?? (article as any)?.canonical_url ?? (article as any)?.liveUrl ?? (article as any)?.live_url;
  const slug = String((article as any)?.slug || extractSlugFromPublicUrl(publicUrl)).trim();
  const title = String((article as any)?.title || '').trim();
  const body = String((article as any)?.summary || '').trim() || ARTICLE_PUSH_FALLBACK_BODY;
  const category = norm((article as any)?.category);
  const language = norm((article as any)?.language ?? (article as any)?.lang) || 'en';

  if (!articleId) return { ok: false, reason: 'Article push unavailable: missing article id.' };
  if (!title) return { ok: false, reason: 'Article push unavailable: missing article title.' };
  if (!slug) return { ok: false, reason: 'Article push unavailable: missing public URL.' };

  return {
    ok: true,
    payload: {
      articleId,
      slug,
      title,
      body,
      url: `https://www.newspulse.co.in/news/${slug}`,
      category,
      language,
      confirmSend: true,
    },
  };
}

function getTags(a: Article): string[] {
  const t = (a as any)?.tags;
  return Array.isArray(t) ? t.map((x) => String(x || '').trim()).filter(Boolean) : [];
}

function isBreakingStory(a: Article): boolean {
  const cat = norm((a as any)?.category);
  const tags = getTags(a).map((t) => norm(t));
  return cat === 'breaking' || tags.includes('breaking');
}

function isGujaratRegional(a: Article): boolean {
  const tags = getTags(a).map((t) => norm(t));
  return (
    tags.includes('state:gujarat')
    || tags.includes('gujarat')
    || tags.some((t) => t.startsWith('district:'))
    || tags.some((t) => t.startsWith('city:'))
  );
}

function needsPtiReview(a: Article): boolean {
  const v = norm((a as any)?.ptiCompliance);
  if (!v) return false;
  return v !== 'compliant';
}

function isFlagged(a: Article): boolean {
  const flags = (a as any)?.flags;
  if (Array.isArray(flags) && flags.length > 0) return true;
  const tags = getTags(a).map((t) => norm(t));
  if (tags.includes('flagged')) return true;
  const workflowLocked = !!(a as any)?.workflow?.locked;
  return workflowLocked;
}

function isAiVerified(a: Article): boolean {
  return !!((a as any)?.aiVerified || (a as any)?.ai_verified || (a as any)?.ai_verified === true || (a as any)?.aiVerifiedAt);
}

function getLocationTags(a: Article): string[] {
  const tags = getTags(a).map((t) => norm(t));
  return tags.filter((t) => t.startsWith('district:') || t.startsWith('city:'));
}

function formatArticleDate(a: Article, published: boolean): string {
  const raw = published ? a.publishedAt : a.updatedAt || a.createdAt;
  if (!raw) return '—';
  const ts = Date.parse(String(raw));
  if (Number.isNaN(ts)) return '—';
  return new Date(ts).toLocaleString();
}

function formatLangTag(code: any): string {
  const c = String(code || '').trim().toLowerCase();
  if (!c) return '';
  if (c === 'en') return 'EN';
  if (c === 'hi') return 'HI';
  if (c === 'gu') return 'GU';
  return c.slice(0, 4).toUpperCase();
}

type ArticleLanguageInfo = {
  badge: string;
};

export type ManageNewsArticleGroup = {
  key: string;
  primary: Article;
  articles: Article[];
};

function getArticleId(a: Article): string {
  return String((a as any)?._id || (a as any)?.id || '').trim();
}

function getManageNewsGroupKey(a: Article): string {
  return String((a as any)?.translationGroupId || '').trim() || getArticleId(a);
}

function getSourceLanguageHint(a: Article): 'en' | 'hi' | 'gu' | '' {
  return normalizeArticleLang(
    (a as any)?.sourceLanguage
      ?? (a as any)?.originalLanguage
      ?? (a as any)?.baseLanguage
      ?? (a as any)?.sourceLang
      ?? (a as any)?.originalLang
      ?? (a as any)?.baseLang,
  );
}

function getNestedSourceArticleId(a: Article): string {
  const source = (a as any)?.sourceArticle ?? (a as any)?.originalArticle ?? (a as any)?.baseArticle;
  if (!source || typeof source !== 'object') return '';
  return String((source as any)?._id || (source as any)?.id || (source as any)?.articleId || '').trim();
}

function isExplicitSourceRow(a: Article): boolean {
  return (a as any)?.__isSource === true
    || (a as any)?.isSource === true
    || (a as any)?.source === true
    || (a as any)?.canonical === true;
}

function getArticleLanguageRank(a: Article): number {
  const lang = normalizeArticleLang((a as any)?.lang ?? (a as any)?.language);
  if (lang === 'en') return 0;
  if (lang === 'hi') return 1;
  if (lang === 'gu') return 2;
  return 3;
}

function getCreatedTimestamp(a: Article): number {
  const raw = (a as any)?.createdAt || (a as any)?.updatedAt || '';
  const ts = Date.parse(String(raw));
  return Number.isNaN(ts) ? Number.MAX_SAFE_INTEGER : ts;
}

function compareCanonicalFallback(a: Article, b: Article): number {
  const langDiff = getArticleLanguageRank(a) - getArticleLanguageRank(b);
  if (langDiff !== 0) return langDiff;

  const createdDiff = getCreatedTimestamp(a) - getCreatedTimestamp(b);
  if (createdDiff !== 0) return createdDiff;

  return getArticleId(a).localeCompare(getArticleId(b));
}

function chooseManageNewsPrimaryArticle(articles: Article[]): Article | null {
  const rows = articles.filter((a) => !!getArticleId(a));
  if (!rows.length) return null;

  const sortedRows = [...rows].sort(compareCanonicalFallback);

  const nestedSourceIds = Array.from(new Set(rows.map(getNestedSourceArticleId).filter(Boolean))).sort();
  for (const sourceId of nestedSourceIds) {
    const found = sortedRows.find((a) => getArticleId(a) === sourceId);
    if (found) return found;
  }

  const explicitSource = sortedRows.find(isExplicitSourceRow);
  if (explicitSource) return explicitSource;

  const sourceLangHints = Array.from(new Set(rows.map(getSourceLanguageHint).filter(Boolean))).sort((a, b) => {
    const order = { en: 0, hi: 1, gu: 2 } as const;
    return order[a as keyof typeof order] - order[b as keyof typeof order];
  });
  for (const lang of sourceLangHints) {
    const found = sortedRows.find((a) => normalizeArticleLang((a as any)?.lang ?? (a as any)?.language) === lang);
    if (found) return found;
  }

  return sortedRows[0];
}

export function groupManageNewsArticleRows(rows: Article[]): ManageNewsArticleGroup[] {
  const groups = new Map<string, Article[]>();
  for (const article of rows) {
    const id = getArticleId(article);
    if (!id) continue;
    const key = getManageNewsGroupKey(article) || id;
    const existing = groups.get(key);
    if (existing) existing.push(article);
    else groups.set(key, [article]);
  }

  return Array.from(groups.entries()).flatMap(([key, articles]) => {
    const primary = chooseManageNewsPrimaryArticle(articles);
    return primary ? [{ key, primary, articles }] : [];
  });
}

async function listManageNewsArticles(params: ManageNewsParams): Promise<ListResponse> {
  const limit = Math.max(1, params.limit || 20);
  const firstPage = await listArticles({ ...params, page: 1, limit });
  const firstRows: Article[] = Array.isArray((firstPage as any)?.rows)
    ? (firstPage as any).rows
    : (Array.isArray((firstPage as any)?.data) ? (firstPage as any).data : []);
  const pageCount = Math.max(1, Number((firstPage as any)?.pages || 1));

  if (pageCount <= 1) {
    return { ...firstPage, rows: firstRows, page: params.page || 1 };
  }

  const remainingPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) => listArticles({ ...params, page: index + 2, limit })),
  );
  const remainingRows = remainingPages.flatMap((pageData) => {
    const rows: Article[] = Array.isArray((pageData as any)?.rows)
      ? (pageData as any).rows
      : (Array.isArray((pageData as any)?.data) ? (pageData as any).data : []);
    return rows;
  });
  const rows = [...firstRows, ...remainingRows];

  return {
    ...firstPage,
    rows,
    total: rows.length,
    page: params.page || 1,
    pages: Math.max(1, Math.ceil(rows.length / limit)),
  };
}

function normalizeArticleLang(input: any): 'en' | 'hi' | 'gu' | '' {
  const c = String(input || '').trim().toLowerCase();
  return c === 'en' || c === 'hi' || c === 'gu' ? c : '';
}

function addTranslationMetadataLanguages(a: Article, langs: Set<string>): void {
  const translations = (a as any)?.translations;
  if (Array.isArray(translations)) {
    for (const item of translations) {
      const code = normalizeArticleLang((item as any)?.lang ?? (item as any)?.language ?? (item as any)?.code);
      if (code) langs.add(code);
    }
    return;
  }

  if (translations && typeof translations === 'object') {
    for (const k of Object.keys(translations)) {
      const code = normalizeArticleLang(k);
      if (code) langs.add(code);
    }
  }
}

function getArticleLanguageCodes(a: Article, rows: Article[]): Set<string> {
  const langs = new Set<string>();
  const primary = normalizeArticleLang((a as any)?.lang ?? (a as any)?.language);
  if (primary) langs.add(primary);

  const groupId = String((a as any)?.translationGroupId || '').trim();
  if (groupId) {
    rows.forEach((candidate) => {
      if (String((candidate as any)?.translationGroupId || '').trim() !== groupId) return;
      const code = normalizeArticleLang((candidate as any)?.lang ?? (candidate as any)?.language);
      if (code) langs.add(code);
      addTranslationMetadataLanguages(candidate, langs);
    });
  } else {
    addTranslationMetadataLanguages(a, langs);
  }

  return langs;
}

function formatLanguageNamesForDelete(codes: Set<string>): string {
  const labels: Record<string, string> = { en: 'English', hi: 'Hindi', gu: 'Gujarati' };
  const names = ['en', 'hi', 'gu'].filter((code) => codes.has(code)).map((code) => labels[code]);
  if (!names.length) return 'English, Hindi and Gujarati';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export function buildManageNewsDeleteConfirmation(a: Article, rows: Article[]): string {
  const languages = formatLanguageNamesForDelete(getArticleLanguageCodes(a, rows));
  return [
    'Delete this story?',
    '',
    'This will delete all available language versions of this story',
    `(${languages}).`,
  ].join('\n');
}

export function getArticleLanguageInfo(a: Article, rows: Article[]): ArticleLanguageInfo {
  const langs = getArticleLanguageCodes(a, rows);
  const primary = normalizeArticleLang((a as any)?.lang ?? (a as any)?.language);

  const ordered = ['en', 'hi', 'gu'];
  const picked = ordered.filter((x) => langs.has(x));
  const badge = picked.length >= 2
    ? picked.map(formatLangTag).join('+')
    : formatLangTag(picked[0] || primary);

  return { badge };
}

function getEditorialTypeLabel(a: Article): string {
  if (norm((a as any)?.category) !== 'editorial') return '';
  return norm((a as any)?.editorialType) === 'special_story' ? 'Special Story' : 'Editorial';
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

function logNewsTableAction(label: string, payload: Record<string, any>): void {
  if (!isAdminArticleDebugEnabled()) return;
  console.log(`[NewsTable] ${label}`, payload);
}

function getAuthorName(a: Article): string {
  const authorRaw = (a as any)?.author;

  // author can be a string in some environments
  if (typeof authorRaw === 'string' && authorRaw.trim()) return authorRaw.trim();

  // author can be an array of strings/objects
  if (Array.isArray(authorRaw) && authorRaw.length > 0) {
    const first = authorRaw[0] as any;
    if (typeof first === 'string' && first.trim()) return first.trim();
    const n1 = first?.name || first?.fullName || first?.displayName || first?.username;
    if (n1 && String(n1).trim()) return String(n1).trim();
  }

  // author can be an object with different keys
  const direct = (authorRaw as any)?.name
    || (authorRaw as any)?.fullName
    || (authorRaw as any)?.displayName
    || (authorRaw as any)?.username;
  if (direct && String(direct).trim()) return String(direct).trim();

  // Common alternates
  const alt = (a as any)?.authorName
    || (a as any)?.by
    || (a as any)?.byline
    || (a as any)?.reporter
    || (a as any)?.writer
    || (a as any)?.createdByName
    || (a as any)?.created_by_name;
  if (alt && String(alt).trim()) return String(alt).trim();

  // Nested creators / users
  const createdBy = (a as any)?.createdBy?.name
    || (a as any)?.createdBy?.fullName
    || (a as any)?.created_by?.name
    || (a as any)?.created_by?.fullName
    || (a as any)?.user?.name
    || (a as any)?.user?.fullName;
  if (createdBy && String(createdBy).trim()) return String(createdBy).trim();

  return '';
}

interface Props {
  params: ManageNewsParams;
  search: string;
  quickView: QuickViewKey;
  onCounts: (counts: QuickViewCounts) => void;
  onLoadStateChange?: (state: QuickViewLoadState) => void;
  actionsDisabled?: boolean;
  onSelectIds?: (ids: string[]) => void;
  onPageChange?: (page: number) => void;
  highlightId?: string;
  stickyTopOffsetPx?: number;
}

type LifecycleRequest =
  | { action: 'publish' | 'unpublish' | 'archive' | 'restore' | 'unarchive' | 'delete' | 'hardDelete' | 'unschedule'; id: string }
  | { action: 'schedule'; id: string; at: string }
  | { action: 'hardDeleteBulk'; ids: string[] };

export function NewsTable({ params, search, quickView, onCounts, onLoadStateChange, actionsDisabled = false, onSelectIds, onPageChange, highlightId, stickyTopOffsetPx = 0 }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const role = normalizeRoleId(user?.role);
  const { publishEnabled } = usePublishFlag();

  const [showAnalyticsCols, setShowAnalyticsCols] = React.useState<boolean>(() => {
    try { return localStorage.getItem('np_admin_articles_show_analytics') === 'true'; } catch { return false; }
  });
  const [analyticsRange, setAnalyticsRange] = React.useState<'24h' | '7d' | '30d'>(() => {
    try {
      const raw = localStorage.getItem('np_admin_articles_analytics_range');
      if (raw === '24h' || raw === '7d' || raw === '30d') return raw;
    } catch {}
    return '30d';
  });

  React.useEffect(() => {
    try { localStorage.setItem('np_admin_articles_show_analytics', String(showAnalyticsCols)); } catch {}
  }, [showAnalyticsCols]);
  React.useEffect(() => {
    try { localStorage.setItem('np_admin_articles_analytics_range', analyticsRange); } catch {}
  }, [analyticsRange]);

  const canArchive = role === 'admin' || role === 'founder' || role === 'editor';
  const canDelete = role === 'admin' || role === 'founder';
  const isFounder = role === 'founder';
  const publishedView = params.status === 'published' || quickView === 'published';

  // Build a stable fetch params object so react-query doesn't refetch on every render
  // when the parent passes a freshly-created `params` object.
  // Also ensure backend search is driven by `search`.
  const fetchParams = React.useMemo<ManageNewsParams>(() => {
    const q = String(search || '').trim();
    return {
      status: params.status,
      category: params.category,
      language: params.language,
      from: params.from,
      to: params.to,
      q: q ? q : undefined,
      page: params.page,
      limit: params.limit,
      sort: publishedView ? '-publishedAt' : params.sort,
    };
  }, [
    params.status,
    params.category,
    params.language,
    params.from,
    params.to,
    params.page,
    params.limit,
    params.sort,
    search,
    publishedView,
  ]);

  const { data, isPending: isLoading, isFetching, isSuccess, error, refetch } = useQuery<ListResponse>({
    queryKey: [
      'articles',
      fetchParams.limit ?? 20,
      fetchParams.sort ?? '-updatedAt',
      fetchParams.status ?? 'all',
      fetchParams.category ?? '',
      fetchParams.language ?? '',
      fetchParams.from ?? '',
      fetchParams.to ?? '',
      fetchParams.q ?? '',
    ],
    queryFn: () => listManageNewsArticles(fetchParams),
    retry: false,
  });

  React.useEffect(() => {
    onLoadStateChange?.(isLoading || isFetching ? 'loading' : error ? 'error' : 'ready');
  }, [isLoading, isFetching, error, onLoadStateChange]);

  const rawRows: Article[] = (data as any)?.rows ?? (data as any)?.data ?? [];

  const lifecycleInFlight = React.useRef(false);
  const lifecycleMutation = useMutation({
    mutationKey: ['articles', 'lifecycle'],
    retry: false,
    mutationFn: (request: LifecycleRequest): Promise<unknown> => {
      switch (request.action) {
        case 'publish': return publishArticle(request.id);
        case 'unpublish': return unpublishArticle(request.id);
        case 'archive': return archiveArticle(request.id);
        case 'restore': return restoreArticle(request.id);
        case 'unarchive': return updateArticleStatus(request.id, 'draft');
        case 'delete': return deleteArticle(request.id);
        case 'hardDelete': return hardDeleteArticle(request.id);
        case 'hardDeleteBulk': return bulkHardDeleteArticles(request.ids);
        case 'unschedule': return unscheduleArticle(request.id);
        case 'schedule': return scheduleArticle(request.id, request.at);
      }
    },
    onSuccess: async (result, request) => {
      const labels: Record<LifecycleRequest['action'], string> = {
        publish: 'Published', unpublish: 'Unpublished', archive: 'Archived',
        restore: 'Restored', unarchive: 'Restored', delete: 'Deleted',
        hardDelete: 'Deleted forever', hardDeleteBulk: 'Deleted forever',
        unschedule: 'Unscheduled', schedule: 'Scheduled',
      };
      const ids = request.action === 'hardDeleteBulk' ? request.ids : [request.id];
      setSelected((current) => current.filter((id) => !ids.includes(id)));
      toast.success(request.action === 'schedule'
        ? `Scheduled for local time ${new Date(request.at).toLocaleString()}`
        : labels[request.action]);
      const warning = articleFollowUpWarning(result);
      if (warning) toast(warning);
      try {
        await Promise.all([
          refreshArticleQueries(qc),
          ...(['delete', 'hardDelete', 'hardDeleteBulk'].includes(request.action)
            ? [qc.invalidateQueries({ queryKey: ['admin', 'analytics', 'articles'] }, { throwOnError: true })]
            : []),
        ]);
      } catch {
        toast.error('The action completed, but the refreshed list could not be loaded. Refresh the list; do not repeat the action.');
      }
    },
    onError: async (error: unknown) => {
      const failure = normalizeArticleError(error, 'Article action failed');
      toast.error(failure.message);
      if (failure.status === 409) {
        try {
          await refreshArticleQueries(qc);
        } catch {
          toast.error('The latest story could not be loaded. Refresh before trying the action again.');
        }
      }
    },
    onSettled: () => { lifecycleInFlight.current = false; },
  });

  const runLifecycle = (request: LifecycleRequest) => {
    if (lifecycleInFlight.current || actionsDisabled || isFetching) return;
    if (['publish', 'unpublish', 'hardDelete', 'hardDeleteBulk'].includes(request.action) && !isFounder) {
      toast.error('Founder permission is required for this action.');
      return;
    }
    if (request.action === 'publish' && !publishEnabled) {
      toast.error('Publishing temporarily disabled');
      return;
    }
    if (request.action === 'hardDelete' || request.action === 'hardDeleteBulk') {
      const ids = request.action === 'hardDeleteBulk' ? request.ids : [request.id];
      if (!ids.length || ids.some((id) => rawRows.find((row) => row._id === id)?.status !== 'deleted')) {
        toast.error('Only soft-deleted stories can be permanently removed.');
        return;
      }
    }
    lifecycleInFlight.current = true;
    lifecycleMutation.mutate(request);
  };

  const lifecycleBusy = lifecycleMutation.isPending || actionsDisabled || isFetching;
  const bulkDeleting = lifecycleMutation.isPending && lifecycleMutation.variables.action === 'hardDeleteBulk';
  const [translationBackfillMode, setTranslationBackfillMode] = React.useState<'all' | 'hi' | 'gu' | 'en'>('all');
  const [bulkTranslating, setBulkTranslating] = React.useState(false);

  const mutateGenerateMissingTranslations = useMutation({
    mutationFn: async (jobs: Array<{ id: string; languages: string[] }>) => {
      for (const job of jobs) {
        await requeueArticleTranslations(job.id, { languages: job.languages });
      }
      return { count: jobs.length };
    },
    onMutate: () => {
      setBulkTranslating(true);
    },
    onSuccess: (_data, jobs) => {
      const languageCount = jobs.reduce((sum, job) => sum + job.languages.length, 0);
      toast.success(`Queued missing translations for ${jobs.length} article${jobs.length === 1 ? '' : 's'} (${languageCount} language${languageCount === 1 ? '' : 's'})`);
      qc.invalidateQueries({ queryKey: ['articles'] });
    },
    onError: (err: any) => {
      toast.error(normalizeError(err, 'Generate missing translations failed').message);
    },
    onSettled: () => {
      setBulkTranslating(false);
    },
  });

  // Schedule dialog
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [scheduleTarget, setScheduleTarget] = React.useState<Article | null>(null);
  const [articlePushTarget, setArticlePushTarget] = React.useState<Article | null>(null);
  const [articlePushSending, setArticlePushSending] = React.useState(false);

  // Selection
  const [selected, setSelected] = React.useState<string[]>([]);
  // Avoid maximum update depth errors when parent passes a non-memoized callback.
  const onSelectIdsRef = React.useRef<typeof onSelectIds>(onSelectIds);
  React.useEffect(() => { onSelectIdsRef.current = onSelectIds; }, [onSelectIds]);
  const lastSelectedKeyRef = React.useRef<string>('');
  React.useEffect(() => {
    const key = JSON.stringify(selected);
    if (key === lastSelectedKeyRef.current) return;
    lastSelectedKeyRef.current = key;
    onSelectIdsRef.current?.(selected);
  }, [selected]);

  // Client-side search + quick view filtering
  const searchKey = React.useMemo(() => norm(search), [search]);

  const isSeededSample = React.useCallback((a: Article) => {
    const title = String((a as any)?.title || '').toLowerCase();
    const authorName = String(getAuthorName(a) || '').toLowerCase();
    const tags = getTags(a).map((t) => norm(t));

    // Backend seed artifacts we never want to show in the admin list.
    if (authorName === 'seeder') return true;
    if (title.startsWith('sample article')) return true;
    if (tags.includes('demo') && tags.includes('seed')) return true;
    return false;
  }, []);

  const baseRows = React.useMemo(() => {
    // Keep parity with old behavior: hide deleted in All tab
    const view = (params.status ?? 'all') as any;
    const cleaned = rawRows.filter((r) => !isSeededSample(r));
    if (view === 'all') return cleaned.filter((r) => (r.status ?? 'draft') !== 'deleted');
    return cleaned;
  }, [rawRows, params.status, isSeededSample]);

  const logicalGroups = React.useMemo(() => groupManageNewsArticleRows(baseRows), [baseRows]);

  React.useEffect(() => {
    if (!isSuccess || isFetching) return;
    const availableIds = new Set(logicalGroups.map((group) => getArticleId(group.primary)));
    setSelected((current) => {
      const next = current.filter((id) => availableIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [logicalGroups, isSuccess, isFetching]);

  const articleMatchesSearch = React.useCallback((a: Article) => {
    if (!searchKey) return true;
    const title = norm((a as any)?.title);
    const summary = norm((a as any)?.summary);
    const content = norm((a as any)?.content);
    const category = norm((a as any)?.category);
    const tags = getTags(a).map((t) => norm(t)).join(' ');
    return (
      title.includes(searchKey)
      || summary.includes(searchKey)
      || content.includes(searchKey)
      || category.includes(searchKey)
      || tags.includes(searchKey)
    );
  }, [searchKey]);

  const groupMatches = React.useCallback((group: ManageNewsArticleGroup, predicate: (a: Article) => boolean) => {
    return predicate(group.primary) || group.articles.some(predicate);
  }, []);

  const searchedRows = React.useMemo(() => {
    const groups = searchKey
      ? logicalGroups.filter((group) => groupMatches(group, articleMatchesSearch))
      : logicalGroups;
    return groups.map((group) => group.primary);
  }, [articleMatchesSearch, groupMatches, logicalGroups, searchKey]);

  const counts = React.useMemo<QuickViewCounts>(() => {
    const all = searchedRows.length;
    const published = searchedRows.filter((a) => (a.status ?? 'draft') === 'published').length;
    const draft = searchedRows.filter((a) => (a.status ?? 'draft') === 'draft').length;
    const scheduled = searchedRows.filter((a) => (a.status ?? 'draft') === 'scheduled').length;
    const searchedSet = new Set(searchedRows.map((a) => getArticleId(a)));
    const searchedGroups = logicalGroups.filter((group) => searchedSet.has(getArticleId(group.primary)));
    const breaking = searchedGroups.filter((group) => groupMatches(group, isBreakingStory)).length;
    const regional = searchedGroups.filter((group) => groupMatches(group, isGujaratRegional)).length;
    const pti = searchedGroups.filter((group) => groupMatches(group, needsPtiReview)).length;
    const flagged = searchedGroups.filter((group) => groupMatches(group, isFlagged)).length;
    return {
      all,
      published,
      draft,
      scheduled,
      breaking,
      regional,
      pti,
      flagged,
    };
  }, [groupMatches, logicalGroups, searchedRows]);

  // Avoid maximum update depth errors when parent passes a non-memoized callback.
  const onCountsRef = React.useRef(onCounts);
  React.useEffect(() => { onCountsRef.current = onCounts; }, [onCounts]);
  const lastCountsKeyRef = React.useRef<string>('');
  React.useEffect(() => {
    if (!isSuccess || isFetching) return;
    const key = JSON.stringify(counts);
    if (key === lastCountsKeyRef.current) return;
    lastCountsKeyRef.current = key;
    onCountsRef.current(counts);
  }, [counts, isSuccess, isFetching]);

  const quickFilteredRows = React.useMemo(() => {
    const searchedSet = new Set(searchedRows.map((a) => getArticleId(a)));
    const searchedGroups = logicalGroups.filter((group) => searchedSet.has(getArticleId(group.primary)));
    switch (quickView) {
      case 'published':
        return searchedRows.filter((a) => (a.status ?? 'draft') === 'published');
      case 'draft':
        return searchedRows.filter((a) => (a.status ?? 'draft') === 'draft');
      case 'scheduled':
        return searchedRows.filter((a) => (a.status ?? 'draft') === 'scheduled');
      case 'breaking':
        return searchedGroups.filter((group) => groupMatches(group, isBreakingStory)).map((group) => group.primary);
      case 'regional':
        return searchedGroups.filter((group) => groupMatches(group, isGujaratRegional)).map((group) => group.primary);
      case 'pti':
        return searchedGroups.filter((group) => groupMatches(group, needsPtiReview)).map((group) => group.primary);
      case 'flagged':
        return searchedGroups.filter((group) => groupMatches(group, isFlagged)).map((group) => group.primary);
      case 'all':
      default:
        return searchedRows;
    }
  }, [groupMatches, logicalGroups, quickView, searchedRows]);

  const sortedRows = React.useMemo(() => {
    const getSortTs = (a: Article): number => {
      const raw = publishedView ? a.publishedAt : (a as any)?.updatedAt
        || (a as any)?.publishedAt
        || (a as any)?.publishAt
        || (a as any)?.createdAt
        || 0;
      const ts = Date.parse(String(raw));
      return Number.isNaN(ts) ? 0 : ts;
    };

    const arr = [...quickFilteredRows];
    arr.sort((a, b) => getSortTs(b) - getSortTs(a));
    return arr;
  }, [quickFilteredRows, publishedView]);

  const pageSize = Math.max(1, fetchParams.limit ?? 20);
  const logicalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const currentPage = Math.min(Math.max(1, fetchParams.page ?? 1), logicalPages);
  const visibleRows = React.useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedRows.slice(start, start + pageSize);
  }, [currentPage, pageSize, sortedRows]);

  const analyticsQuery = useQuery({
    queryKey: ['admin', 'analytics', 'articles', 'table', analyticsRange, fetchParams],
    enabled: showAnalyticsCols,
    queryFn: async () => {
      const res = await listAdminAnalyticsArticles({
        range: analyticsRange,
        status: fetchParams.status,
        category: fetchParams.category,
        language: fetchParams.language,
        from: fetchParams.from,
        to: fetchParams.to,
        page: fetchParams.page,
        limit: fetchParams.limit,
        // tolerate search term (backend may ignore)
        ...(fetchParams.q ? { q: fetchParams.q } as any : {}),
      } as any);
      const rows = (res?.rows || res?.items || []) as ArticlesAnalyticsRow[];
      return rows;
    },
    retry: 0,
    refetchOnWindowFocus: false,
  });

  React.useEffect(() => {
    if (!analyticsQuery.isError) return;
    if (!import.meta.env.DEV) return;
    try {
      // eslint-disable-next-line no-console
      console.error('[NewsTable] analytics columns load failed', analyticsQuery.error);
    } catch {}
  }, [analyticsQuery.error, analyticsQuery.isError]);

  const analyticsById = React.useMemo(() => {
    const m = new Map<string, ArticlesAnalyticsRow>();
    for (const r of (analyticsQuery.data || [])) {
      const id = String((r as any)?.articleId || '').trim();
      if (!id) continue;
      m.set(id, r);
    }
    return m;
  }, [analyticsQuery.data]);

  const visibleIds = React.useMemo(() => visibleRows.map((a) => a._id), [visibleRows]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const someVisibleSelected = visibleIds.some((id) => selected.includes(id));
  const selectAllRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

  const selectedArticles = React.useMemo(() => {
    const selectedSet = new Set(selected);
    return logicalGroups.map((group) => group.primary).filter((a) => selectedSet.has(getArticleId(a)));
  }, [logicalGroups, selected]);

  const runMissingTranslationBackfill = () => {
    if (role !== 'founder') return;
    const targetOrder = ['en', 'hi', 'gu'];
    const forcedTarget = translationBackfillMode === 'all' ? '' : translationBackfillMode;
    const jobs: Array<{ id: string; languages: string[] }> = [];
    const sourceLanguages = new Set<string>();
    const targetLanguages = new Set<string>();
    let estimatedCharacters = 0;

    for (const article of selectedArticles) {
      const id = String((article as any)?._id || '').trim();
      if (!id) continue;
      const available = getArticleLanguageCodes(article, rawRows);
      const primary = normalizeArticleLang((article as any)?.lang ?? (article as any)?.language) || Array.from(available)[0] || 'unknown';
      sourceLanguages.add(primary.toUpperCase());
      const missing = targetOrder.filter((code) => !available.has(code));
      const languages = forcedTarget ? missing.filter((code) => code === forcedTarget) : missing;
      if (!languages.length) continue;

      const charCount = [article.title, article.summary, article.description, article.content]
        .map((value) => String(value || ''))
        .join(' ')
        .length;
      estimatedCharacters += charCount * languages.length;
      languages.forEach((code) => targetLanguages.add(code.toUpperCase()));
      jobs.push({ id, languages });
    }

    if (!jobs.length) {
      toast('No selected articles are missing the requested language translations.');
      return;
    }

    const ok = confirm([
      'Generate Missing Translations',
      '',
      `Articles: ${selectedArticles.length}`,
      `Jobs to queue: ${jobs.length}`,
      `Source languages: ${Array.from(sourceLanguages).sort().join(', ') || '—'}`,
      `Target languages: ${Array.from(targetLanguages).sort().join(', ') || '—'}`,
      `Estimated character count: ${estimatedCharacters.toLocaleString()}`,
      '',
      'This queues translation jobs only for selected articles. It does not translate the full database automatically.',
    ].join('\n'));
    if (!ok) return;
    mutateGenerateMissingTranslations.mutate(jobs);
  };

  // Avoid a visible "gap" above the header when using a non-zero sticky top offset.
  // We only apply the offset after the header would collide with the sticky quick-views bar.
  const stickySentinelRef = React.useRef<HTMLDivElement | null>(null);
  const [headerPinned, setHeaderPinned] = React.useState(false);
  React.useEffect(() => {
    const update = () => {
      const el = stickySentinelRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const nextPinned = top <= stickyTopOffsetPx;
      setHeaderPinned((p) => (p === nextPinned ? p : nextPinned));
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [stickyTopOffsetPx]);

  const effectiveStickyTop = headerPinned ? stickyTopOffsetPx : 0;

  const ActionLink = (
    {
      label,
      title,
      onClick,
      disabled,
      tone,
    }: {
      label: string;
      title?: string;
      onClick: () => void;
      disabled?: boolean;
      tone?: 'blue' | 'green' | 'amber' | 'slate' | 'red';
    },
  ) => {
    const toneClass =
      tone === 'green'
        ? 'text-green-700 hover:text-green-800'
        : tone === 'amber'
          ? 'text-amber-700 hover:text-amber-800'
          : tone === 'red'
            ? 'text-red-700 hover:text-red-800'
            : tone === 'slate'
              ? 'text-slate-700 hover:text-slate-900'
              : 'text-blue-700 hover:text-blue-800';

    return (
      <button
        type="button"
        title={title || label}
        aria-label={title || label}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={
          'text-xs font-medium underline-offset-2 hover:underline '
          + toneClass
          + (disabled ? ' opacity-50 cursor-not-allowed hover:no-underline' : '')
        }
      >
        {label}
      </button>
    );
  };

  const confirmArticlePush = async () => {
    if (!articlePushTarget || articlePushSending) return;
    const built = buildArticlePushPayload(articlePushTarget);
    if (!built.ok) {
      toast.error(built.reason);
      return;
    }

    setArticlePushSending(true);
    try {
      await adminJson('/admin/push/article', {
        method: 'POST',
        json: built.payload,
      });
      toast.success('Article push sent successfully.');
      setArticlePushTarget(null);
    } catch (e: any) {
      toast.error(pushSendErrorMessage(e, 'Article push failed.'));
    } finally {
      setArticlePushSending(false);
    }
  };

  const showSkeleton = isLoading;

  if (error) {
    const failure = normalizeArticleError(error, 'Error loading articles');
    if (failure.authExpired) {
      return (
        <div role="alert" className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">Unauthorized</div>
          <div className="mt-1 text-xs text-slate-600">Your admin session is missing or expired. Please sign in again.</div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/unauthorized', { replace: true })}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Go to sign in
            </button>
            <button
              type="button"
              disabled={isFetching}
              onClick={() => void refetch()}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700">
        <div>{failure.message}</div>
        <button type="button" disabled={isFetching} onClick={() => void refetch()} className="mt-3 rounded border px-3 py-2">
          {isFetching ? 'Refreshing...' : 'Retry'}
        </button>
      </div>
    );
  }

  const empty = !showSkeleton && visibleRows.length === 0;

  const EmptyState = (
    <div className="rounded border bg-white p-6 text-sm text-slate-700">
      <div className="font-semibold">No stories found.</div>
      <div className="mt-1 text-xs text-slate-600">Try clearing filters or create a new story.</div>
    </div>
  );

  const RowBadges = ({ a }: { a: Article }) => {
    const tags = getTags(a).map((t) => norm(t));
    const pti = needsPtiReview(a);
    const ai = isAiVerified(a);

    return (
      <div className="flex flex-wrap gap-1">
        {pti && <span className="px-2 py-0.5 rounded-full bg-amber-700 text-white text-[10px]">PTI</span>}
        {ai && <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px]">AI-Verified</span>}
        {tags.includes('flagged') && <span className="px-2 py-0.5 rounded-full bg-red-700 text-white text-[10px]">Flagged</span>}
      </div>
    );
  };

  const LocationBadge = ({ a }: { a: Article }) => {
    const loc = getLocationTags(a);
    if (!loc.length) return <span className="text-slate-500 text-xs">—</span>;
    const firstTwo = loc.slice(0, 2);
    const rest = loc.length - firstTwo.length;
    return (
      <div className="flex items-center gap-1 flex-wrap">
        {firstTwo.map((t) => (
          <span key={t} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] border">{t}</span>
        ))}
        {rest > 0 && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] border">+{rest}</span>}
      </div>
    );
  };

  const renderActions = (a: Article) => {
    const st = (a.status ?? 'draft') as ArticleStatus;
    const id = a._id;
    const group = logicalGroups.find((candidate) => getArticleId(candidate.primary) === id);
    const groupRows = group?.articles || [a];
    const restoreNeedsFounder = groupRows.some((row) => row.deletedFromStatus === 'published');
    const baseLogPayload = {
      clickedArticleId: id,
      slug: String(a.slug || ''),
      language: String((a as any).lang ?? a.language ?? ''),
      translationGroupId: String((a as any).translationGroupId || ''),
      status: st,
      relatedArticleIds: [],
    };

    return (
      <div className="flex items-center justify-end gap-3 flex-nowrap whitespace-nowrap">
        <ActionLink
          label="Edit"
          tone="blue"
          onClick={() => {
            logNewsTableAction('edit click', {
              ...baseLogPayload,
              route: `/admin/articles/${encodeURIComponent(id)}/edit`,
            });
            navigate(`/admin/articles/${id}/edit`);
          }}
        />

        {st === 'draft' && (
          <>
            {isFounder && <ActionLink
              label="Publish"
              title={publishEnabled ? 'Publish' : 'Publish (disabled)'}
              tone="green"
              disabled={lifecycleBusy || !publishEnabled}
              onClick={() => {
                if (!publishEnabled) return;
                logNewsTableAction('publish click', {
                  ...baseLogPayload,
                  route: `/admin-api/articles/${encodeURIComponent(id)}/publish`,
                });
                runLifecycle({ action: 'publish', id });
              }}
            />}
            <ActionLink
              label="Schedule"
              title={publishEnabled ? 'Schedule…' : 'Schedule (disabled)'}
              tone="amber"
              disabled={lifecycleBusy || !publishEnabled}
              onClick={() => {
                if (!publishEnabled) return;
                logNewsTableAction('schedule click', {
                  ...baseLogPayload,
                  route: `/admin-api/articles/${encodeURIComponent(id)}`,
                });
                setScheduleTarget(a);
                setScheduleOpen(true);
              }}
            />
          </>
        )}

        {st === 'scheduled' && (
          <ActionLink
            label="Unschedule"
            tone="amber"
            disabled={lifecycleBusy}
            onClick={() => {
              logNewsTableAction('unschedule click', {
                ...baseLogPayload,
                route: `/admin-api/articles/${encodeURIComponent(id)}`,
                payload: { status: 'draft', publishAt: null, scheduledAt: null },
              });
              runLifecycle({ action: 'unschedule', id });
            }}
          />
        )}

        {st === 'published' && (
          <>
            {(() => {
              const push = buildArticlePushPayload(a);
              return (
                <ActionLink
                  label="Push"
                  title={push.ok ? 'Send Push' : push.reason}
                  tone="green"
                  disabled={!push.ok}
                  onClick={() => {
                    if (!push.ok) {
                      toast.error(push.reason);
                      return;
                    }
                    setArticlePushTarget(a);
                  }}
                />
              );
            })()}
            {isFounder && <ActionLink
              label="Unpublish"
              tone="slate"
              disabled={lifecycleBusy}
              onClick={() => {
                logNewsTableAction('unpublish click', {
                  ...baseLogPayload,
                  route: `/admin-api/articles/${encodeURIComponent(id)}/unpublish`,
                  payload: { toStatus: 'draft' },
                });
                runLifecycle({ action: 'unpublish', id });
              }}
            />}
          </>
        )}

        {st !== 'archived' && st !== 'deleted' && canArchive && (
          <ActionLink
            label="Archive"
            tone="slate"
            disabled={lifecycleBusy}
            onClick={() => runLifecycle({ action: 'archive', id })}
          />
        )}

        {(st === 'archived' || st === 'deleted') && canArchive && (
          <ActionLink
            label="Restore"
            tone="blue"
            disabled={lifecycleBusy || (restoreNeedsFounder && !isFounder)}
            title={restoreNeedsFounder && !isFounder ? 'Founder permission is required to restore a published story' : undefined}
            onClick={() => runLifecycle({ action: st === 'deleted' ? 'restore' : 'unarchive', id })}
          />
        )}

        {st !== 'deleted' && canDelete && (
          <ActionLink
            label="Delete"
            tone="red"
            disabled={lifecycleBusy}
            onClick={() => {
              const ok = confirm(buildManageNewsDeleteConfirmation(a, groupRows));
              if (!ok) return;
              runLifecycle({ action: 'delete', id });
            }}
          />
        )}

        {st === 'deleted' && isFounder && (
          <ActionLink
            label="Delete forever"
            tone="red"
            disabled={lifecycleBusy}
            onClick={() => {
              const confirmation = window.prompt(`Permanently delete "${a.title}" and all available language versions?\nThis cannot be undone.\nType DELETE to confirm.`);
              if (confirmation === 'DELETE') runLifecycle({ action: 'hardDelete', id });
            }}
          />
        )}
      </div>
    );
  };

  const thBase = 'sticky z-30 bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 border-b border-slate-200';
  const thRight = `${thBase} text-right`;
  const thStyle: React.CSSProperties = { top: effectiveStickyTop };

  const renderAnalyticsCell = (id: string, field: 'views' | 'readers' | 'engaged' | 'avg' | 'completion') => {
    if (!showAnalyticsCols) return null;
    if (analyticsQuery.isLoading) return <span className="text-xs text-slate-500">…</span>;
    if (analyticsQuery.isError) return <span className="text-xs text-slate-500">—</span>;
    const row = analyticsById.get(id);
    if (!row) return <span className="text-xs text-slate-500">—</span>;
    if (field === 'views') return <span className="text-xs font-semibold text-slate-800">{formatNumberCompact(row.views)}</span>;
    if (field === 'readers') return <span className="text-xs text-slate-700">{formatNumberCompact((row.uniqueReaders ?? row.readers) as any)}</span>;
    if (field === 'engaged') return <span className="text-xs text-slate-700">{formatNumberCompact(row.engagedReads)}</span>;
    if (field === 'avg') return <span className="text-xs text-slate-700">{formatDurationShort(row.avgReadTimeSec)}</span>;
    return <span className="text-xs text-slate-700">{formatPercent(row.completionRate)}</span>;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div role="status" className="text-xs text-slate-600">
          {isLoading ? 'Loading stories...' : isFetching ? 'Refreshing stories...' : `Showing ${visibleRows.length} of ${quickFilteredRows.length} loaded`}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={showAnalyticsCols}
              onChange={(e) => setShowAnalyticsCols(e.target.checked)}
            />
            Analytics columns
          </label>
          {showAnalyticsCols ? (
            <select
              value={analyticsRange}
              onChange={(e) => setAnalyticsRange(e.target.value as any)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
              title="Analytics range"
            >
              <option value="24h">24h</option>
              <option value="7d">7d</option>
              <option value="30d">30d</option>
            </select>
          ) : null}
        </div>
        {params.status === 'deleted' && isFounder && selected.length > 0 ? (
          <button
            type="button"
            disabled={lifecycleBusy}
            onClick={() => {
              const ids = [...selected];
              const count = ids.length;
              if (count <= 0) return;
              const confirmation = window.prompt(`Permanently delete ${count} selected stor${count === 1 ? 'y' : 'ies'} and all available language versions?\nThis cannot be undone.\nType DELETE to confirm.`);
              if (confirmation !== 'DELETE') return;
              runLifecycle({ action: 'hardDeleteBulk', ids });
            }}
            className={
              'rounded-md px-3 py-2 text-xs font-semibold '
              + (bulkDeleting ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-red-700 text-white hover:bg-red-800')
            }
          >
            {bulkDeleting ? 'Deleting…' : `Delete Selected Forever (${selected.length})`}
          </button>
        ) : null}
        {role === 'founder' && selected.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
            <span className="text-[11px] font-semibold text-slate-700">Selected articles</span>
            <select
              value={translationBackfillMode}
              onChange={(e) => setTranslationBackfillMode(e.target.value as any)}
              className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
              title="Missing translation target"
            >
              <option value="all">All missing languages</option>
              <option value="hi">Missing Hindi only</option>
              <option value="gu">Missing Gujarati only</option>
              <option value="en">Missing English only</option>
            </select>
            <button
              type="button"
              disabled={bulkTranslating}
              onClick={runMissingTranslationBackfill}
              className={
                'rounded-md px-3 py-1.5 text-xs font-semibold '
                + (bulkTranslating ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800')
              }
            >
              {bulkTranslating ? 'Queueing…' : 'Generate Missing Translations'}
            </button>
          </div>
        ) : null}
      </div>

      {showSkeleton ? (
        <div className="relative isolate rounded-xl border border-slate-200 bg-white">
          <div ref={stickySentinelRef} className="h-0" aria-hidden="true" />
          <div className="overflow-x-auto">
            <table className={showAnalyticsCols ? 'min-w-[1500px] w-full border-separate border-spacing-0' : 'min-w-[1240px] w-full border-separate border-spacing-0'}>
              <thead className="bg-slate-50">
                <tr className="bg-slate-50">
                  <th className={thBase} style={thStyle}>
                    <div className="flex items-center gap-2">
                      <input ref={selectAllRef} type="checkbox" checked={false} readOnly aria-label="Select all visible" />
                      <span>Title</span>
                    </div>
                  </th>
                  <th className={thBase} style={thStyle}>Author</th>
                  <th className={thBase} style={thStyle}>Category</th>
                  <th className={thBase} style={thStyle}>Status</th>
                  <th className={thBase} style={thStyle}>Lang</th>
                  {showAnalyticsCols ? (
                    <>
                      <th className={thBase} style={thStyle}>Views</th>
                      <th className={thBase} style={thStyle}>Readers</th>
                      <th className={thBase} style={thStyle}>Engaged</th>
                      <th className={thBase} style={thStyle}>Avg Read</th>
                      <th className={thBase} style={thStyle}>Completion</th>
                    </>
                  ) : null}
                  <th className={thBase} style={thStyle}>Location</th>
                  <th className={thBase} style={thStyle}>{publishedView ? 'Published' : 'Updated'}</th>
                  <th className={thRight} style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-3 py-3"><div className="h-4 w-56 rounded bg-slate-100" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-24 rounded bg-slate-100" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-16 rounded bg-slate-100" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-10 rounded bg-slate-100" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-10 rounded bg-slate-100" /></td>
                    {showAnalyticsCols ? (
                      <>
                        <td className="px-3 py-3"><div className="h-4 w-16 rounded bg-slate-100" /></td>
                        <td className="px-3 py-3"><div className="h-4 w-16 rounded bg-slate-100" /></td>
                        <td className="px-3 py-3"><div className="h-4 w-16 rounded bg-slate-100" /></td>
                        <td className="px-3 py-3"><div className="h-4 w-16 rounded bg-slate-100" /></td>
                        <td className="px-3 py-3"><div className="h-4 w-16 rounded bg-slate-100" /></td>
                      </>
                    ) : null}
                    <td className="px-3 py-3"><div className="h-4 w-24 rounded bg-slate-100" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-28 rounded bg-slate-100" /></td>
                    <td className="px-3 py-3 text-right"><div className="h-4 w-24 ml-auto rounded bg-slate-100" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : empty ? (
        EmptyState
      ) : (
        <>
          {/* Desktop table-like list */}
          <div className="hidden md:block relative isolate rounded-xl border border-slate-200 bg-white">
            <div ref={stickySentinelRef} className="h-0" aria-hidden="true" />
            <div className="overflow-x-auto">
              <table className={showAnalyticsCols ? 'min-w-[1500px] w-full border-separate border-spacing-0' : 'min-w-[1240px] w-full border-separate border-spacing-0'}>
                <thead className="bg-slate-50">
                  <tr className="bg-slate-50">
                    <th className={thBase} style={thStyle}>
                      <div className="flex items-center gap-2">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelected((cur) => {
                              if (checked) return Array.from(new Set([...cur, ...visibleIds]));
                              return cur.filter((id) => !visibleIds.includes(id));
                            });
                          }}
                          aria-label="Select all visible"
                        />
                        <span>Title</span>
                      </div>
                    </th>
                    <th className={thBase} style={thStyle}>Author</th>
                    <th className={thBase} style={thStyle}>Category</th>
                    <th className={thBase} style={thStyle}>Status</th>
                    <th className={thBase} style={thStyle}>Lang</th>
                    {showAnalyticsCols ? (
                      <>
                        <th className={thBase} style={thStyle}>Views</th>
                        <th className={thBase} style={thStyle}>Readers</th>
                        <th className={thBase} style={thStyle}>Engaged</th>
                        <th className={thBase} style={thStyle}>Avg Read</th>
                        <th className={thBase} style={thStyle}>Completion</th>
                      </>
                    ) : null}
                    <th className={thBase} style={thStyle}>Location</th>
                    <th className={thBase} style={thStyle}>{publishedView ? 'Published' : 'Updated'}</th>
                    <th className={thRight} style={thStyle}>Actions</th>
                  </tr>
                </thead>

                <tbody className="[&>tr:hover]:bg-slate-50">
                  {visibleRows.map((a) => {
                    const isHighlighted = !!highlightId && a._id === highlightId;
                    const st = (a.status ?? 'draft') as ArticleStatus;
                    const isSelected = selected.includes(a._id);
                    const author = getAuthorName(a);
                    const languageInfo = getArticleLanguageInfo(a, rawRows);
                    return (
                      <tr
                        key={a._id}
                        onClick={() => navigate(`/admin/articles/${a._id}/edit`)}
                        className={
                          'border-b border-slate-200 cursor-pointer '
                          + (isHighlighted ? 'bg-amber-50 ' : '')
                        }
                      >
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelected((cur) => {
                                  if (checked) return Array.from(new Set([...cur, a._id]));
                                  return cur.filter((x) => x !== a._id);
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1"
                              aria-label="Select row"
                            />
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-slate-900 whitespace-normal break-words leading-5">{a.title}</div>
                              {author ? (
                                <div className="mt-0.5 text-xs text-slate-500">By {author}</div>
                              ) : null}
                              <div className="mt-1"><RowBadges a={a} /></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top text-xs text-slate-700 whitespace-nowrap">{author || '—'}</td>
                        <td className="px-3 py-3 align-top text-xs text-slate-700">
                          <div className="truncate">{(a as any)?.category || '—'}</div>
                          {getEditorialTypeLabel(a) ? (
                            <div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">{getEditorialTypeLabel(a)}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className={
                            'px-2 py-0.5 rounded text-[11px] text-white '
                            + (st === 'published' ? 'bg-green-600' : st === 'scheduled' ? 'bg-amber-600' : st === 'archived' ? 'bg-slate-600' : st === 'deleted' ? 'bg-red-700' : 'bg-gray-500')
                          }>
                            {st}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          {languageInfo.badge ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[11px] border bg-white text-slate-700">
                              {languageInfo.badge}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-700">—</span>
                          )}
                        </td>
                        {showAnalyticsCols ? (
                          <>
                            <td className="px-3 py-3 align-top">{renderAnalyticsCell(a._id, 'views')}</td>
                            <td className="px-3 py-3 align-top">{renderAnalyticsCell(a._id, 'readers')}</td>
                            <td className="px-3 py-3 align-top">{renderAnalyticsCell(a._id, 'engaged')}</td>
                            <td className="px-3 py-3 align-top">{renderAnalyticsCell(a._id, 'avg')}</td>
                            <td className="px-3 py-3 align-top">{renderAnalyticsCell(a._id, 'completion')}</td>
                          </>
                        ) : null}
                        <td className="px-3 py-3 align-top"><LocationBadge a={a} /></td>
                        <td className="px-3 py-3 align-top text-xs text-slate-700 whitespace-nowrap">{formatArticleDate(a, publishedView)}</td>
                        <td className="px-3 py-3 align-top text-right" onClick={(e) => e.stopPropagation()}>
                          {renderActions(a)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-2">
            {visibleRows.map((a) => {
              const st = (a.status ?? 'draft') as ArticleStatus;
              const languageInfo = getArticleLanguageInfo(a, rawRows);
              return (
                <div key={a._id} className="rounded border bg-white p-3" onClick={() => navigate(`/admin/articles/${a._id}/edit`)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 whitespace-normal break-words leading-5">{a.title}</div>
                      {getAuthorName(a) ? (
                        <div className="mt-0.5 text-xs text-slate-500">By {getAuthorName(a)}</div>
                      ) : null}
                      <div className="mt-1"><RowBadges a={a} /></div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>{renderActions(a)}</div>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-700">
                    <div>
                      <div className="text-[11px] text-slate-500">Category</div>
                      <div className="truncate">{(a as any)?.category || '—'}</div>
                      {getEditorialTypeLabel(a) ? (
                        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">{getEditorialTypeLabel(a)}</div>
                      ) : null}
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Status</div>
                      <span className={
                        'inline-flex px-2 py-0.5 rounded text-[11px] text-white '
                        + (st === 'published' ? 'bg-green-600' : st === 'scheduled' ? 'bg-amber-600' : st === 'archived' ? 'bg-slate-600' : st === 'deleted' ? 'bg-red-700' : 'bg-gray-500')
                      }>
                        {st}
                      </span>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Language</div>
                      <div>
                        {languageInfo.badge ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[11px] border bg-white text-slate-700">
                            {languageInfo.badge}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">{publishedView ? 'Published' : 'Updated'}</div>
                      <div>{formatArticleDate(a, publishedView)}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[11px] text-slate-500">Location</div>
                      <LocationBadge a={a} />
                    </div>

                    {showAnalyticsCols ? (
                      <div className="col-span-2">
                        <div className="text-[11px] text-slate-500">Analytics ({analyticsRange})</div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                          <div><span className="font-semibold">Views:</span> {renderAnalyticsCell(a._id, 'views')}</div>
                          <div><span className="font-semibold">Readers:</span> {renderAnalyticsCell(a._id, 'readers')}</div>
                          <div><span className="font-semibold">Avg:</span> {renderAnalyticsCell(a._id, 'avg')}</div>
                          <div><span className="font-semibold">Comp:</span> {renderAnalyticsCell(a._id, 'completion')}</div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      {!isLoading && <div className="flex items-center justify-between text-sm">
        <div className="text-xs text-slate-600">Page {currentPage} of {logicalPages}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => onPageChange?.(currentPage - 1)}
            className={`px-2 py-1 rounded border text-xs ${currentPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'bg-white hover:bg-slate-50'}`}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={currentPage >= logicalPages}
            onClick={() => onPageChange?.(currentPage + 1)}
            className={`px-2 py-1 rounded border text-xs ${currentPage >= logicalPages ? 'opacity-50 cursor-not-allowed' : 'bg-white hover:bg-slate-50'}`}
          >
            Next
          </button>
        </div>
      </div>}

      <ScheduleDialog
        isOpen={scheduleOpen}
        initialDateTime={(() => {
          if (!scheduleTarget) return undefined;
          const base = (scheduleTarget as any).publishAt || (scheduleTarget as any).scheduledAt || null;
          return base;
        })()}
        onCancel={() => { setScheduleOpen(false); setScheduleTarget(null); }}
        onConfirm={(localValue) => {
          if (!scheduleTarget) return;
          const iso = new Date(localValue).toISOString();
          if (!iso || Number.isNaN(Date.parse(iso))) { toast.error('Invalid date'); return; }
          runLifecycle({ action: 'schedule', id: scheduleTarget._id, at: iso });
          setScheduleOpen(false);
          setScheduleTarget(null);
        }}
      />

      {articlePushTarget ? (() => {
        const built = buildArticlePushPayload(articlePushTarget);
        const previewBody = built.ok ? built.payload.body : (String((articlePushTarget as any)?.summary || '').trim() || ARTICLE_PUSH_FALLBACK_BODY);
        const previewUrl = built.ok ? built.payload.url : '';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={(e) => e.stopPropagation()}>
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <div className="text-lg font-semibold text-slate-950">Send Article Push?</div>
              <div className="mt-2 text-sm text-slate-600">This will notify visitors who enabled article alerts.</div>
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">{ARTICLE_PUSH_SPAM_WARNING}</div>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-950">News Pulse</div>
                <div className="mt-2 whitespace-pre-wrap text-sm font-semibold text-slate-900">{String((articlePushTarget as any)?.title || '')}</div>
                <div className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{previewBody}</div>
                {previewUrl ? (
                  <div className="mt-3 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">URL:</span> {previewUrl}
                  </div>
                ) : null}
              </div>
              {!built.ok ? <div className="mt-3 text-sm font-semibold text-red-700">{built.reason}</div> : null}
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  disabled={articlePushSending}
                  onClick={() => setArticlePushTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={articlePushSending || !built.ok}
                  onClick={confirmArticlePush}
                >
                  {articlePushSending ? 'Sending...' : 'Send Push'}
                </button>
              </div>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}

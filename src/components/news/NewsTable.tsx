import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import type { ManageNewsParams } from '@/types/api';
import type { ArticleStatus } from '@/types/articles';
import {
  listArticles,
  archiveArticle,
  restoreArticle,
  deleteArticle,
  updateArticleStatus,
  scheduleArticle,
  unscheduleArticle,
  hardDeleteArticle,
  bulkHardDeleteArticles,
  type Article,
  type ListResponse,
} from '@/lib/api/articles';
import { normalizeError } from '@/lib/error';
import { useAuth } from '@/context/AuthContext';
import { usePublishFlag } from '@/context/PublishFlagContext';
import { ScheduleDialog } from './ScheduleDialog';
import type { QuickViewCounts, QuickViewKey } from './QuickViewsBar';

function norm(s: any): string {
  return String(s || '').trim().toLowerCase();
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

function isGujaratBreaking(a: Article): boolean {
  return isBreakingStory(a) && isGujaratRegional(a);
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

function formatUpdatedAt(a: Article): string {
  const raw = (a as any)?.updatedAt || (a as any)?.createdAt;
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
  onSelectIds?: (ids: string[]) => void;
  onPageChange?: (page: number) => void;
  highlightId?: string;
  stickyTopOffsetPx?: number;
}

export function NewsTable({ params, search, quickView, onCounts, onSelectIds, onPageChange, highlightId, stickyTopOffsetPx = 0 }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const role = user?.role || 'editor';
  const { publishEnabled } = usePublishFlag();

  const canArchive = role === 'admin' || role === 'founder' || role === 'editor';
  const canDelete = role === 'admin' || role === 'founder';

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
      sort: params.sort,
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
  ]);

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: [
      'articles',
      fetchParams.page ?? 1,
      fetchParams.limit ?? 20,
      fetchParams.sort ?? '-updatedAt',
      fetchParams.status ?? 'all',
      fetchParams.category ?? '',
      fetchParams.language ?? '',
      fetchParams.from ?? '',
      fetchParams.to ?? '',
      fetchParams.q ?? '',
    ],
    queryFn: () => listArticles(fetchParams),
  });

  const rawRows: Article[] = (data as any)?.rows ?? (data as any)?.data ?? [];
  const total: number = (data as any)?.total ?? rawRows.length;
  const page = (data as any)?.page || 1;
  const pages = (data as any)?.pages || 1;

  // Mutations
  const mutateArchive = useMutation({
    mutationFn: archiveArticle,
    onSuccess: () => toast.success('Archived'),
    onError: (err: any) => toast.error(normalizeError(err, 'Archive failed').message),
    onSettled: () => qc.invalidateQueries({ queryKey: ['articles'] }),
  });
  const mutateRestore = useMutation({
    mutationFn: restoreArticle,
    onSuccess: () => toast.success('Restored'),
    onError: (err: any) => toast.error(normalizeError(err, 'Restore failed').message),
    onSettled: () => qc.invalidateQueries({ queryKey: ['articles'] }),
  });
  const mutateDelete = useMutation({
    mutationFn: deleteArticle,
    onSuccess: () => toast.success('Deleted'),
    onError: (err: any) => toast.error(normalizeError(err, 'Delete failed').message),
    onSettled: () => qc.invalidateQueries({ queryKey: ['articles'] }),
  });
  const mutatePublish = useMutation({
    mutationFn: (id: string) => updateArticleStatus(id, 'published'),
    onSuccess: () => toast.success('Published'),
    onError: (err: any) => toast.error(normalizeError(err, 'Publish failed').message),
    onSettled: () => qc.invalidateQueries({ queryKey: ['articles'] }),
  });
  const mutateUnpublish = useMutation({
    mutationFn: (id: string) => updateArticleStatus(id, 'draft'),
    onSuccess: () => toast.success('Unpublished'),
    onError: (err: any) => toast.error(normalizeError(err, 'Unpublish failed').message),
    onSettled: () => qc.invalidateQueries({ queryKey: ['articles'] }),
  });
  const mutateUnschedule = useMutation({
    mutationFn: (id: string) => unscheduleArticle(id),
    onSuccess: () => toast.success('Unscheduled'),
    onError: (err: any) => toast.error(normalizeError(err, 'Unschedule failed').message),
    onSettled: () => qc.invalidateQueries({ queryKey: ['articles'] }),
  });
  const mutateDeleteHard = useMutation({
    mutationFn: (id: string) => hardDeleteArticle(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['articles'] });

      const prev = qc.getQueriesData<ListResponse>({ queryKey: ['articles'] });

      qc.setQueriesData({ queryKey: ['articles'] }, (old: any) => {
        if (!old) return old;
        const rows: any[] | null = Array.isArray(old?.rows)
          ? old.rows
          : (Array.isArray(old?.data) ? old.data : null);
        if (!rows) return old;

        const nextRows = rows.filter((a) => (a as any)?._id !== id);
        const removed = rows.length - nextRows.length;
        if (removed <= 0) return old;

        const next: any = { ...old };
        if (Array.isArray(old?.rows)) next.rows = nextRows;
        if (Array.isArray(old?.data)) next.data = nextRows;
        if (typeof old?.total === 'number') next.total = Math.max(0, old.total - removed);
        return next;
      });

      setSelected((cur) => cur.filter((x) => x !== id));
      return { prev };
    },
    onSuccess: () => toast.success('Deleted forever'),
    onError: (err: any, _id, ctx) => {
      if (ctx?.prev) {
        for (const [key, data] of ctx.prev as any[]) {
          qc.setQueryData(key, data);
        }
      }
      toast.error(normalizeError(err, 'Hard delete failed').message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['articles'] }),
  });

  const [bulkDeleting, setBulkDeleting] = React.useState(false);
  const mutateDeleteHardBulk = useMutation({
    mutationFn: (ids: string[]) => bulkHardDeleteArticles(ids),
    onMutate: async (ids: string[]) => {
      setBulkDeleting(true);
      // ensure we don't race with an inflight refetch
      await qc.cancelQueries({ queryKey: ['articles'] });
      return { ids };
    },
    onSuccess: (_data, ids: string[]) => {
      const idSet = new Set(ids);
      qc.setQueriesData({ queryKey: ['articles'] }, (old: any) => {
        if (!old) return old;
        const rows: any[] | null = Array.isArray(old?.rows)
          ? old.rows
          : (Array.isArray(old?.data) ? old.data : null);
        if (!rows) return old;

        const nextRows = rows.filter((a) => !idSet.has(String((a as any)?._id || '')));
        const removed = rows.length - nextRows.length;
        if (removed <= 0) return old;

        const next: any = { ...old };
        if (Array.isArray(old?.rows)) next.rows = nextRows;
        if (Array.isArray(old?.data)) next.data = nextRows;
        if (typeof old?.total === 'number') next.total = Math.max(0, old.total - removed);
        return next;
      });

      setSelected([]);
      toast.success(`Deleted forever (${ids.length})`);
    },
    onError: (err: any) => {
      toast.error(normalizeError(err, 'Bulk hard delete failed').message);
    },
    onSettled: () => {
      setBulkDeleting(false);
      qc.invalidateQueries({ queryKey: ['articles'] });
    },
  });

  // Schedule dialog
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [scheduleTarget, setScheduleTarget] = React.useState<Article | null>(null);
  const mutateSchedule = useMutation({
    mutationFn: ({ id, at }: { id: string; at: string }) => scheduleArticle(id, at),
    onSuccess: (_data, vars) => toast.success(`Scheduled for local time ${new Date(vars.at).toLocaleString()}`),
    onError: (err: any) => toast.error(normalizeError(err, 'Schedule failed').message),
    onSettled: () => qc.invalidateQueries({ queryKey: ['articles'] }),
  });

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

  const searchedRows = React.useMemo(() => {
    if (!searchKey) return baseRows;
    return baseRows.filter((a) => {
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
    });
  }, [baseRows, searchKey]);

  const counts = React.useMemo<QuickViewCounts>(() => {
    const all = searchedRows.length;
    const published = searchedRows.filter((a) => (a.status ?? 'draft') === 'published').length;
    const draft = searchedRows.filter((a) => (a.status ?? 'draft') === 'draft').length;
    const scheduled = searchedRows.filter((a) => (a.status ?? 'draft') === 'scheduled').length;
    const breaking = searchedRows.filter(isBreakingStory).length;
    const gujaratBreaking = searchedRows.filter(isGujaratBreaking).length;
    const regional = searchedRows.filter(isGujaratRegional).length;
    const pti = searchedRows.filter(needsPtiReview).length;
    const flagged = searchedRows.filter(isFlagged).length;
    return {
      all,
      published,
      draft,
      scheduled,
      breaking,
      'gujarat-breaking': gujaratBreaking,
      regional,
      pti,
      flagged,
    };
  }, [searchedRows]);

  // Avoid maximum update depth errors when parent passes a non-memoized callback.
  const onCountsRef = React.useRef(onCounts);
  React.useEffect(() => { onCountsRef.current = onCounts; }, [onCounts]);
  const lastCountsKeyRef = React.useRef<string>('');
  React.useEffect(() => {
    const key = JSON.stringify(counts);
    if (key === lastCountsKeyRef.current) return;
    lastCountsKeyRef.current = key;
    onCountsRef.current(counts);
  }, [counts]);

  const quickFilteredRows = React.useMemo(() => {
    switch (quickView) {
      case 'published':
        return searchedRows.filter((a) => (a.status ?? 'draft') === 'published');
      case 'draft':
        return searchedRows.filter((a) => (a.status ?? 'draft') === 'draft');
      case 'scheduled':
        return searchedRows.filter((a) => (a.status ?? 'draft') === 'scheduled');
      case 'breaking':
        return searchedRows.filter(isBreakingStory);
      case 'gujarat-breaking':
        return searchedRows.filter(isGujaratBreaking);
      case 'regional':
        return searchedRows.filter(isGujaratRegional);
      case 'pti':
        return searchedRows.filter(needsPtiReview);
      case 'flagged':
        return searchedRows.filter(isFlagged);
      case 'all':
      default:
        return searchedRows;
    }
  }, [searchedRows, quickView]);

  const sortedRows = React.useMemo(() => {
    // Lock default sorting: newest-first by updatedAt, falling back to createdAt / publishedAt.
    const getSortTs = (a: Article): number => {
      const raw = (a as any)?.updatedAt
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
  }, [quickFilteredRows]);

  const visibleIds = React.useMemo(() => sortedRows.map((a) => a._id), [sortedRows]);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const someVisibleSelected = visibleIds.some((id) => selected.includes(id));
  const selectAllRef = React.useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
  }, [allVisibleSelected, someVisibleSelected]);

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

  const showSkeleton = isLoading;

  if (error) {
    const status = (error as any)?.response?.status;
    if (status === 401) {
      return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
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
              onClick={() => window.location.reload()}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    const n = normalizeError(error, 'Error loading articles');
    return <div className="text-red-600">{n.message}</div>;
  }

  const empty = !showSkeleton && sortedRows.length === 0;

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
    const catKey = norm((a as any)?.category);
    if (catKey === 'national') {
      const nl: any = (a as any)?.nationalLocation || (a as any)?.national_location || null;
      const scope = String(nl?.scope || '').trim().toUpperCase();

      const titleize = (s: string) => String(s || '')
        .trim()
        .replace(/[_-]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');

      const label = (() => {
        if (scope === 'STATE_UT') {
          const name = String(nl?.stateUtName || nl?.state_ut_name || '').trim();
          if (name) return name;
          const slug = String(nl?.stateUtSlug || nl?.state_ut_slug || '').trim();
          return slug ? titleize(slug) : '';
        }
        if (scope === 'ALL_INDIA' || !scope) return 'All India';
        return '';
      })();

      if (!label) return <span className="text-slate-500 text-xs">—</span>;
      return (
        <span className="inline-flex px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[11px] border">
          {label}
        </span>
      );
    }

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

    return (
      <div className="flex items-center justify-end gap-3 flex-nowrap whitespace-nowrap">
        <ActionLink
          label="Edit"
          tone="blue"
          onClick={() => navigate(`/admin/articles/${id}/edit`)}
        />

        {st === 'draft' && (
          <>
            <ActionLink
              label="Publish"
              title={publishEnabled ? 'Publish' : 'Publish (disabled)'}
              tone="green"
              disabled={!publishEnabled}
              onClick={() => {
                if (!publishEnabled) return;
                mutatePublish.mutate(id);
              }}
            />
            <ActionLink
              label="Schedule"
              title={publishEnabled ? 'Schedule…' : 'Schedule (disabled)'}
              tone="amber"
              disabled={!publishEnabled}
              onClick={() => {
                if (!publishEnabled) return;
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
            onClick={() => mutateUnschedule.mutate(id)}
          />
        )}

        {st === 'published' && (
          <ActionLink
            label="Unpublish"
            tone="slate"
            onClick={() => mutateUnpublish.mutate(id)}
          />
        )}

        {st !== 'archived' && canArchive && (
          <ActionLink
            label="Archive"
            tone="slate"
            onClick={() => mutateArchive.mutate(id)}
          />
        )}

        {(st === 'archived' || st === 'deleted') && canArchive && (
          <ActionLink
            label="Restore"
            tone="blue"
            onClick={() => mutateRestore.mutate(id)}
          />
        )}

        {st !== 'deleted' && canDelete && (
          <ActionLink
            label="Delete"
            tone="red"
            onClick={() => mutateDelete.mutate(id)}
          />
        )}

        {st === 'deleted' && canDelete && (
          <ActionLink
            label="Delete forever"
            tone="red"
            onClick={() => {
              const ok = confirm('Delete forever? This will permanently delete this article and cannot be undone.');
              if (ok) mutateDeleteHard.mutate(id);
            }}
          />
        )}
      </div>
    );
  };

  const thBase = 'sticky z-30 bg-slate-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 border-b border-slate-200';
  const thRight = `${thBase} text-right`;
  const thStyle: React.CSSProperties = { top: effectiveStickyTop };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-slate-600">Showing {sortedRows.length} of {total} loaded</div>
        {(params.status === 'deleted' || (params.status as any) === 'trash') && canDelete && selected.length > 0 ? (
          <button
            type="button"
            disabled={bulkDeleting}
            onClick={() => {
              const ids = [...selected];
              const count = ids.length;
              if (count <= 0) return;
              const ok = confirm(`Delete ${count} article${count === 1 ? '' : 's'} forever? This cannot be undone.`);
              if (!ok) return;
              mutateDeleteHardBulk.mutate(ids);
            }}
            className={
              'rounded-md px-3 py-2 text-xs font-semibold '
              + (bulkDeleting ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-red-700 text-white hover:bg-red-800')
            }
          >
            {bulkDeleting ? 'Deleting…' : `Delete Selected Forever (${selected.length})`}
          </button>
        ) : null}
      </div>

      {showSkeleton ? (
        <div className="relative isolate rounded-xl border border-slate-200 bg-white">
          <div ref={stickySentinelRef} className="h-0" aria-hidden="true" />
          <div className="overflow-x-auto">
            <table className="min-w-[1240px] w-full border-separate border-spacing-0">
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
                  <th className={thBase} style={thStyle}>Location</th>
                  <th className={thBase} style={thStyle}>Updated</th>
                  <th className={thRight} style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-3 py-3"><div className="h-4 w-56 rounded bg-slate-100" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-24 rounded bg-slate-100" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-24 rounded bg-slate-100" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-16 rounded bg-slate-100" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-10 rounded bg-slate-100" /></td>
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
              <table className="min-w-[1240px] w-full border-separate border-spacing-0">
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
                    <th className={thBase} style={thStyle}>Location</th>
                    <th className={thBase} style={thStyle}>Updated</th>
                    <th className={thRight} style={thStyle}>Actions</th>
                  </tr>
                </thead>

                <tbody className="[&>tr:hover]:bg-slate-50">
                  {sortedRows.map((a) => {
                    const isHighlighted = !!highlightId && a._id === highlightId;
                    const st = (a.status ?? 'draft') as ArticleStatus;
                    const isSelected = selected.includes(a._id);
                    const author = getAuthorName(a);
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
                        <td className="px-3 py-3 align-top text-xs text-slate-700 truncate">{(a as any)?.category || '—'}</td>
                        <td className="px-3 py-3 align-top">
                          <span className={
                            'px-2 py-0.5 rounded text-[11px] text-white '
                            + (st === 'published' ? 'bg-green-600' : st === 'scheduled' ? 'bg-amber-600' : st === 'archived' ? 'bg-slate-600' : st === 'deleted' ? 'bg-red-700' : 'bg-gray-500')
                          }>
                            {st}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top">
                          {formatLangTag((a as any)?.lang ?? a.language) ? (
                            <span className="inline-flex px-2 py-0.5 rounded text-[11px] border bg-white text-slate-700">
                              {formatLangTag((a as any)?.lang ?? a.language)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-700">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top"><LocationBadge a={a} /></td>
                        <td className="px-3 py-3 align-top text-xs text-slate-700 whitespace-nowrap">{formatUpdatedAt(a)}</td>
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
            {sortedRows.map((a) => {
              const st = (a.status ?? 'draft') as ArticleStatus;
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
                        {formatLangTag((a as any)?.lang ?? a.language) ? (
                          <span className="inline-flex px-2 py-0.5 rounded text-[11px] border bg-white text-slate-700">
                            {formatLangTag((a as any)?.lang ?? a.language)}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-500">Updated</div>
                      <div>{formatUpdatedAt(a)}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-[11px] text-slate-500">Location</div>
                      <LocationBadge a={a} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <div className="text-xs text-slate-600">Page {page} of {pages}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange?.(page - 1)}
            className={`px-2 py-1 rounded border text-xs ${page <= 1 ? 'opacity-50 cursor-not-allowed' : 'bg-white hover:bg-slate-50'}`}
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => onPageChange?.(page + 1)}
            className={`px-2 py-1 rounded border text-xs ${page >= pages ? 'opacity-50 cursor-not-allowed' : 'bg-white hover:bg-slate-50'}`}
          >
            Next
          </button>
        </div>
      </div>

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
          mutateSchedule.mutate({ id: scheduleTarget._id, at: iso });
          setScheduleOpen(false);
          setScheduleTarget(null);
        }}
      />
    </div>
  );
}

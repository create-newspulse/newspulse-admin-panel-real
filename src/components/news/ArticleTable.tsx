import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listArticles,
  archiveArticle,
  restoreArticle,
  deleteArticle,
  updateArticleStatus,
  scheduleArticle,
  unscheduleArticle,
  hardDeleteArticle,
  type Article,
  type ListResponse,
} from '@/lib/api/articles';
import toast from 'react-hot-toast';
import { normalizeError } from '@/lib/error';
import { useAuth } from '@/context/AuthContext';
import type { ArticleStatus } from '@/types/articles';
import { ScheduleDialog } from './ScheduleDialog';
import { usePublishFlag } from '@/context/PublishFlagContext';

import type { ManageNewsParams } from '@/types/api';
interface Props {
  params: ManageNewsParams;
  onSelectIds?: (ids: string[]) => void;
  onPageChange?: (page: number) => void;
  highlightId?: string;
}

export const ArticleTable: React.FC<Props> = ({ params, onSelectIds, onPageChange, highlightId }) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const role = user?.role || 'editor';
  // Call all hooks unconditionally at the top (before any early returns)
  const { publishEnabled } = usePublishFlag();
  const canArchive = role === 'admin' || role === 'founder' || role === 'editor';
  const canDelete = role === 'admin' || role === 'founder';
  const { data, isLoading, error } = useQuery<ListResponse>({ queryKey: ['articles', params], queryFn: () => listArticles(params) });
  // Optimistic mutations
  const mutateArchive = useMutation({
    mutationFn: archiveArticle,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['articles'] });
      const prev = qc.getQueryData<ListResponse>(['articles', params]);
      if (prev?.rows) {
        qc.setQueryData(['articles', params], {
          ...prev,
          rows: prev.rows.map((a: Article)=> a._id===id? { ...a, status:'archived' }: a)
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => { if (ctx?.prev) qc.setQueryData(['articles', params], ctx.prev); toast.error('Archive failed'); },
    onSuccess: () => { toast.success('Archived'); },
    onSettled: () => { qc.invalidateQueries({ queryKey:['articles']}); }
  });
  const mutateRestore = useMutation({
    mutationFn: restoreArticle,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['articles'] });
      const prev = qc.getQueryData<ListResponse>(['articles', params]);
      if (prev?.rows) {
        qc.setQueryData(['articles', params], {
          ...prev,
          rows: prev.rows.map((a: Article)=> a._id===id? { ...a, status:'draft' }: a)
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => { if (ctx?.prev) qc.setQueryData(['articles', params], ctx.prev); toast.error('Restore failed'); },
    onSuccess: () => { toast.success('Restored'); },
    onSettled: () => { qc.invalidateQueries({ queryKey:['articles']}); }
  });
  const mutateDelete = useMutation({
    mutationFn: deleteArticle,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['articles'] });
      const prev = qc.getQueryData<ListResponse>(['articles', params]);
      if (prev?.rows) {
        // In All view, drop the row immediately; otherwise mark as deleted
        const inAllView = (params.status ?? 'all') === 'all';
        qc.setQueryData(['articles', params], {
          ...prev,
          rows: inAllView
            ? prev.rows.filter((a: Article) => a._id !== id)
            : prev.rows.map((a: Article)=> a._id===id? { ...a, status:'deleted' }: a),
          total: Math.max(0, (prev.total || 1) - (inAllView ? 1 : 0)),
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => { if (ctx?.prev) qc.setQueryData(['articles', params], ctx.prev); toast.error('Delete failed'); },
    onSuccess: () => { toast.success('Deleted'); },
    onSettled: () => { qc.invalidateQueries({ queryKey:['articles']}); }
  });
  const [selected, setSelected] = React.useState<string[]>([]);
  
  // Actions helper
  type ArticleAction =
    | 'edit'
    | 'publishNow'
    | 'schedule'
    | 'unschedule'
    | 'unpublish'
    | 'archive'
    | 'restore'
    | 'deleteSoft'
    | 'deleteHard';

  function getAvailableActions(status: ArticleStatus): ArticleAction[] {
    switch (status) {
      case 'draft':
        return ['edit', 'publishNow', 'schedule', 'archive', 'deleteSoft'];
      case 'scheduled':
        return ['edit', 'unschedule', 'archive', 'deleteSoft'];
      case 'published':
        return ['edit', 'unpublish', 'archive', 'deleteSoft'];
      case 'archived':
        return ['edit', 'restore', 'deleteSoft'];
      case 'deleted':
        return ['restore', 'deleteHard'];
      default:
        return ['edit'];
    }
  }

  // Mutations for status transitions
  const mutatePublish = useMutation({
    mutationFn: (id: string) => updateArticleStatus(id, 'published'),
    onSuccess: () => { toast.success('Published'); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['articles'] }); }
  });
  const mutateUnpublish = useMutation({
    mutationFn: (id: string) => updateArticleStatus(id, 'draft'),
    onSuccess: () => { toast.success('Unpublished'); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['articles'] }); }
  });
  const mutateSchedule = useMutation({
    mutationFn: ({ id, at }: { id: string; at: string }) => scheduleArticle(id, at),
    onSuccess: (_data, vars) => { toast.success(`Scheduled for local time ${new Date(vars.at).toLocaleString()}`); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['articles'] }); }
  });
  const mutateUnschedule = useMutation({
    mutationFn: (id: string) => unscheduleArticle(id),
    onSuccess: () => { toast.success('Unscheduled'); },
    onSettled: () => { qc.invalidateQueries({ queryKey: ['articles'] }); }
  });
  const [hardDeletingId, setHardDeletingId] = React.useState<string | null>(null);
  const mutateDeleteHard = useMutation({
    mutationFn: (id: string) => hardDeleteArticle(id),
    onMutate: async (id: string) => {
      setHardDeletingId(id);
      // Optimistic removal from current page
      await qc.cancelQueries({ queryKey: ['articles'] });
      const prev = qc.getQueryData<ListResponse>(['articles', params]);
      if (prev?.data) {
        qc.setQueryData(['articles', params], {
          ...prev,
          data: prev.data.filter((a: Article) => a._id !== id),
          total: Math.max(0, (prev.total || 1) - 1),
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['articles', params], ctx.prev);
      toast.error('Hard delete failed');
    },
    onSuccess: () => { toast.success('Deleted forever'); },
    onSettled: () => { setHardDeletingId(null); qc.invalidateQueries({ queryKey: ['articles'] }); }
  });
  // Scheduling dialog state
  const [scheduleOpen, setScheduleOpen] = React.useState(false);
  const [scheduleTarget, setScheduleTarget] = React.useState<Article | null>(null);

  // derive table rows and total from the query result (safe during loading)
  const rawRows: Article[] = (data as any)?.rows ?? (data as any)?.data ?? [];
  const total: number = (data as any)?.total ?? rawRows.length;

  const isSeededSample = React.useCallback((a: Article) => {
    const title = String(a?.title || '').toLowerCase();
    const authorName = String(a?.author?.name || '').toLowerCase();
    const tags = Array.isArray((a as any)?.tags)
      ? ((a as any).tags as any[]).map((t) => String(t || '').toLowerCase())
      : [];

    // Backend seed artifacts we never want to show in the admin list.
    if (authorName === 'seeder') return true;
    if (title.startsWith('sample article')) return true;
    if (tags.includes('demo') && tags.includes('seed')) return true;
    return false;
  }, []);

  // UX requirement: Deleted items must NOT appear in the "All" tab.
  // They should only appear when status === 'deleted'.
  const rows: Article[] = React.useMemo(() => {
    const view = (params.status ?? 'all') as any;
    const cleaned = rawRows.filter((r) => !isSeededSample(r));
    if (view === 'all') return cleaned.filter((r) => (r.status ?? 'draft') !== 'deleted');
    return cleaned;
  }, [rawRows, params.status, isSeededSample]);

  const [didScrollHighlight, setDidScrollHighlight] = React.useState(false);
  React.useEffect(() => {
    // allow new highlight ids to re-trigger scroll
    setDidScrollHighlight(false);
  }, [highlightId]);

  React.useEffect(() => {
    if (!highlightId) return;
    if (didScrollHighlight) return;
    const existsOnPage = (rows as Article[]).some((r) => r._id === highlightId);
    if (!existsOnPage) return;
    // small delay so table renders
    window.setTimeout(() => {
      const el = document.getElementById(`article-row-${highlightId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
    setDidScrollHighlight(true);
  }, [didScrollHighlight, highlightId, rows]);

  React.useEffect(()=>{ onSelectIds?.(selected); },[selected]);
  if (isLoading) return <div className="animate-pulse text-slate-500">Loading articles…</div>;
  if (error) {
    const n = normalizeError(error, 'Error loading articles');
    return <div className="text-red-600">{n.message}</div>;
  }

  const page = data?.page || 1;
  const pages = data?.pages || 1;
  const canPrev = page > 1;
  const canNext = page < pages;
  return (
    <>
    <table className="w-full text-sm border">
      <thead className="sticky top-0 bg-slate-100">
        <tr className="text-left">
          <th className="p-2"><input type="checkbox" onChange={e=> setSelected(e.target.checked? rows.map((r:Article)=> r._id): [])} /></th>
          <th className="p-2">Title</th>
          <th className="p-2">Status</th>
          <th className="p-2">Author</th>
          <th className="p-2">PTI</th>
          <th className="p-2">Trust</th>
          <th className="p-2">Created</th>
          <th className="p-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r: Article)=> {
          const statusColors: Record<'draft'|'scheduled'|'published'|'archived'|'deleted', string> = {
            draft: 'bg-gray-500', scheduled: 'bg-amber-600', published: 'bg-green-600', archived: 'bg-slate-600', deleted: 'bg-red-700'
          };
          const st = (r.status ?? 'draft') as ArticleStatus;
          const badge = statusColors[st] || 'bg-gray-500';

          const ptiColors: Record<'compliant'|'pending'|'rejected', string> = { compliant: 'bg-green-600', pending: 'bg-amber-600', rejected: 'bg-red-600' };
          const pti = (r.ptiCompliance ?? 'pending') as 'compliant'|'pending'|'rejected';
          const ptiBadge = ptiColors[pti];

          const isHighlighted = !!highlightId && r._id === highlightId;
          return (
            <tr
              key={r._id}
              id={`article-row-${r._id}`}
              className={`border-t hover:bg-slate-50 ${isHighlighted ? 'bg-amber-50' : ''}`}
            >
              <td className="p-2"><input type="checkbox" checked={selected.includes(r._id)} onChange={()=> setSelected(s=> s.includes(r._id)? s.filter(x=>x!==r._id): [...s, r._id])} /></td>
              <td className="p-2">
                <div className="font-medium flex items-center gap-2">
                  <span>{r.title}</span>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px]">{r.language?.toUpperCase()}</span>
                  <span className="px-1 py-0.5 rounded bg-sky-700 text-white text-[10px]">{r.category}</span>
                </div>
              </td>
              <td className="p-2"><span className={`px-2 py-0.5 rounded text-white ${badge}`}>{st}</span></td>
              <td className="p-2">{r.author?.name || '—'}</td>
              <td className="p-2"><span className={`px-2 py-0.5 rounded text-white ${ptiBadge}`}>{r.ptiCompliance}</span></td>
              <td className="p-2">{r.trustScore ?? 0}</td>
              <td className="p-2">{(() => { const t = r.createdAt && !Number.isNaN(Date.parse(r.createdAt)) ? new Date(r.createdAt).toLocaleString() : '—'; return t; })()}</td>
              <td className="p-2 space-x-2">
                {getAvailableActions((r.status || 'draft') as ArticleStatus).includes('edit') && (
                  <button onClick={()=> navigate(`/admin/articles/${r._id}/edit`)} className="text-blue-600 hover:underline">Edit</button>
                )}
                {getAvailableActions(r.status as ArticleStatus).includes('publishNow') && (
                  publishEnabled ? (
                    <button onClick={()=> mutatePublish.mutate(r._id)} className="text-green-700 hover:underline">Publish</button>
                  ) : (
                    <span className="text-slate-400 cursor-not-allowed">Publish (disabled)</span>
                  )
                )}
                {getAvailableActions(r.status as ArticleStatus).includes('schedule') && (
                  publishEnabled ? (
                    <button
                      onClick={()=> {
                        setScheduleTarget(r);
                        setScheduleOpen(true);
                      }}
                      className="text-amber-700 hover:underline"
                    >Schedule</button>
                  ) : (
                    <span className="text-slate-400 cursor-not-allowed">Schedule (disabled)</span>
                  )
                )}
                {getAvailableActions(r.status as ArticleStatus).includes('unschedule') && (
                  <button onClick={()=> mutateUnschedule.mutate(r._id)} className="text-amber-700 hover:underline">Unschedule</button>
                )}
                {getAvailableActions(r.status as ArticleStatus).includes('unpublish') && (
                  <button onClick={()=> mutateUnpublish.mutate(r._id)} className="text-slate-700 hover:underline">Unpublish</button>
                )}
                {getAvailableActions(r.status as ArticleStatus).includes('archive') && canArchive && (
                  <button onClick={()=> mutateArchive.mutate(r._id)} className="text-slate-600 hover:underline">Archive</button>
                )}
                {getAvailableActions(r.status as ArticleStatus).includes('restore') && (
                  <button onClick={()=> mutateRestore.mutate(r._id)} className="text-green-600 hover:underline">Restore</button>
                )}
                {getAvailableActions(r.status as ArticleStatus).includes('deleteSoft') && canDelete && (
                  <button onClick={()=> mutateDelete.mutate(r._id)} className="text-red-600 hover:underline">Delete</button>
                )}
                {getAvailableActions(r.status as ArticleStatus).includes('deleteHard') && canDelete && (
                  <button
                    disabled={hardDeletingId === r._id}
                    onClick={()=> {
                      const ok = confirm('Are you sure? This will permanently delete this article. This action cannot be undone.');
                      if (ok) mutateDeleteHard.mutate(r._id);
                    }}
                    className={`hover:underline ${hardDeletingId === r._id ? 'text-slate-400 cursor-not-allowed' : 'text-red-700'}`}
                  >{hardDeletingId === r._id ? 'Deleting…' : 'Delete forever'}</button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
  </table>
    <div className="flex items-center justify-between mt-3 text-sm">
      <div>Showing page {page} of {pages} • {total} total</div>
      <div className="flex items-center gap-2">
  <button disabled={!canPrev} onClick={()=> onPageChange?.(page - 1)} className={`px-2 py-1 rounded border ${canPrev? '':'opacity-50'}`}>Prev</button>
  <button disabled={!canNext} onClick={()=> onPageChange?.(page + 1)} className={`px-2 py-1 rounded border ${canNext? '':'opacity-50'}`}>Next</button>
      </div>
      {selected.length>0 && (
        <div className="flex items-center gap-2">
          {canArchive && <button onClick={()=> { if (confirm(`Archive ${selected.length} items?`)) selected.forEach(id=> mutateArchive.mutate(id)); }} className="px-2 py-1 rounded border">Archive</button>}
          {canArchive && <button onClick={()=> { if (confirm(`Restore ${selected.length} items?`)) selected.forEach(id=> mutateRestore.mutate(id)); }} className="px-2 py-1 rounded border">Restore</button>}
          {canDelete && <button onClick={()=> { if (confirm(`Delete ${selected.length} items?`)) selected.forEach(id=> { mutateDelete.mutate(id); toast((t)=> (<span>Deleted. <button className='underline' onClick={()=> { mutateRestore.mutate(id); toast.dismiss(t.id); }}>Undo</button></span>), { duration: 4000 }); }); }} className="px-2 py-1 rounded border text-red-600">Delete</button>}
        </div>
      )}
    </div>
    {/* Schedule Dialog */}
    <ScheduleDialog
      isOpen={scheduleOpen}
      initialDateTime={(() => {
        if (!scheduleTarget) return undefined;
        const base = scheduleTarget.publishAt || scheduleTarget.scheduledAt || null;
        return base;
      })()}
      onCancel={() => { setScheduleOpen(false); setScheduleTarget(null); }}
      onConfirm={(localValue) => {
        if (!scheduleTarget) return;
        // localValue format: YYYY-MM-DDTHH:mm (local). new Date parses as local time.
        const iso = new Date(localValue).toISOString();
        if (!iso || Number.isNaN(Date.parse(iso))) { toast.error('Invalid date'); return; }
        mutateSchedule.mutate({ id: scheduleTarget._id, at: iso });
        setScheduleOpen(false);
        setScheduleTarget(null);
      }}
    />
    </>
  );
};

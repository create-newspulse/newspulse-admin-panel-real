import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { listMyStories, withdrawStory, deleteMyStory } from '@/lib/api/communityStories';
import type { CommunityStory } from '@/types/community';
import type { ArticleStatus } from '@/types/articles';
import StoryStatusPill, { mapStoryStatus, type CommunityStoryStatus } from '@/components/community/StoryStatusPill';

function StatusBadge({ status }: { status: string | ArticleStatus }) {
  const mapped = mapStoryStatus(String(status || ''));
  return <StoryStatusPill status={mapped} />;
}

function snippet(txt?: string, n = 140) {
  if (!txt) return '';
  const clean = String(txt).replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
}

export default function MyCommunityStories() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<CommunityStory | null>(null);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState<CommunityStoryStatus | 'all'>('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-community-stories', status, q],
    queryFn: () => listMyStories({ status: status === 'all' ? 'all' : undefined, q, page: 1, limit: 100 }),
    staleTime: 30_000,
  });

  const items: CommunityStory[] = (data?.items || []).slice();

  // Hide stories deleted by the reporter immediately from the list
  const visible = useMemo(() => {
    let arr = items.filter((s) => {
      const raw = String(s.status || '').toLowerCase();
      const isDeletedByReporter = raw === 'deleted' || (s as any).deletedByReporter === true;
      return !isDeletedByReporter;
    });
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      arr = arr.filter((s) => (s.title || '').toLowerCase().includes(qq));
    }
    if (status !== 'all') {
      arr = arr.filter((s) => mapStoryStatus(String(s.status)) === status);
    }
    return arr;
  }, [items, q, status]);

  const withdrawMut = useMutation({
    mutationFn: async (id: string) => withdrawStory(id),
    onSuccess: async () => {
      toast.success('Story withdrawn');
      await qc.invalidateQueries({ queryKey: ['my-community-stories'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to withdraw');
    }
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => deleteMyStory(id),
    onSuccess: async (_data, variables) => {
      toast.success('Story deleted');
      // Optimistically remove the story from cached lists so it disappears immediately
      const removeFromCache = (key: any[]) => {
        qc.setQueryData(key, (prev: any) => {
          if (!prev) return prev;
          if (Array.isArray(prev)) {
            return prev.filter((s: any) => s?._id !== variables);
          }
          if (prev?.items && Array.isArray(prev.items)) {
            return { ...prev, items: prev.items.filter((s: any) => s?._id !== variables) };
          }
          return prev;
        });
      };
      removeFromCache(['my-community-stories']);
      removeFromCache(['my-community-stories', status, q]);
      await qc.invalidateQueries({ queryKey: ['my-community-stories'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to delete');
    }
  });

  useEffect(() => { refetch(); }, [status, refetch]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">My Community Stories</h1>
          <p className="text-sm text-slate-600">View and manage stories you've submitted to News Pulse.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={()=> navigate('/community/submit')}>+ New Story</button>
          <button className="btn-secondary" onClick={()=> qc.invalidateQueries({ queryKey: ['my-community-stories'] })}>Refresh</button>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm">Status</label>
            <select value={status} onChange={e=> setStatus(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="published">Published</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm">Search</label>
            <input value={q} onChange={e=> setQ(e.target.value)} placeholder="Title contains…" className="border rounded px-2 py-1 text-sm w-full" />
          </div>
        </div>
      </div>

      {isLoading && <div>Loading…</div>}

      <table className="w-full text-sm border">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-2 text-left">Title</th>
            <th className="p-2 text-left">Summary</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Language</th>
            <th className="p-2 text-left">Category</th>
            <th className="p-2 text-left">City</th>
            <th className="p-2 text-left">Created</th>
            <th className="p-2 text-left">Last updated</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((s)=> (
            <tr key={s._id} className="border-t hover:bg-slate-50">
              <td className="p-2 max-w-[240px] truncate" title={s.title}>{s.title}</td>
              <td className="p-2 max-w-[300px] truncate" title={s.summary || snippet(s.content)}>{s.summary || snippet(s.content)}</td>
              <td className="p-2">
                <StatusBadge status={String(s.status || '')} />
              </td>
              <td className="p-2" title={s.language || ''}>{s.language || '—'}</td>
              <td className="p-2" title={s.category || ''}>{s.category || '—'}</td>
              <td className="p-2" title={s.location?.city || ''}>{s.location?.city || '—'}</td>
              <td className="p-2" title={s.createdAt || ''}>{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
              <td className="p-2" title={s.updatedAt || ''}>{s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '—'}</td>
              <td className="p-2">
                <RowActions
                  story={s}
                  onView={() => setViewing(s)}
                  onWithdraw={async () => {
                    const mapped = mapStoryStatus(String(s.status));
                    if (mapped !== 'submitted') { toast.error('Withdraw allowed only while submitted/under review'); return; }
                    if (!window.confirm('Withdraw this submission? Editors will stop reviewing it.')) return;
                    await withdrawMut.mutateAsync(s._id);
                  }}
                  onDelete={async () => {
                    if (!window.confirm('Delete this story? This action cannot be undone.')) return;
                    await deleteMut.mutateAsync(s._id);
                  }}
                  onEdit={() => navigate(`/community/submit?storyId=${encodeURIComponent(s._id)}`)}
                  onSubmit={() => toast.success('Submit not wired yet')}
                  onResubmit={() => toast.success('Resubmit not wired yet')}
                  onNewDraft={() => navigate(`/community/submit?fromStory=${encodeURIComponent(s._id)}`)}
                />
              </td>
            </tr>
          ))}
          {!isLoading && visible.length === 0 && (
            <tr>
              <td colSpan={9} className="p-4 text-center text-slate-500">You haven’t submitted any stories yet. Use the Reporter Portal or Submit Story page to send your first report.</td>
            </tr>
          )}
        </tbody>
      </table>

      {viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full mx-4">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold truncate" title={viewing.title}>{viewing.title || 'Untitled story'}</h3>
              <button className="text-slate-600 hover:text-slate-900" onClick={()=> setViewing(null)}>✕</button>
            </div>
            <div className="p-4 space-y-3 text-sm text-slate-800">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={String(viewing.status || '')} />
                {viewing.language && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 border border-slate-200">{viewing.language}</span>}
                {viewing.category && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 border border-slate-200">{viewing.category}</span>}
                {viewing.location?.city && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700 border border-slate-200">{viewing.location.city}</span>}
                {viewing.createdAt && <span className="text-xs text-slate-500">{new Date(viewing.createdAt).toLocaleString()}</span>}
              </div>
              {mapStoryStatus(String(viewing.status)) === 'rejected' && viewing.decisionReason && (
                <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">Reason: {viewing.decisionReason}</div>
              )}
              {mapStoryStatus(String(viewing.status)) === 'removed' && (
                <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">This story was removed by News Pulse for safety/legal reasons.</div>
              )}
              {viewing.summary && (
                <p className="text-slate-700">{viewing.summary}</p>
              )}
              {viewing.content && (
                <div className="prose max-w-none whitespace-pre-wrap leading-relaxed">{viewing.content}</div>
              )}
              {mapStoryStatus(String(viewing.status)) === 'published' && viewing.publishedUrl && (
                <a className="text-sm text-blue-600 hover:underline" href={viewing.publishedUrl} target="_blank" rel="noreferrer">View on site</a>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex items-center justify-end gap-2">
              <button className="px-3 py-1 text-sm rounded bg-slate-200 text-slate-800" onClick={()=> setViewing(null)}>Close</button>
              <button className="px-3 py-1 text-sm rounded bg-blue-600 text-white" onClick={()=> { setViewing(null); navigate(`/admin/articles/${viewing._id}/edit`); }}>Edit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RowActions({
  story,
  onView,
  onEdit,
  onSubmit,
  onWithdraw,
  onDelete,
  onResubmit,
  onNewDraft,
}: {
  story: CommunityStory;
  onView: () => void;
  onEdit: () => void;
  onSubmit: () => void;
  onWithdraw: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
  onResubmit: () => void;
  onNewDraft: () => void;
}) {
  const s = mapStoryStatus(String(story.status));
  const Btn = ({ className, children, onClick, disabled }: any) => (
    <button className={className} onClick={onClick} disabled={disabled}>{children}</button>
  );

  // Common styles
  const outlineBlue = 'px-3 py-1 text-xs rounded border border-blue-300 text-blue-700 bg-white hover:bg-blue-50';
  const filledBlue = 'px-3 py-1 text-xs rounded bg-blue-600 text-white hover:bg-blue-700';
  const filledGreen = 'px-3 py-1 text-xs rounded bg-emerald-600 text-white hover:bg-emerald-700';
  const outlineRed = 'px-3 py-1 text-xs rounded border border-red-300 text-red-700 bg-white hover:bg-red-50';
  const textRed = 'px-2 py-1 text-xs text-red-700 hover:underline';

  if (s === 'draft') {
    return (
      <div className="flex gap-2 flex-wrap">
        <Btn className={outlineBlue} onClick={onEdit}>Edit</Btn>
        <Btn className={filledGreen} onClick={onSubmit}>Submit</Btn>
        <Btn className={textRed} onClick={onDelete}>Delete</Btn>
      </div>
    );
  }
  if (s === 'submitted') {
    return (
      <div className="flex gap-2 flex-wrap">
        <Btn className={outlineBlue} onClick={onView}>View</Btn>
        <Btn className={outlineRed} onClick={onWithdraw}>Withdraw</Btn>
      </div>
    );
  }
  if (s === 'approved') {
    return (
      <div className="flex gap-2 flex-wrap">
        <Btn className={outlineBlue} onClick={onView}>View</Btn>
      </div>
    );
  }
  if (s === 'published') {
    return (
      <div className="flex gap-2 flex-wrap">
        <Btn className={outlineBlue} onClick={onView}>View</Btn>
        {story.publishedUrl && (
          <a className={filledBlue} href={story.publishedUrl} target="_blank" rel="noreferrer">View on site</a>
        )}
      </div>
    );
  }
  if (s === 'rejected') {
    return (
      <div className="flex gap-2 flex-wrap">
        <Btn className={outlineBlue} onClick={onView}>View</Btn>
        <Btn className={filledBlue} onClick={onNewDraft}>New draft</Btn>
        <Btn className={textRed} onClick={onDelete}>Delete</Btn>
      </div>
    );
  }
  if (s === 'withdrawn') {
    return (
      <div className="flex gap-2 flex-wrap">
        <Btn className={outlineBlue} onClick={onEdit}>Edit</Btn>
        <Btn className={filledGreen} onClick={onResubmit}>Resubmit</Btn>
        <Btn className={textRed} onClick={onDelete}>Delete</Btn>
      </div>
    );
  }
  // Removed by News Pulse – no actions available
  return (
    <span className="text-xs text-gray-500 italic">Removed by News Pulse – no actions available</span>
  );
}


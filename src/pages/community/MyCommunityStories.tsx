import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { listMyStories, withdrawStory, deleteMyStory } from '@/lib/api/communityStories';
import type { CommunityStory } from '@/types/community';
import type { ArticleStatus } from '@/types/articles';

function StatusBadge({ status }: { status: string | ArticleStatus }) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] capitalize';
  const s = String(status || '').toLowerCase();
  if (s === 'draft') return <span className={`${base} bg-slate-100 text-slate-700 border border-slate-200`}>draft</span>;
  if (s === 'pending' || s === 'under_review') return <span className={`${base} bg-amber-50 text-amber-800 border border-amber-200`}>pending</span>;
  if (s === 'approved' || s === 'published') return <span className={`${base} bg-emerald-50 text-emerald-700 border border-emerald-200`}>{s === 'approved' ? 'approved' : 'published'}</span>;
  if (s === 'rejected' || s === 'deleted') return <span className={`${base} bg-red-50 text-red-700 border border-red-200`}>{s === 'rejected' ? 'rejected' : 'deleted'}</span>;
  if (s === 'archived') return <span className={`${base} bg-slate-50 text-slate-500 border border-slate-200`}>archived</span>;
  if (s === 'scheduled') return <span className={`${base} bg-indigo-100 text-indigo-700 border border-indigo-200`}>scheduled</span>;
  return <span className={`${base} bg-slate-50 text-slate-500 border border-slate-200`}>{status || 'unknown'}</span>;
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
  const [status, setStatus] = useState<ArticleStatus | 'all'>('all');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-community-stories', status, q],
    queryFn: () => listMyStories({ status, q, page: 1, limit: 100 }),
    staleTime: 30_000,
  });

  const items: CommunityStory[] = (data?.items || []).slice();

  const filtered = useMemo(() => {
    let arr = items;
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      arr = arr.filter((s) => (s.title || '').toLowerCase().includes(qq));
    }
    return arr;
  }, [items, q]);

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
    onSuccess: async () => {
      toast.success('Story deleted');
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
          <p className="text-sm text-slate-600">View and manage stories you've submitted to NewsPulse.</p>
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
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
              <option value="deleted">Deleted</option>
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
            <th className="p-2 text-left">Location</th>
            <th className="p-2 text-left">Created</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((s)=> (
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
              <td className="p-2">
                <div className="flex gap-2 flex-wrap">
                  <button className="px-3 py-1 text-xs rounded bg-slate-200 text-slate-900" onClick={()=> setViewing(s)}>View</button>
                  <button className="px-3 py-1 text-xs rounded bg-blue-600 text-white" onClick={()=> navigate(`/admin/articles/${s._id}/edit`)}>Edit</button>
                  <button className="px-3 py-1 text-xs rounded bg-slate-200 text-slate-800" onClick={()=> withdrawMut.mutate(s._id)} disabled={withdrawMut.isPending}>Withdraw</button>
                  <button className="px-3 py-1 text-xs rounded bg-red-600 text-white" onClick={()=> deleteMut.mutate(s._id)} disabled={deleteMut.isPending}>Delete</button>
                </div>
              </td>
            </tr>
          ))}
          {!isLoading && filtered.length === 0 && (
            <tr>
              <td colSpan={8} className="p-4 text-center text-slate-500">No stories found.</td>
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
              {viewing.summary && (
                <p className="text-slate-700">{viewing.summary}</p>
              )}
              {viewing.content && (
                <div className="prose max-w-none whitespace-pre-wrap leading-relaxed">{viewing.content}</div>
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

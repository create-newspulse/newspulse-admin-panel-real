import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listArticles, archiveArticle, restoreArticle, deleteArticle } from '@/lib/api/articles';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

interface Props { params: Record<string, any>; onEdit: (id: string) => void; onSelectIds?: (ids: string[]) => void; onPageChange?: (page: number) => void; }

export const ArticleTable: React.FC<Props> = ({ params, onEdit, onSelectIds, onPageChange }) => {
  const qc = useQueryClient();
  const { user } = useAuth();
  const role = user?.role || 'editor';
  const canArchive = role === 'admin' || role === 'founder' || role === 'editor';
  const canDelete = role === 'admin' || role === 'founder';
  const { data, isLoading, error } = useQuery({ queryKey: ['articles', params], queryFn: () => listArticles(params) });
  // Optimistic mutations
  const mutateArchive = useMutation({
    mutationFn: archiveArticle,
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ['articles'] });
      const prev = qc.getQueryData<any>(['articles', params]);
      if (prev?.data) {
        qc.setQueryData(['articles', params], {
          ...prev,
          data: prev.data.map((a: any)=> a._id===id? { ...a, status:'archived' }: a)
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
      const prev = qc.getQueryData<any>(['articles', params]);
      if (prev?.data) {
        qc.setQueryData(['articles', params], {
          ...prev,
          data: prev.data.map((a: any)=> a._id===id? { ...a, status:'draft' }: a)
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
      const prev = qc.getQueryData<any>(['articles', params]);
      if (prev?.data) {
        qc.setQueryData(['articles', params], {
          ...prev,
          data: prev.data.map((a: any)=> a._id===id? { ...a, status:'deleted' }: a)
        });
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => { if (ctx?.prev) qc.setQueryData(['articles', params], ctx.prev); toast.error('Delete failed'); },
    onSuccess: () => { toast.success('Deleted'); },
    onSettled: () => { qc.invalidateQueries({ queryKey:['articles']}); }
  });
  const [selected, setSelected] = React.useState<string[]>([]);
  React.useEffect(()=>{ onSelectIds?.(selected); },[selected]);
  if (isLoading) return <div className="animate-pulse text-slate-500">Loading articles…</div>;
  if (error) return <div className="text-red-600">Error loading articles</div>;
  const rows = data?.data || [];
  const page = data?.page || 1;
  const pages = data?.pages || 1;
  const total = data?.total || 0;
  const canPrev = page > 1;
  const canNext = page < pages;
  return (
    <>
    <table className="w-full text-sm border">
      <thead className="sticky top-0 bg-slate-100">
        <tr className="text-left">
          <th className="p-2"><input type="checkbox" onChange={e=> setSelected(e.target.checked? rows.map((r:any)=> r._id): [])} /></th>
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
        {rows.map((r:any)=> {
          const statusColors: Record<'draft'|'scheduled'|'published'|'archived'|'deleted', string> = {
            draft: 'bg-gray-500', scheduled: 'bg-amber-600', published: 'bg-green-600', archived: 'bg-slate-600', deleted: 'bg-red-700'
          };
          const st = (r.status ?? 'draft') as 'draft'|'scheduled'|'published'|'archived'|'deleted';
          const badge = statusColors[st] || 'bg-gray-500';

          const ptiColors: Record<'compliant'|'pending'|'rejected', string> = { compliant: 'bg-green-600', pending: 'bg-amber-600', rejected: 'bg-red-600' };
          const pti = (r.ptiCompliance ?? 'pending') as 'compliant'|'pending'|'rejected';
          const ptiBadge = ptiColors[pti];
          return (
            <tr key={r._id} className="border-t hover:bg-slate-50">
              <td className="p-2"><input type="checkbox" checked={selected.includes(r._id)} onChange={()=> setSelected(s=> s.includes(r._id)? s.filter(x=>x!==r._id): [...s, r._id])} /></td>
              <td className="p-2">
                <div className="font-medium flex items-center gap-2">
                  <span>{r.title}</span>
                  <span className="px-1.5 py-0.5 rounded bg-indigo-600 text-white text-[10px]">{r.language?.toUpperCase()}</span>
                  <span className="px-1 py-0.5 rounded bg-sky-700 text-white text-[10px]">{r.category}</span>
                </div>
              </td>
              <td className="p-2"><span className={`px-2 py-0.5 rounded text-white ${badge}`}>{r.status}</span></td>
              <td className="p-2">{r.author?.name || '—'}</td>
              <td className="p-2"><span className={`px-2 py-0.5 rounded text-white ${ptiBadge}`}>{r.ptiCompliance}</span></td>
              <td className="p-2">{r.trustScore ?? 0}</td>
              <td className="p-2">{new Date(r.createdAt).toLocaleDateString()}</td>
              <td className="p-2 space-x-2">
                <button onClick={()=> onEdit(r._id)} className="text-blue-600 hover:underline">Edit</button>
                {canArchive && r.status !== 'archived' && r.status !== 'deleted' && <button onClick={()=> mutateArchive.mutate(r._id)} className="text-slate-600 hover:underline">Archive</button>}
                {canArchive && r.status === 'archived' && <button onClick={()=> mutateRestore.mutate(r._id)} className="text-green-600 hover:underline">Restore</button>}
                {canDelete && r.status !== 'deleted' && <button onClick={()=> mutateDelete.mutate(r._id)} className="text-red-600 hover:underline">Delete</button>}
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
    </>
  );
};

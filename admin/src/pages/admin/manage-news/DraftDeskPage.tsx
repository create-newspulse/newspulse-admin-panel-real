import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listArticles, deleteArticle, AdminArticle } from '../../../lib/api/articles';

export default function DraftDeskPage(){
  const qc = useQueryClient();
  const [toast, setToast] = useState<string|null>(null);
  const [originFilter, setOriginFilter] = useState<'all'|'community'|'editor'|'founder'|'journalist'>('all');
  const { data, isLoading } = useQuery({
    queryKey:['articles','drafts', originFilter],
    queryFn: () => {
      const params: any = { status: 'draft' };
      if (originFilter !== 'all') {
        // Backend contract: support origin/source filter; send origin for compatibility
        params.origin = originFilter;
      }
      return listArticles(params);
    }
  });
  const itemsRaw: AdminArticle[] = (data?.data || []) as AdminArticle[];
  const items: AdminArticle[] = useMemo(() =>
    (itemsRaw || []).filter((a) => a?.status === 'draft'),
  [itemsRaw]);

  async function onDelete(id: string){
    const ok = window.confirm('Move this draft to Deleted? You can restore later from Manage News → Deleted.');
    if (!ok) return;
    // Optimistically remove from current list
    qc.setQueryData(['articles','drafts'], (old: any) => {
      try {
        const arr = Array.isArray(old?.data) ? old.data : (Array.isArray(old) ? old : []);
        const next = arr.filter((a: AdminArticle) => a._id !== id);
        return Array.isArray(old) ? next : { ...(old||{}), data: next };
      } catch { return old; }
    });
    try {
      await deleteArticle(id);
      setToast('Draft moved to Deleted Articles.');
      setTimeout(()=> setToast(null), 3000);
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || 'Failed to delete draft');
    } finally {
      qc.invalidateQueries({ queryKey:['articles'] });
      qc.invalidateQueries({ queryKey:['articles','drafts'] });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">📰 Draft Desk</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={()=> setOriginFilter('all')}
            className={`px-3 py-1 rounded border text-sm ${originFilter==='all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
          >All</button>
          <button
            type="button"
            onClick={()=> setOriginFilter('community')}
            className={`px-3 py-1 rounded border text-sm ${originFilter==='community' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
          >Community drafts</button>
          <button
            type="button"
            onClick={()=> setOriginFilter('editor')}
            className={`px-3 py-1 rounded border text-sm ${originFilter==='editor' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
          >Editor drafts</button>
          {/* Future: founder, journalist */}
        </div>
      </div>
      {toast && <div className="mb-3 text-sm bg-green-100 text-green-700 px-3 py-2 rounded border border-green-200">{toast}</div>}
      {isLoading && <div>Loading...</div>}
      <table className="w-full text-sm border">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-2 text-left">Title</th>
            <th className="p-2">Language</th>
            <th className="p-2">Status</th>
            <th className="p-2">Origin</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a: AdminArticle)=>(
            <tr key={a._id} className="border-t">
              <td className="p-2">{a.title}</td>
              <td className="p-2 text-center">{a.language}</td>
              <td className="p-2 text-center">{a.status}</td>
              <td className="p-2 text-center">
                {a?.source === 'community' ? (
                  <span className="px-2 py-0.5 rounded text-xs font-medium border bg-blue-100 text-blue-700 border-blue-200">Community Reporter</span>
                ) : a?.source === 'editor' ? (
                  <span className="px-2 py-0.5 rounded text-xs font-medium border bg-purple-100 text-purple-700 border-purple-200">Editor Draft</span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-xs font-medium border bg-slate-100 text-slate-700 border-slate-200">—</span>
                )}
              </td>
              <td className="p-2 flex gap-2 justify-center">
                <a href={`/admin/manage-news/${a._id}/edit`} className="btn-secondary">Edit</a>
                {a?.status === 'draft' && (
                  <button onClick={()=> onDelete(a._id)} className="btn-secondary">Delete draft</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

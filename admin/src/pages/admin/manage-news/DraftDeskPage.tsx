import { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listDrafts, deleteDraft, restoreDraft, hardDeleteDraft, AdminDraft } from '../../../lib/api/drafts';

type FilterMode = 'all' | 'deleted' | 'community' | 'editor' | 'pro' | 'founder' | 'restored' | 'hard-delete';

export default function DraftDeskPage(){
  const qc = useQueryClient();
  const [toast, setToast] = useState<string|null>(null);
  const [error, setError] = useState<string|null>(null);
  const [mode, setMode] = useState<FilterMode>('all');
  const permanentModeActive = mode === 'hard-delete';
  const [search, setSearch] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');

  // Debounce search input to reduce network calls
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  const queryParams = useMemo(() => ({
    deleted: mode === 'deleted' || permanentModeActive ? 1 : 0,
    source: (mode === 'community' || mode === 'editor' || mode === 'pro' || mode === 'founder') ? mode : undefined,
    q: debouncedSearch || undefined
  }), [mode, debouncedSearch, permanentModeActive]);

  const { data, isLoading } = useQuery({
    queryKey:['admin-drafts', queryParams],
    queryFn: () => listDrafts({
      deleted: queryParams.deleted,
      source: queryParams.source as any,
      search: queryParams.q
    })
  });
  const items: AdminDraft[] = Array.isArray(data) ? data : [];
  async function onSoftDelete(id: string){
    const ok = window.confirm('Delete this draft? It will move to Deleted.');
    if (!ok) return;
    // Optimistically remove from current list
    qc.setQueryData(['admin-drafts', queryParams], (old: any) => {
      try {
        const arr = Array.isArray(old?.data) ? old.data : (Array.isArray(old) ? old : []);
        const next = arr.filter((a: AdminDraft) => a._id !== id);
        return Array.isArray(old) ? next : { ...(old||{}), data: next };
      } catch { return old; }
    });
    try {
      await deleteDraft(id);
      setToast('Draft deleted.');
      setTimeout(()=> setToast(null), 3000);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to delete draft';
      setError(msg);
      setTimeout(()=> setError(null), 4500);
    } finally {
      qc.invalidateQueries({ queryKey:['admin-drafts'] });
    }
  }

  async function onRestore(id: string){
    const ok = window.confirm('Restore this draft? It will move back to All Drafts.');
    if (!ok) return;
    // Optimistically remove from current list (Deleted tab)
    qc.setQueryData(['admin-drafts', queryParams], (old: any) => {
      try {
        const arr = Array.isArray(old?.data) ? old.data : (Array.isArray(old) ? old : []);
        const next = arr.filter((a: AdminDraft) => a._id !== id);
        return Array.isArray(old) ? next : { ...(old||{}), data: next };
      } catch { return old; }
    });
    try {
      await restoreDraft(id);
      setToast('Draft restored.');
      setTimeout(()=> setToast(null), 3000);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to restore draft';
      setError(msg);
      setTimeout(()=> setError(null), 4500);
    } finally {
      qc.invalidateQueries({ queryKey:['admin-drafts'] });
    }
  }

  async function onHardDelete(id: string){
    const ok = window.confirm('Permanently delete this draft? This cannot be undone.');
    if(!ok) return;
    qc.setQueryData(['admin-drafts', queryParams], (old: any) => {
      try {
        const arr = Array.isArray(old?.data) ? old.data : (Array.isArray(old) ? old : []);
        const next = arr.filter((a: AdminDraft) => a._id !== id);
        return Array.isArray(old) ? next : { ...(old||{}), data: next };
      } catch { return old; }
    });
    try {
      await hardDeleteDraft(id);
      setToast('Draft permanently deleted.');
      setTimeout(()=> setToast(null), 3000);
    } catch(e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed permanent delete.';
      setError(msg);
      setTimeout(()=> setError(null), 4500);
    } finally {
      qc.invalidateQueries({ queryKey:['admin-drafts'] });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">📰 Draft Desk – All Draft Articles</h1>
        <div className="flex items-center gap-2">
          <button onClick={()=> qc.invalidateQueries({ queryKey:['admin-drafts'] })} className="btn-secondary">Refresh</button>
        </div>
      </div>
      {/* Unified filter/action row */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {(['all','deleted','community','editor','pro','founder','restored','hard-delete'] as FilterMode[]).map((m) => (
          <button
            key={m}
            type="button"
            className={`px-2 py-1 text-xs rounded border ${mode===m ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
            onClick={()=> setMode(m)}
          >{labelForMode(m)}</button>
        ))}
      </div>
      {/* Search input */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={e=> setSearch(e.target.value)}
          placeholder="Search headline..."
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </div>
      {toast && <div className="mb-3 text-sm bg-green-100 text-green-700 px-3 py-2 rounded border border-green-200">{toast}</div>}
      {error && <div className="mb-3 text-sm bg-red-100 text-red-700 px-3 py-2 rounded border border-red-200">{error}</div>}
      {isLoading && <div>Loading...</div>}
      <table className="w-full text-sm border">
        <thead className="bg-slate-100">
          <tr>
            <th className="p-2 text-left">Headline</th>
            <th className="p-2">Language</th>
            <th className="p-2">Status</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((d: AdminDraft)=>(
            <tr key={d._id} className="border-t">
              <td className="p-2">{d.headline || d.title || '—'}</td>
              <td className="p-2 text-center">{d.language}</td>
              <td className="p-2 text-center">{(mode==='deleted'||mode==='hard-delete') ? 'deleted' : (d.status || 'draft')}</td>
              <td className="p-2 flex gap-2 justify-center">
                {/* View story could link to a read-only view if present; keeping existing behavior not specified here */}
                <a href={`/admin/manage-news/${(d.articleId || d._id)}/edit`} className="btn-secondary">Edit</a>
                { (mode==='deleted' || mode==='hard-delete') ? (
                  <>
                    <button onClick={()=> onRestore(d._id)} className="btn-secondary">Restore</button>
                    {permanentModeActive && (
                      <button onClick={()=> onHardDelete(d._id)} className="btn-secondary text-red-600 border-red-600">Delete Permanent</button>
                    )}
                  </>
                ) : (
                  <button onClick={()=> onSoftDelete(d._id)} className="btn-secondary">Delete draft</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function labelForMode(m: FilterMode){
  if (m==='all') return 'All';
  if (m==='deleted') return 'Deleted';
  if (m==='community') return 'Community drafts';
  if (m==='editor') return 'Editor drafts';
  if (m==='pro') return 'Professional Journalist';
  if (m==='founder') return 'Founder';
  if (m==='restored') return 'Restored'; // Placeholder: no separate backend filter; behaves like All
  if (m==='hard-delete') return 'Delete Permanent';
  return String(m);
}

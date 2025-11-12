import React, { Suspense } from 'react';
import { ArticleTable } from '@/components/news/ArticleTable';
import { ArticleFilters } from '@/components/news/ArticleFilters';
import { UploadCsvDialog } from '@/components/news/UploadCsvDialog';
import apiClient from '@/lib/api';
import toast from 'react-hot-toast';
import { safeLazy } from '@/utils/safeLazy';

const ArticleForm = safeLazy(() => import('@/components/news/ArticleForm').then(m => ({ default: m.ArticleForm })), 'ArticleForm');

// (Optional future) Workflow typing placeholder kept minimal

export default function ManageNews() {
  const [params, setParams] = React.useState<Record<string,any>>({ page:1, limit:20, sort:'-createdAt' });
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showCsv, setShowCsv] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // Voice & playback controls removed (no-op)

  // Workflow transition (mirrors legacy doTransition)
  const doTransition = async (id: string, action: string) => {
    try {
      await apiClient.post(`/news/${id}/transition`, { action });
      toast.success(`${action} done`);
      // Trigger a soft refresh by nudging params (keeps pagination)
      setParams(p => ({ ...p }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Transition failed');
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Manage News Articles</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <button onClick={()=> setShowCsv(true)} className="px-3 py-1 bg-indigo-600 text-white rounded">CSV Upload</button>
          <button onClick={()=> window.location.href='/add'} className="px-3 py-1 bg-green-600 text-white rounded">Add New</button>
          <button onClick={()=> setParams(p => ({ ...p }))} className="px-3 py-1 bg-slate-700 text-white rounded">Refresh</button>
          {/* Voice controls removed */}
        </div>
      </div>

      <ArticleFilters params={params} onChange={setParams} />

      <ArticleTable
        params={params}
        onEdit={(id)=> { setEditingId(id); }}
        onSelectIds={setSelectedIds}
        onPageChange={(p)=> setParams(prev => ({ ...prev, page: Math.max(1, p) }))}
      />

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded border text-xs">
          <span className="font-medium">Selected: {selectedIds.length}</span>
          <span className="mx-2 text-slate-400">|</span>
          <button onClick={()=> { if (confirm(`Send ${selectedIds.length} to Review?`)) selectedIds.forEach(id => void doTransition(id,'toReview')); }} className="px-2 py-1 rounded border">To Review</button>
          <button onClick={()=> { if (confirm(`Send ${selectedIds.length} to Legal?`)) selectedIds.forEach(id => void doTransition(id,'toLegal')); }} className="px-2 py-1 rounded border">To Legal</button>
          <button onClick={()=> { if (confirm(`Approve ${selectedIds.length}?`)) selectedIds.forEach(id => void doTransition(id,'approve')); }} className="px-2 py-1 rounded border">Approve</button>
          <button onClick={()=> { if (confirm(`Publish ${selectedIds.length}?`)) selectedIds.forEach(id => void doTransition(id,'publish')); }} className="px-2 py-1 rounded border text-white bg-red-600">Publish</button>
        </div>
      )}

      {editingId && (
        <div className="fixed top-0 right-0 w-[400px] h-full bg-white dark:bg-slate-900 shadow-xl overflow-y-auto p-4 z-40 border-l">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-semibold">Edit Article</h2>
            <button onClick={()=> setEditingId(null)} className="text-sm px-2 py-1 rounded bg-slate-200 dark:bg-slate-700">Close</button>
          </div>
          <Suspense fallback={<div className="p-4 text-sm">Loading form…</div>}>
            <ArticleForm id={editingId} onDone={()=> { setEditingId(null); setParams(p => ({ ...p })); }} />
          </Suspense>
        </div>
      )}

      {showCsv && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <UploadCsvDialog onDone={()=> setShowCsv(false)} />
        </div>
      )}
    </div>
  );
}

import React, { Suspense } from 'react';
import { ArticleTable } from '@/components/news/ArticleTable';
import { ArticleFilters } from '@/components/news/ArticleFilters';
import { UploadCsvDialog } from '@/components/news/UploadCsvDialog';
import apiClient from '@/lib/api';
import { debug } from '@/lib/debug';
import { guardAction, type ArticleWorkflowAction } from '@/lib/articleWorkflowGuard';
import toast from 'react-hot-toast';
import { safeLazy } from '@/utils/safeLazy';
import type { ArticleStatus } from '@/types/articles';
import type { ManageNewsParams } from '@/types/api';
import { usePublishFlag } from '@/context/PublishFlagContext';
import { useAuth } from '@/context/AuthContext';

const ArticleForm = safeLazy(() => import('@/components/news/ArticleForm').then(m => ({ default: m.ArticleForm })), 'ArticleForm');

// Status tabs metadata (shared type)
const STATUS_TABS: { value: 'all' | ArticleStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
  { value: 'deleted', label: 'Deleted' },
];

export default function ManageNews() {
  // status param uses explicit 'all' | ArticleStatus for UI sync
  const [params, setParams] = React.useState<ManageNewsParams>({ page:1, limit:20, sort:'-createdAt', status:'all' });
  // Side-panel edit removed; editing now handled via dedicated route.
  const [showCsv, setShowCsv] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const { publishEnabled, override, setOverride, envDefault } = usePublishFlag();
  const { isFounder } = useAuth();

  // Voice & playback controls removed (no-op)

  // Workflow transition (mirrors legacy doTransition)
  const doTransition = async (id: string, action: ArticleWorkflowAction) => {
    try {
      const g = guardAction(action, publishEnabled, { isFounder });
      if (!g.allowed) {
        debug('[ManageNews] blocked transition', { id, action, publishEnabled });
        toast.error(g.reason || 'Action blocked');
        return;
      }
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

      {/* Status Tabs (synced with filters dropdown) */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(tab => {
          const active = (params.status ?? 'all') === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setParams(p => ({ ...p, status: tab.value, page:1 }))}
              className={`px-3 py-1 rounded border text-sm transition ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'}`}
            >{tab.label}</button>
          );
        })}
      </div>

      <ArticleFilters params={params} onChange={setParams} />

      <ArticleTable
        params={params}
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
          {publishEnabled ? (
            <button onClick={()=> { if (confirm(`Publish ${selectedIds.length}?`)) selectedIds.forEach(id => void doTransition(id,'publish')); }} className="px-2 py-1 rounded border text-white bg-red-600">Publish</button>
          ) : (
            <span className="px-2 py-1 rounded border bg-slate-200 text-slate-500" title="Publishing temporarily disabled">Publish (disabled)</span>
          )}
        </div>
      )}
      {isFounder && (
        <div className="mt-4 p-3 rounded border bg-slate-50 text-xs flex flex-wrap items-center gap-3">
          <span className="font-medium">Publish Runtime Toggle</span>
          <span>Env Default: {envDefault ? 'ON' : 'OFF'}</span>
          <span>Override: {override === null ? '—' : (override ? 'ON' : 'OFF')}</span>
          <span>Effective: {publishEnabled ? 'ON' : 'OFF'}</span>
          <button
            type="button"
            onClick={()=> setOverride(override === null ? !envDefault : !override)}
            className="px-2 py-1 rounded border bg-white hover:bg-slate-100"
          >Toggle</button>
          {override !== null && (
            <button
              type="button"
              onClick={()=> setOverride(null)}
              className="px-2 py-1 rounded border bg-white hover:bg-slate-100"
            >Clear Override</button>
          )}
        </div>
      )}

      {/* Edit side panel removed in favor of /admin/articles/:id/edit route */}

      {showCsv && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <UploadCsvDialog onDone={()=> setShowCsv(false)} />
        </div>
      )}
    </div>
  );
}

// newspulse-admin-panel-real-main/src/pages/ManageNews.tsx

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArticleTable } from '@/components/news/ArticleTable';
import { ArticleFilters } from '@/components/news/ArticleFilters';
import { UploadCsvDialog } from '@/components/news/UploadCsvDialog';
import apiClient from '@/lib/api';
import { debug } from '@/lib/debug';
import { guardAction, type ArticleWorkflowAction } from '@/lib/articleWorkflowGuard';
import toast from 'react-hot-toast';
import type { ArticleStatus } from '@/types/articles';
import type { ManageNewsParams } from '@/types/api';
import { usePublishFlag } from '@/context/PublishFlagContext';
import { useAuth } from '@/context/AuthContext';

// Status tabs metadata
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
  const [params, setParams] = React.useState<ManageNewsParams>({
    page: 1,
    limit: 20,
    sort: '-createdAt',
    status: 'all',
  });

  const [showCsv, setShowCsv] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const { publishEnabled, override, setOverride, envDefault } = usePublishFlag();
  const { isFounder } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const highlightId = React.useMemo(() => {
    try {
      const sp = new URLSearchParams(location.search);
      return sp.get('highlight');
    } catch {
      return null;
    }
  }, [location.search]);

  React.useEffect(() => {
    try {
      const sp = new URLSearchParams(location.search);
      const statusFromUrl = sp.get('status');
      if (statusFromUrl && STATUS_TABS.some(t => t.value === statusFromUrl)) {
        setParams(p => ({
          ...p,
          status: statusFromUrl as any,
          page: 1,
        }));
      }
    } catch {}
  }, [location.search]);

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
      toast.error(
        err?.response?.data?.message || err?.message || 'Transition failed',
      );
    }
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Manage News Articles</h1>
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={() => setShowCsv(true)}
            className="px-3 py-1 bg-indigo-600 text-white rounded"
          >
            CSV Upload
          </button>
          <button
            onClick={() => navigate('/add')}
            className="px-3 py-1 bg-green-600 text-white rounded"
          >
            Add New
          </button>
          <button
            onClick={() => setParams(p => ({ ...p }))}
            className="px-3 py-1 bg-slate-700 text-white rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map(tab => {
          const active = (params.status ?? 'all') === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() =>
                setParams(p => ({
                  ...p,
                  status: tab.value,
                  page: 1,
                }))
              }
              className={`px-3 py-1 rounded border text-sm transition ${
                active
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <ArticleFilters params={params} onChange={setParams} />

      {/* Table */}
      <ArticleTable
        params={params}
        onSelectIds={setSelectedIds}
        onPageChange={p =>
          setParams(prev => ({ ...prev, page: Math.max(1, p) }))
        }
        highlightId={highlightId || undefined}
      />

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-800 p-3 rounded border text-xs">
          <span className="font-medium">Selected: {selectedIds.length}</span>
          <span className="mx-2 text-slate-400">|</span>

          <button
            onClick={() => {
              if (
                confirm(`Send ${selectedIds.length} article(s) to Review?`)
              ) {
                selectedIds.forEach(id => void doTransition(id, 'toReview'));
              }
            }}
            className="px-2 py-1 rounded border"
          >
            To Review
          </button>

          <button
            onClick={() => {
              if (confirm(`Send ${selectedIds.length} article(s) to Legal?`)) {
                selectedIds.forEach(id => void doTransition(id, 'toLegal'));
              }
            }}
            className="px-2 py-1 rounded border"
          >
            To Legal
          </button>

          <button
            onClick={() => {
              if (confirm(`Approve ${selectedIds.length} article(s)?`)) {
                selectedIds.forEach(id => void doTransition(id, 'approve'));
              }
            }}
            className="px-2 py-1 rounded border"
          >
            Approve
          </button>

          {publishEnabled ? (
            <button
              onClick={() => {
                if (confirm(`Publish ${selectedIds.length} article(s)?`)) {
                  selectedIds.forEach(id => void doTransition(id, 'publish'));
                }
              }}
              className="px-2 py-1 rounded border text-white bg-red-600"
            >
              Publish
            </button>
          ) : (
            <span
              className="px-2 py-1 rounded border bg-slate-200 text-slate-500"
              title="Publishing temporarily disabled"
            >
              Publish (disabled)
            </span>
          )}
        </div>
      )}

      {/* Founder-only publish toggle */}
      {isFounder && (
        <div className="mt-4 p-3 rounded border bg-slate-50 text-xs flex flex-wrap items-center gap-3">
          <span className="font-medium">Publish Runtime Toggle</span>
          <span>Env Default: {envDefault ? 'ON' : 'OFF'}</span>
          <span>
            Override:{' '}
            {override === null ? '—' : override ? 'ON' : 'OFF'}
          </span>
          <span>Effective: {publishEnabled ? 'ON' : 'OFF'}</span>

          <button
            type="button"
            onClick={() =>
              setOverride(override === null ? !envDefault : !override)
            }
            className="px-2 py-1 rounded border bg-white hover:bg-slate-100"
          >
            Toggle
          </button>

          {override !== null && (
            <button
              type="button"
              onClick={() => setOverride(null)}
              className="px-2 py-1 rounded border bg-white hover:bg-slate-100"
            >
              Clear Override
            </button>
          )}
        </div>
      )}

      {/* CSV upload modal */}
      {showCsv && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <UploadCsvDialog onDone={() => setShowCsv(false)} />
        </div>
      )}
    </div>
  );
}

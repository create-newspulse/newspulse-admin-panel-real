import { useEffect, useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { deleteReporterStoryForAdmin, listReporterStoriesByEmail, listReporterStoriesForAdmin } from '@/lib/community';
import type { ReporterAdminStory } from '@/lib/community';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useNotify } from '@/components/ui/toast-bridge';
import { useAuth } from '@/context/AuthContext.tsx';

function useQueryParam(name: string) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name) || '', [search, name]);
}

export default function ReporterStoriesAdmin() {
  const location = useLocation();
  const reporterKeyFromQuery = useQueryParam('reporterKey');
  const emailFromQuery = useQueryParam('email');
  const reporterName = useQueryParam('name') || (location.state as any)?.reporterName || '';
  const reporterKeyFromState = (location.state as any)?.reporterKey || '';
  const inferredInitial = (reporterKeyFromQuery || reporterKeyFromState || emailFromQuery).trim();

  const notify = (useNotify?.() as unknown) as { ok: (msg: string, sub?: string) => void; error: (msg: string) => void } | undefined;
  const { user } = useAuth();
  const role = (user?.role || '').toLowerCase();
  const canDelete = role === 'founder' || role === 'admin';

  const [keyInput, setKeyInput] = useState<string>(inferredInitial);
  const [activeKey, setActiveKey] = useState<string>(inferredInitial);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchText, setSearchText] = useState('');
  const [stories, setStories] = useState<ReporterAdminStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<ReporterAdminStory | null>(null);
  const [deleteSelectedOpen, setDeleteSelectedOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  async function load() {
    const key = (activeKey || '').trim();
    if (!key) { setError('Enter reporter key (id) or email first'); return; }
    setLoading(true); setError(null);
    try {
      const isEmail = key.includes('@');
      const res = isEmail
        ? await listReporterStoriesByEmail(key, { status: statusFilter === 'all' ? undefined : statusFilter, q: searchText || undefined })
        : await listReporterStoriesForAdmin(key, { status: statusFilter === 'all' ? undefined : statusFilter, q: searchText || undefined });
      setStories(res.items || []);
      setSelectedStoryIds(new Set());
    } catch (e: any) {
      setError(e?.message || 'Failed to load stories');
      setStories([]);
      setSelectedStoryIds(new Set());
    } finally {
      setLoading(false);
    }
  }

  // Auto-load when arriving from the directory (query/state pre-fills email)
  useEffect(() => {
    if (!activeKey) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);

      return (
        <div className="px-6 py-4 max-w-6xl mx-auto space-y-6">
          <ConfirmModal
            open={!!deleteTarget}
            title="Delete story?"
            description="This will delete the selected story. This action cannot be undone."
            confirmLabel="Delete Story"
            confirmVariant="danger"
            confirmDisabled={deleteBusy}
            confirmBusyLabel="Deleting…"
            onCancel={() => {
              if (deleteBusy) return;
              setDeleteTarget(null);
            }}
            onConfirm={async () => {
              if (!deleteTarget || deleteBusy) return;
              setDeleteBusy(true);
              try {
                await deleteReporterStoryForAdmin(deleteTarget.id);
                notify?.ok?.('Story deleted');
                setDeleteTarget(null);
                await load();
              } catch (e: any) {
                notify?.error?.(e?.message || 'Failed to delete story');
              } finally {
                setDeleteBusy(false);
              }
            }}
          />

          <ConfirmModal
            open={deleteSelectedOpen}
            title="Delete selected stories?"
            description="This will delete the selected story record(s). This action cannot be undone."
            confirmLabel={`Delete ${selectedStoryIds.size || ''}`.trim()}
            confirmVariant="danger"
            confirmDisabled={deleteBusy}
            confirmBusyLabel="Deleting…"
            onCancel={() => {
              if (deleteBusy) return;
              setDeleteSelectedOpen(false);
            }}
            onConfirm={async () => {
              if (deleteBusy) return;
              const ids = Array.from(selectedStoryIds);
              if (ids.length === 0) return;
              setDeleteBusy(true);
              let okCount = 0;
              let failCount = 0;
              try {
                for (const id of ids) {
                  try {
                    await deleteReporterStoryForAdmin(id);
                    okCount += 1;
                  } catch (e: any) {
                    failCount += 1;
                  }
                }

                if (failCount === 0) {
                  notify?.ok?.('Deleted stories', `${okCount} deleted`);
                } else {
                  notify?.error?.(`Deleted ${okCount}, failed ${failCount}.`);
                }
                setDeleteSelectedOpen(false);
                setSelectedStoryIds(new Set());
                await load();
              } finally {
                setDeleteBusy(false);
              }
            }}
          />

          <header className="space-y-2">
            <div>
              <Link to="/community/reporter-contacts" className="text-sm text-slate-600 hover:text-slate-800">← Back to Reporter Contact Directory</Link>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">My Community Stories</h1>
            <p className="text-sm text-slate-600">Admin view – load stories by verified contributor id first, with reporter email kept as a fallback for older records.</p>
            <div className="flex items-center gap-2 mt-2">
              <input
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Verified contributor id or reporter email"
                className="border rounded-md px-3 py-1.5 text-sm w-80"
              />
              <button
                onClick={() => setActiveKey(keyInput.trim())}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >Load</button>
            </div>
            <div className="text-xs text-slate-500">Loaded identity key: <span className="font-mono">{activeKey || '—'}</span></div>
          </header>

          {loading ? (
            <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-600">Loading stories…</div>
          ) : error ? (
            <div className="rounded-xl border border-red-300 bg-red-50 p-6 space-y-4">
              <div className="font-semibold text-red-800">Failed to load stories</div>
              <div className="text-sm text-red-700">{error}</div>
              <button
                onClick={() => load()}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm"
              >Retry</button>
            </div>
          ) : (
            stories.length === 0 ? (
              <div className="rounded-xl border border-slate-200 p-12 text-center space-y-3 bg-white">
                <div className="text-lg font-semibold">No stories yet</div>
                <p className="text-sm text-slate-600">This reporter has not submitted any stories.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-3 bg-white border-b border-slate-200 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Status</label>
                    <select value={statusFilter} onChange={(e)=> setStatusFilter(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Search</label>
                    <input value={searchText} onChange={(e)=> setSearchText(e.target.value)} placeholder="Title contains…" className="border rounded px-2 py-1 text-sm w-64" />
                    <button onClick={() => load()} className="inline-flex items-center px-3 py-1.5 rounded-md border text-sm hover:bg-slate-50">Apply</button>
                  </div>
                  {canDelete && (
                    <>
                      <div className="ml-auto text-xs text-slate-600">{selectedStoryIds.size} selected</div>
                      <button
                        type="button"
                        disabled={selectedStoryIds.size === 0 || deleteBusy}
                        onClick={() => setDeleteSelectedOpen(true)}
                        className="text-xs px-3 py-2 rounded-md border text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {deleteBusy ? 'Deleting…' : 'Delete selected stories'}
                      </button>
                    </>
                  )}
                </div>
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      {canDelete && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">
                          <input
                            type="checkbox"
                            aria-label="Select all stories"
                            checked={stories.length > 0 && stories.every((s) => selectedStoryIds.has(s.id))}
                            onChange={() => {
                              if (deleteBusy) return;
                              const allSelected = stories.length > 0 && stories.every((s) => selectedStoryIds.has(s.id));
                              setSelectedStoryIds(() => {
                                if (allSelected) return new Set();
                                return new Set(stories.map((s) => s.id));
                              });
                            }}
                          />
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Summary</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Language</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">City</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Last updated</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {stories.map(s => (
                      <tr key={s.id}>
                        {canDelete && (
                          <td className="px-4 py-3 text-sm">
                            <input
                              type="checkbox"
                              aria-label="Select story"
                              disabled={deleteBusy}
                              checked={selectedStoryIds.has(s.id)}
                              onChange={() => {
                                if (deleteBusy) return;
                                setSelectedStoryIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(s.id)) next.delete(s.id);
                                  else next.add(s.id);
                                  return next;
                                });
                              }}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm">{s.title}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{s.summary || '—'}</td>
                        <td className="px-4 py-3 text-sm">{s.status}</td>
                        <td className="px-4 py-3 text-sm">{s.language}</td>
                        <td className="px-4 py-3 text-sm">{s.category || '—'}</td>
                        <td className="px-4 py-3 text-sm">{s.city || '—'}</td>
                        <td className="px-4 py-3 text-sm">{new Date(s.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">{new Date(s.updatedAt).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex items-center gap-2">
                            <Link
                              to={`/admin/community-reporter/${encodeURIComponent(s.id)}`}
                              state={{ reporterKey: activeEmail, reporterName }}
                              className="text-blue-600 hover:text-blue-800"
                            >View</Link>
                            {canDelete && (
                              <button
                                type="button"
                                disabled={deleteBusy}
                                onClick={() => setDeleteTarget(s)}
                                className="text-xs px-2 py-1 rounded border text-red-700 hover:bg-red-50 disabled:opacity-50"
                              >
                                Delete Story
                              </button>
                            )}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      );
}

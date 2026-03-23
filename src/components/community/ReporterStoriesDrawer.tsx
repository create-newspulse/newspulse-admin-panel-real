import { useEffect, useMemo, useState } from 'react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useNotify } from '@/components/ui/toast-bridge';
import { bulkDeleteReporterStories, deleteReporterStory, listReporterStoriesForContact, type ReporterStory } from '@/lib/api/reporterDirectory';

export default function ReporterStoriesDrawer({
  open,
  contactId,
  contactName,
  canDelete,
  onClose,
  onAfterMutation,
}: {
  open: boolean;
  contactId: string;
  contactName?: string;
  canDelete: boolean;
  onClose: () => void;
  onAfterMutation: () => void;
}) {
  const notify = (useNotify?.() as unknown) as { ok: (msg: string, sub?: string) => void; error: (msg: string) => void } | undefined;

  const [stories, setStories] = useState<ReporterStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<ReporterStory | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const title = useMemo(() => {
    const base = 'Reporter stories';
    const name = (contactName || '').trim();
    return name ? `${base} — ${name}` : base;
  }, [contactName]);

  async function load() {
    const id = String(contactId || '').trim();
    if (!id) {
      setStories([]);
      setSelectedIds(new Set());
      setError('Missing contact id');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await listReporterStoriesForContact(id);
      setStories(res.items || []);
      setSelectedIds(new Set());
    } catch (e: any) {
      setStories([]);
      setSelectedIds(new Set());
      setError(e?.message || 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contactId]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (!open) return;
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  const allSelected = stories.length > 0 && stories.every((s) => selectedIds.has(s.id));

  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete story?"
        description="This will delete the selected story. This action cannot be undone."
        confirmLabel="Delete Story"
        confirmVariant="danger"
        confirmDisabled={busy}
        confirmBusyLabel="Deleting…"
        onCancel={() => {
          if (busy) return;
          setDeleteTarget(null);
        }}
        onConfirm={async () => {
          if (!deleteTarget || busy) return;
          setBusy(true);
          try {
            await deleteReporterStory(deleteTarget.id);
            notify?.ok?.('Story deleted');
            setDeleteTarget(null);
            await load();
            onAfterMutation();
          } catch (e: any) {
            notify?.error?.(e?.message || 'Failed to delete story');
          } finally {
            setBusy(false);
          }
        }}
      />

      <ConfirmModal
        open={bulkDeleteOpen}
        title="Delete selected stories?"
        description="This will delete the selected story record(s). This action cannot be undone."
        confirmLabel={`Delete ${selectedIds.size || ''}`.trim()}
        confirmVariant="danger"
        confirmDisabled={busy}
        confirmBusyLabel="Deleting…"
        onCancel={() => {
          if (busy) return;
          setBulkDeleteOpen(false);
        }}
        onConfirm={async () => {
          if (busy) return;
          const ids = Array.from(selectedIds);
          if (ids.length === 0) return;
          setBusy(true);
          try {
            const res = await bulkDeleteReporterStories(ids);
            notify?.ok?.('Deleted stories', `${res.deleted} deleted`);
            setBulkDeleteOpen(false);
            setSelectedIds(new Set());
            await load();
            onAfterMutation();
          } catch (e: any) {
            notify?.error?.(e?.message || 'Failed to delete selected stories');
          } finally {
            setBusy(false);
          }
        }}
      />

      <div
        className={`absolute inset-0 bg-black/30 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[920px] bg-white shadow-xl border-l transition-transform ${open ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <div className="text-xs text-slate-500">Contact id: <span className="font-mono">{contactId || '—'}</span></div>
          </div>
          <div className="flex items-center gap-2">
            {canDelete && (
              <>
                <div className="text-xs text-slate-600">{selectedIds.size} selected</div>
                <button
                  type="button"
                  disabled={selectedIds.size === 0 || busy}
                  onClick={() => setBulkDeleteOpen(true)}
                  className="text-xs px-3 py-2 rounded-md border text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {busy ? 'Deleting…' : 'Delete selected stories'}
                </button>
              </>
            )}
            <button
              type="button"
              disabled={loading}
              onClick={() => load()}
              className="text-xs px-3 py-2 rounded-md border hover:bg-slate-50 disabled:opacity-50"
            >
              Refresh
            </button>
            <button onClick={onClose} className="px-2 py-1 text-sm rounded-md border hover:bg-slate-50">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-600">Loading stories…</div>
          ) : error ? (
            <div className="rounded-xl border border-red-300 bg-red-50 p-6 space-y-3">
              <div className="font-semibold text-red-800">Failed to load stories</div>
              <div className="text-sm text-red-700">{error}</div>
              <button
                onClick={() => load()}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm"
              >Retry</button>
            </div>
          ) : stories.length === 0 ? (
            <div className="rounded-xl border border-slate-200 p-12 text-center space-y-3 bg-white">
              <div className="text-lg font-semibold">No stories yet</div>
              <p className="text-sm text-slate-600">This reporter has not submitted any stories.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 whitespace-nowrap">
                  <thead className="bg-slate-50">
                    <tr>
                      {canDelete && (
                        <th className="px-3 py-3 text-left text-xs font-medium text-slate-600">
                          <input
                            type="checkbox"
                            aria-label="Select all stories"
                            checked={allSelected}
                            disabled={busy}
                            onChange={() => {
                              if (busy) return;
                              setSelectedIds(() => {
                                if (allSelected) return new Set();
                                return new Set(stories.map((s) => s.id));
                              });
                            }}
                          />
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Language</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Approval</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {stories.map((s) => (
                      <tr key={s.id}>
                        {canDelete && (
                          <td className="px-3 py-3 text-sm">
                            <input
                              type="checkbox"
                              aria-label="Select story"
                              disabled={busy}
                              checked={selectedIds.has(s.id)}
                              onChange={() => {
                                if (busy) return;
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(s.id)) next.delete(s.id);
                                  else next.add(s.id);
                                  return next;
                                });
                              }}
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 text-sm max-w-[420px] truncate" title={s.title}>{s.title}</td>
                        <td className="px-4 py-3 text-sm">{s.status || '—'}</td>
                        <td className="px-4 py-3 text-sm">{s.language || '—'}</td>
                        <td className="px-4 py-3 text-sm">{s.createdAt ? new Date(s.createdAt).toLocaleString() : '—'}</td>
                        <td className="px-4 py-3 text-sm">{s.approvalState || '—'}</td>
                        <td className="px-4 py-3 text-sm">
                          {canDelete ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => setDeleteTarget(s)}
                              className="text-xs px-3 py-2 rounded-md border text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              Delete Story
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

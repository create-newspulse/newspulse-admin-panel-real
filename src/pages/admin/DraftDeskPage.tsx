import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import {
  listArticles,
  deleteArticle,
  restoreArticle,
  hardDeleteArticle,
  Article as NPArticle,
} from '@/lib/api/articles';

// Extend with optional “community / pro / founder” hints
type Article = NPArticle & {
  source?: string;
  origin?: string;
  submittedBy?: string;
  isCommunity?: boolean;
  city?: string;
  location?: string;
  category?: string;
  content?: string;
};

function isCommunityDraft(a: Article): boolean {
  const src = (a.source || a.origin || a.submittedBy || '').toLowerCase();
  if (a.isCommunity) return true;
  if (src.includes('community')) return true;
  if (src.includes('reporter')) return true;
  if (src.includes('community-reporter')) return true;
  return false;
}

// Rough classification just for filtering / badges
function getSourceKind(
  a: Article,
): 'community' | 'editor' | 'pro' | 'founder' {
  const raw = (a.source || a.origin || a.submittedBy || '').toLowerCase();

  if (raw.includes('founder') || raw.includes('owner')) return 'founder';
  if (raw.includes('pro') || raw.includes('professional') || raw.includes('journalist')) {
    return 'pro';
  }
  if (isCommunityDraft(a)) return 'community';
  return 'editor';
}

function snippet(txt?: string, n = 150) {
  if (!txt) return '';
  const clean = String(txt).replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
}

export default function DraftDeskPage() {
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');

  // NEW: status + source filters
  const [statusFilter, setStatusFilter] = useState<'drafts' | 'deleted'>('drafts');
  const [sourceFilter, setSourceFilter] =
    useState<'all' | 'community' | 'editor' | 'pro' | 'founder'>('all');

  const [preview, setPreview] = useState<Article | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hardDeletingId, setHardDeletingId] = useState<string | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const navigate = useNavigate();

  // Load drafts OR deleted drafts whenever statusFilter changes
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const statusParam = statusFilter === 'deleted' ? 'deleted' : 'draft';
        const res = await listArticles({
          status: statusParam,
          page: 1,
          limit: 100,
          sort: '-createdAt',
        });
        if (!cancelled) {
          setItems(res.data as Article[]);
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(
            err?.response?.data?.message ||
              err?.message ||
              'Failed to load drafts',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  const filtered = useMemo(() => {
    let arr = items;

    // Apply source filter
    if (sourceFilter !== 'all') {
      arr = arr.filter((a) => getSourceKind(a) === sourceFilter);
    }

    // Apply search
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter((a) => (a.title || '').toLowerCase().includes(q));
    }

    return arr;
  }, [items, sourceFilter, query]);

  const handleDelete = async (id: string) => {
    const draft = items.find((a) => a._id === id);
    if (!draft) return;

    const ok = window.confirm(
      'Delete this draft? It will move to Deleted and disappear from Draft Desk.',
    );
    if (!ok) return;

    try {
      setDeletingId(id);
      // Reuse the same API as Manage News (soft delete = status "deleted")
      await deleteArticle(id);
      setItems((prev) => prev.filter((a) => a._id !== id));
      toast.success('Draft moved to Deleted');
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to delete draft',
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleRestore = async (id: string) => {
    const ok = window.confirm('Restore this draft back to All Drafts?');
    if (!ok) return;
    try {
      setRestoringId(id);
      await restoreArticle(id);
      // Remove from current Deleted view list
      setItems(prev => prev.filter(a => a._id !== id));
      toast.success('Draft restored');
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to restore draft',
      );
    } finally {
      setRestoringId(null);
    }
  };

  const handleHardDelete = async (id: string) => {
    const ok = window.confirm('Permanently delete this draft? This cannot be undone.');
    if (!ok) return;
    try {
      setHardDeletingId(id);
      await hardDeleteArticle(id);
      // Remove from current Deleted view list
      setItems(prev => prev.filter(a => a._id !== id));
      toast.success('Draft permanently deleted');
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to permanently delete draft',
      );
    } finally {
      setHardDeletingId(null);
    }
  };

  const handleEdit = (id: string) => {
    // Use the same route that Manage News "Edit" button uses
    navigate(`/admin/news/${id}/edit`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          📰 Draft Desk – All Draft Articles
        </h1>
        <div className="text-sm text-slate-600">
          All drafts from Community Reporter &amp; Editors in one place.
        </div>
      </div>

      {/* Search + filters */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search headline…"
            className="px-3 py-2 border rounded w-64"
          />
        </div>

        {/* NEW filter bar */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {/* Status: drafts vs deleted */}
          <div className="inline-flex rounded border border-slate-300 overflow-hidden">
            <button
              onClick={() => setStatusFilter('drafts')}
              className={`px-3 py-1 text-sm ${
                statusFilter === 'drafts'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700'
              }`}
            >
              All Drafts
            </button>
            <button
              onClick={() => setStatusFilter('deleted')}
              className={`px-3 py-1 text-sm border-l border-slate-300 ${
                statusFilter === 'deleted'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700'
              }`}
            >
              Deleted
            </button>
          </div>

          {/* Source filters */}
          <div className="inline-flex flex-wrap gap-2">
            <button
              onClick={() => setSourceFilter('community')}
              className={`px-3 py-1 rounded border text-sm ${
                sourceFilter === 'community'
                  ? 'bg-purple-700 text-white border-purple-700'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              Community drafts
            </button>

            <button
              onClick={() => setSourceFilter('editor')}
              className={`px-3 py-1 rounded border text-sm ${
                sourceFilter === 'editor'
                  ? 'bg-blue-700 text-white border-blue-700'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              Editor drafts
            </button>

            <button
              onClick={() => setSourceFilter('pro')}
              className={`px-3 py-1 rounded border text-sm ${
                sourceFilter === 'pro'
                  ? 'bg-amber-600 text-white border-amber-600'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              Professional Journalist
            </button>

            <button
              onClick={() => setSourceFilter('founder')}
              className={`px-3 py-1 rounded border text-sm ${
                sourceFilter === 'founder'
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-slate-700 border-slate-300'
              }`}
            >
              Founder
            </button>
          </div>
        </div>
      </div>

      {loading && <div>Loading…</div>}
      {!loading && filtered.length === 0 && (
        <div className="p-3 rounded border bg-amber-50 text-amber-800">
          No drafts match this filter. Try clearing search or switching filters.
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((a) => {
          const sourceKind = getSourceKind(a);
          const isCommunity = sourceKind === 'community';
          const isPro = sourceKind === 'pro';
          const isFounder = sourceKind === 'founder';

          return (
            <div
              key={a._id}
              className={`flex items-start justify-between gap-4 p-3 rounded border ${
                isCommunity ? 'bg-purple-50 border-purple-200' : 'bg-white'
              } hover:bg-slate-50`}
            >
              <div className="flex-1">
                <div className="text-xs mb-1 text-slate-600 flex flex-wrap gap-2 items-center">
                  {isCommunity && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                      🧑‍🤝‍🧑 Community Reporter
                    </span>
                  )}
                  {!isCommunity && isPro && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      🎙️ Professional Journalist
                    </span>
                  )}
                  {!isCommunity && !isPro && isFounder && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ⭐ Founder Draft
                    </span>
                  )}
                  {!isCommunity && !isPro && !isFounder && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                      ✍️ Editor Draft
                    </span>
                  )}

                  {a.city || a.location ? <span>· {a.city || a.location}</span> : null}
                  {a.language ? <span>· {a.language?.toUpperCase()}</span> : null}
                  {a.category ? <span>· {a.category}</span> : null}
                  {a.createdAt ? (
                    <span>· {new Date(a.createdAt).toLocaleString()}</span>
                  ) : null}
                  {a.status ? <span>· status: {a.status}</span> : null}
                </div>

                <div className="font-semibold">{a.title || 'Untitled'}</div>
                <div className="text-sm text-slate-600 mt-1">
                  {snippet(
                    a.content ||
                      (a as any).body ||
                      a.summary ||
                      (a as any).description,
                    160,
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 items-stretch w-[150px]">
                <button
                  type="button"
                  className="px-3 py-1 rounded border text-center bg-white hover:bg-slate-100"
                  onClick={() => setPreview(a)}
                >
                  View story
                </button>

                {/* Actions for All Drafts */}
                {statusFilter === 'drafts' && a.status === 'draft' && (
                  <>
                    <button
                      type="button"
                      className="px-3 py-1 rounded border text-center bg-blue-600 text-white hover:bg-blue-700"
                      onClick={() => handleEdit(a._id)}
                    >
                      Edit draft
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 rounded border text-center bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
                      disabled={deletingId === a._id}
                      onClick={() => handleDelete(a._id)}
                    >
                      {deletingId === a._id ? 'Deleting…' : 'Delete draft'}
                    </button>
                  </>
                )}

                {/* Actions for Deleted view: show regardless of exact status string */}
                {statusFilter === 'deleted' && (
                  <>
                    <button
                      type="button"
                      className="px-3 py-1 rounded border text-center bg-white hover:bg-slate-100 disabled:opacity-60"
                      disabled={restoringId === a._id}
                      onClick={() => handleRestore(a._id)}
                    >
                      {restoringId === a._id ? 'Restoring…' : 'Restore'}
                    </button>
                    <button
                      type="button"
                      className="px-3 py-1 rounded border text-center bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                      disabled={hardDeletingId === a._id}
                      onClick={() => handleHardDelete(a._id)}
                    >
                      {hardDeletingId === a._id ? 'Deleting…' : 'Delete Permanent'}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPreview(null)}
          ></div>
          <div className="relative bg-white max-w-3xl w-[92vw] max-h-[90vh] overflow-auto rounded shadow-xl p-4">
            <div className="flex items-start justify-between gap-4 mb-2">
              <h2 className="text-xl font-bold">{preview.title || 'Untitled'}</h2>
              <button
                type="button"
                className="px-3 py-1 rounded bg-slate-700 text-white"
                onClick={() => setPreview(null)}
              >
                Close
              </button>
            </div>
            <div className="text-xs mb-3 text-slate-600 flex flex-wrap gap-2 items-center">
              {(() => {
                const sourceKind = getSourceKind(preview as Article);
                if (sourceKind === 'community') {
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                      🧑‍🤝‍🧑 Community Reporter
                    </span>
                  );
                }
                if (sourceKind === 'pro') {
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                      🎙️ Professional Journalist
                    </span>
                  );
                }
                if (sourceKind === 'founder') {
                  return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      ⭐ Founder Draft
                    </span>
                  );
                }
                return (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                    ✍️ Editor Draft
                  </span>
                );
              })()}

              {preview.language ? (
                <span>· {preview.language?.toUpperCase()}</span>
              ) : null}
              {preview.category ? <span>· {preview.category}</span> : null}
              {preview.city || preview.location ? (
                <span>· {preview.city || preview.location}</span>
              ) : null}
              {preview.createdAt ? (
                <span>· {new Date(preview.createdAt).toLocaleString()}</span>
              ) : null}
              {preview.status ? <span>· status: {preview.status}</span> : null}
            </div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {String(
                preview.content ||
                  (preview as any).body ||
                  preview.summary ||
                  (preview as any).description ||
                  '',
              ).trim() || '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

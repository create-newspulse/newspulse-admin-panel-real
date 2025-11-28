import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import {
  listArticles,
  deleteArticle,
  Article as NPArticle,
} from '@/lib/api/articles';

// Extend with optional “community” hints
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

function snippet(txt?: string, n = 150) {
  if (!txt) return '';
  const clean = String(txt).replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1) + '…' : clean;
}

export default function DraftDeskPage() {
  const [items, setItems] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'community' | 'editor'>('all');
  const [preview, setPreview] = useState<Article | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const navigate = useNavigate();

  // Load all drafts once
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await listArticles({
          status: 'draft',
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
            err?.response?.data?.message || err?.message || 'Failed to load drafts',
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
  }, []);

  const filtered = useMemo(() => {
    let arr = items;

    if (filter === 'community') arr = arr.filter(isCommunityDraft);
    if (filter === 'editor') arr = arr.filter((a) => !isCommunityDraft(a));

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      arr = arr.filter((a) => (a.title || '').toLowerCase().includes(q));
    }

    return arr;
  }, [items, filter, query]);

  const handleDelete = async (id: string) => {
    const draft = items.find((a) => a._id === id);
    if (!draft) return;

    const ok = window.confirm(
      'Delete this draft? It will move to Deleted and disappear from Draft Desk.',
    );
    if (!ok) return;

    try {
      setDeletingId(id);
      // IMPORTANT: reuse the same API as Manage News
      await deleteArticle(id);
      setItems((prev) => prev.filter((a) => a._id !== id));
      toast.success('Draft moved to Deleted');
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || err?.message || 'Failed to delete draft',
      );
    } finally {
      setDeletingId(null);
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

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search headline…"
          className="px-3 py-2 border rounded w-64"
        />
        <div className="ml-2 flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded border text-sm ${
              filter === 'all'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('community')}
            className={`px-3 py-1 rounded border text-sm ${
              filter === 'community'
                ? 'bg-purple-700 text-white border-purple-700'
                : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            Community drafts
          </button>
          <button
            onClick={() => setFilter('editor')}
            className={`px-3 py-1 rounded border text-sm ${
              filter === 'editor'
                ? 'bg-blue-700 text-white border-blue-700'
                : 'bg-white text-slate-700 border-slate-300'
            }`}
          >
            Editor drafts
          </button>
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
          const community = isCommunityDraft(a);
          return (
            <div
              key={a._id}
              className={`flex items-start justify-between gap-4 p-3 rounded border ${
                community ? 'bg-purple-50 border-purple-200' : 'bg-white'
              } hover:bg-slate-50`}
            >
              <div className="flex-1">
                <div className="text-xs mb-1 text-slate-600 flex flex-wrap gap-2 items-center">
                  {community ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                      🧑‍🤝‍🧑 Community Reporter
                    </span>
                  ) : (
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
                </div>
                <div className="font-semibold">{a.title || 'Untitled'}</div>
                <div className="text-sm text-slate-600 mt-1">
                  {snippet(
                    a.content || (a as any).body || a.summary || (a as any).description,
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

                {a.status === 'draft' && (
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
              {isCommunityDraft(preview) ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                  🧑‍🤝‍🧑 Community Reporter
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                  ✍️ Editor Draft
                </span>
              )}
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

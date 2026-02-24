import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';

import { FiltersDrawer } from '@/components/news/FiltersDrawer';
import {
  deleteArticle,
  getArticle,
  updateArticleStatus,
  updateArticlePartial,
  type Article,
} from '@/lib/api/articles';

type DraftPatch = Partial<Pick<Article,
  | 'title'
  | 'summary'
  | 'content'
  | 'category'
  | 'tags'
  | 'language'
  | 'imageUrl'
  | 'coverImage'
  | 'coverImageUrl'
>>;

function normalizeImageUrl(a?: Article): string {
  const cover: any = (a as any)?.coverImage;
  if (cover && typeof cover === 'object') {
    const u = cover.url || cover.secureUrl || cover.secure_url || '';
    return String(u || '').trim();
  }
  return String((cover as any) || a?.imageUrl || a?.coverImageUrl || '').trim();
}

function toTagString(tags?: string[]): string {
  if (!Array.isArray(tags)) return '';
  return tags.filter(Boolean).join(', ');
}

function parseTagString(s: string): string[] {
  return s
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function DraftWorkspacePage() {
  const { id } = useParams();
  const draftId = String(id || '').trim();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const mode = String(searchParams.get('mode') || '').toLowerCase();
  const drawerOpen = mode === 'edit';

  const [loading, setLoading] = useState(false);
  const [article, setArticle] = useState<Article | null>(null);

  const [form, setForm] = useState<{
    title: string;
    summary: string;
    content: string;
    category: string;
    tags: string;
    language: string;
    image: string;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const lastSentRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!draftId) return;
      setLoading(true);
      try {
        const a = await getArticle(draftId);
        if (cancelled) return;
        setArticle(a);
        setForm({
          title: a.title || '',
          summary: a.summary || '',
          content: a.content || '',
          category: a.category || '',
          tags: toTagString(a.tags),
          language: a.language || '',
          image: normalizeImageUrl(a),
        });
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load draft');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  const sanitizedHtml = useMemo(() => {
    const raw = String(article?.content || '').trim();
    if (!raw) return '';
    return DOMPurify.sanitize(raw);
  }, [article?.content]);

  const scheduleSave = (patch: DraftPatch) => {
    if (!draftId) return;

    const signature = JSON.stringify(patch);
    if (signature === lastSentRef.current) return;

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    saveTimerRef.current = window.setTimeout(async () => {
      try {
        setSaving(true);
        lastSentRef.current = signature;
        const updated = await updateArticlePartial(draftId, patch);
        setArticle(updated);
        setLastSavedAt(Date.now());
      } catch (e: any) {
        // Allow further saves after a failure
        lastSentRef.current = '';
        toast.error(e?.message || 'Autosave failed');
      } finally {
        setSaving(false);
      }
    }, 600);
  };

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  const setMode = (next: 'view' | 'edit') => {
    const sp = new URLSearchParams(searchParams);
    if (next === 'edit') sp.set('mode', 'edit');
    else sp.delete('mode');
    setSearchParams(sp, { replace: true });
  };

  const onChange = (key: keyof NonNullable<typeof form>, value: string) => {
    if (!form) return;
    const next = { ...form, [key]: value };
    setForm(next);

    const patch: DraftPatch = {};
    if (key === 'title') patch.title = value;
    if (key === 'summary') patch.summary = value;
    if (key === 'content') patch.content = value;
    if (key === 'category') patch.category = value;
    if (key === 'tags') patch.tags = parseTagString(value);
    if (key === 'language') patch.language = value;
    if (key === 'image') {
      const v = value.trim();
      patch.imageUrl = v || undefined;
      patch.coverImageUrl = v || undefined;
      patch.coverImage = v ? ({ url: v } as any) : undefined;
    }

    scheduleSave(patch);
  };

  const submitToManageNews = async () => {
    if (!draftId) return;
    const ok = window.confirm('Submit this draft to Manage News for review?');
    if (!ok) return;
    try {
      setSaving(true);
      // Existing workflow convention used by Draft Desk in this repo
      await updateArticleStatus(draftId, 'review' as any);
      toast.success('Submitted to Manage News');
      navigate(`/admin/articles?qv=draft&highlight=${encodeURIComponent(draftId)}`);
    } catch (e: any) {
      toast.error(e?.message || 'Submit failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteDraft = async () => {
    if (!draftId) return;
    const ok = window.confirm('Delete this draft? It will move to Deleted.');
    if (!ok) return;
    try {
      setSaving(true);
      await deleteArticle(draftId);
      toast.success('Draft moved to Deleted');
      navigate('/draft-desk');
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  if (!draftId) {
    return (
      <div className="p-3 rounded border bg-amber-50 text-amber-800">
        Missing draft id.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-slate-600">
            <Link to="/draft-desk" className="hover:underline">Draft Desk</Link>
            <span className="px-2">/</span>
            <span className="text-slate-800">Draft Workspace</span>
          </div>
          <h1 className="text-2xl font-bold truncate">
            {article?.title || (loading ? 'Loading…' : 'Untitled draft')}
          </h1>
          <div className="text-xs text-slate-600 flex flex-wrap gap-2 items-center">
            {article?.language ? <span>· {article.language.toUpperCase()}</span> : null}
            {article?.category ? <span>· {article.category}</span> : null}
            {article?.updatedAt ? <span>· Updated {new Date(article.updatedAt).toLocaleString()}</span> : null}
            {article?.status ? <span>· status: {String(article.status)}</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="px-3 py-2 text-sm rounded-md border bg-white hover:bg-slate-50"
            onClick={() => setMode('edit')}
          >
            Edit draft
          </button>
          <button
            type="button"
            className="px-3 py-2 text-sm rounded-md border bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            disabled={saving || loading}
            onClick={submitToManageNews}
          >
            Submit to Manage News
          </button>
          <button
            type="button"
            className="px-3 py-2 text-sm rounded-md border bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
            disabled={saving || loading}
            onClick={deleteDraft}
          >
            Delete draft
          </button>
        </div>
      </div>

      {loading ? <div>Loading…</div> : null}

      {!loading && !article ? (
        <div className="p-3 rounded border bg-amber-50 text-amber-800">
          Draft not found or you don’t have access.
        </div>
      ) : null}

      {article ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_0px] gap-6">
          <article className="rounded border bg-white p-4">
            {normalizeImageUrl(article) ? (
              <img
                src={normalizeImageUrl(article)}
                alt=""
                className="w-full max-h-[360px] object-cover rounded border mb-4"
              />
            ) : null}

            {article.summary ? (
              <div className="text-slate-700 text-base mb-4 whitespace-pre-wrap">{article.summary}</div>
            ) : null}

            {sanitizedHtml ? (
              <div
                className="text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            ) : (
              <div className="text-sm text-slate-500">No content yet.</div>
            )}
          </article>
        </div>
      ) : null}

      <FiltersDrawer
        open={drawerOpen}
        title={
          saving
            ? 'Editing (saving…)'
            : lastSavedAt
              ? `Editing (saved ${new Date(lastSavedAt).toLocaleTimeString()})`
              : 'Edit draft'
        }
        onClose={() => setMode('view')}
      >
        {!form ? (
          <div className="text-sm text-slate-600">Loading editor…</div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Title</label>
              <input
                value={form.title}
                onChange={(e) => onChange('title', e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded text-sm"
                placeholder="Headline"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Summary</label>
              <textarea
                value={form.summary}
                onChange={(e) => onChange('summary', e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded text-sm min-h-[90px]"
                placeholder="Short summary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Content</label>
              <textarea
                value={form.content}
                onChange={(e) => onChange('content', e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded text-sm min-h-[180px]"
                placeholder="Story content (HTML supported)"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Category</label>
                <input
                  value={form.category}
                  onChange={(e) => onChange('category', e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded text-sm"
                  placeholder="Category"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Language</label>
                <input
                  value={form.language}
                  onChange={(e) => onChange('language', e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded text-sm"
                  placeholder="en / hi / ..."
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Tags</label>
              <input
                value={form.tags}
                onChange={(e) => onChange('tags', e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded text-sm"
                placeholder="comma,separated,tags"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Image</label>
              <input
                value={form.image}
                onChange={(e) => onChange('image', e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded text-sm"
                placeholder="https://..."
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-md border bg-white hover:bg-slate-50"
                onClick={() => setMode('view')}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </FiltersDrawer>
    </div>
  );
}

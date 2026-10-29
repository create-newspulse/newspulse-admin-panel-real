import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import DOMPurify from 'dompurify';

import { FiltersDrawer } from '@/components/news/FiltersDrawer';
import {
  deleteArticle,
  getArticle,
  getOwnDraft,
  publishArticle,
  updateArticle,
  type Article,
  type OwnDraftDetail,
} from '@/lib/api/articles';
import { articleCmsId, articleFollowUpWarning, normalizeArticleError } from '@/lib/articleLifecycle';
import { useEditorialAccess } from '@/hooks/useEditorialAccess';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { usePublishFlag } from '@/context/PublishFlagContext';

type DraftPatch = Partial<Pick<Article,
  | 'title'
  | 'summary'
  | 'content'
  | 'category'
  | 'tags'
  | 'coverImageUrl'
>>;
type WorkspaceArticle = Article | OwnDraftDetail;
type PublicationPhase = 'idle' | 'saving' | 'publishing' | 'unconfirmed' | 'published';

function normalizeImageUrl(a?: WorkspaceArticle): string {
  const cover = a?.coverImage;
  if (cover && typeof cover === 'object') {
    return String(cover.url || '').trim();
  }
  return String(cover || a?.coverImageUrl || (a && 'imageUrl' in a ? a.imageUrl : '') || '').trim();
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
  const access = useEditorialAccess();
  if (access.loading) return <div>Checking Draft Workspace access...</div>;
  if (!access.canManageNews && !access.canReadOwnDrafts) {
    return <div role="alert" className="rounded border p-4 text-red-700">{access.reason}</div>;
  }
  return <DraftWorkspace key={`${draftId}:${access.canManageNews}`} draftId={draftId}
    restricted={!access.canManageNews} canPublish={access.canPublish} />;
}

function DraftWorkspace({ draftId, restricted, canPublish }: { draftId: string; restricted: boolean; canPublish: boolean }) {
  const navigate = useNavigate();
  const { publishEnabled } = usePublishFlag();
  const [searchParams, setSearchParams] = useSearchParams();

  const mode = String(searchParams.get('mode') || '').toLowerCase();
  const drawerOpen = mode === 'edit';

  const [loading, setLoading] = useState(false);
  const [article, setArticle] = useState<WorkspaceArticle | null>(null);
  const [loadError, setLoadError] = useState<ReturnType<typeof normalizeArticleError> | null>(null);
  const [loadVersion, setLoadVersion] = useState(0);

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
  const [dirty, setDirty] = useState(false);
  const [saveError, setSaveError] = useState<ReturnType<typeof normalizeArticleError> | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [publicationPhase, setPublicationPhaseState] = useState<PublicationPhase>('idle');
  const [deleted, setDeleted] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const pendingPatch = useRef<DraftPatch>({});
  const activeSave = useRef<Promise<boolean> | null>(null);
  const inFlight = useRef(false);
  const paused = useRef(false);
  const mounted = useRef(true);
  const publicationPhaseRef = useRef<PublicationPhase>('idle');
  const refreshInFlight = useRef(false);
  const publishAccess = useRef({ canPublish, publishEnabled });
  publishAccess.current = { canPublish, publishEnabled };
  const published = publicationPhase === 'published';
  const publicationPending = publicationPhase === 'saving' || publicationPhase === 'publishing';
  const editingLocked = publicationPhase !== 'idle';
  useUnsavedChanges(dirty, saving || publicationPending);

  function setPublicationPhase(phase: PublicationPhase) {
    // Close callback races before React renders the disabled controls.
    publicationPhaseRef.current = phase;
    if (mounted.current) setPublicationPhaseState(phase);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!draftId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const a = await (restricted ? getOwnDraft(draftId) : getArticle(draftId));
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
      } catch (error: unknown) {
        if (!cancelled) setLoadError(normalizeArticleError(error, 'Failed to load draft'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [draftId, restricted, loadVersion]);

  const sanitizedHtml = useMemo(() => {
    const raw = String(article?.content || '').trim();
    if (!raw) return '';
    return DOMPurify.sanitize(raw);
  }, [article?.content]);

  const armSave = () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    if (paused.current || publicationPhaseRef.current !== 'idle') return;
    saveTimerRef.current = window.setTimeout(() => { void flushPending(); }, 600);
  };

  function flushPending(): Promise<boolean> {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    if (activeSave.current) return activeSave.current;
    if (inFlight.current || paused.current) return Promise.resolve(false);
    const patch = pendingPatch.current;
    if (!Object.keys(patch).length) return Promise.resolve(true);
    pendingPatch.current = {};
    inFlight.current = true;
    setSaving(true);
    activeSave.current = Promise.resolve().then(async () => {
      try {
        const result = await updateArticle(draftId, patch);
        if (!mounted.current) return false;
        // Only locally edited fields are applied; a restricted DTO is never promoted to a full editor DTO.
        setArticle((previous) => previous ? { ...previous, ...patch } : previous);
        setLastSavedAt(Date.now());
        setSaveError(null);
        const followUp = articleFollowUpWarning(result);
        setWarning(followUp);
        if (followUp) {
          paused.current = true;
          setRecoveryReady(false);
        }
        setDirty(Object.keys(pendingPatch.current).length > 0);
        return true;
      } catch (error: unknown) {
        if (!mounted.current) return false;
        pendingPatch.current = { ...patch, ...pendingPatch.current };
        paused.current = true;
        setRecoveryReady(false);
        setDirty(true);
        setSaveError(normalizeArticleError(error, 'Autosave failed'));
        return false;
      } finally {
        activeSave.current = null;
        inFlight.current = false;
        if (mounted.current) {
          setSaving(false);
          if (Object.keys(pendingPatch.current).length && !paused.current) armSave();
        }
      }
    });
    return activeSave.current;
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (deleted && !saving && !dirty) navigate('/draft-desk');
  }, [deleted, saving, dirty, navigate]);

  async function refreshLatest() {
    if (!mounted.current || refreshInFlight.current || inFlight.current
      || publicationPhaseRef.current === 'saving' || publicationPhaseRef.current === 'publishing') return;
    refreshInFlight.current = true;
    setRefreshing(true);
    setRecoveryReady(false);
    try {
      const latest = await (restricted ? getOwnDraft(draftId) : getArticle(draftId));
      if (!mounted.current) return;
      setArticle(latest);
      if (publicationPhaseRef.current === 'unconfirmed') {
        if (latest.status === 'published') {
          setPublicationPhase('published');
          setSaveError(null);
          return;
        }
        if (latest.status !== 'draft') {
          toast.error('This story is no longer a draft. Review its latest status before continuing.');
          return;
        }
      }
      setRecoveryReady(true);
    } catch (error: unknown) {
      if (mounted.current) toast.error(normalizeArticleError(error, 'Could not refresh the draft; your edits are still here').message);
    } finally {
      refreshInFlight.current = false;
      if (mounted.current) setRefreshing(false);
    }
  }

  function resumeSaving() {
    if (!recoveryReady || refreshInFlight.current || inFlight.current
      || publicationPhaseRef.current === 'saving' || publicationPhaseRef.current === 'publishing'
      || publicationPhaseRef.current === 'published') return;
    setPublicationPhase('idle');
    paused.current = false;
    setSaveError(null);
    setWarning(null);
    setRecoveryReady(false);
    void flushPending();
  }

  const canLeaveEditor = () => {
    if (publicationPhaseRef.current === 'saving' || publicationPhaseRef.current === 'publishing') {
      toast.error('Wait for publication to finish before leaving the editor.');
      return false;
    }
    return true;
  };

  const setMode = (next: 'view' | 'edit') => {
    if (!canLeaveEditor()) return;
    const sp = new URLSearchParams(searchParams);
    if (next === 'edit') sp.set('mode', 'edit');
    else sp.delete('mode');
    setSearchParams(sp, { replace: true });
  };

  const onChange = (key: Exclude<keyof NonNullable<typeof form>, 'language'>, value: string) => {
    if (!form) return;
    if (publicationPhaseRef.current !== 'idle') {
      toast.error('Editing is locked for publication. No changes were applied.');
      return;
    }
    setForm((previous) => previous ? { ...previous, [key]: value } : previous);

    const patch: DraftPatch = {};
    if (key === 'title') patch.title = value;
    if (key === 'summary') patch.summary = value;
    if (key === 'content') patch.content = value;
    if (key === 'category') patch.category = value;
    if (key === 'tags') patch.tags = parseTagString(value);
    if (key === 'image') patch.coverImageUrl = value.trim();

    pendingPatch.current = { ...pendingPatch.current, ...patch };
    setDirty(true);
    armSave();
  };

  const publishDraft = async () => {
    if (!article || loading || deleted || !publishAccess.current.canPublish || !publishAccess.current.publishEnabled
      || publicationPhaseRef.current !== 'idle' || paused.current || refreshInFlight.current
      || (inFlight.current && !activeSave.current)) return;
    const hadEdits = !!activeSave.current || Object.keys(pendingPatch.current).length > 0;
    setPublicationPhase('saving');
    let attempted = false;
    try {
      do {
        if (!await flushPending() || !mounted.current || paused.current) return;
      } while (Object.keys(pendingPatch.current).length > 0);
      if (!publishAccess.current.canPublish || !publishAccess.current.publishEnabled) {
        toast.error('Publishing access changed. Publication was not attempted.');
        return;
      }
      if (!window.confirm('Publish this story? The Backend will verify every language edition and your effective Publish News right.')) return;
      const cmsId = articleCmsId(article);
      setPublicationPhase('publishing');
      inFlight.current = true;
      attempted = true;
      const result = await publishArticle(cmsId);
      if (!mounted.current) return;
      setPublicationPhase('published');
      paused.current = true;
      setWarning(articleFollowUpWarning(result));
      toast.success('Story published');
    } catch (error: unknown) {
      if (!mounted.current) return;
      if (attempted) setPublicationPhase('unconfirmed');
      paused.current = true;
      setRecoveryReady(false);
      const failure = normalizeArticleError(error, 'Publication failed');
      setSaveError({ ...failure, message: `${hadEdits && attempted ? 'Draft changes were saved. ' : ''}Publication was not ${attempted ? 'confirmed' : 'attempted'}. ${failure.message}` });
    } finally {
      inFlight.current = false;
      if (!attempted) setPublicationPhase('idle');
    }
  };

  const deleteDraft = async () => {
    if (!draftId || restricted || inFlight.current
      || (publicationPhaseRef.current !== 'idle' && publicationPhaseRef.current !== 'published')) return;
    const ok = window.confirm(`Delete this draft? It will move to Deleted.${dirty ? ' Unsaved edits will be discarded.' : ''}`);
    if (!ok) return;
    inFlight.current = true;
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    try {
      setSaving(true);
      const result = await deleteArticle(draftId);
      pendingPatch.current = {};
      setDirty(false);
      setDeleted(true);
      toast.success('Draft moved to Deleted');
      const followUp = articleFollowUpWarning(result);
      if (followUp) toast(followUp);
    } catch (error: unknown) {
      paused.current = true;
      setSaveError(normalizeArticleError(error, 'Delete failed'));
    } finally {
      inFlight.current = false;
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
            {article?.status ? <span>· status: {published ? 'published' : String(article.status)}</span> : null}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="px-3 py-2 text-sm rounded-md border bg-white hover:bg-slate-50"
            disabled={!article || loading || editingLocked}
            onClick={() => setMode('edit')}
          >
            Edit draft
          </button>
          {!restricted && <button
            type="button"
            className="px-3 py-2 text-sm rounded-md border bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            disabled={saving || loading || publicationPending}
            onClick={() => { if (canLeaveEditor()) navigate(`/admin/articles?qv=draft&highlight=${encodeURIComponent(draftId)}`); }}
          >
            Open in Manage News
          </button>}
          {canPublish && !published && <button type="button" className="rounded-md border bg-emerald-600 px-3 py-2 text-sm text-white disabled:opacity-60"
            disabled={!article || loading || editingLocked || (saving && !activeSave.current) || refreshing || !publishEnabled || !!saveError || !!warning}
            onClick={() => void publishDraft()}>{publicationPhase === 'saving' ? 'Saving before publishing...' : publicationPhase === 'publishing' ? 'Publishing...' : 'Publish'}</button>}
          {!restricted && <button
            type="button"
            className="px-3 py-2 text-sm rounded-md border bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-60"
            disabled={!article || saving || loading || (editingLocked && !published)}
            onClick={deleteDraft}
          >
            Delete draft
          </button>}
        </div>
      </div>

      {loading ? <div>Loading…</div> : null}
      {restricted && <p className="text-sm text-slate-600">Own-draft workspace. Only changed fields are saved; other editions and omitted metadata are not loaded or replaced.</p>}
      {publicationPending && <div role="status" className="rounded border p-3 text-slate-700">
        {publicationPhase === 'saving' ? 'Saving changes before publishing...' : 'Publishing story...'} Editing is locked until publication is resolved.
      </div>}
      {published && <div role="status" className="rounded border p-3 text-emerald-700">Publication committed. This story is no longer an own draft. Do not publish it again.</div>}
      {(saveError || warning) && <div role="alert" className="rounded border border-amber-300 p-3 text-amber-900">
        <div>{saveError?.message || warning}</div>
        <p>{publicationPhase === 'unconfirmed'
          ? 'Editing is locked until the latest state is verified. Publication will not be retried automatically.'
          : 'Unsaved edits remain in this workspace. Automatic retries are paused.'}</p>
        {!published && <button type="button" className="mt-2 underline" disabled={saving || refreshing || publicationPending} onClick={() => void refreshLatest()}>
          {refreshing ? 'Refreshing...' : 'Refresh latest state without discarding edits'}
        </button>}
        {!published && recoveryReady && <button type="button" className="ml-3 underline" disabled={saving || refreshing || publicationPending}
          onClick={resumeSaving}>Resume saving unsaved changes</button>}
      </div>}
      {!saveError && !warning && dirty && <div role="status">Unsaved changes{saving ? ' - saving...' : ''}</div>}

      {!loading && loadError ? (
        <div role="alert" className="p-3 rounded border bg-amber-50 text-amber-800">
          {loadError.status === 404 ? 'This draft is not available in your workspace.' : loadError.message}
          {loadError.status !== 403 && <button type="button" className="ml-3 underline" onClick={() => setLoadVersion((value) => value + 1)}>Retry loading draft</button>}
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
          publicationPending
            ? publicationPhase === 'saving' ? 'Saving before publishing...' : 'Publishing...'
            : saving
            ? 'Editing (saving…)'
            : dirty
              ? 'Editing (unsaved changes)'
              : lastSavedAt
              ? `Editing (saved ${new Date(lastSavedAt).toLocaleTimeString()})`
              : 'Edit draft'
        }
        onClose={() => setMode('view')}
      >
        {!form ? (
          <div className="text-sm text-slate-600">Loading editor…</div>
        ) : (
          <fieldset className="space-y-3" disabled={editingLocked}>
            <div>
              <label className="text-xs font-medium text-slate-600">Title</label>
              <input
                aria-label="Title"
                value={form.title}
                onChange={(e) => onChange('title', e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded text-sm"
                placeholder="Headline"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Summary</label>
              <textarea
                aria-label="Summary"
                value={form.summary}
                onChange={(e) => onChange('summary', e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded text-sm min-h-[90px]"
                placeholder="Short summary"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Content</label>
              <textarea
                aria-label="Content"
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
                  aria-label="Category"
                  value={form.category}
                  onChange={(e) => onChange('category', e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded text-sm"
                  placeholder="Category"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Language</label>
                <input
                  aria-label="Language"
                  readOnly
                  value={form.language}
                  className="mt-1 w-full px-3 py-2 border rounded text-sm"
                  placeholder="en / hi / ..."
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Tags</label>
              <input
                aria-label="Tags"
                value={form.tags}
                onChange={(e) => onChange('tags', e.target.value)}
                className="mt-1 w-full px-3 py-2 border rounded text-sm"
                placeholder="comma,separated,tags"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-600">Image</label>
              <input
                aria-label="Image"
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
          </fieldset>
        )}
      </FiltersDrawer>
    </div>
  );
}

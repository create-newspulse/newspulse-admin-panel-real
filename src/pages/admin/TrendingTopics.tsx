import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Switch from '@/components/settings/Switch';
import ConfirmModal from '@/components/ui/ConfirmModal';
import Denied from '@/pages/Denied';
import { getArticle, listArticles, type Article } from '@/lib/api/articles';
import {
  createTopic, getTopic, listTopics, topicErrorMessage, updateTopic,
  type EditorialTopic, type EditorialTopicListResponse, type LocalizedText,
} from '@/lib/api/trendingTopics';
import { normalizeError } from '@/lib/error';

const LANGUAGES = [
  { code: 'gu', label: 'Gujarati' },
  { code: 'hi', label: 'Hindi' },
  { code: 'en', label: 'English' },
] as const;
const inputClass = 'mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const buttonClass = 'rounded border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700';
const errorClass = 'rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800';
const isNewsId = (id: string) => /^[a-f\d]{24}$/i.test(id);
const emptyText = (): LocalizedText => ({ gu: '', hi: '', en: '' });
const trimText = (text: LocalizedText): LocalizedText => ({ gu: text.gu.trim(), hi: text.hi.trim(), en: text.en.trim() });

type TopicForm = {
  name: LocalizedText;
  description: LocalizedText;
  slug: string;
  articleTags: string;
  pinnedArticleId: string | null;
  startsAt: string;
  expiresAt: string;
  active: boolean;
  order: string;
};

function localDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function submittedDate(value: string, original?: string | null): Date {
  // Preserve saved seconds/milliseconds when an existing minute-level input is unchanged.
  return new Date(original && localDateTime(original) === value ? original : value);
}

function newForm(topic?: EditorialTopic): TopicForm {
  return {
    name: topic ? { ...topic.name } : emptyText(),
    description: topic ? { ...topic.description } : emptyText(),
    slug: topic?.slug ?? '',
    articleTags: topic?.articleTags.join('\n') ?? '',
    pinnedArticleId: topic?.pinnedArticleId ?? null,
    startsAt: topic ? localDateTime(topic.startsAt) : '',
    expiresAt: topic?.expiresAt ? localDateTime(topic.expiresAt) : '',
    active: topic?.active ?? false,
    order: String(topic?.order ?? 0),
  };
}

function topicState(topic: EditorialTopic, now: number): string {
  if (!topic.active) return 'Inactive';
  if (Date.parse(topic.startsAt) > now) return 'Scheduled';
  if (topic.expiresAt && Date.parse(topic.expiresAt) <= now) return 'Expired';
  return 'Eligible for Trending Strip';
}

function PinnedStoryPicker({ value, onChange, disabled }: {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState<Article | null>(null);
  const [pinError, setPinError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setSelected(null);
    setPinError('');
    if (value) {
      getArticle(value).then((article) => {
        if (!isNewsId(article._id) || article._id !== value) throw new Error('Invalid CMS News reference');
        if (!cancelled) setSelected(article);
      }).catch(() => {
        if (!cancelled) setPinError('The saved CMS News reference could not be loaded. Keep it for backend validation or clear the pin.');
      });
    }
    return () => { cancelled = true; };
  }, [value]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setArticles([]);
    const timer = window.setTimeout(() => {
      listArticles({ q: search.trim() || undefined, status: 'published', page, limit: 20, sort: '-publishedAt' })
        .then((result) => {
          if (cancelled) return;
          setArticles(result.rows.filter((article) => isNewsId(article._id) && article.status === 'published'));
          setPages(result.pages);
        }).catch((failure: unknown) => {
          if (!cancelled) setError(normalizeError(failure, 'Published CMS News stories could not be loaded. Please retry.').message);
        }).finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [open, search, page, attempt]);

  return (
    <section className="space-y-2 rounded border border-slate-200 p-3" aria-label="Pinned Story">
      <div className="font-medium">Pinned Story <span className="text-sm font-normal">(optional)</span></div>
      {value ? (
        <div className="space-y-1 text-sm">
          <div>{selected ? `${selected.title} | ${selected.language || selected.lang || 'Language unavailable'} | ${selected.status || 'Status unavailable'}` : 'CMS News reference'}</div>
          <div className="break-all font-mono">{value}</div>
          {selected && selected.status !== 'published' && <p role="alert">This story is no longer published. Clear or replace the pin before saving.</p>}
          <button type="button" className={buttonClass} disabled={disabled} onClick={() => onChange(null)}>Clear pinned story</button>
        </div>
      ) : <p className="text-sm text-slate-500">No pinned story</p>}
      {pinError && <p role="alert" className="text-sm text-amber-800">{pinError}</p>}
      <button type="button" className={buttonClass} disabled={disabled} onClick={() => setOpen(!open)}>{open ? 'Close story search' : 'Choose pinned story'}</button>
      {open && (
        <div className="space-y-2">
          <label className="block text-sm">Search published stories
            <input className={inputClass} value={search} disabled={disabled} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search title or slug" />
          </label>
          {loading && <p role="status">Loading published stories...</p>}
          {error && <div role="alert" className={errorClass}>{error} <button type="button" className={buttonClass} onClick={() => setAttempt(attempt + 1)}>Retry story search</button></div>}
          {!loading && !error && (
            <>
              <label className="block text-sm">Published CMS News story
                <select className={inputClass} value="" disabled={disabled} onChange={(event) => {
                  const article = articles.find((item) => item._id === event.target.value);
                  if (article) { onChange(article._id); setOpen(false); }
                }}>
                  <option value="">Select a story</option>
                  {articles.map((article) => <option key={article._id} value={article._id}>{article.title} | {article.language || article.lang || 'Language unavailable'} | {article.status} | {article._id}</option>)}
                </select>
              </label>
              {!articles.length && <p>No published stories found on this page.</p>}
              <div className="flex items-center gap-2">
                <button type="button" className={buttonClass} disabled={disabled || page <= 1} onClick={() => setPage(page - 1)}>Previous stories</button>
                <span className="text-sm">Page {page} of {Math.max(1, pages)}</span>
                <button type="button" className={buttonClass} disabled={disabled || page >= pages} onClick={() => setPage(page + 1)}>Next stories</button>
              </div>
            </>
          )}
        </div>
      )}
      <p className="text-xs text-slate-500">Only CMS News IDs are selected here. The backend checks public eligibility and matching article tags. Selecting a story never edits it.</p>
    </section>
  );
}

function TopicEditor({ id, onCancel, onSaved }: {
  id: string | null;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [topic, setTopic] = useState<EditorialTopic | null>(null);
  const [form, setForm] = useState<TopicForm>(() => newForm());
  const [loading, setLoading] = useState(!!id);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const inFlight = useRef(false);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    getTopic(id).then((loaded) => {
      if (!cancelled) { setTopic(loaded); setForm(newForm(loaded)); }
    }).catch((failure: unknown) => {
      if (!cancelled) setLoadError(topicErrorMessage(failure));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, attempt]);

  function fieldError(field: string) {
    return errors[field] ? <p role="alert" className="mt-1 text-sm text-red-700">{errors[field]}</p> : null;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    const nextErrors: Record<string, string> = {};
    for (const { code, label } of LANGUAGES) {
      if (!form.name[code].trim()) nextErrors[`name.${code}`] = `${label} Name is required.`;
    }
    if (!form.slug.trim()) nextErrors.slug = 'Canonical Slug is required.';
    const articleTags = [...new Set(form.articleTags.split(/\r?\n/).map((tag) => tag.trim()).filter(Boolean))];
    if (!articleTags.length) nextErrors.articleTags = 'At least one article tag is required.';
    else if (articleTags.length > 20 || articleTags.some((tag) => tag.length > 120 || /[\u0000-\u001f\u007f*]/.test(tag))) {
      nextErrors.articleTags = 'Use up to 20 exact tags, at most 120 characters each, without wildcards or control characters.';
    }
    const startsAt = submittedDate(form.startsAt, topic?.startsAt);
    const expiresAt = form.expiresAt ? submittedDate(form.expiresAt, topic?.expiresAt) : null;
    const start = startsAt.getTime();
    const expiry = expiresAt?.getTime() ?? null;
    if (!Number.isFinite(start)) nextErrors.startsAt = 'Starts At is required and must be a valid local date and time.';
    if (expiry !== null && (!Number.isFinite(expiry) || expiry <= start)) nextErrors.expiresAt = 'Expires At must be later than Starts At.';
    if (!form.order.trim() || !Number.isSafeInteger(Number(form.order))) nextErrors.order = 'Order must be a whole safe integer.';
    setErrors(nextErrors);
    setSaveError('');
    if (Object.keys(nextErrors).length) return;
    const payload = {
      name: trimText(form.name),
      description: trimText(form.description),
      articleTags,
      pinnedArticleId: form.pinnedArticleId,
      startsAt: startsAt.toISOString(),
      expiresAt: expiresAt?.toISOString() ?? null,
      active: form.active,
      order: Number(form.order),
    };
    inFlight.current = true;
    setSaving(true);
    try {
      if (id) await updateTopic(id, payload);
      else await createTopic({ ...payload, slug: form.slug.trim() });
      onSaved();
    } catch (failure: unknown) {
      setSaveError(topicErrorMessage(failure));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" aria-label={id ? 'Edit Topic' : 'Create Topic'}>
      <h2 className="text-lg font-semibold">{id ? 'Edit Topic' : 'Create Topic'}</h2>
      {loading ? <p role="status">Loading topic...</p> : loadError ? (
        <div role="alert" className={errorClass}>{loadError} <button type="button" className={buttonClass} onClick={() => setAttempt(attempt + 1)}>Retry topic</button></div>
      ) : (
        <form onSubmit={(event) => void save(event)} noValidate>
          <fieldset disabled={saving} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              {LANGUAGES.map(({ code, label }) => (
                <div key={code}>
                  <label className="block text-sm font-medium">{label} Name *
                    <input className={inputClass} required maxLength={160} value={form.name[code]} onChange={(event) => setForm({ ...form, name: { ...form.name, [code]: event.target.value } })} />
                  </label>
                  {fieldError(`name.${code}`)}
                  <label className="mt-3 block text-sm">{label} Description
                    <textarea className={inputClass} rows={3} maxLength={1000} value={form.description[code]} onChange={(event) => setForm({ ...form, description: { ...form.description, [code]: event.target.value } })} />
                  </label>
                </div>
              ))}
            </div>
            <label className="block text-sm font-medium">Canonical Slug *
              <input className={inputClass} required readOnly={!!id} maxLength={140} value={form.slug} onChange={(event) => { if (!id) setForm({ ...form, slug: event.target.value }); }} />
              <span className="mt-1 block text-xs font-normal text-slate-500">{id ? 'Read-only after creation.' : 'One stable canonical slug for all three languages. The backend validates its format and uniqueness.'}</span>
            </label>
            {fieldError('slug')}
            <label className="block text-sm font-medium">Article Tags *
              <textarea className={inputClass} required rows={3} value={form.articleTags} onChange={(event) => setForm({ ...form, articleTags: event.target.value })} placeholder="topic:navratri-2026" />
              <span className="mt-1 block text-xs font-normal text-slate-500">One exact News.tags value per line (up to 20). Spaces around tags and duplicates are removed on Save. This does not modify any article.</span>
            </label>
            {fieldError('articleTags')}
            <PinnedStoryPicker value={form.pinnedArticleId} disabled={saving} onChange={(pinnedArticleId) => setForm({ ...form, pinnedArticleId })} />
            <p className="text-sm">Times use your browser timezone: <strong>{timezone}</strong>. Saved timestamps are converted to UTC.</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Starts At *
                  <input type="datetime-local" required className={inputClass} value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} />
                </label>
                {fieldError('startsAt')}
              </div>
              <div>
                <label className="block text-sm font-medium">Expires At
                  <input type="datetime-local" className={inputClass} value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} />
                </label>
                <p className="text-xs text-slate-500">Optional. Clear to remove the expiry.</p>
                {fieldError('expiresAt')}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Active {form.active ? 'ON' : 'OFF'}</span>
                <Switch checked={form.active} label="Active" disabled={saving} onCheckedChange={(active) => setForm({ ...form, active })} />
              </div>
              <div>
                <label className="block text-sm font-medium">Order
                  <input type="number" step={1} className={inputClass} value={form.order} onChange={(event) => setForm({ ...form, order: event.target.value })} />
                </label>
                <p className="text-xs text-slate-500">Lower order numbers appear earlier.</p>
                {fieldError('order')}
              </div>
            </div>
            {saveError && <p role="alert" className={errorClass}>{saveError}</p>}
            <div className="flex gap-2">
              <button type="submit" className={`${buttonClass} bg-blue-600 text-white`}>{saving ? 'Saving...' : 'Save'}</button>
              <button type="button" className={buttonClass} onClick={onCancel}>Cancel</button>
            </div>
          </fieldset>
        </form>
      )}
      {(loading || loadError) && <button type="button" className={buttonClass} onClick={onCancel}>Cancel</button>}
    </section>
  );
}

function TrendingTopicsManager() {
  const [data, setData] = useState<EditorialTopicListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<{ id: string | null } | null>(null);
  const [deactivate, setDeactivate] = useState<EditorialTopic | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);
    listTopics({ active: 'all', page, limit: 20 }).then((result) => {
      if (!cancelled) setData(result);
    }).catch((failure: unknown) => {
      if (!cancelled) setError(topicErrorMessage(failure));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, attempt]);

  async function setActive(topic: EditorialTopic, active: boolean) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setActionError('');
    setNotice('');
    try {
      await updateTopic(topic.id, { active });
      setDeactivate(null);
      setNotice(active ? 'Topic activated. Its schedule still applies.' : 'Topic deactivated.');
      setAttempt((value) => value + 1);
    } catch (failure: unknown) {
      setActionError(topicErrorMessage(failure));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  const disabled = loading || busy || !!editor || !!deactivate;
  return (
    <div className="space-y-5">
      <Link to="/admin/editorial" className="text-sm text-blue-600">Back to Editorial</Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Trending Topics</h1>
        <button type="button" className={`${buttonClass} bg-blue-600 text-white`} disabled={disabled || !!error} onClick={() => { setNotice(''); setActionError(''); setEditor({ id: null }); }}>Create Topic</button>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Founder-only control. Active OFF makes a topic unavailable publicly. Active ON with a future start is scheduled.
        Once started, an unexpired topic is eligible for the Trending Strip. Expiry removes it from the strip, not its archive/detail.
        Expiry never switches Active OFF. The backend is authoritative.
      </p>
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
      {actionError && !deactivate && <p role="alert" className={errorClass}>{actionError}</p>}
      {editor && <TopicEditor key={editor.id ?? 'new'} id={editor.id} onCancel={() => setEditor(null)} onSaved={() => {
        setEditor(null); setNotice('Topic saved.'); setPage(1); setAttempt((value) => value + 1);
      }} />}
      {loading && <p role="status">Loading topics...</p>}
      {error && <div role="alert" className={errorClass}>{error} <button type="button" className={buttonClass} onClick={() => setAttempt(attempt + 1)}>Retry topics</button></div>}
      {data && !data.items.length && <p>No topics found.</p>}
      {data && data.items.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-800"><tr>{['Topic', 'Active', 'Order', 'Starts', 'Expires', 'Article Tag(s)', 'Pinned Story', 'Actions'].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}</tr></thead>
            <tbody>{data.items.map((topic) => (
              <tr key={topic.id} className="border-t border-slate-200 align-top">
                <td className="px-3 py-3">{LANGUAGES.map(({ code }) => <div key={code} lang={code}>{topic.name[code]}</div>)}<div className="text-xs text-slate-500">{topic.slug}</div></td>
                <td className="px-3 py-3"><div>{topic.active ? 'ON' : 'OFF'}</div><div className="text-xs">{topicState(topic, now)}</div></td>
                <td className="px-3 py-3">{topic.order}</td>
                <td className="px-3 py-3">{new Date(topic.startsAt).toLocaleString()}</td>
                <td className="px-3 py-3">{topic.expiresAt ? new Date(topic.expiresAt).toLocaleString() : 'No expiry'}</td>
                <td className="px-3 py-3">{topic.articleTags.map((tag) => <div key={tag}>{tag}</div>)}</td>
                <td className="break-all px-3 py-3">{topic.pinnedArticleId || 'None'}</td>
                <td className="px-3 py-3"><div className="flex gap-2">
                  <button type="button" className={buttonClass} disabled={disabled} aria-label={`Edit ${topic.name.gu}`} onClick={() => { setNotice(''); setActionError(''); setEditor({ id: topic.id }); }}>Edit</button>
                  <button type="button" className={buttonClass} disabled={disabled} aria-label={`${topic.active ? 'Deactivate' : 'Activate'} ${topic.name.gu}`} onClick={() => {
                    if (topic.active) { setActionError(''); setDeactivate(topic); }
                    else void setActive(topic, true);
                  }}>{topic.active ? 'Deactivate' : 'Activate'}</button>
                </div></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {data && <div className="flex items-center gap-3">
        <button type="button" className={buttonClass} disabled={disabled || page <= 1} onClick={() => setPage(page - 1)}>Previous topics</button>
        <span className="text-sm">Page {page} of {Math.max(1, data.totalPages)} ({data.total} topics). Times: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</span>
        <button type="button" className={buttonClass} disabled={disabled || !data.hasNextPage} onClick={() => setPage(page + 1)}>Next topics</button>
      </div>}
      <ConfirmModal open={!!deactivate} title="Deactivate topic?" description={`Deactivate ${deactivate?.name.gu || 'this topic'}? It will become unavailable publicly. Nothing is deleted.`}
        confirmLabel="Deactivate" confirmVariant="danger" confirmDisabled={busy} confirmBusyLabel="Deactivating..."
        onCancel={() => { if (!busy) { setDeactivate(null); setActionError(''); } }}
        onConfirm={() => { if (deactivate) void setActive(deactivate, false); }}>
        {actionError ? <p role="alert">{actionError}</p> : undefined}
      </ConfirmModal>
    </div>
  );
}

export default function TrendingTopics() {
  const { isAuthenticated, isFounder } = useAuth();
  // Do not extend FounderRoute's development/demo allowances to this live-content control.
  if (!isAuthenticated || !isFounder) return <Denied message="Trending Topics management is restricted to the Founder." />;
  return <TrendingTopicsManager />;
}

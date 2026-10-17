import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ConfirmModal from '@/components/ui/ConfirmModal';
import {
  attachTopicStories, detachTopicStories, listTopicCandidates, listTopicStories,
  refreshTopicMembershipQueries, searchTopicStories, topicStoryErrorMessage,
  type TopicLanguage, type TopicStory,
} from '@/lib/api/trendingTopics';
import { articleFollowUpWarning } from '@/lib/articleLifecycle';
import { ARTICLE_CATEGORY_LABELS, isAllowedArticleCategoryKey } from '@/lib/articleCategories';

type StoryView = 'attached' | 'search' | 'candidates';
const views: Array<{ key: StoryView; label: string }> = [
  { key: 'attached', label: 'Attached Stories' },
  { key: 'search', label: 'Search Existing Stories' },
  { key: 'candidates', label: 'Suggested Related Stories' },
];
const buttonClass = 'rounded border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700';
const errorClass = 'rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800';

function matchReason(field: string): string {
  if (field === 'title' || /^translations\.(gu|hi|en)\.title$/.test(field)) return 'Matched headline';
  if (field === 'tags') return 'Matched article tag';
  if (field === 'keywords' || field === 'seo.keywords' || field === 'seo.metaKeywords') return 'Matched SEO keyword';
  if (field === 'category') return 'Matched category';
  if (field === 'slug' || field.startsWith('slugs.')) return 'Matched slug';
  return `Matched ${field}`;
}

export default function TopicStoryManager({ topic, canEdit, onClose }: {
  topic: { id: string; title: string; slug: string };
  canEdit: boolean;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [view, setView] = useState<StoryView>('attached');
  const [lang, setLang] = useState<TopicLanguage>('gu');
  const [page, setPage] = useState(1);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [warning, setWarning] = useState('');
  const [detaching, setDetaching] = useState<TopicStory | null>(null);
  const inFlight = useRef(false);
  const ready = view !== 'search' || q.length >= 2;
  const query = useQuery({
    queryKey: ['trending-topics', 'stories', topic.id, view, lang, page, q],
    queryFn: () => {
      const params = { lang, page, limit: 20 };
      if (view === 'search') return searchTopicStories(topic.id, { ...params, q });
      if (view === 'candidates') return listTopicCandidates(topic.id, { ...params, ...(q ? { q } : {}) });
      return listTopicStories(topic.id, params);
    },
    enabled: ready,
    staleTime: 0,
    retry: false,
  });
  const mutation = useMutation({
    mutationKey: ['trending-topics', 'membership'],
    retry: false,
    mutationFn: ({ action, ids }: { action: 'attach' | 'detach'; ids: string[] }) =>
      (action === 'attach' ? attachTopicStories : detachTopicStories)(topic.id, ids),
    onSuccess: async (result) => {
      setSelected([]);
      setDetaching(null);
      setNotice(`${result.count} logical ${result.count === 1 ? 'story' : 'stories'} ${result.action === 'attach' ? 'attached' : 'detached'}.`);
      setWarning(articleFollowUpWarning(result) || '');
      try {
        await refreshTopicMembershipQueries(client);
      } catch {
        setWarning('Membership was saved, but the latest saved state could not be loaded. Reload the list; do not repeat the action.');
      }
    },
    onError: (error: unknown) => setActionError(topicStoryErrorMessage(error)),
    onSettled: () => { inFlight.current = false; },
  });
  const loading = ready && (query.isPending || query.isFetching);
  const busy = mutation.isPending;

  function changeMembership(action: 'attach' | 'detach', ids: string[]) {
    if (inFlight.current) return;
    setNotice('');
    setWarning('');
    setActionError('');
    if (!canEdit) {
      setActionError('Access denied. The Edit news special right is required to change membership.');
      return;
    }
    if (!ids.length || ids.length > 50) {
      setActionError('Select between 1 and 50 CMS News stories.');
      return;
    }
    inFlight.current = true;
    mutation.mutate({ action, ids });
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const term = text.trim();
    if ((view === 'search' || term) && (term.length < 2 || term.length > 120 || /[\u0000-\u001f\u007f]/.test(term))) {
      setActionError('Enter search text between 2 and 120 characters.');
      return;
    }
    setActionError('');
    setSelected([]);
    setPage(1);
    setQ(term);
    if (term === q && page === 1) void query.refetch();
  }

  function changeView(next: StoryView) {
    setView(next);
    setPage(1);
    setQ('');
    setText('');
    setSelected([]);
    setActionError('');
    setNotice('');
    setWarning('');
  }

  return (
    <section aria-label="Manage Stories" className="space-y-4">
      <button type="button" className={buttonClass} disabled={busy} onClick={onClose}>Back to Trending Topics</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Manage Stories: {topic.title}</h1>
          <p className="text-sm text-slate-500">{topic.slug}</p>
        </div>
        <label className="text-sm">Story language
          <select className="ml-2 rounded border px-3 py-2" value={lang} disabled={busy} onChange={(event) => {
            const value = event.target.value;
            if (value === 'gu' || value === 'hi' || value === 'en') { setLang(value); setPage(1); setSelected([]); }
          }}>
            <option value="gu">Gujarati</option><option value="hi">Hindi</option><option value="en">English</option>
          </select>
        </label>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        One row represents one logical story across its editions. Membership changes do not publish, unpublish, or change categories.
        Expiry preserves membership and archives. Pins are presentation priority only.
      </p>
      {!canEdit && <p className="rounded border border-amber-200 p-3 text-sm">Read-only. The Edit news special right is required to attach or detach stories.</p>}
      <div className="flex flex-wrap gap-2" aria-label="Story management views">
        {views.map((item) => <button type="button" key={item.key} aria-pressed={view === item.key} disabled={busy || !!detaching}
          className={`${buttonClass} ${view === item.key ? 'bg-blue-600 text-white' : ''}`} onClick={() => changeView(item.key)}>{item.label}</button>)}
      </div>
      {view !== 'attached' && (
        <form onSubmit={submitSearch} className="flex flex-wrap gap-2">
          <label className="flex-1 text-sm">{view === 'search' ? 'Search existing stories' : 'Refine suggestions (optional)'}
            <input className="mt-1 w-full rounded border px-3 py-2" value={text} minLength={view === 'search' ? 2 : undefined}
              maxLength={120} disabled={busy} onChange={(event) => setText(event.target.value)} />
          </label>
          <button type="submit" className={buttonClass} disabled={busy}>{view === 'search' ? 'Search' : 'Find suggestions'}</button>
        </form>
      )}
      {view === 'candidates' && <p className="text-sm">Suggestions only. Nothing is selected or attached until you choose stories and click Add Selected.</p>}
      {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
      {warning && <p role="alert" className="rounded border border-amber-200 p-3 text-sm text-amber-800">{warning}</p>}
      {actionError && !detaching && <p role="alert" className={errorClass}>{actionError}</p>}
      {busy && <p role="status">Saving membership...</p>}
      {!ready ? <p className="text-sm">Enter 2-120 characters to search the Backend.</p>
        : loading ? <p role="status">Loading stories...</p>
          : query.isError ? (
            <div role="alert" className={errorClass}>{topicStoryErrorMessage(query.error)}
              <button type="button" className={`${buttonClass} ml-2`} disabled={busy} onClick={() => void query.refetch()}>Retry stories</button>
            </div>
          ) : query.data && (
            <>
              {query.data.items.length === 0 ? <p>{view === 'attached' ? 'No stories are attached to this topic.' : view === 'search' ? 'No matching stories found.' : 'No related suggestions found.'}</p> : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-800"><tr>
                      {view !== 'attached' && <th className="px-3 py-2">Select</th>}
                      {['Headline', 'Category', 'Status', 'Published', 'Languages', 'Membership', 'Actions'].map((label) => <th key={label} className="px-3 py-2">{label}</th>)}
                    </tr></thead>
                    <tbody>{query.data.items.map((story) => (
                      <tr key={story.logicalStoryId} className="border-t border-slate-200 align-top">
                        {view !== 'attached' && <td className="px-3 py-3"><input type="checkbox" aria-label={`Select ${story.title}`}
                          disabled={!canEdit || busy || story.attached || (selected.length >= 50 && !selected.includes(story.logicalStoryId))}
                          checked={selected.includes(story.logicalStoryId)} onChange={(event) => setSelected((previous) =>
                            event.target.checked ? [...previous, story.logicalStoryId] : previous.filter((id) => id !== story.logicalStoryId))} /></td>}
                        <td className="px-3 py-3">
                          <div className="font-medium">{story.title || 'Untitled story'}</div>
                          {story.pinned && <span className="text-xs text-blue-700">Pinned (presentation only)</span>}
                          {view === 'candidates' && story.matchReasons?.map((reason) => <div key={`${reason.field}:${reason.term}`} className="text-xs text-slate-600">{matchReason(reason.field)}: {reason.term}</div>)}
                        </td>
                        <td className="px-3 py-3">{isAllowedArticleCategoryKey(story.category) ? ARTICLE_CATEGORY_LABELS[story.category] : story.category || 'Not set'}</td>
                        <td className="px-3 py-3">{story.status}</td>
                        <td className="px-3 py-3">{story.publishedAt ? new Date(story.publishedAt).toLocaleString() : 'No published date'}</td>
                        <td className="px-3 py-3">{story.availableLanguages.map((code) => code.toUpperCase()).join(' / ') || 'Not reported'}</td>
                        <td className="px-3 py-3">
                          {story.attached ? 'Already attached' : 'Available to attach'}
                          {!story.membershipConsistent && <p className="text-xs text-amber-800">Membership differs between editions.</p>}
                        </td>
                        <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                          {canEdit && <Link className={buttonClass} to={`/admin/articles/${encodeURIComponent(story.articleId)}/edit`}>View/Edit</Link>}
                          {view === 'attached' && <button type="button" className={buttonClass} disabled={!canEdit || busy}
                            aria-label={`Detach ${story.title}`} onClick={() => { setActionError(''); setNotice(''); setDetaching(story); }}>Detach</button>}
                        </div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              {view !== 'attached' && <button type="button" className={`${buttonClass} bg-blue-600 text-white`}
                disabled={!canEdit || busy || selected.length === 0} onClick={() => changeMembership('attach', selected)}>Add Selected ({selected.length})</button>}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className={buttonClass} disabled={busy || page <= 1} onClick={() => { setPage(page - 1); setSelected([]); }}>Previous stories</button>
                <span className="text-sm">Page {page} of {Math.max(1, query.data.totalPages)} ({query.data.total} logical stories)</span>
                <button type="button" className={buttonClass} disabled={busy || !query.data.hasNextPage} onClick={() => { setPage(page + 1); setSelected([]); }}>Next stories</button>
                <button type="button" className={buttonClass} disabled={busy} onClick={() => { setSelected([]); void query.refetch(); }}>Refresh stories</button>
              </div>
            </>
          )}
      <ConfirmModal open={!!detaching} title="Detach story?"
        description={`Remove ${detaching?.title || 'this story'} from ${topic.title} only? Other topics, ordinary tags, category, and publication are preserved by the Backend.`}
        confirmLabel="Detach" confirmVariant="danger" confirmDisabled={busy || !canEdit} confirmBusyLabel="Detaching..."
        onCancel={() => { if (!busy) { setDetaching(null); setActionError(''); } }}
        onConfirm={() => { if (detaching) changeMembership('detach', [detaching.logicalStoryId]); }}>
        {actionError ? <p role="alert">{actionError}</p> : undefined}
      </ConfirmModal>
    </section>
  );
}

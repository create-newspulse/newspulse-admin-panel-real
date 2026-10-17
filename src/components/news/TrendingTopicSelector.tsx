import type { ArticleTrendingTopicsState } from '@/hooks/useArticleTrendingTopics';
import { topicStoryErrorMessage } from '@/lib/api/trendingTopics';

export default function TrendingTopicSelector({ topics, disabled = false }: {
  topics: ArticleTrendingTopicsState;
  disabled?: boolean;
}) {
  const { access, query } = topics;
  const loading = access.loading || (access.canRead && (query.isPending || query.isFetching));
  return (
    <section aria-label="Trending Topics" className="space-y-2 rounded border border-slate-200 p-3 dark:border-slate-700">
      <h3 className="text-sm font-semibold">Trending Topics</h3>
      <p className="text-xs text-slate-600 dark:text-slate-300">
        Optional: select zero, one, or multiple topics for this logical story across GU, HI, and EN.
        Category, SEO, and ordinary article tags stay separate. Changes use the existing Save or Publish action.
      </p>
      {loading ? <p role="status" className="text-sm">Loading Trending Topics...</p>
        : !access.canRead ? <p className="text-sm">{access.reason}</p>
          : query.isError ? (
            <div role="alert" className="space-y-2 text-sm text-red-700">
              <p>{topicStoryErrorMessage(query.error)}</p>
              <button type="button" className="rounded border px-2 py-1" disabled={disabled} onClick={() => void query.refetch()}>Retry Trending Topics</button>
            </div>
          ) : (
            <>
              {!access.canEdit && <p className="text-xs">Read-only. The Edit news special right is required to change membership.</p>}
              {topics.items.length === 0 ? <p className="text-sm">No Trending Topics are available.</p> : (
                <fieldset disabled={disabled || !access.canEdit} className="max-h-64 space-y-2 overflow-y-auto">
                  <legend className="sr-only">Select Trending Topics</legend>
                  {topics.items.map((topic) => (
                    <label key={topic.id} className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1" aria-label={`Trending Topic: ${topic.title}`}
                        checked={topics.isSelected(topic.id)} onChange={(event) => topics.setSelected(topic.id, event.target.checked)} />
                      <span>
                        <span className="font-medium">{topic.title}</span>
                        <span className="block text-xs text-slate-500">{topic.slug} | {topic.promotionState}</span>
                        {topic.id in topics.changes && <span className="block text-xs text-amber-800">
                          {topics.changes[topic.id] ? 'Pending addition' : 'Pending removal'} - not yet saved
                        </span>}
                        {!topic.assignmentSupported && <span className="block text-xs text-amber-800">Legacy/shared tags: assignment may require Founder review.</span>}
                        {topic.membershipConsistent === false && <span className="block text-xs text-amber-800">Membership differs between editions. Backend review may be needed.</span>}
                      </span>
                    </label>
                  ))}
                </fieldset>
              )}
            </>
          )}
      {topics.saveError && <p role="alert" className="text-sm text-red-700">{topics.saveError}</p>}
      {topics.warning && <p role="alert" className="text-sm text-amber-800">{topics.warning}</p>}
      <p className="text-xs text-slate-500">Expiry ends Trending Strip promotion, not membership or the archive. A pin does not assign a story.</p>
    </section>
  );
}

import type { AdminCommunityStory } from '@/lib/api/communityReporterStories';
import StoryStatusPill, { mapStoryStatus } from '@/components/community/StoryStatusPill';
import type { StoryDeskGroup } from '@/components/community/StoryDeskTable';

function fmtDateShort(value?: string) {
  const s = String(value || '').trim();
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

function safeText(v: any): string {
  const s = String(v ?? '').trim();
  return s ? s : '—';
}

export default function StoryDeskTimeline({
  groups,
  onView,
}: {
  groups: StoryDeskGroup[];
  onView: (story: AdminCommunityStory) => void;
}) {
  if (groups.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-600">
        No stories match your filters.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.key} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
            <span className="font-medium text-slate-800">{g.label}</span>
            <span className="ml-2">· {g.items.length}</span>
          </div>
          <div className="divide-y divide-slate-200">
            {g.items.map((s) => {
              const reporterName = safeText(s.reporterName) !== '—'
                ? safeText(s.reporterName)
                : safeText(s.reporterEmail) !== '—'
                  ? safeText(String(s.reporterEmail).split('@')[0])
                  : '—';

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onView(s)}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate" title={safeText(s.headline)}>
                        {safeText(s.headline)}
                      </div>
                      <div className="mt-1 text-xs text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                        <span>Reporter: <span className="font-medium">{reporterName}</span></span>
                        <span>Category: <span className="font-medium">{safeText(s.category)}</span></span>
                        <span>City: <span className="font-medium">{safeText(s.city)}</span></span>
                        <span>Lang: <span className="font-medium">{safeText(s.language).toUpperCase()}</span></span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        Created: {fmtDateShort(s.createdAt)} · Updated: {fmtDateShort(s.updatedAt)}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <StoryStatusPill status={mapStoryStatus(s.status)} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

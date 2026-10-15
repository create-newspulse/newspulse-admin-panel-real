export type QuickViewKey =
  | 'all'
  | 'published'
  | 'draft'
  | 'scheduled'
  | 'breaking'
  | 'regional'
  | 'pti'
  | 'flagged';

export interface QuickViewCounts {
  all: number;
  published: number;
  draft: number;
  scheduled: number;
  breaking: number;
  regional: number;
  pti: number;
  flagged: number;
}

export type QuickViewLoadState = 'loading' | 'ready' | 'error';

const VIEW_LABELS: Record<QuickViewKey, string> = {
  all: 'All',
  published: 'Published',
  draft: 'Draft',
  scheduled: 'Scheduled',
  breaking: 'Breaking',
  regional: 'Regional (Gujarat)',
  pti: 'PTI Needs Review',
  flagged: 'Flagged',
};

interface Props {
  value: QuickViewKey;
  counts: QuickViewCounts;
  loadState?: QuickViewLoadState;
  logicalCounts?: Pick<QuickViewCounts, 'published' | 'draft' | 'scheduled'>;
  logicalLoadState?: QuickViewLoadState;
  onChange: (v: QuickViewKey) => void;
  onOpenFilters: () => void;
}

export function QuickViewsBar({ value, counts, loadState = 'ready', logicalCounts, logicalLoadState, onChange, onOpenFilters }: Props) {
  const items: QuickViewKey[] = ['all', 'published', 'draft', 'scheduled', 'breaking', 'regional', 'pti', 'flagged'];

  return (
    <div className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-3">
        <div className="flex-1 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center gap-2 min-w-max">
            {items.map((k) => {
              const active = value === k;
              const logicalStatus = k === 'published' || k === 'draft' || k === 'scheduled';
              const state = logicalStatus && logicalLoadState ? logicalLoadState : loadState;
              const countValue = logicalStatus && logicalLoadState ? logicalCounts?.[k] : counts[k];
              const unavailable = state === 'error' || (state === 'ready' && countValue === undefined);
              const count = state === 'loading' ? '...' : unavailable ? '--' : countValue;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => onChange(k)}
                  className={
                    `px-3 py-1 rounded-full border text-xs inline-flex items-center gap-2 transition `
                    + (active
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50')
                  }
                >
                  <span className="whitespace-nowrap">{VIEW_LABELS[k]}</span>
                  <span aria-label={state === 'loading' ? 'Loading count' : unavailable ? 'Count unavailable' : undefined} className={
                    `px-2 py-0.5 rounded-full text-[11px] `
                    + (active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700')
                  }>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenFilters}
            className="px-3 py-1 rounded border text-xs bg-slate-900 text-white hover:bg-slate-800"
          >
            Filters
          </button>
        </div>
      </div>
    </div>
  );
}

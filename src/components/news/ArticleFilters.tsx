import React from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import type { ArticleStatus } from '@/types/articles';
import type { ManageNewsParams } from '@/types/api';
import { ARTICLE_CATEGORY_OPTIONS, ARTICLE_CATEGORY_LABELS, isAllowedArticleCategoryKey } from '@/lib/articleCategories';

interface Props {
  params: ManageNewsParams;
  onChange: (p: ManageNewsParams) => void;
  hideSearch?: boolean;
  hideStatus?: boolean;
}

export const ArticleFilters: React.FC<Props> = ({ params, onChange, hideSearch = false, hideStatus = false }) => {
  const [local, setLocal] = React.useState<ManageNewsParams>(params);
  const [dateDraft, setDateDraft] = React.useState<{ from?: string; to?: string }>({
    from: params.from,
    to: params.to,
  });

  const normalizeCategoryToken = React.useCallback((raw: string): string => {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    if (isAllowedArticleCategoryKey(trimmed)) return trimmed;

    const compact = trimmed
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');

    // Common legacy/pretty values → canonical keys
    const legacy: Record<string, string> = {
      breaking: 'breaking',
      'breaking-news': 'breaking',
      regional: 'regional',
      national: 'national',
      international: 'international',
      business: 'business',
      sport: 'sports',
      sports: 'sports',
      lifestyle: 'lifestyle',
      glamour: 'glamour',
      glamorous: 'glamour',
      tech: 'tech',
      scitech: 'tech',
      'sci-tech': 'tech',
      editorial: 'editorial',
      webstories: 'web-stories',
      'web-stories': 'web-stories',
      viralvideos: 'viral-videos',
      'viral-videos': 'viral-videos',
      youthpulse: 'youth-pulse',
      'youth-pulse': 'youth-pulse',
      inspirationhub: 'inspiration-hub',
      'inspiration-hub': 'inspiration-hub',
    };

    const mapped = legacy[compact] || '';
    return isAllowedArticleCategoryKey(mapped) ? mapped : '';
  }, []);

  const normalizeCategoryList = React.useCallback((value: string | undefined): string | undefined => {
    const tokens = String(value || '')
      .split(',')
      .map((t) => normalizeCategoryToken(t))
      .filter(Boolean);

    // de-dupe while preserving order
    const unique: string[] = [];
    tokens.forEach((t) => {
      if (!unique.includes(t)) unique.push(t);
    });

    return unique.length ? unique.join(',') : undefined;
  }, [normalizeCategoryToken]);

  React.useEffect(() => {
    const normalizedCategory = normalizeCategoryList(params.category);
    setLocal({
      ...params,
      category: normalizedCategory,
    });
    setDateDraft({ from: params.from, to: params.to });
  }, [params, normalizeCategoryList]);

  const debouncedSearch = useDebounce(local.q, 300);
  const debouncedAuto = useDebounce(
    JSON.stringify({
      status: local.status ?? 'all',
      language: local.language || '',
      category: local.category || '',
    }),
    300,
  );

  React.useEffect(() => {
    if (hideSearch) return;
    if ((debouncedSearch || undefined) === (params.q || undefined)) return;
    onChange({ ...params, ...local, q: debouncedSearch || undefined, page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, hideSearch]);

  React.useEffect(() => {
    // Auto-apply everything except date range.
    // (Date range is applied only via the Apply button.)
    void debouncedAuto;

    const next: ManageNewsParams = {
      ...params,
      status: (hideStatus ? (params.status ?? 'all') : (local.status ?? 'all')) as any,
      language: local.language || undefined,
      category: local.category || undefined,
      page: 1,
    };

    const changed =
      (!hideStatus && (next.status ?? 'all') !== (params.status ?? 'all'))
      || (next.language || undefined) !== (params.language || undefined)
      || (next.category || undefined) !== (params.category || undefined);

    if (!changed) return;
    onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAuto]);

  const applyDates = () => {
    onChange({
      ...params,
      ...local,
      from: dateDraft.from || undefined,
      to: dateDraft.to || undefined,
      page: 1,
    });
  };

  const datesDirty = (dateDraft.from || undefined) !== (params.from || undefined)
    || (dateDraft.to || undefined) !== (params.to || undefined);

  return (
    <div className="flex flex-wrap gap-3 items-end">
      {!hideSearch && (
        <div className="flex flex-col">
          <label className="text-xs font-semibold">Search</label>
          <input
            value={local.q || ''}
            onChange={(e) => setLocal({ ...local, q: e.target.value || undefined, page: 1 })}
            placeholder="Search..."
            className="border rounded px-2 py-2"
          />
        </div>
      )}
      <div className="flex flex-col">
        <label className="text-xs font-semibold">Categories</label>
        <div className="flex flex-wrap gap-1 border rounded px-2 py-2 bg-white">
          {ARTICLE_CATEGORY_OPTIONS.map((opt) => {
            const selected = String(local.category || '')
              .split(',')
              .map((t) => normalizeCategoryToken(t))
              .filter(Boolean);
            const isOn = selected.includes(opt.key);
            return (
              <button
                type="button"
                key={opt.key}
                onClick={() => {
                  const next = isOn
                    ? selected.filter((c: string) => c !== opt.key)
                    : [...selected, opt.key];
                  setLocal({ ...local, category: next.length ? next.join(',') : undefined, page: 1 });
                }}
                className={`px-2 py-0.5 rounded text-[11px] border ${isOn? 'bg-blue-600 text-white border-blue-600':'bg-slate-100 text-slate-700 border-slate-300'}`}
              >{ARTICLE_CATEGORY_LABELS[opt.key]}</button>
            );
          })}
        </div>
      </div>
      {!hideStatus && (
        <div className="flex flex-col">
          <label className="text-xs font-semibold">Status</label>
          <select
            value={(local.status ?? 'all') as 'all' | ArticleStatus}
            onChange={e=> setLocal({ ...local, status: (e.target.value as 'all' | ArticleStatus), page:1 })}
            className="border rounded px-2 py-2"
          >
            <option value="all">All</option>
            {(['draft','scheduled','published','archived','deleted'] as ArticleStatus[]).map(s=> <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      )}
      <div className="flex flex-col">
        <label className="text-xs font-semibold">Language</label>
        <select value={local.language||''} onChange={e=> setLocal({...local,language:e.target.value||undefined, page:1})} className="border rounded px-2 py-2">
          <option value="">All</option>
          {['en','hi','gu'].map(l=> <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-semibold">From (date)</label>
        <input
          type="date"
          value={dateDraft.from || ''}
          onChange={(e) => setDateDraft((d) => ({ ...d, from: e.target.value || undefined }))}
          className="border rounded px-2 py-2"
        />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-semibold">To (date)</label>
        <input
          type="date"
          value={dateDraft.to || ''}
          onChange={(e) => setDateDraft((d) => ({ ...d, to: e.target.value || undefined }))}
          className="border rounded px-2 py-2"
        />
      </div>
      <button
        type="button"
        disabled={!datesDirty}
        onClick={applyDates}
        className={
          'px-3 py-2 rounded text-sm text-white '
          + (datesDirty ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed')
        }
      >
        Apply date range
      </button>
    </div>
  );
};

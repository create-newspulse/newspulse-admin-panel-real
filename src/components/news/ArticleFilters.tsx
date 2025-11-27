import React from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import type { ArticleStatus } from '@/types/articles';
import type { ManageNewsParams } from '@/types/api';

interface Props { params: ManageNewsParams; onChange: (p: ManageNewsParams) => void; }
export const ArticleFilters: React.FC<Props> = ({ params, onChange }) => {
  const [local, setLocal] = React.useState<ManageNewsParams>(params);
  React.useEffect(()=> setLocal(params), [params]);
  const apply = () => onChange(local);
  const reset = () => { const cleared: ManageNewsParams = { page:1, limit:20, status:'all', sort: params.sort }; setLocal(cleared); onChange(cleared); };
  const debouncedSearch = useDebounce(local.q, 400);
  React.useEffect(()=> { if (debouncedSearch !== params.q) onChange({ ...local, q: debouncedSearch || undefined, page:1 }); /* eslint-disable-next-line */}, [debouncedSearch]);
  return (
    <div className="flex flex-wrap gap-3 items-end mb-4">
      <div className="flex flex-col">
        <label className="text-xs font-semibold">Search</label>
        <input value={local.q||''} onChange={e=> setLocal({...local,q:e.target.value||undefined, page:1})} placeholder="Search..." className="border rounded px-2 py-1" />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-semibold">Categories</label>
        <div className="flex flex-wrap gap-1 border rounded px-2 py-1 bg-white">
          {(['Breaking','Regional','National','International','Business','Sports','Lifestyle','Glamorous','SciTech','Editorial','WebStories','ViralVideos'] as string[]).map((cat: string) => {
            const selected = (local.category||'').split(',').filter(Boolean);
            const isOn = selected.includes(cat);
            return (
              <button
                type="button"
                key={cat}
                onClick={() => {
                  const next = isOn ? selected.filter((c: string)=> c!==cat) : [...selected, cat];
                  setLocal({...local, category: next.length? next.join(','): undefined, page:1});
                }}
                className={`px-2 py-0.5 rounded text-[11px] border ${isOn? 'bg-blue-600 text-white border-blue-600':'bg-slate-100 text-slate-700 border-slate-300'}`}
              >{cat}</button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-semibold">Status</label>
        <select
          value={(local.status ?? 'all') as 'all' | ArticleStatus}
          onChange={e=> setLocal({ ...local, status: (e.target.value as 'all' | ArticleStatus), page:1 })}
          className="border rounded px-2 py-1"
        >
          <option value="all">All</option>
          {(['draft','scheduled','published','archived','deleted'] as ArticleStatus[]).map(s=> <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-semibold">Language</label>
        <select value={local.language||''} onChange={e=> setLocal({...local,language:e.target.value||undefined, page:1})} className="border rounded px-2 py-1">
          <option value="">All</option>
          {['en','hi','gu'].map(l=> <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-semibold">From</label>
        <input type="date" value={local.from||''} onChange={e=> setLocal({...local,from:e.target.value||undefined, page:1})} className="border rounded px-2 py-1" />
      </div>
      <div className="flex flex-col">
        <label className="text-xs font-semibold">To</label>
        <input type="date" value={local.to||''} onChange={e=> setLocal({...local,to:e.target.value||undefined, page:1})} className="border rounded px-2 py-1" />
      </div>
      <button onClick={apply} className="px-3 py-1 bg-blue-600 text-white rounded">Apply</button>
      <button onClick={reset} className="px-3 py-1 bg-slate-600 text-white rounded">Reset</button>
    </div>
  );
};

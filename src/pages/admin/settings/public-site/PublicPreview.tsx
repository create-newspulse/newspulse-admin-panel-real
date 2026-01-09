import { useMemo } from 'react';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';

export default function PublicPreview() {
  const { draft } = usePublicSiteSettingsDraft();

  const safe = useMemo(() => {
    const s: any = draft || {};
    return {
      homepage: s.homepage,
      tickers: s.tickers,
      liveTv: s.liveTv,
      languageTheme: s.languageTheme,
    };
  }, [draft]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Preview</div>
        <div className="mt-1 text-sm text-slate-600">Preview the effective public settings payload.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <pre className="text-xs overflow-x-auto whitespace-pre-wrap">{JSON.stringify(safe, null, 2)}</pre>
      </div>
    </div>
  );
}

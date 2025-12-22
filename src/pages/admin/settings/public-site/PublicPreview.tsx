import { useMemo } from 'react';
import { useSettingsDraft } from '@/features/settings/SettingsDraftContext';

export default function PublicPreview() {
  const { draft } = useSettingsDraft();

  const safe = useMemo(() => {
    const s: any = draft || {};
    return {
      ui: s.ui,
      navigation: s.navigation,
      voice: s.voice,
      homepage: s.homepage,
      tickers: s.tickers,
      liveTv: s.liveTv,
      footer: s.footer,
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

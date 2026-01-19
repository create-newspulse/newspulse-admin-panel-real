import Switch from '@/components/settings/Switch';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';

export default function TickersSettings() {
  const { draft, patchDraft } = usePublicSiteSettingsDraft();

  const liveEnabled = !!(draft as any)?.tickers?.live?.enabled;
  const breakingEnabled = !!(draft as any)?.tickers?.breaking?.enabled;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Tickers</div>
        <div className="mt-1 text-sm text-slate-600">Control ticker visibility.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Live Updates Ticker</div>
            <div className="text-xs text-slate-600">Shown on the homepage when enabled.</div>
          </div>
          <Switch checked={liveEnabled} onCheckedChange={(v) => patchDraft({ tickers: { live: { enabled: v } } } as any)} />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Breaking Ticker</div>
            <div className="text-xs text-slate-600">Highlights urgent breaking headlines.</div>
          </div>
          <Switch checked={breakingEnabled} onCheckedChange={(v) => patchDraft({ tickers: { breaking: { enabled: v } } } as any)} />
        </div>
      </div>
    </div>
  );
}

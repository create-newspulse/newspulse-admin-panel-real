import { useMemo } from 'react';
import Switch from '@/components/settings/Switch';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';

export default function TickersSettings() {
  const { draft, patchDraft } = usePublicSiteSettingsDraft();

  const liveEnabled = !!(draft as any)?.tickers?.live?.enabled;
  const breakingEnabled = !!(draft as any)?.tickers?.breaking?.enabled;

  const speeds = useMemo(() => {
    const t = (draft as any)?.tickers || {};
    return {
      liveSpeedSec: typeof t?.live?.speedSec === 'number' ? t.live.speedSec : 8,
      breakingSpeedSec: typeof t?.breaking?.speedSec === 'number' ? t.breaking.speedSec : 6,
    };
  }, [draft]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Tickers</div>
        <div className="mt-1 text-sm text-slate-600">Control ticker visibility and speeds.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Live Updates Ticker</div>
            <div className="text-xs text-slate-600">Shown on the homepage when enabled.</div>
          </div>
          <Switch checked={liveEnabled} onCheckedChange={(v) => patchDraft({ tickers: { live: { enabled: v } } } as any)} />
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Live ticker speed (seconds)</div>
            <div className="text-xs text-slate-600">Lower is faster.</div>
          </div>
          <input
            className="w-28 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            type="number"
            min={1}
            max={60}
            value={speeds.liveSpeedSec}
            onChange={(e) => patchDraft({ tickers: { live: { speedSec: Math.max(1, Math.min(60, Number(e.target.value) || 8)) } } } as any)}
          />
        </label>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Breaking Ticker</div>
            <div className="text-xs text-slate-600">Highlights urgent breaking headlines.</div>
          </div>
          <Switch checked={breakingEnabled} onCheckedChange={(v) => patchDraft({ tickers: { breaking: { enabled: v } } } as any)} />
        </div>

        <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Breaking ticker speed (seconds)</div>
            <div className="text-xs text-slate-600">Lower is faster.</div>
          </div>
          <input
            className="w-28 rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            type="number"
            min={1}
            max={60}
            value={speeds.breakingSpeedSec}
            onChange={(e) => patchDraft({ tickers: { breaking: { speedSec: Math.max(1, Math.min(60, Number(e.target.value) || 6)) } } } as any)}
          />
        </label>
      </div>
    </div>
  );
}

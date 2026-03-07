import { useMemo } from 'react';
import Switch from '@/components/settings/Switch';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';

function clampDurationSeconds(v: unknown, fallback: number) {
  const n = Number(v);
  const base = Number.isFinite(n) ? n : fallback;
  return Math.max(10, Math.min(120, Math.round(base)));
}

function clampMaxItems(v: unknown, fallback: number) {
  const n = Number(v);
  const base = Number.isFinite(n) ? n : fallback;
  return Math.max(1, Math.min(100, Math.round(base)));
}

function PresetsRow(props: {
  value: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  presets?: Array<{ key: string; label: string; value: number }>;
}) {
  const presets = props.presets || [
    { key: 'slow', label: 'Slow', value: 85 },
    { key: 'normal', label: 'Normal', value: 65 },
    { key: 'fast', label: 'Fast', value: 45 },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((p) => {
        const active = props.value === p.value;
        return (
          <button
            key={p.key}
            type="button"
            disabled={props.disabled}
            onClick={() => props.onChange(p.value)}
            className={
              'rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ' +
              (active
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50')
            }
          >
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

export default function TickersSettings() {
  const { draft, patchDraft } = usePublicSiteSettingsDraft();

  const liveEnabled = !!(draft as any)?.tickers?.live?.enabled;
  const breakingEnabled = !!(draft as any)?.tickers?.breaking?.enabled;
  const pauseOnHover = (draft as any)?.tickers?.pauseOnHover;

  const speeds = useMemo(() => {
    const t = (draft as any)?.tickers || {};
    return {
      liveSpeedSec: clampDurationSeconds(t?.live?.speedSec, 65),
      breakingSpeedSec: clampDurationSeconds(t?.breaking?.speedSec, 55),
      liveMaxItems: clampMaxItems(t?.live?.maxItems, 15),
      breakingMaxItems: clampMaxItems(t?.breaking?.maxItems, 12),
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
            <div className="text-sm font-semibold">Pause on hover</div>
            <div className="text-xs text-slate-600">Pause scrolling when the user hovers the ticker.</div>
          </div>
          <Switch
            checked={typeof pauseOnHover === 'boolean' ? pauseOnHover : true}
            onCheckedChange={(v) => patchDraft({ tickers: { pauseOnHover: v } } as any)}
          />
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Live Updates Ticker</div>
            <div className="text-xs text-slate-600">Shown on the homepage when enabled.</div>
          </div>
          <Switch checked={liveEnabled} onCheckedChange={(v) => patchDraft({ tickers: { live: { enabled: v } } } as any)} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Live max items</div>
              <div className="text-xs text-slate-600">Maximum number of items shown in the Live ticker.</div>
            </div>
            <div className="text-sm font-semibold text-slate-900">{speeds.liveMaxItems}</div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={speeds.liveMaxItems}
              onChange={(e) => patchDraft({ tickers: { live: { maxItems: clampMaxItems(e.target.value, 15) } } } as any)}
              className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              aria-label="Live max items"
            />
            <button
              type="button"
              className="text-xs font-semibold text-slate-700 hover:text-slate-900"
              onClick={() => patchDraft({ tickers: { live: { maxItems: 15 } } } as any)}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Live ticker speed (seconds)</div>
              <div className="text-xs text-slate-600">Higher seconds = slower = more readable</div>
            </div>
            <div className="text-sm font-semibold text-slate-900">{speeds.liveSpeedSec}s</div>
          </div>

          <PresetsRow
            value={speeds.liveSpeedSec}
            onChange={(v) => patchDraft({ tickers: { live: { speedSec: clampDurationSeconds(v, 65) } } } as any)}
          />

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={10}
              max={120}
              step={1}
              value={speeds.liveSpeedSec}
              onChange={(e) => patchDraft({ tickers: { live: { speedSec: clampDurationSeconds(e.target.value, 65) } } } as any)}
              className="w-full"
              aria-label="Live ticker speed"
            />
            <button
              type="button"
              className="text-xs font-semibold text-slate-700 hover:text-slate-900"
              onClick={() => patchDraft({ tickers: { live: { speedSec: 65 } } } as any)}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Breaking Ticker</div>
            <div className="text-xs text-slate-600">Highlights urgent breaking headlines.</div>
          </div>
          <Switch checked={breakingEnabled} onCheckedChange={(v) => patchDraft({ tickers: { breaking: { enabled: v } } } as any)} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Breaking max items</div>
              <div className="text-xs text-slate-600">Maximum number of items shown in the Breaking ticker.</div>
            </div>
            <div className="text-sm font-semibold text-slate-900">{speeds.breakingMaxItems}</div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              value={speeds.breakingMaxItems}
              onChange={(e) => patchDraft({ tickers: { breaking: { maxItems: clampMaxItems(e.target.value, 12) } } } as any)}
              className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              aria-label="Breaking max items"
            />
            <button
              type="button"
              className="text-xs font-semibold text-slate-700 hover:text-slate-900"
              onClick={() => patchDraft({ tickers: { breaking: { maxItems: 12 } } } as any)}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Breaking ticker speed (seconds)</div>
              <div className="text-xs text-slate-600">Higher seconds = slower = more readable</div>
            </div>
            <div className="text-sm font-semibold text-slate-900">{speeds.breakingSpeedSec}s</div>
          </div>

          <PresetsRow
            value={speeds.breakingSpeedSec}
            onChange={(v) => patchDraft({ tickers: { breaking: { speedSec: clampDurationSeconds(v, 55) } } } as any)}
          />

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={10}
              max={120}
              step={1}
              value={speeds.breakingSpeedSec}
              onChange={(e) => patchDraft({ tickers: { breaking: { speedSec: clampDurationSeconds(e.target.value, 55) } } } as any)}
              className="w-full"
              aria-label="Breaking ticker speed"
            />
            <button
              type="button"
              className="text-xs font-semibold text-slate-700 hover:text-slate-900"
              onClick={() => patchDraft({ tickers: { breaking: { speedSec: 55 } } } as any)}
            >
              Reset
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

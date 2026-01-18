import { useMemo } from 'react';
import { useSettingsDraft } from '@/features/settings/SettingsDraftContext';

export default function TranslationSettings() {
  const { draft, patchDraft, status, error } = useSettingsDraft();

  const mode = useMemo(() => {
    const raw = (draft as any)?.translation?.mode;
    return raw === 'failsafe' ? 'failsafe' : 'auto';
  }, [draft]);

  const busy = status === 'publishing' || status === 'saving' || status === 'loading';

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm text-slate-500">Admin Panel Settings</div>
        <h2 className="text-xl font-semibold">Translation</h2>
        <p className="mt-1 text-sm text-slate-600">
          Simple runtime behavior only — no queues, approvals, or review UI.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">Translation Mode</div>
            <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium">AUTO</span>: attempt automatic translation when needed.
              <span className="mx-2">•</span>
              <span className="font-medium">FAILSAFE</span>: prefer original text if translation fails or looks unsafe.
            </div>
          </div>

          <select
            className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            value={mode}
            disabled={busy}
            onChange={(e) => {
              const next = e.target.value === 'failsafe' ? 'failsafe' : 'auto';
              patchDraft({ translation: { mode: next } } as any);
            }}
          >
            <option value="auto">AUTO</option>
            <option value="failsafe">FAILSAFE</option>
          </select>
        </div>

        <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
          Tip: keep Translation UI hidden unless you explicitly enable it via `VITE_TRANSLATION_UI`.
        </div>
      </div>
    </div>
  );
}

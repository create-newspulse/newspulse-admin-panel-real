import { useMemo } from 'react';
import { useSettingsDraft } from '@/features/settings/SettingsDraftContext';

export default function LanguageThemeSettings() {
  const { draft, patchDraft } = useSettingsDraft();

  const theme = draft?.ui?.theme || 'system';

  const languages = useMemo(() => {
    const arr = draft?.voice?.languages;
    return Array.isArray(arr) ? arr : ['en'];
  }, [draft]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Language & Theme</div>
        <div className="mt-1 text-sm text-slate-600">Default language and theme preset.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Theme preset</div>
            <div className="text-xs text-slate-600">Default theme used by the site.</div>
          </div>
          <select
            className="rounded border border-slate-300 bg-white px-2 py-1 text-sm"
            value={theme}
            onChange={(e) => patchDraft({ ui: { theme: e.target.value as any } } as any)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>

        <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-semibold">Languages</div>
          <div className="mt-1 text-xs text-slate-600">Comma-separated codes (e.g., en,hi).</div>
          <input
            className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={languages.join(',')}
            onChange={(e) => {
              const next = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
              patchDraft({ voice: { languages: next } } as any);
            }}
            placeholder="en,hi"
          />
        </label>
      </div>
    </div>
  );
}

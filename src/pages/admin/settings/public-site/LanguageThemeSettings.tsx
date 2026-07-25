import { useEffect, useMemo, useState } from 'react';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';
import { normalizePublicSiteLanguageCode, normalizePublicSiteLanguageCodes } from '@/types/publicSiteSettings';

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  gu: 'Gujarati',
};

function unsupportedLanguageTokens(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((token) => {
      const unsupported = !normalizePublicSiteLanguageCode(token);
      if (!unsupported || seen.has(token)) return false;
      seen.add(token);
      return true;
    });
}

export default function LanguageThemeSettings() {
  const { draft, patchDraft } = usePublicSiteSettingsDraft();

  const theme = (draft as any)?.languageTheme?.themePreset || 'system';

  const languages = useMemo(() => {
    const arr = (draft as any)?.languageTheme?.languages;
    return Array.isArray(arr) && arr.length > 0 ? arr : ['en'];
  }, [draft]);
  const languageText = languages.join(',');
  const [languageInput, setLanguageInput] = useState(languageText);
  const unsupportedTokens = unsupportedLanguageTokens(languageInput);

  useEffect(() => {
    setLanguageInput(languageText);
  }, [languageText]);

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
            onChange={(e) => patchDraft({ languageTheme: { themePreset: e.target.value as any } } as any)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </label>

        <label className="block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-sm font-semibold">Languages</div>
          <div className="mt-1 text-xs text-slate-600">Comma-separated canonical codes: en,hi,gu.</div>
          <input
            className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm"
            value={languageInput}
            onChange={(e) => {
              const raw = e.target.value;
              setLanguageInput(raw);
              const next = normalizePublicSiteLanguageCodes(raw);
              patchDraft({ languageTheme: { languages: next } } as any);
            }}
            placeholder="en,hi,gu"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {languages.map((code) => (
              <span key={code} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700">
                {LANGUAGE_LABELS[code] || code} ({code})
              </span>
            ))}
          </div>
          {unsupportedTokens.length > 0 ? (
            <div className="mt-2 text-xs text-amber-700">
              Unsupported language codes ignored: {unsupportedTokens.join(', ')}. Use en, hi, or gu.
            </div>
          ) : null}
        </label>
      </div>
    </div>
  );
}

import StickySettingsBar from '@/components/settings/StickySettingsBar';
import { useSettingsSection } from '@/lib/useSettingsSection';
import type { SiteSettings } from '@/types/siteSettings';

export default function VoiceLanguagesSettings() {
  const { loading, saving, dirty, state, setState, save, cancel } = useSettingsSection(
    (s) => s.voice,
    (prev, part) => ({ ...prev, voice: part }) as SiteSettings
  );

  const onToggle = (key: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!state) return;
    setState({ ...state, [key]: e.target.checked } as any);
  };
  const onSelectVoice = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!state) return;
    setState({ ...state, ttsVoice: e.target.value });
  };

  const onLanguages = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!state) return;
    const arr = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
    setState({ ...state, languages: arr });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-3">Voice & Languages</h2>
        {loading || !state ? (
          <div className="text-slate-600">Loading…</div>
        ) : (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.ttsEnabled} onChange={onToggle('ttsEnabled')} />
              <span>Enable Text-to-Speech</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-48">Voice</span>
              <select value={state.ttsVoice} onChange={onSelectVoice} className="border rounded px-2 py-1">
                <option value="female_en">Female (EN)</option>
                <option value="male_en">Male (EN)</option>
                <option value="female_hi">Female (HI)</option>
                <option value="male_hi">Male (HI)</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.rtlEnabled} onChange={onToggle('rtlEnabled')} />
              <span>Enable RTL (admin only)</span>
            </label>
            <label className="flex items-center gap-2 md:col-span-2">
              <span className="w-48">Languages (comma-separated)</span>
              <textarea rows={2} value={(state.languages || []).join(', ')} onChange={onLanguages} className="flex-1 border rounded px-2 py-1" />
            </label>
          </form>
        )}
      </div>
      <StickySettingsBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} />
    </div>
  );
}

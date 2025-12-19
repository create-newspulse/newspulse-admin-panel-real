import StickySettingsBar from '@/components/settings/StickySettingsBar';
import { useSettingsSection } from '@/lib/useSettingsSection';
import type { SiteSettings } from '@/types/siteSettings';

export default function AIModulesSettings() {
  const { loading, saving, dirty, state, setState, save, cancel } = useSettingsSection(
    (s) => s.ai,
    (prev, part) => ({ ...prev, ai: part }) as SiteSettings
  );

  const onToggle = (key: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!state) return;
    setState({ ...state, [key]: e.target.checked } as any);
  };
  const onSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!state) return;
    setState({ ...state, model: e.target.value as any });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-3">AI Modules</h2>
        {loading || !state ? (
          <div className="text-slate-600">Loading…</div>
        ) : (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.editorialAssistant} onChange={onToggle('editorialAssistant')} />
              <span>Enable Editorial Assistant</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.autoSummaries} onChange={onToggle('autoSummaries')} />
              <span>Auto-generate summaries</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.contentTagging} onChange={onToggle('contentTagging')} />
              <span>AI content tagging</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-48">Model</span>
              <select value={state.model} onChange={onSelect} className="border rounded px-2 py-1">
                <option value="gpt">GPT</option>
                <option value="mixtral">Mixtral</option>
                <option value="claude">Claude</option>
                <option value="local">Local</option>
              </select>
            </label>
          </form>
        )}
      </div>
      <StickySettingsBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} />
    </div>
  );
}

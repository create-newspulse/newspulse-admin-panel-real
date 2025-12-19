import StickySettingsBar from '@/components/settings/StickySettingsBar';
import { useSettingsSection } from '@/lib/useSettingsSection';
import type { SiteSettings } from '@/types/siteSettings';

export default function PublishingSettings() {
  const { loading, saving, dirty, state, setState, save, cancel } = useSettingsSection(
    (s) => s.publishing,
    (prev, part) => ({ ...prev, publishing: part }) as SiteSettings
  );

  const onToggle = (key: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!state) return;
    setState({ ...state, [key]: e.target.checked } as any);
  };
  const onSelect = (key: 'reviewWorkflow' | 'defaultVisibility') => (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!state) return;
    setState({ ...state, [key]: e.target.value } as any);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-3">Publishing</h2>
        {loading || !state ? (
          <div className="text-slate-600">Loading…</div>
        ) : (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.autoPublishApproved} onChange={onToggle('autoPublishApproved')} />
              <span>Auto-publish approved articles</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-48">Review Workflow</span>
              <select value={state.reviewWorkflow} onChange={onSelect('reviewWorkflow')} className="border rounded px-2 py-1">
                <option value="none">None</option>
                <option value="basic">Basic</option>
                <option value="strict">Strict</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-48">Default Visibility</span>
              <select value={state.defaultVisibility} onChange={onSelect('defaultVisibility')} className="border rounded px-2 py-1">
                <option value="public">Public</option>
                <option value="private">Private</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </label>
          </form>
        )}
      </div>
      <StickySettingsBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} />
    </div>
  );
}

import StickySettingsBar from '@/components/settings/StickySettingsBar';
import { useSettingsSection } from '@/lib/useSettingsSection';
import type { SiteSettings } from '@/types/siteSettings';

export default function CommunitySettings() {
  const { loading, saving, dirty, state, setState, save, cancel } = useSettingsSection(
    (s) => s.community,
    (prev, part) => ({ ...prev, community: part }) as SiteSettings
  );

  const onToggle = (key: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!state) return;
    setState({ ...state, [key]: e.target.checked } as any);
  };
  const onSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!state) return;
    setState({ ...state, moderationLevel: e.target.value as any });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-3">Community</h2>
        {loading || !state ? (
          <div className="text-slate-600">Loading…</div>
        ) : (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.reporterPortalEnabled} onChange={onToggle('reporterPortalEnabled')} />
              <span>Enable Reporter Portal</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.commentsEnabled} onChange={onToggle('commentsEnabled')} />
              <span>Enable Comments</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-48">Moderation Level</span>
              <select value={state.moderationLevel} onChange={onSelect} className="border rounded px-2 py-1">
                <option value="open">Open</option>
                <option value="moderated">Moderated</option>
                <option value="closed">Closed</option>
              </select>
            </label>
          </form>
        )}
      </div>
      <StickySettingsBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} />
    </div>
  );
}

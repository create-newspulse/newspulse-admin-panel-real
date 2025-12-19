import StickySettingsBar from '@/components/settings/StickySettingsBar';
import { useSettingsSection } from '@/lib/useSettingsSection';
import type { SiteSettings } from '@/types/siteSettings';

export default function NavigationSettings() {
  const { loading, saving, dirty, state, setState, save, cancel } = useSettingsSection(
    (s) => s.navigation,
    (prev, part) => ({ ...prev, navigation: part }) as SiteSettings
  );

  const onToggle = (key: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!state) return;
    setState({ ...state, [key]: e.target.checked } as any);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-3">Navigation</h2>
        {loading || !state ? (
          <div className="text-slate-600">Loading…</div>
        ) : (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.enableTopNav} onChange={onToggle('enableTopNav')} />
              <span>Enable Top Navigation</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.enableSidebar} onChange={onToggle('enableSidebar')} />
              <span>Enable Sidebar</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.enableBreadcrumbs} onChange={onToggle('enableBreadcrumbs')} />
              <span>Enable Breadcrumbs</span>
            </label>
          </form>
        )}
      </div>
      <StickySettingsBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} />
    </div>
  );
}

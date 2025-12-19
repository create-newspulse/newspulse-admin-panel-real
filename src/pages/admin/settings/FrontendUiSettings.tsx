import StickySettingsBar from '@/components/settings/StickySettingsBar';
import { useSettingsSection } from '@/lib/useSettingsSection';
import type { SiteSettings } from '@/types/siteSettings';
import { DEFAULT_SETTINGS } from '@/types/siteSettings';
import { toast } from 'react-hot-toast';

export default function FrontendUiSettings() {
  const { loading, saving, dirty, error, state, setState, save, cancel } = useSettingsSection(
    (s) => s.ui,
    (prev, part) => ({ ...prev, ui: part }) as SiteSettings
  );

  const onToggle = (key: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!state) return;
    setState({ ...state, [key]: e.target.checked } as any);
  };
  const onSelect = (key: 'theme' | 'density') => (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!state) return;
    setState({ ...state, [key]: e.target.value as any });
  };

  const onSave = async () => {
    try {
      await save();
      toast.success('Settings saved');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save settings');
    }
  };

  const onReset = () => {
    setState({ ...DEFAULT_SETTINGS.ui });
    toast('Defaults applied (not saved)', { icon: '⚠️' });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-3">Frontend UI</h2>
        {loading ? (
          <div className="text-slate-600">Loading…</div>
        ) : !state ? (
          <div className="text-red-600">{error || 'Failed to load settings'}</div>
        ) : (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.showExploreCategories} onChange={onToggle('showExploreCategories')} />
              <span>Show Explore Categories</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.showCategoryStrip} onChange={onToggle('showCategoryStrip')} />
              <span>Show Category Strip</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.showTrendingStrip} onChange={onToggle('showTrendingStrip')} />
              <span>Show Trending Strip</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.showLiveUpdatesTicker} onChange={onToggle('showLiveUpdatesTicker')} />
              <span>Show Live Updates Ticker</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.showBreakingTicker} onChange={onToggle('showBreakingTicker')} />
              <span>Show Breaking Ticker</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.showQuickTools} onChange={onToggle('showQuickTools')} />
              <span>Show Quick Tools</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.showAppPromo} onChange={onToggle('showAppPromo')} />
              <span>Show App Promo</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.showFooter} onChange={onToggle('showFooter')} />
              <span>Show Footer</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-48">Theme</span>
              <select value={state.theme} onChange={onSelect('theme')} className="border rounded px-2 py-1">
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-48">Density</span>
              <select value={state.density} onChange={onSelect('density')} className="border rounded px-2 py-1">
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
            </label>
          </form>
        )}
      </div>
      <StickySettingsBar dirty={dirty} saving={saving} onSave={onSave} onCancel={cancel} onReset={onReset} />
    </div>
  );
}


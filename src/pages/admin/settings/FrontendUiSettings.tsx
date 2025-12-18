import { useEffect, useState } from 'react';
import { siteSettingsApi, type AdminSettingsPayload } from '@/lib/siteSettingsApi';

type Message = { type: 'success'|'error'; text: string } | null;

const DEFAULTS: AdminSettingsPayload = {
  showExploreCategories: true,
  showCategoryStrip: true,
  showTrendingStrip: true,
  showLiveUpdatesTicker: false,
  showBreakingTicker: false,
  showQuickTools: true,
  showAppPromo: false,
  showFooter: true,
};

export default function FrontendUiSettings() {
  const apiUrl = (import.meta as any).env?.VITE_API_URL as string | undefined;
  const [settings, setSettings] = useState<AdminSettingsPayload>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await siteSettingsApi.getAdminSettings();
        if (mounted) {
          if (data) setSettings({ ...DEFAULTS, ...data });
        }
      } catch (err: any) {
        setMessage({ type: 'error', text: err?.message || 'Failed to load settings' });
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const onToggle = (key: keyof AdminSettingsPayload) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings((prev) => ({ ...prev, [key]: e.target.checked }));
  };

  const onSave = async () => {
    setMessage(null);
    setSaving(true);
    try {
      await siteSettingsApi.saveAdminSettings(settings);
      setMessage({ type: 'success', text: 'Settings saved successfully.' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const disabled = !apiUrl || saving;

  return (
    <div className="space-y-4">
      {!apiUrl && (
        <div className="p-3 rounded border border-yellow-300 bg-yellow-50 text-yellow-800">
          VITE_API_URL is not set. Loading and saving is disabled.
        </div>
      )}
      {message && (
        <div className={`p-3 rounded border ${message.type === 'success' ? 'border-green-300 bg-green-50 text-green-800' : 'border-red-300 bg-red-50 text-red-800'}`}>
          {message.text}
        </div>
      )}
      <div className="p-4 rounded border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-3">Frontend UI Visibility</h2>
        {loading ? (
          <div className="text-slate-600">Loading current settings…</div>
        ) : (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.showExploreCategories} onChange={onToggle('showExploreCategories')} />
              <span>Show Explore Categories</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.showCategoryStrip} onChange={onToggle('showCategoryStrip')} />
              <span>Show Category Strip</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.showTrendingStrip} onChange={onToggle('showTrendingStrip')} />
              <span>Show Trending Strip</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.showLiveUpdatesTicker} onChange={onToggle('showLiveUpdatesTicker')} />
              <span>Show Live Updates Ticker</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.showBreakingTicker} onChange={onToggle('showBreakingTicker')} />
              <span>Show Breaking Ticker</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.showQuickTools} onChange={onToggle('showQuickTools')} />
              <span>Show Quick Tools</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.showAppPromo} onChange={onToggle('showAppPromo')} />
              <span>Show App Promo</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.showFooter} onChange={onToggle('showFooter')} />
              <span>Show Footer</span>
            </label>

            <div className="md:col-span-2 mt-4">
              <button type="button" disabled={disabled} onClick={onSave} className={`px-4 py-2 rounded ${disabled ? 'bg-slate-300 text-slate-700' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>
                {saving ? 'Saving…' : 'Save Settings'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
// (legacy inline demo component removed to avoid duplicate default export)

import StickySettingsBar from '@/components/settings/StickySettingsBar';
import { useSettingsSection } from '@/lib/useSettingsSection';
import type { SiteSettings } from '@/types/siteSettings';

export default function IntegrationsSettings() {
  const { loading, saving, dirty, state, setState, save, cancel } = useSettingsSection(
    (s) => s.integrations,
    (prev, part) => ({ ...prev, integrations: part }) as SiteSettings
  );

  const onToggle = (key: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!state) return;
    setState({ ...state, [key]: e.target.checked } as any);
  };
  const onSelect = (key: 'analyticsProvider' | 'newsletterProvider') => (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!state) return;
    setState({ ...state, [key]: e.target.value as any });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-3">Integrations</h2>
        {loading || !state ? (
          <div className="text-slate-600">Loading…</div>
        ) : (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.analyticsEnabled} onChange={onToggle('analyticsEnabled')} />
              <span>Enable Analytics</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-48">Analytics Provider</span>
              <select value={state.analyticsProvider} onChange={onSelect('analyticsProvider')} className="border rounded px-2 py-1">
                <option value="none">None</option>
                <option value="ga4">Google Analytics 4</option>
                <option value="plausible">Plausible</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-48">Newsletter Provider</span>
              <select value={state.newsletterProvider} onChange={onSelect('newsletterProvider')} className="border rounded px-2 py-1">
                <option value="none">None</option>
                <option value="mailchimp">Mailchimp</option>
                <option value="resend">Resend</option>
              </select>
            </label>
          </form>
        )}
      </div>
      <StickySettingsBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} />
    </div>
  );
}

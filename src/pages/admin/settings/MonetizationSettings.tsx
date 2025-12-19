import StickySettingsBar from '@/components/settings/StickySettingsBar';
import { useSettingsSection } from '@/lib/useSettingsSection';
import type { SiteSettings } from '@/types/siteSettings';

export default function MonetizationSettings() {
  const { loading, saving, dirty, state, setState, save, cancel } = useSettingsSection(
    (s) => s.monetization,
    (prev, part) => ({ ...prev, monetization: part }) as SiteSettings
  );

  const onToggle = (key: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!state) return;
    setState({ ...state, [key]: e.target.checked } as any);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-3">Monetization</h2>
        {loading || !state ? (
          <div className="text-slate-600">Loading…</div>
        ) : (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.adsEnabled} onChange={onToggle('adsEnabled')} />
              <span>Enable Ads</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.sponsorBlocks} onChange={onToggle('sponsorBlocks')} />
              <span>Show Sponsor Blocks</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.membershipEnabled} onChange={onToggle('membershipEnabled')} />
              <span>Enable Memberships</span>
            </label>
          </form>
        )}
      </div>
      <StickySettingsBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} />
    </div>
  );
}

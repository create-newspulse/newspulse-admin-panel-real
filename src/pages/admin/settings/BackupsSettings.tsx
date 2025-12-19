import StickySettingsBar from '@/components/settings/StickySettingsBar';
import { useSettingsSection } from '@/lib/useSettingsSection';
import type { SiteSettings } from '@/types/siteSettings';
import { useAuthZ } from '@/store/auth';

export default function BackupsSettings() {
  const { hasRole } = useAuthZ();
  const isFounder = hasRole('founder');
  const { loading, saving, dirty, state, setState, save, cancel } = useSettingsSection(
    (s) => s.backups,
    (prev, part) => ({ ...prev, backups: part }) as SiteSettings
  );

  if (!isFounder) {
    return <div className="p-4 rounded border border-red-200 bg-red-50 text-red-800">Founder access required.</div>;
  }

  const onToggle = (key: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!state) return;
    setState({ ...state, [key]: e.target.checked } as any);
  };
  const onCadence = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!state) return;
    setState({ ...state, cadence: e.target.value as any });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-3">Backups</h2>
        {loading || !state ? (
          <div className="text-slate-600">Loading…</div>
        ) : (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.enabled} onChange={onToggle('enabled')} />
              <span>Enable Backups</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-48">Cadence</span>
              <select value={state.cadence} onChange={onCadence} className="border rounded px-2 py-1">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </form>
        )}
      </div>
      <StickySettingsBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} />
    </div>
  );
}

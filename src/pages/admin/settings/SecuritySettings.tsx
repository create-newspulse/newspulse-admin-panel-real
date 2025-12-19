import StickySettingsBar from '@/components/settings/StickySettingsBar';
import { useSettingsSection } from '@/lib/useSettingsSection';
import type { SiteSettings } from '@/types/siteSettings';
import { useAuthZ } from '@/store/auth';

export default function SecuritySettings() {
  const { hasRole } = useAuthZ();
  const isFounder = hasRole('founder');
  const { loading, saving, dirty, state, setState, save, cancel } = useSettingsSection(
    (s) => s.security,
    (prev, part) => ({ ...prev, security: part }) as SiteSettings
  );

  if (!isFounder) {
    return <div className="p-4 rounded border border-red-200 bg-red-50 text-red-800">Founder access required.</div>;
  }

  const onToggle = (key: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!state) return;
    setState({ ...state, [key]: e.target.checked } as any);
  };
  const onAllowedHosts = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!state) return;
    const hosts = e.target.value.split(/\n|,/).map(s => s.trim()).filter(Boolean);
    setState({ ...state, allowedHosts: hosts });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-3">Security</h2>
        {loading || !state ? (
          <div className="text-slate-600">Loading…</div>
        ) : (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.lockdown} onChange={onToggle('lockdown')} />
              <span>Lockdown Mode</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.twoFactorRequired} onChange={onToggle('twoFactorRequired')} />
              <span>Require 2FA for Admins</span>
            </label>
            <label className="flex flex-col gap-2 md:col-span-2">
              <span>Allowed Hosts (one per line)</span>
              <textarea rows={4} value={(state.allowedHosts || []).join('\n')} onChange={onAllowedHosts} className="border rounded px-2 py-1" />
            </label>
          </form>
        )}
      </div>
      <StickySettingsBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} />
    </div>
  );
}

import StickySettingsBar from '@/components/settings/StickySettingsBar';
import { useSettingsSection } from '@/lib/useSettingsSection';
import type { SiteSettings } from '@/types/siteSettings';
import { Link } from 'react-router-dom';

export default function AuditLogsSettings() {
  const { loading, saving, dirty, state, setState, save, cancel } = useSettingsSection(
    (s) => s.audit,
    (prev, part) => ({ ...prev, audit: part }) as SiteSettings
  );

  const onToggle = (key: keyof typeof state) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!state) return;
    setState({ ...state, [key]: e.target.checked } as any);
  };
  const onDays = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!state) return;
    const v = Math.max(1, Math.min(365, Number(e.target.value) || 90));
    setState({ ...state, retentionDays: v });
  };

  return (
    <div className="space-y-4">
      <div className="p-4 rounded border border-slate-200 bg-white">
        <h2 className="text-lg font-semibold mb-3">Audit Logs</h2>
        {loading || !state ? (
          <div className="text-slate-600">Loading…</div>
        ) : (
          <form className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={state.enabled} onChange={onToggle('enabled')} />
              <span>Enable Audit Logging</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-48">Retention (days)</span>
              <input type="number" min={1} max={365} value={state.retentionDays} onChange={onDays} className="border rounded px-2 py-1 w-28" />
            </label>
            <div className="md:col-span-2 text-sm text-slate-600">
              View recent events in <Link className="text-blue-600" to="/safeownerzone/audit">Audit Viewer</Link>.
            </div>
          </form>
        )}
      </div>
      <StickySettingsBar dirty={dirty} saving={saving} onSave={save} onCancel={cancel} />
    </div>
  );
}

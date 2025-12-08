import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext.tsx';
import { useNotify } from '@/components/ui/toast-bridge';
import { fetchCommunitySettings, updateCommunitySettings } from '@/lib/api/communityAdmin.ts';
import type { CommunitySettings } from '@/lib/api/communityAdmin.ts';

export default function FeatureTogglesCommunityReporter() {
  const { isFounder } = useAuth();
  const notify = useNotify();
  const [settings, setSettings] = useState<CommunitySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await fetchCommunitySettings();
        if (!cancelled) setSettings(s);
      } catch (e: any) {
        const status = e?.response?.status;
        const msg = status ? `Request failed with status code ${status}` : e?.message || 'Unable to load settings';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  async function saveChanges() {
    if (!settings || saving) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateCommunitySettings(settings);
      setSettings(updated);
      notify.ok('Settings updated');
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 403) {
        setError('You do not have permission to change these settings.');
      } else {
        const msg = e?.message || 'Failed to save settings';
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Community Reporter Feature Toggles</h1>
      <p className="text-sm text-slate-600">Founder-only switches to open/close Community Reporter program.</p>

      {error && (
        <div className="p-4 border rounded border-red-300 text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button type="button" onClick={() => setReload(r => r + 1)} className="px-3 py-1 text-sm bg-red-600 text-white rounded">Retry</button>
        </div>
      )}

      {loading && <div className="p-4 border rounded">Loading settings...</div>}

      {!loading && settings && (
        <div className="border rounded p-4 bg-white">
          <div className="space-y-4">
            <ToggleRow
              label="Enable Community Reporter module"
              description="When off, all public Community Reporter entry points are disabled."
              checked={settings.communityReporterEnabled}
              disabled={!isFounder}
              onChange={(v) => setSettings(s => s ? { ...s, communityReporterEnabled: v } : s)}
            />
            <ToggleRow
              label="Accept new Community Reporter submissions"
              checked={settings.allowNewSubmissions}
              disabled={!isFounder}
              onChange={(v) => setSettings(s => s ? { ...s, allowNewSubmissions: v } : s)}
            />
            <ToggleRow
              label="Allow My Community Stories portal"
              checked={settings.allowMyStoriesPortal}
              disabled={!isFounder}
              onChange={(v) => setSettings(s => s ? { ...s, allowMyStoriesPortal: v } : s)}
            />
            <ToggleRow
              label="Accept Journalist verification applications"
              checked={settings.allowJournalistApplications}
              disabled={!isFounder}
              onChange={(v) => setSettings(s => s ? { ...s, allowJournalistApplications: v } : s)}
            />
            <ToggleRow
              label="Safe Mode – manual review only"
              checked={settings.safeModeManualReviewOnly}
              disabled={!isFounder}
              onChange={(v) => setSettings(s => s ? { ...s, safeModeManualReviewOnly: v } : s)}
            />
          </div>

          {!isFounder && (
            <div className="mt-4 text-xs text-slate-600">Only the Founder can change these settings.</div>
          )}

          {isFounder && (
            <div className="mt-6">
              <button
                type="button"
                onClick={saveChanges}
                disabled={saving}
                className="px-4 py-2 rounded bg-slate-900 text-white text-sm hover:bg-slate-800 disabled:opacity-50"
              >{saving ? 'Saving...' : 'Save changes'}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, description, checked, disabled, onChange }: { label: string; description?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="font-medium">{label}</div>
        {description && <div className="text-xs text-slate-600 mt-1">{description}</div>}
      </div>
      <label className={`inline-flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
        <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} disabled={disabled} />
        <span className="text-sm">{checked ? 'ON' : 'OFF'}</span>
      </label>
    </div>
  );
}

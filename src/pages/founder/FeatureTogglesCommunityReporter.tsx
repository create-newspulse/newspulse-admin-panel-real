import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/adminApi';

type SettingsResponse = {
  success: boolean;
  settings: { myCommunityStoriesEnabled: boolean };
};

export default function FeatureTogglesCommunityReporter() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState<boolean>(false);
  const [reload, setReload] = useState(0);

  // Load current setting from backend
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminApi.get<SettingsResponse>(
          '/api/admin/settings/community-reporter'
        );
        if (!cancelled) {
          const flag = !!res.data?.settings?.myCommunityStoriesEnabled;
          setEnabled(flag);
        }
      } catch (e: any) {
        const status = e?.response?.status;
        const msg = status
          ? `Request failed with status code ${status}`
          : e?.message || 'Unable to load settings';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [reload]);

  const onToggle = async (next: boolean) => {
    if (saving) return;

    const previous = enabled;
    setEnabled(next); // optimistic
    setSaving(true);
    setError(null);

    try {
      await adminApi.post<SettingsResponse>(
        '/api/admin/settings/community-reporter',
        { myCommunityStoriesEnabled: next }
      );
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = status
        ? `Request failed with status code ${status}`
        : e?.message || 'Failed to save settings';
      setError(msg);
      setEnabled(previous); // rollback
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Feature Toggles – Community Reporter
      </h1>

      {error && (
        <div className="p-4 border rounded border-red-300 text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setReload((r) => r + 1)}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded"
          >
            Retry
          </button>
        </div>
      )}

      {loading && (
        <div className="p-4 border rounded">Loading settings…</div>
      )}

      {!loading && (
        <div className="border rounded p-4 bg-white dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-semibold">
                My Community Stories (Reporter Portal) – ON/OFF for public site
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                When OFF, the public “My Community Stories” page is hidden on
                the News Pulse website. When ON, reporters can see and use it.
              </div>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!!enabled}
                onChange={(e) => onToggle(e.target.checked)}
                disabled={saving}
              />
              <span className="text-sm">{enabled ? 'ON' : 'OFF'}</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

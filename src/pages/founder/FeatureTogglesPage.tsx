import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import FounderRoute from '@/components/FounderRoute';
import { getCommunityReporterSettings, updateCommunityReporterSettings } from '@/lib/api/communityReporterSettings';

export default function FeatureTogglesPage() {
  return (
    <FounderRoute>
      <FeatureTogglesInner />
    </FounderRoute>
  );
}

function FeatureTogglesInner() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<{ myStoriesEnabled: boolean }>({ myStoriesEnabled: false });
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await getCommunityReporterSettings();
        if (!cancelled) setSettings({ myStoriesEnabled: !!s.myStoriesEnabled });
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load settings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reload]);

  const onToggle = async (next: boolean) => {
    if (saving) return;
    const prev = settings.myStoriesEnabled;
    setSettings({ myStoriesEnabled: next });
    setSaving(true);
    try {
      const s = await updateCommunityReporterSettings({ myStoriesEnabled: next });
      setSettings({ myStoriesEnabled: !!s.myStoriesEnabled });
      toast.success('Settings saved');
    } catch (e: any) {
      setSettings({ myStoriesEnabled: prev });
      toast.error(e?.message || 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb is handled globally by <Breadcrumbs /> */}
      <h1 className="text-2xl font-bold">Feature Toggles – Community Reporter</h1>
      {error && (
        <div className="p-4 border rounded border-red-300 text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setReload(r => r + 1)} className="px-3 py-1 text-sm bg-red-600 text-white rounded">Retry</button>
        </div>
      )}
      {loading && <div className="p-4 border rounded">Loading settings…</div>}
      {!loading && !error && (
        <div className="border rounded p-4 bg-white dark:bg-slate-900">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold">My Community Stories (Reporter Portal)</div>
              <div className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                Controls the My Community Stories page and link on the public site.
                When OFF, reporters can still submit stories but cannot see the My Stories dashboard.
              </div>
            </div>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!settings.myStoriesEnabled}
                onChange={(e) => onToggle(e.target.checked)}
                disabled={saving}
              />
              <span className="text-sm">{settings.myStoriesEnabled ? 'ON' : 'OFF'}</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

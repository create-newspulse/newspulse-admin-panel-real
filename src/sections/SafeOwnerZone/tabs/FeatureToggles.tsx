import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminApi } from '@/lib/adminApi';

export interface CommunityReporterConfig {
  communityMyStoriesEnabled: boolean;
  // Future extra keys allowed implicitly
  [key: string]: any;
}

async function getCommunityReporterConfig(): Promise<CommunityReporterConfig> {
  const res = await adminApi.get<CommunityReporterConfig>('/community-reporter/config');
  return res.data as CommunityReporterConfig;
}

async function updateCommunityReporterConfig(partial: Partial<CommunityReporterConfig>): Promise<CommunityReporterConfig> {
  const res = await adminApi.put<CommunityReporterConfig>('/community-reporter/config', partial);
  return res.data as CommunityReporterConfig;
}

export default function FeatureToggles() {
  const [cfg, setCfg] = useState<CommunityReporterConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await getCommunityReporterConfig();
        if (!cancelled) setCfg(r);
      } catch (e: any) {
        toast.error(e?.message || 'Failed to load feature config');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function toggleMyStories(enabled: boolean) {
    if (saving) return;
    setSaving(true);
    try {
      const next = await updateCommunityReporterConfig({ communityMyStoriesEnabled: enabled });
      setCfg(next);
      toast.success(enabled ? 'My Community Stories enabled' : 'My Community Stories disabled');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  const current = cfg?.communityMyStoriesEnabled === true;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">Feature Toggles</h2>
        <p className="text-sm text-slate-600">Control visibility of Community Reporter features on the public site.</p>
      </header>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-medium">My Community Stories (Reporter Portal)</h3>
            <p className="text-sm text-slate-600">Show/hide the public Portal section that lists a reporter’s submissions.</p>
            {loading && <p className="text-xs text-slate-500 mt-2">Loading current status…</p>}
          </div>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={current}
              onChange={(e) => toggleMyStories(e.target.checked)}
              disabled={saving || loading}
            />
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${current ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
              {current ? 'Enabled' : 'Disabled'}
            </span>
          </label>
        </div>
      </div>

      <div className="text-xs text-slate-500">This setting updates the backend config via <code>/api/admin/community-reporter/config</code> and is read by the public frontend to toggle visibility.</div>
    </div>
  );
}

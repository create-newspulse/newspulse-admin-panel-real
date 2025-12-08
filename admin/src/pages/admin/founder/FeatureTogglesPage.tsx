import React, { useEffect, useState } from 'react';
import { getCommunityReporterSettings, updateCommunityReporterSettings } from '../../../lib/api/communityReporterSettings';
import AdminProtectedRoute from '../../../components/AdminProtectedRoute';
import { useAdminAuth } from '../../../context/AdminAuthContext';

export default function FeatureTogglesPage(){
  return (
    <AdminProtectedRoute>
      <FeatureTogglesInner />
    </AdminProtectedRoute>
  );
}

function FeatureTogglesInner(){
  const { auth } = useAdminAuth();
  // Simple founder-only guard based on email. Can be extended to role-based later.
  const meta: any = import.meta as any;
  const founderEmails = ((meta?.env?.VITE_FOUNDER_EMAILS as string) || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  const isFounder = auth.email && founderEmails.length > 0 ? founderEmails.includes(auth.email) : true; // default open if not configured

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [myCommunityStoriesEnabled, setMyCommunityStoriesEnabled] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string|null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await getCommunityReporterSettings();
        if (!mounted) return;
        setMyCommunityStoriesEnabled(!!s.myCommunityStoriesEnabled);
      } catch (e:any) {
        setError(e?.message || 'Failed to load settings');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [reloadFlag]);

  const retry = () => setReloadFlag(x => x + 1);

  const onToggle = async (nextVal: boolean) => {
    const prev = myCommunityStoriesEnabled;
    setMyCommunityStoriesEnabled(nextVal);
    setSaving(true);
    try {
      const s = await updateCommunityReporterSettings({ myCommunityStoriesEnabled: nextVal });
      setMyCommunityStoriesEnabled(!!s.myCommunityStoriesEnabled);
      setToast('Saved');
      setTimeout(()=> setToast(null), 3000);
    } catch (e:any) {
      setMyCommunityStoriesEnabled(prev);
      setError(`Request failed: ${e?.message || 'Failed to update settings'}`);
      setTimeout(()=> setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  if (!isFounder) {
    return <div className="p-6"><h2 className="text-xl font-semibold">Feature Toggles</h2><div className="mt-4 text-sm text-red-600">You do not have Founder access.</div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-slate-600">Home / Founder / Feature Toggles</div>
      <h1 className="text-2xl font-bold">Feature Toggles – Community Reporter</h1>
      {toast && <div className="p-3 text-sm bg-green-100 text-green-700 rounded border border-green-200">{toast}</div>}
      {loading && <div className="p-4 border rounded">Loading settings…</div>}
      {error && (
        <div className="p-4 border rounded border-red-300 text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={retry} className="px-3 py-1 text-sm bg-red-600 text-white rounded">Retry</button>
        </div>
      )}
      {!loading && !error && (
        <div className="border rounded p-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-semibold">Community Reporter – Feature Toggles</div>
              <div className="mt-4">
                <div className="font-semibold">My Community Stories (Reporter Portal)</div>
                <div className="text-sm text-slate-600 mt-1">Show / hide the public Reporter Portal page that lists a reporter’s submissions.</div>
              </div>
            </div>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={!!myCommunityStoriesEnabled} onChange={e=> onToggle(e.target.checked)} disabled={saving} />
              <span className="text-sm">{myCommunityStoriesEnabled ? 'ON' : 'OFF'}</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

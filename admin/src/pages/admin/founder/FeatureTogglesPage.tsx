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
  const { auth, isReady } = useAdminAuth();
  // Simple founder-only guard based on email. Can be extended to role-based later.
  const meta: any = import.meta as any;
  const founderEmails = ((meta?.env?.VITE_FOUNDER_EMAILS as string) || '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  const emailIsFounder = !!(auth.email && founderEmails.length > 0 && founderEmails.includes(auth.email));
  const hasFounderClaim = auth.isFounder === true;
  const isFounder = hasFounderClaim || emailIsFounder || (founderEmails.length === 0 && auth.isFounder !== false);
  const sessionSummary = [auth.email || 'unknown account', auth.role ? `role: ${auth.role}` : null].filter(Boolean).join(' • ');
  const sessionSource = auth.source ? `source: ${auth.source}` : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const [settings, setSettings] = useState({
    communityReporterClosed: false,
    reporterPortalClosed: false,
    updatedAt: undefined as string | undefined,
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string|null>(null);
  const [reloadFlag, setReloadFlag] = useState(0);

  useEffect(() => {
    if (!isReady || !auth.token) {
      setLoading(!isReady);
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await getCommunityReporterSettings();
        if (!mounted) return;
        setSettings({
          communityReporterClosed: !!s.communityReporterClosed,
          reporterPortalClosed: !!s.reporterPortalClosed,
          updatedAt: s.updatedAt,
        });
      } catch (e:any) {
        const status = e?.response?.status;
        if (status === 401 || status === 403) {
          setError('Founder access required');
        } else {
          setError(e?.message || 'Failed to load settings');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [auth.token, isReady, reloadFlag]);

  const retry = () => setReloadFlag(x => x + 1);

  const onToggle = async (key: 'communityReporterClosed' | 'reporterPortalClosed', nextVal: boolean) => {
    const prev = settings;
    setSettings(current => ({ ...current, [key]: nextVal }));
    setSaving(true);
    try {
      const s = await updateCommunityReporterSettings({
        communityReporterClosed: key === 'communityReporterClosed' ? nextVal : settings.communityReporterClosed,
        reporterPortalClosed: key === 'reporterPortalClosed' ? nextVal : settings.reporterPortalClosed,
      });
      setSettings({
        communityReporterClosed: !!s.communityReporterClosed,
        reporterPortalClosed: !!s.reporterPortalClosed,
        updatedAt: s.updatedAt,
      });
      setToast(
        key === 'communityReporterClosed'
          ? `Community Reporter saved as ${s.communityReporterClosed ? 'closed / hidden' : 'open / visible'}.`
          : `Reporter Portal saved as ${s.reporterPortalClosed ? 'closed / hidden' : 'open / visible'}.`
      );
      setTimeout(()=> setToast(null), 3000);
    } catch (e:any) {
      setSettings(prev);
      const status = e?.response?.status;
      setError((status === 401 || status === 403) ? 'Founder access required' : `Request failed: ${e?.message || 'Failed to update settings'}`);
      setTimeout(()=> setError(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  if (!isFounder) {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold">Feature Toggles</h2>
        <div className="mt-4 text-sm text-red-600">Founder access required.</div>
        <div className="mt-2 text-xs text-slate-500">Current session: {sessionSummary}</div>
        {sessionSource ? <div className="mt-1 text-xs text-slate-500">{sessionSource}</div> : null}
        {auth.hasMismatch ? <div className="mt-1 text-xs text-amber-600">A stale local session differs from the current cookie session. Refresh or sign in again.</div> : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-sm text-slate-600">Home / Founder / Feature Toggles</div>
      <h1 className="text-2xl font-bold">Feature Toggles – Community Reporter</h1>
      {toast && <div className="p-3 text-sm bg-green-100 text-green-700 rounded border border-green-200">{toast}</div>}
      {!loading && settings.updatedAt && <div className="text-xs text-slate-500">Last updated: {new Date(settings.updatedAt).toLocaleString()}</div>}
      {loading && <div className="p-4 border rounded">Loading settings…</div>}
      {error && (
        <div className="p-4 border rounded border-red-300 text-red-700 flex items-center justify-between">
          <span>{error === 'Founder access required' ? `${error}. Current session: ${sessionSummary}${sessionSource ? ` • ${sessionSource}` : ''}${auth.hasMismatch ? ' • stale local session detected' : ''}` : error}</span>
          <button onClick={retry} className="px-3 py-1 text-sm bg-red-600 text-white rounded">Retry</button>
        </div>
      )}
      {!loading && !error && (
        <div className="space-y-4">
          <div className="border rounded p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">Community Reporter</div>
                <div className="text-sm text-slate-600 mt-1">ON closes and hides the public Community Reporter submission entry. OFF keeps it open so reporters can start new submissions.</div>
              </div>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={settings.communityReporterClosed} onChange={e=> onToggle('communityReporterClosed', e.target.checked)} disabled={saving} />
                <span className="text-sm">{settings.communityReporterClosed ? 'ON' : 'OFF'}</span>
              </label>
            </div>
          </div>

          <div className="border rounded p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold">Reporter Portal</div>
                <div className="text-sm text-slate-600 mt-1">ON hides and closes the live Reporter Portal. OFF keeps it open and visible so reporters can log in by email OTP, open their dashboard, manage submissions, update profile details, and submit stories.</div>
              </div>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={settings.reporterPortalClosed} onChange={e=> onToggle('reporterPortalClosed', e.target.checked)} disabled={saving} />
                <span className="text-sm">{settings.reporterPortalClosed ? 'ON' : 'OFF'}</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@context/AuthContext';
import { toast } from 'react-hot-toast';
import { getAdminPanelPreview, toFriendlyErrorMessage, type AdminPanelPreviewResponse } from '@/api/adminPanelSettingsApi';

export default function AdminPreview() {
  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const isFounder = role === 'founder';

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<AdminPanelPreviewResponse | null>(null);
  const [tab, setTab] = useState<'draft' | 'published' | 'effective'>('effective');

  useEffect(() => {
    if (!isFounder) {
      setLoading(false);
      setErr('Access denied (founder only).');
      setData(null);
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await getAdminPanelPreview();
        if (!mounted) return;
        setData(r || {});
      } catch (e: any) {
        if (!mounted) return;
        const msg = toFriendlyErrorMessage(e, 'Preview unavailable');
        setErr(msg);
        setData(null);
        toast.error(msg);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isFounder]);

  const jsonForTab = useMemo(() => {
    const d = data || {};
    if (tab === 'draft') return d.draft ?? {};
    if (tab === 'published') return d.published ?? {};
    return d.effective ?? {};
  }, [data, tab]);

  const pretty = useMemo(() => JSON.stringify(jsonForTab ?? {}, null, 2), [jsonForTab]);

  const download = (name: string, content: string) => {
    try {
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Preview</div>
        <div className="mt-1 text-sm text-slate-600">Preview admin-panel settings payloads from the backend.</div>
        {data && !loading && !err && (
          <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-700">
            <div><span className="font-semibold">Version:</span> {data.version || '—'}</div>
            <div><span className="font-semibold">Updated:</span> {data.updatedAt ? new Date(data.updatedAt).toLocaleString() : '—'}</div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="text-slate-600">Loading…</div>
        ) : err ? (
          <div className="text-red-700">{err}</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                {(['draft', 'published', 'effective'] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTab(k)}
                    className={
                      'rounded-lg border px-3 py-2 text-sm font-semibold ' +
                      (tab === k ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 hover:bg-slate-100')
                    }
                  >
                    {k[0].toUpperCase() + k.slice(1)}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                  onClick={async () => {
                    try {
                      if (!navigator?.clipboard?.writeText) throw new Error('Clipboard unavailable');
                      await navigator.clipboard.writeText(pretty);
                      toast.success('Copied JSON');
                    } catch {
                      toast.error('Copy failed');
                    }
                  }}
                >
                  Copy JSON
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                  onClick={() => download(`admin-panel-${tab}.json`, pretty)}
                >
                  Download JSON
                </button>
              </div>
            </div>

            <pre className="mt-4 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-800">
              {pretty}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

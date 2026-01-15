import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@context/AuthContext';
import { toast } from 'react-hot-toast';
import { getAuditLogs, toFriendlyErrorMessage, type AuditLogRow } from '@/api/adminPanelSettingsApi';

export default function AuditLogsView() {
  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const isFounder = role === 'founder';

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isFounder) {
      setLoading(false);
      setRows([]);
      setErr('Access denied (founder only).');
      return;
    }
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const items = await getAuditLogs(50);
        if (!mounted) return;
        setRows(Array.isArray(items) ? items : []);
      } catch (e: any) {
        if (!mounted) return;
        const msg = toFriendlyErrorMessage(e, 'Audit log unavailable');
        setErr(msg);
        toast.error(msg);
        setRows([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [isFounder]);

  const formatted = useMemo(() => {
    return rows.map((r) => {
      const ts = r.ts || r.time;
      const when = ts ? new Date(ts) : null;
      return {
        ...r,
        _when: when && !Number.isNaN(when.getTime()) ? when.toLocaleString() : ts || '—',
      };
    });
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Audit Logs</div>
        <div className="mt-1 text-sm text-slate-600">Read-only view of recent administrative events.</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {loading ? (
          <div className="text-slate-600">Loading…</div>
        ) : err ? (
          <div className="text-red-700">{err}</div>
        ) : formatted.length === 0 ? (
          <div className="text-slate-600">No audit events.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="py-2 pr-3">When</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3">Action</th>
                  <th className="py-2 pr-3">Target</th>
                  <th className="py-2 pr-3">Meta</th>
                </tr>
              </thead>
              <tbody>
                {formatted.map((r, idx) => (
                  <tr key={idx} className="border-t border-slate-200">
                    <td className="py-2 pr-3">{(r as any)._when}</td>
                    <td className="py-2 pr-3">{r.actorEmail || r.actorId || 'system'}</td>
                    <td className="py-2 pr-3">{r.action || r.type || '—'}</td>
                    <td className="py-2 pr-3">{r.target || '—'}</td>
                    <td className="py-2 pr-3">
                      {(r.meta || r.payload) ? (
                        <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <summary className="cursor-pointer text-xs font-semibold text-slate-700">View JSON</summary>
                          <pre className="mt-2 overflow-auto text-xs text-slate-800">
                            {JSON.stringify(r.meta ?? r.payload, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

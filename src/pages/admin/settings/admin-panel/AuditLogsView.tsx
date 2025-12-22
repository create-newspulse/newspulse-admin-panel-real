import { useEffect, useMemo, useState } from 'react';
import { getRecentAudit } from '@/api/ownerZone';

type Row = {
  ts?: string;
  type?: string;
  actorId?: string;
  role?: string;
  payload?: any;
};

export default function AuditLogsView() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await getRecentAudit(50);
        const items = Array.isArray((r as any)?.items) ? (r as any).items : Array.isArray(r) ? r : (r as any)?.audit || [];
        if (!mounted) return;
        setRows(Array.isArray(items) ? items : []);
      } catch (e: any) {
        if (!mounted) return;
        setErr(e?.message || 'Audit log unavailable');
        setRows([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const formatted = useMemo(() => {
    return rows.map((r) => {
      const when = r.ts ? new Date(r.ts) : null;
      return {
        ...r,
        _when: when && !Number.isNaN(when.getTime()) ? when.toLocaleString() : r.ts || '—',
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
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Actor</th>
                  <th className="py-2 pr-3">Role</th>
                </tr>
              </thead>
              <tbody>
                {formatted.map((r, idx) => (
                  <tr key={idx} className="border-t border-slate-200">
                    <td className="py-2 pr-3">{(r as any)._when}</td>
                    <td className="py-2 pr-3">{r.type || '—'}</td>
                    <td className="py-2 pr-3">{r.actorId || 'system'}</td>
                    <td className="py-2 pr-3">{r.role || '—'}</td>
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

import { useEffect, useState } from 'react';
import { getRecentAudit } from '@/api/ownerZone';

export default function AuditViewer() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const d: any = await getRecentAudit(30);
        const items = Array.isArray(d?.items) ? d.items : Array.isArray(d) ? d : [];
        if (mounted) setRows(items);
      } catch {
        if (mounted) setRows([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  return (
    <div className="border rounded">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr><th className="p-2 text-left">Time</th><th className="p-2 text-left">Type</th><th className="p-2 text-left">Actor</th><th className="p-2 text-left">Payload</th></tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t align-top">
              <td className="p-2 whitespace-nowrap">{r.ts ? new Date(r.ts).toLocaleString() : ''}</td>
              <td className="p-2">{r.type}</td>
              <td className="p-2">{r.actorId} ({r.role})</td>
              <td className="p-2 w-[50%]"><pre className="whitespace-pre-wrap text-xs max-h-40 overflow-auto">{JSON.stringify(r.payload, null, 2)}</pre></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="p-4 text-gray-500">No audit events.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useFounderActions } from '../hooks/useFounderActions';
import { useNotify } from '@/components/ui/toast-bridge';

export default function RollbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { listSnapshots, diffSnapshot, rollback } = useFounderActions();
  const notify = useNotify();
  const [snapshots, setSnaps] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    if (!open) return;
    listSnapshots().then(r => setSnaps(r.items || []));
  }, [open]);
  async function onSelect(id: string) {
    setSelected(id);
    const diff = await diffSnapshot(id);
    setRows(diff.rows || []);
  }
  async function confirm() {
    if (!selected) return;
    const res = await rollback(selected, false);
    if (res.ok) notify.ok('Rollback applied', selected); else notify.err('Rollback failed', res.error);
    onClose();
  }
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose}>
      <div className="mx-auto mt-24 w-full max-w-3xl rounded-lg bg-white p-4 shadow" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-2">Rollback — choose snapshot</h3>
        <select className="border rounded px-2 py-2 w-full mb-3" value={selected} onChange={e => onSelect(e.target.value)}>
          <option value="">Select snapshot…</option>
          {snapshots.map(s => <option key={s.id} value={s.id}>{s.id} — {s.note}</option>)}
        </select>
        <div className="max-h-64 overflow-auto border rounded">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50"><th className="text-left p-2">Path</th><th className="text-left p-2">Before</th><th className="text-left p-2">After</th><th className="text-left p-2">Impact</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="p-2">{r.path}</td>
                  <td className="p-2">{String(r.before)}</td>
                  <td className="p-2">{String(r.after)}</td>
                  <td className="p-2">{r.impact}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td className="p-4 text-gray-500" colSpan={4}>Select a snapshot to preview changes…</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 py-1 border rounded" onClick={onClose}>Cancel</button>
          <button className="px-3 py-1 rounded bg-blue-600 text-white" disabled={!selected} onClick={confirm}>Apply Rollback</button>
        </div>
      </div>
    </div>
  );
}

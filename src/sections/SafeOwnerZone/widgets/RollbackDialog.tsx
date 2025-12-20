import { useEffect, useState } from 'react';
import { useNotify } from '@/components/ui/toast-bridge';
import ConfirmDangerModal from '@/components/modals/ConfirmDangerModal';
import { listSnapshots, rollbackApply } from '@/api/ownerZone';

export default function RollbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const notify = useNotify();
  const [snapshots, setSnaps] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [rows, setRows] = useState<any[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    listSnapshots(20).then(r => setSnaps((r as any)?.items || []));
  }, [open]);
  async function onSelect(id: string) {
    setSelected(id);
    // This backend contract does not expose a snapshot diff preview.
    // Keep the table empty so users can still apply rollbacks.
    setRows([]);
  }
  async function confirm() {
    if (!selected) return;
    try {
      await rollbackApply(selected);
      notify.ok('Rollback applied', selected);
    } catch (e: any) {
      notify.err('Rollback failed', e?.message || 'Unknown error');
    }
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
          <button
            className="px-3 py-1 rounded bg-blue-600 text-white"
            disabled={!selected}
            onClick={() => setConfirmOpen(true)}
          >Apply Rollback</button>
        </div>

        <ConfirmDangerModal
          open={confirmOpen}
          title="Apply rollback"
          description="This will revert settings/content to the selected snapshot. Type CONFIRM to proceed."
          requirePin={false}
          onClose={() => setConfirmOpen(false)}
          onConfirm={async () => {
            await confirm();
          }}
        />
      </div>
    </div>
  );
}

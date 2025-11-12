import { useState } from 'react';
import { useFounderActions } from '../hooks/useFounderActions';
import { useNotify } from '@/components/ui/toast-bridge';
import RollbackDryRunDialog from './RollbackDryRunDialog';
import RollbackDialog from './RollbackDialog';

export default function FounderQuickActions() {
  const { lockdown, snapshot, rotatePin } = useFounderActions();
  const notify = useNotify();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  async function handleLock() {
  if (!pin) { notify.err('PIN required'); return; }
    setBusy(true);
    try {
  const r = await lockdown({ reason: 'Manual emergency', scope: 'site', pin });
  (window as any).__LOCK_STATE__ = r.ok ? 'LOCKED' : (window as any).__LOCK_STATE__ || 'UNLOCKED';
  if (r.ok) notify.ok('Lockdown enabled'); else notify.err('Lockdown failed', r.error);
    } finally { setBusy(false); }
  }
  async function handleSnapshot() {
    setBusy(true);
    try {
  const r = await snapshot('Founder quick snapshot');
  if (r.ok && r.id) (window as any).__LAST_SNAPSHOT_ID__ = r.id;
  if (r.ok) notify.ok('Snapshot created', r.id); else notify.err('Snapshot failed', r.error);
    } finally { setBusy(false); }
  }
  return (
    <div className="flex flex-wrap gap-2 items-center">
      <input
        className="border px-2 py-1 rounded text-sm"
        placeholder="Founder PIN"
        value={pin}
        onChange={e => setPin(e.target.value)}
      />
      <button
        className="rounded px-3 py-1 bg-red-600 text-white text-sm disabled:opacity-50"
        onClick={handleLock}
        disabled={!pin || busy}
      >Lockdown</button>
      <button
        className="rounded px-3 py-1 bg-blue-600 text-white text-sm disabled:opacity-50"
        onClick={handleSnapshot}
        disabled={busy}
      >Snapshot</button>
      <button className="rounded px-3 py-1 bg-gray-700 text-white text-sm" onClick={async () => {
        const oldPin = prompt('Enter current PIN'); if (!oldPin) return;
        const newPin = prompt('Enter NEW PIN (6+ digits)'); if (!newPin) return;
        const r = await rotatePin(oldPin, newPin);
        if (r.ok) notify.ok('PIN rotated'); else notify.err('PIN rotate failed', r.error);
      }}>Rotate PIN</button>
      <RollbackDryRunDialog />
      <button
        className="rounded px-3 py-1 bg-amber-600 text-white text-sm"
        onClick={() => setRollbackOpen(true)}
      >Rollback…</button>
      <RollbackDialog open={rollbackOpen} onClose={() => setRollbackOpen(false)} />
    </div>
  );
}

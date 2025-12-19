import { useState } from 'react';
import { useFounderActions } from '../hooks/useFounderActions';
import { useNotify } from '@/components/ui/toast-bridge';
import RollbackDryRunDialog from './RollbackDryRunDialog';
import RollbackDialog from './RollbackDialog';
import ConfirmDangerModal from '@/components/modals/ConfirmDangerModal';
import { Link } from 'react-router-dom';
import { isOwnerKeyUnlocked, useOwnerKeyStore } from '@/lib/ownerKeyStore';

export default function FounderQuickActions() {
  const { lockdown, snapshot, rotatePin } = useFounderActions();
  const notify = useNotify();
  const ownerUnlockedUntilMs = useOwnerKeyStore((s) => s.unlockedUntilMs);
  const [busy, setBusy] = useState(false);
  const [rollbackOpen, setRollbackOpen] = useState(false);
  const [lockConfirmOpen, setLockConfirmOpen] = useState(false);
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);
  async function handleLock() {
  if (!isOwnerKeyUnlocked(ownerUnlockedUntilMs)) { notify.err('Owner Key required'); return; }
    setBusy(true);
    try {
  const r = await lockdown({ reason: 'Manual emergency', scope: 'site' });
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
      {!isOwnerKeyUnlocked(ownerUnlockedUntilMs) ? (
        <Link
          to="/admin/safe-owner-zone"
          className="rounded px-3 py-1 bg-blue-600 text-white text-sm"
        >
          Manage Owner Key → Safe Owner Zone
        </Link>
      ) : null}
      <button
        className="rounded px-3 py-1 bg-red-600 text-white text-sm disabled:opacity-50"
        onClick={() => setLockConfirmOpen(true)}
        disabled={!isOwnerKeyUnlocked(ownerUnlockedUntilMs) || busy}
      >Lockdown</button>
      <button
        className="rounded px-3 py-1 bg-blue-600 text-white text-sm disabled:opacity-50"
        onClick={handleSnapshot}
        disabled={busy}
      >Snapshot</button>
      <button
        className="rounded px-3 py-1 bg-gray-700 text-white text-sm disabled:opacity-50"
        disabled={busy}
        onClick={() => setRotateConfirmOpen(true)}
      >Rotate PIN</button>
      <RollbackDryRunDialog />
      <button
        className="rounded px-3 py-1 bg-amber-600 text-white text-sm"
        onClick={() => setRollbackOpen(true)}
      >Rollback…</button>
      <RollbackDialog open={rollbackOpen} onClose={() => setRollbackOpen(false)} />

      <ConfirmDangerModal
        open={lockConfirmOpen}
        title="Enable emergency lockdown"
        description="This will immediately lock down the site/admin depending on scope. Type CONFIRM to proceed."
        requirePin={false}
        onClose={() => setLockConfirmOpen(false)}
        onConfirm={async () => {
          await handleLock();
        }}
      />

      <ConfirmDangerModal
        open={rotateConfirmOpen}
        title="Rotate founder PIN"
        description="Rotating the PIN can lock out other admins. Type CONFIRM to proceed."
        requirePin={false}
        onClose={() => setRotateConfirmOpen(false)}
        onConfirm={async () => {
          const oldPin = prompt('Enter current PIN');
          if (!oldPin) return;
          const newPin = prompt('Enter NEW PIN (6+ digits)');
          if (!newPin) return;
          setBusy(true);
          try {
            const r = await rotatePin(oldPin, newPin);
            if (r.ok) notify.ok('PIN rotated');
            else notify.err('PIN rotate failed', r.error);
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

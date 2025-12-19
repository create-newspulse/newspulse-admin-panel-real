import { useEffect, useMemo, useState } from 'react';

export default function ConfirmDangerModal({
  open,
  title,
  description,
  confirmLabel = 'CONFIRM',
  requirePin = false,
  confirmButtonText = 'Confirm',
  danger = true,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  requirePin?: boolean;
  confirmButtonText?: string;
  danger?: boolean;
  onClose: () => void;
  onConfirm: (args: { confirmText: string; pin?: string }) => Promise<void> | void;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  const canConfirm = useMemo(() => {
    if (confirmText.trim().toUpperCase() !== confirmLabel.toUpperCase()) return false;
    if (requirePin && !pin.trim()) return false;
    return true;
  }, [confirmText, confirmLabel, requirePin, pin]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setConfirmText('');
      setPin('');
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const confirm = async () => {
    if (!canConfirm || busy) return;
    setBusy(true);
    try {
      await onConfirm({ confirmText, pin: requirePin ? pin : undefined });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{description}</p>}

        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Type {confirmLabel} to proceed</label>
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={confirmLabel}
              autoFocus
            />
          </div>

          {requirePin && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">PIN (placeholder UI)</label>
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Enter PIN"
              />
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="rounded-lg border px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={onClose}>
            Cancel
          </button>
          <button
            className={`rounded-lg px-3 py-2 text-white disabled:opacity-50 ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
            disabled={!canConfirm || busy}
            onClick={confirm}
          >
            {busy ? 'Working…' : confirmButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}

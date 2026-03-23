import type { ReactNode } from 'react';

export type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
  confirmDisabled?: boolean;
  confirmBusyLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmVariant = 'primary',
  confirmDisabled = false,
  confirmBusyLabel,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const isBusy = !!confirmDisabled && !!confirmBusyLabel;

  const confirmClassName =
    confirmVariant === 'danger'
      ? 'text-sm px-3 py-2 rounded bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 inline-flex items-center gap-2'
      : 'btn inline-flex items-center gap-2';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div>
        </div>
        {children ? (
          <div className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{children}</div>
        ) : description ? (
          <div className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{description}</div>
        ) : null}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
          <button type="button" className="text-sm px-3 py-2 rounded border bg-white hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={confirmClassName} disabled={confirmDisabled} onClick={onConfirm}>
            {isBusy ? (
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
            ) : null}
            {isBusy ? confirmBusyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

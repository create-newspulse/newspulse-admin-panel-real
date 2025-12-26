export type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="max-w-lg mx-auto bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="font-semibold text-slate-900 dark:text-slate-100">{title}</div>
        </div>
        {description ? (
          <div className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{description}</div>
        ) : null}
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
          <button type="button" className="text-sm px-3 py-2 rounded border bg-white hover:bg-slate-50 dark:bg-slate-950 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-900" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

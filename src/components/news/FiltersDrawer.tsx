import React from 'react';

interface Props {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function FiltersDrawer({ open, title = 'Filters', onClose, children }: Props) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close filters"
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl border-l">
        <div className="p-4 border-b flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">{title}</div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        <div className="p-4 overflow-auto h-[calc(100%-56px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

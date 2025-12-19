type Props = {
  dirty?: boolean;
  saving?: boolean;
  onSave: () => void;
  onCancel: () => void;
  onReset?: () => void;
};

export default function StickySettingsBar({ dirty = false, saving = false, onSave, onCancel, onReset }: Props) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className={`rounded-lg border ${dirty ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50'} shadow-sm flex items-center justify-between px-3 py-2`}>
          <span className="text-sm text-slate-700">{dirty ? 'Unsaved changes' : 'No changes'}</span>
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100">Cancel</button>
            {onReset && <button onClick={onReset} className="px-3 py-1 rounded border border-yellow-300 bg-yellow-50 text-yellow-800 hover:bg-yellow-100">Reset to defaults</button>}
            <button onClick={onSave} disabled={!dirty || saving} className={`px-3 py-1 rounded ${(!dirty || saving) ? 'bg-slate-300 text-slate-700' : 'bg-blue-600 text-white hover:bg-blue-500'}`}>{saving ? 'Saving…' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';

type Props = {
  dirty: boolean;
  canPublish: boolean;
  onReset: () => void;
  onSaveDraft: () => void;
  onPublish: () => Promise<void>;
  previewTo?: string;
  busy?: boolean;
};

export default function StickyActionBar({ dirty, canPublish, onReset, onSaveDraft, onPublish, previewTo, busy }: Props) {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div
          className={
            `rounded-xl border shadow-sm flex items-center justify-between px-3 py-2 ` +
            (dirty ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50')
          }
        >
          <div className="text-sm text-slate-700">
            {dirty ? 'Unsaved changes (draft)' : 'No changes'}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={!dirty || busy}
              className={
                `px-3 py-1 rounded border ` +
                (!dirty || busy
                  ? 'border-slate-300 bg-slate-200 text-slate-700'
                  : 'border-slate-300 bg-white hover:bg-slate-100')
              }
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={() => {
                if (previewTo) navigate(previewTo);
              }}
              disabled={!previewTo}
              className={
                `px-3 py-1 rounded border ` +
                (!previewTo
                  ? 'border-slate-300 bg-slate-200 text-slate-700'
                  : 'border-slate-300 bg-white hover:bg-slate-100')
              }
            >
              Preview
            </button>
            <button
              type="button"
              onClick={onPublish}
              disabled={!dirty || busy || !canPublish}
              className={
                `px-3 py-1 rounded ` +
                (!dirty || busy || !canPublish
                  ? 'bg-slate-300 text-slate-700'
                  : 'bg-blue-600 text-white hover:bg-blue-500')
              }
              title={!canPublish ? 'Founder-only' : undefined}
            >
              Publish
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

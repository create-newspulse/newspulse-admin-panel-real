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

  const baseBtn =
    'h-9 px-3 inline-flex items-center justify-center rounded-lg text-sm font-medium border transition-colors';
  const secondaryBtn = `${baseBtn} border-slate-300 bg-white text-slate-800 hover:bg-slate-50`;
  const disabledSecondaryBtn = `${baseBtn} border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed`;
  const primaryBtn = 'h-9 px-4 inline-flex items-center justify-center rounded-lg text-sm font-medium transition-colors';

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div
          className={
            `rounded-xl border shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 py-2 ` +
            (dirty ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-slate-50')
          }
        >
          <div className={
            'text-sm font-medium ' +
            (dirty ? 'text-blue-800' : 'text-slate-600')
          }>
            {dirty ? 'Unsaved changes (draft)' : 'No changes'}
          </div>

          <div className="flex items-center justify-end gap-2 flex-wrap">
            <button
              type="button"
              onClick={onReset}
              className={secondaryBtn}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={!dirty || busy}
              className={
                (!dirty || busy) ? disabledSecondaryBtn : secondaryBtn
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
                (!previewTo) ? disabledSecondaryBtn : secondaryBtn
              }
            >
              Preview
            </button>
            <button
              type="button"
              onClick={onPublish}
              disabled={!dirty || busy || !canPublish}
              className={
                primaryBtn + ' ' +
                (!dirty || busy || !canPublish
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
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

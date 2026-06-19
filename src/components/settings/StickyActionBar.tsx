import { useNavigate } from 'react-router-dom';

type Props = {
  dirty: boolean;
  canPublish: boolean;
  onReset: () => void | Promise<void>;
  onSaveDraft: () => void | Promise<void>;
  onPublish: () => Promise<void>;
  previewTo?: string;
  busy?: boolean;
};

export default function StickyActionBar({ dirty, canPublish, onReset, onSaveDraft, onPublish, previewTo, busy }: Props) {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-20">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div
          className={
            `flex flex-col gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between ` +
            (dirty ? 'border-blue-300 bg-blue-50/95' : 'border-slate-200 bg-white/95')
          }
        >
          <div className="text-sm font-semibold text-slate-700">
            {dirty ? 'Unsaved changes (draft)' : 'No changes'}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={onSaveDraft}
              disabled={!dirty || busy}
              className={
                `rounded-lg border px-3 py-2 text-sm font-semibold ` +
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
                `rounded-lg border px-3 py-2 text-sm font-semibold ` +
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
                `rounded-lg px-3 py-2 text-sm font-semibold ` +
                (!dirty || busy || !canPublish
                  ? 'bg-slate-300 text-slate-700'
                  : 'bg-blue-600 text-white hover:bg-blue-500')
              }
              title={!canPublish ? 'Founder-only' : undefined}
            >
              Publish LIVE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

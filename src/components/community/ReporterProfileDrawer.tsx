import { useEffect, useState } from 'react';
import { ReporterContact, updateReporterContactNotes } from '@/lib/api/reporterDirectory';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';

interface ReporterProfileDrawerProps {
  open: boolean;
  reporter: ReporterContact | null;
  onClose: () => void;
  onOpenStories: (key: string) => void;
  onOpenQueue: (key: string) => void;
}

export default function ReporterProfileDrawer({ open, reporter, onClose, onOpenStories, onOpenQueue }: ReporterProfileDrawerProps) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const key = reporter?.email || reporter?.phone || '';
  const name = reporter?.name || 'Unknown reporter';
  const maskedPhone = reporter?.phone ? reporter.phone.replace(/(\d{2})\d+(\d{3})/, '$1*****$2') : null;

  const queryClient = useQueryClient();
  const [draftNotes, setDraftNotes] = useState<string>(reporter?.notes || '');
  // Sync when reporter changes
  useEffect(() => { setDraftNotes(reporter?.notes || ''); }, [reporter?.notes, reporter?.id]);

  const { mutate: saveNotes, isLoading: saving } = useMutation({
    mutationFn: async () => {
      if (!key) throw new Error('Missing reporter key');
      return updateReporterContactNotes(key, draftNotes.trim());
    },
    onSuccess: () => {
      toast.success('Notes saved');
      // Refresh directory list (contains notes indicator)
      queryClient.invalidateQueries({ queryKey: ['reporter-contacts'] });
    },
    onError: (e: any) => {
      toast.error(e?.message || 'Failed to save notes');
    }
  });

  const onBlurSave = () => {
    // Only save if value changed from original
    if ((reporter?.notes || '') !== draftNotes.trim()) {
      saveNotes();
    }
  };

  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-xl border-l transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h2 className="text-lg font-semibold">{name}</h2>
            <p className="text-xs text-slate-600">Founder/Admin only — do not share publicly.</p>
          </div>
          <button onClick={onClose} className="px-2 py-1 text-sm rounded-md border hover:bg-slate-50">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Meta */}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-slate-100 border">{reporter?.totalStories ?? 0} stories</span>
            <span className="text-xs text-slate-500">Last: {reporter?.lastStoryAt ? new Date(reporter.lastStoryAt).toLocaleString() : '—'}</span>
          </div>

          {/* Contact */}
          <div className="space-y-1">
            <div className="text-sm"><span className="font-medium">Email:</span> {reporter?.email || '—'}</div>
            <div className="text-sm"><span className="font-medium">Phone:</span> {maskedPhone || '—'}</div>
          </div>

          {/* Location */}
          <div className="space-y-1">
            <div className="text-sm"><span className="font-medium">City:</span> {reporter?.city || '—'}</div>
            <div className="text-sm"><span className="font-medium">State:</span> {reporter?.state || '—'}</div>
            <div className="text-sm"><span className="font-medium">Country:</span> {reporter?.country || '—'}</div>
          </div>

          {/* Activity */}
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Total" value={reporter?.totalStories ?? 0} />
            <Metric label="Approved" value={reporter?.approvedStories ?? 0} />
            <Metric label="Pending" value={reporter?.pendingStories ?? 0} />
          </div>

          {/* Private Notes (Admin-only) */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
              Private notes <span className="text-slate-400">(founder/admin)</span>
            </label>
            <textarea
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
              onBlur={onBlurSave}
              placeholder="Add any internal context, sourcing details, risk flags..."
              className="w-full min-h-[110px] resize-y px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                disabled={saving || (reporter?.notes || '') === draftNotes.trim()}
                onClick={() => saveNotes()}
                className="px-3 py-1.5 text-sm rounded-md border bg-white hover:bg-slate-50 disabled:opacity-50"
              >{saving ? 'Saving…' : 'Save notes'}</button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              disabled={!key}
              onClick={() => key && onOpenStories(key)}
              className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50"
            >
              Open My Community Stories
            </button>
            <button
              disabled={!key}
              onClick={() => key && onOpenQueue(key)}
              className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50"
            >
              Open in Reporter Queue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className="text-xs text-slate-600">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

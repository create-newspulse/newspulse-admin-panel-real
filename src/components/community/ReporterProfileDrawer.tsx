import { useEffect, useState } from 'react';
import { ReporterContact, updateReporterContactNotes } from '@/lib/api/reporterDirectory';
import { updateReporterStatus } from '@/lib/api/communityAdmin';
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

  const { mutate: saveNotes, isPending: saving } = useMutation({
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
      if (e?.isUnauthorized) {
        toast.error('Session expired — please log in again.');
        return;
      }
      if (e?.isNotImplemented) {
        toast('Notes saving is not available in this environment.', { icon: 'ℹ️' });
        return;
      }
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
            <p className="text-xs text-slate-600">{reporter?.email || '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            {reporter?.reporterType && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${reporter.reporterType==='journalist' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-purple-100 text-purple-700 border-purple-200'}`}>
                {reporter.reporterType==='journalist' ? 'Journalist' : 'Community'}
              </span>
            )}
            {reporter?.verificationLevel && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${reporter.verificationLevel==='verified' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : reporter.verificationLevel==='pending' ? 'bg-amber-100 text-amber-800 border-amber-200' : reporter.verificationLevel==='limited' ? 'bg-amber-100 text-amber-800 border-amber-200' : reporter.verificationLevel==='revoked' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                {reporter.verificationLevel==='verified' ? 'Verified' : reporter.verificationLevel==='pending' ? 'Pending' : reporter.verificationLevel==='limited' ? 'Limited' : reporter.verificationLevel==='revoked' ? 'Revoked' : 'Community Default'}
              </span>
            )}
            {reporter?.status && (
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${reporter.status==='active' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : reporter.status==='watchlist' ? 'bg-amber-100 text-amber-800 border-amber-200' : reporter.status==='suspended' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                {reporter.status.charAt(0).toUpperCase() + reporter.status.slice(1)}
              </span>
            )}
          </div>
          <button onClick={onClose} className="px-2 py-1 text-sm rounded-md border hover:bg-slate-50">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Meta badges duplicated in header; keep story count */}
          {/* Meta */}
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-slate-100 border">{reporter?.totalStories ?? 0} stories</span>
            <span className="text-xs text-slate-500">Last: {reporter?.lastStoryAt ? new Date(reporter.lastStoryAt).toLocaleString() : '—'}</span>
          </div>

          {/* Completeness Notice */}
          {reporter && (!reporter.phone || (!reporter.city && !reporter.state && !reporter.country)) && (
            <div className="border rounded-md p-3 bg-slate-50 text-xs text-slate-600 space-y-1">
              <p className="font-medium flex items-center gap-1">Profile incomplete</p>
              <p>This profile is missing contact/location details. Update when reliable information is available.</p>
              <ul className="list-disc ml-4 space-y-0.5">
                {!reporter.phone && <li>No phone recorded</li>}
                {!reporter.city && !reporter.state && !reporter.country && <li>No location (city/state/country)</li>}
              </ul>
            </div>
          )}

          {/* Contact */}
          <div className="space-y-1">
            <div className="text-sm"><span className="font-medium">Email:</span> {reporter?.email || '—'}</div>
            <div className="text-sm"><span className="font-medium">Phone:</span> {maskedPhone || '—'}</div>
          </div>

          {/* Organisation & Professional */}
          {(reporter?.organisationName || reporter?.positionTitle || reporter?.beatsProfessional || reporter?.yearsExperience || reporter?.languages || reporter?.websiteOrPortfolio || reporter?.socialLinks) && (
            <div className="space-y-1">
              {reporter?.organisationName && (
                <div className="text-sm"><span className="font-medium">Organisation:</span> {reporter.organisationName} {reporter.organisationType ? `(${reporter.organisationType})` : ''}</div>
              )}
              {reporter?.positionTitle && (
                <div className="text-sm"><span className="font-medium">Position:</span> {reporter.positionTitle}</div>
              )}
              {Array.isArray(reporter?.beatsProfessional) && reporter!.beatsProfessional!.length > 0 && (
                <div className="text-sm"><span className="font-medium">Beats:</span> {reporter!.beatsProfessional!.join(', ')}</div>
              )}
              {typeof reporter?.yearsExperience === 'number' && (
                <div className="text-sm"><span className="font-medium">Experience:</span> {reporter!.yearsExperience} years</div>
              )}
              {Array.isArray(reporter?.languages) && reporter!.languages!.length > 0 && (
                <div className="text-sm"><span className="font-medium">Languages:</span> {reporter!.languages!.join(', ')}</div>
              )}
                        {/* Ethics & Behaviour */}
                        <div className="space-y-1">
                          {typeof reporter?.ethicsStrikes === 'number' && (
                            <div className="text-sm"><span className="font-medium">Ethics strikes:</span> {reporter!.ethicsStrikes}</div>
                          )}
                          {Array.isArray((reporter as any)?.behaviourNotes) && ((reporter as any).behaviourNotes.length > 0) && (
                            <div className="text-sm">
                              <span className="font-medium">Behaviour notes:</span>
                              <div className="mt-1 space-y-1">
                                {((reporter as any).behaviourNotes as Array<{ date?: string; note: string }>).map((n, idx) => (
                                  <div key={idx} className="text-xs text-slate-700">
                                    <span className="text-slate-500 mr-1">{n.date ? new Date(n.date).toLocaleString() : ''}</span>
                                    {n.note}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
              {reporter?.websiteOrPortfolio && (
                <div className="text-sm"><span className="font-medium">Website:</span> <a className="text-blue-600 hover:underline" href={reporter.websiteOrPortfolio} target="_blank" rel="noreferrer">{reporter.websiteOrPortfolio}</a></div>
              )}
              {reporter?.socialLinks && (
                <div className="text-sm"><span className="font-medium">Social:</span> {reporter.socialLinks.linkedin && <a className="text-blue-600 hover:underline mr-2" href={reporter.socialLinks.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>} {reporter.socialLinks.twitter && <a className="text-blue-600 hover:underline" href={reporter.socialLinks.twitter} target="_blank" rel="noreferrer">Twitter/X</a>}</div>
              )}
            </div>
          )}

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
            {/* Quick status actions */}
            {reporter?.id && (
              <div className="ml-auto flex items-center gap-2">
                <button className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50" onClick={async ()=> { await updateReporterStatus(reporter.id, { status: 'watchlist' }); toast.success('Marked watchlist'); queryClient.invalidateQueries({ queryKey: ['reporter-contacts'] }); }}>Mark Watchlist</button>
                <button className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50" onClick={async ()=> { if (window.confirm('Suspend this reporter?')) { await updateReporterStatus(reporter.id, { status: 'suspended' }); toast.success('Suspended'); queryClient.invalidateQueries({ queryKey: ['reporter-contacts'] }); } }}>Suspend</button>
                <button className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50 text-red-700" onClick={async ()=> { if (window.confirm('Ban this reporter?')) { await updateReporterStatus(reporter.id, { status: 'banned' }); toast.success('Banned'); queryClient.invalidateQueries({ queryKey: ['reporter-contacts'] }); } }}>Ban</button>
                <button className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50" onClick={async ()=> { await updateReporterStatus(reporter.id, { addStrike: true }); toast.success('Ethics strike added'); queryClient.invalidateQueries({ queryKey: ['reporter-contacts'] }); }}>Add strike</button>
              </div>
            )}
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

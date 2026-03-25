import { useEffect, useMemo, useRef, useState } from 'react';
import { ReporterContact, updateReporterContactNotes } from '@/lib/api/reporterDirectory';
import { updateReporterStatus } from '@/lib/api/communityAdmin';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

interface ReporterProfileDrawerProps {
  open: boolean;
  reporter: ReporterContact | null;
  initialTab?: 'overview' | 'contact' | 'coverage' | 'stories' | 'notes' | 'tasks' | 'activity';
  onClose: () => void;
  onOpenStories: (key: string) => void;
  onOpenQueue: (key: string) => void;
}

export default function ReporterProfileDrawer({ open, reporter, initialTab, onClose, onOpenStories, onOpenQueue }: ReporterProfileDrawerProps) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const { user } = useAuth();
  const role = String(user?.role || '').trim().toLowerCase();
  const canSeeDebug = role === 'founder' || role === 'admin';

  const key = String(reporter?.reporterKey || reporter?.id || reporter?.email || reporter?.phone || '').trim();
  const name = reporter?.name || 'Unknown reporter';
  const maskedPhone = reporter?.phone ? reporter.phone.replace(/(\d{2})\d+(\d{3})/, '$1*****$2') : null;

  type TabKey = 'overview' | 'contact' | 'coverage' | 'stories' | 'notes' | 'tasks' | 'activity';
  const tabs: Array<{ key: TabKey; label: string }> = useMemo(() => (
    [
      { key: 'overview', label: 'Overview' },
      { key: 'contact', label: 'Contact' },
      { key: 'coverage', label: 'Coverage' },
      { key: 'stories', label: 'Stories' },
      { key: 'notes', label: 'Notes' },
      { key: 'tasks', label: 'Tasks' },
      { key: 'activity', label: 'Activity' },
    ]
  ), []);
  const [tab, setTab] = useState<TabKey>('overview');
  useEffect(() => {
    if (!open) return;
    const next = (initialTab || 'overview') as TabKey;
    setTab(next);
  }, [open, initialTab, reporter?.id, reporter?.email, reporter?.phone]);

  const queryClient = useQueryClient();
  const [draftNotes, setDraftNotes] = useState<string>(reporter?.notes || '');
  // Sync when reporter changes
  useEffect(() => { setDraftNotes(reporter?.notes || ''); }, [reporter?.notes, reporter?.id]);

  const [entryKind, setEntryKind] = useState<'NOTE' | 'CALL' | 'EMAIL' | 'TASK' | 'CONTACTED' | 'VERIFY_REQUEST' | 'MERGE_DUPLICATE'>('NOTE');
  const [entryText, setEntryText] = useState('');

  const appendEntry = (kind: typeof entryKind, text: string) => {
    const clean = String(text || '').trim();
    const stamp = new Date().toLocaleString();
    const line = clean
      ? `[${stamp}] ${kind}: ${clean}`
      : `[${stamp}] ${kind}`;
    setDraftNotes((prev) => {
      const p = String(prev || '').trimEnd();
      return p ? `${p}\n${line}` : line;
    });
  };

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

  const statusBusy = useRef(false);
  async function applyStatusPatch(patch: Parameters<typeof updateReporterStatus>[1], successMsg: string) {
    if (!reporter?.id) return;
    if (statusBusy.current) return;
    statusBusy.current = true;
    try {
      await updateReporterStatus(reporter.id, patch);
      toast.success(successMsg);
      queryClient.invalidateQueries({ queryKey: ['reporter-contacts'] });
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    } finally {
      statusBusy.current = false;
    }
  }

  return (
    <div className={`fixed inset-0 z-40 ${open ? '' : 'pointer-events-none'}`}>
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/30 transition-opacity ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-xl border-l transition-transform ${open ? 'translate-x-0' : 'translate-x-full'} flex flex-col`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
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

        <div className="shrink-0 border-b bg-white px-3 py-2 overflow-x-auto">
          <div className="flex items-center gap-2">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={
                  'px-3 py-1.5 text-xs rounded-md border whitespace-nowrap ' +
                  (tab === t.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700')
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-8">
          {tab === 'overview' ? (
            <>
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center px-2 py-1 text-xs rounded bg-slate-100 border">{reporter?.totalStories ?? 0} stories</span>
                <span className="text-xs text-slate-500">Last submission: {reporter?.lastSubmissionAt || reporter?.lastStoryAt ? new Date((reporter?.lastSubmissionAt || reporter?.lastStoryAt) as string).toLocaleString() : '—'}</span>
              </div>

              {canSeeDebug && reporter ? (
                <div className="rounded-md border bg-white p-3 text-xs text-slate-700 space-y-1">
                  <div className="font-medium text-slate-800">Debug</div>
                  <div>Contributor id: <span className="font-mono">{String(reporter.contributorId || reporter.id || '—')}</span></div>
                  <div>Linked story count: <span className="font-mono">{typeof reporter.linkedStoryCount === 'number' ? reporter.linkedStoryCount : (reporter.totalStories ?? 0)}</span></div>
                  <div>Identity source: <span className="font-mono">{String(reporter.identitySource || '—')}</span></div>
                </div>
              ) : null}

              {reporter && (!String(reporter.email || '').trim() || !reporter.phone || (!reporter.city && !reporter.state && !reporter.country)) && (
                <div className="border rounded-md p-3 bg-slate-50 text-xs text-slate-600 space-y-1">
                  <p className="font-medium">Profile incomplete</p>
                  <ul className="list-disc ml-4 space-y-0.5">
                    {!String(reporter.email || '').trim() && <li>No email recorded</li>}
                    {!reporter.phone && <li>No phone recorded</li>}
                    {!reporter.city && !reporter.state && !reporter.country && <li>No location (city/state/country)</li>}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <Metric label="Total" value={reporter?.totalStories ?? 0} />
                <Metric label="Approved" value={reporter?.approvedStories ?? 0} />
                <Metric label="Pending" value={reporter?.pendingStories ?? 0} />
                <Metric label="Rejected" value={reporter?.rejectedStories ?? 0} />
                <Metric label="Withdrawn" value={reporter?.withdrawnStories ?? 0} />
                <Metric label="Published" value={reporter?.publishedStories ?? 0} />
              </div>
            </>
          ) : null}

          {tab === 'contact' ? (
            <div className="space-y-2">
              <div className="text-sm"><span className="font-medium">Email:</span> {reporter?.email || '—'}</div>
              <div className="text-sm"><span className="font-medium">Phone:</span> {maskedPhone || '—'}</div>
              <div className="pt-2 border-t" />
              <div className="text-sm"><span className="font-medium">City:</span> {reporter?.city || '—'}</div>
              <div className="text-sm"><span className="font-medium">State:</span> {reporter?.state || '—'}</div>
              <div className="text-sm"><span className="font-medium">Country:</span> {reporter?.country || '—'}</div>
            </div>
          ) : null}

          {tab === 'coverage' ? (
            <div className="space-y-2">
              {(reporter?.organisationName || reporter?.positionTitle) ? (
                <div className="space-y-1">
                  {reporter?.organisationName && (
                    <div className="text-sm"><span className="font-medium">Organisation:</span> {reporter.organisationName} {reporter.organisationType ? `(${reporter.organisationType})` : ''}</div>
                  )}
                  {reporter?.positionTitle && (
                    <div className="text-sm"><span className="font-medium">Position:</span> {reporter.positionTitle}</div>
                  )}
                </div>
              ) : null}

              {Array.isArray(reporter?.beatsProfessional) && reporter!.beatsProfessional!.length > 0 ? (
                <div className="text-sm"><span className="font-medium">Beats:</span> {reporter!.beatsProfessional!.join(', ')}</div>
              ) : null}
              {Array.isArray(reporter?.languages) && reporter!.languages!.length > 0 ? (
                <div className="text-sm"><span className="font-medium">Languages:</span> {reporter!.languages!.join(', ')}</div>
              ) : null}
              {typeof reporter?.yearsExperience === 'number' ? (
                <div className="text-sm"><span className="font-medium">Experience:</span> {reporter!.yearsExperience} years</div>
              ) : null}

              {(reporter?.websiteOrPortfolio || reporter?.socialLinks) ? (
                <div className="pt-2 border-t space-y-1">
                  {reporter?.websiteOrPortfolio ? (
                    <div className="text-sm"><span className="font-medium">Website:</span> <a className="text-blue-600 hover:underline" href={reporter.websiteOrPortfolio} target="_blank" rel="noreferrer">{reporter.websiteOrPortfolio}</a></div>
                  ) : null}
                  {reporter?.socialLinks ? (
                    <div className="text-sm"><span className="font-medium">Social:</span> {reporter.socialLinks.linkedin && <a className="text-blue-600 hover:underline mr-2" href={reporter.socialLinks.linkedin} target="_blank" rel="noreferrer">LinkedIn</a>} {reporter.socialLinks.twitter && <a className="text-blue-600 hover:underline" href={reporter.socialLinks.twitter} target="_blank" rel="noreferrer">Twitter/X</a>}</div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === 'stories' ? (
            <div className="space-y-2">
              <div className="text-xs text-slate-600">Founder/admin actions</div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  disabled={!key}
                  onClick={() => key && onOpenStories(key)}
                  className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50"
                >
                  Open reporter stories
                </button>
                <button
                  disabled={!key}
                  onClick={() => key && onOpenQueue(key)}
                  className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50"
                >
                  Open in queue
                </button>
              </div>
            </div>
          ) : null}

          {tab === 'notes' || tab === 'tasks' ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  Private notes <span className="text-slate-400">(founder/admin)</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={entryKind}
                    onChange={(e) => setEntryKind(e.target.value as any)}
                    className="px-2 py-2 border rounded-md text-xs"
                    title="CRM entry type"
                  >
                    <option value="NOTE">Note</option>
                    <option value="CALL">Log call</option>
                    <option value="EMAIL">Log email</option>
                    <option value="TASK">Follow-up task</option>
                    <option value="CONTACTED">Mark contacted</option>
                    <option value="VERIFY_REQUEST">Request verification</option>
                    <option value="MERGE_DUPLICATE">Merge duplicate</option>
                  </select>
                  <input
                    value={entryText}
                    onChange={(e) => setEntryText(e.target.value)}
                    placeholder={tab === 'tasks' ? 'Follow-up task details…' : 'Add a short note / call log…'}
                    className="flex-1 min-w-[180px] px-3 py-2 border rounded-md text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const kind = tab === 'tasks' ? 'TASK' : entryKind;
                      appendEntry(kind as any, entryText);
                      setEntryText('');
                    }}
                    className="px-3 py-2 text-sm rounded-md border bg-white hover:bg-slate-50"
                  >
                    Add
                  </button>
                </div>
              </div>

              <textarea
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                onBlur={onBlurSave}
                placeholder="Add any internal context, sourcing details, risk flags..."
                className="w-full min-h-[180px] resize-y px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex items-center justify-end gap-3">
                <button
                  disabled={saving || (reporter?.notes || '') === draftNotes.trim()}
                  onClick={() => saveNotes()}
                  className="px-3 py-1.5 text-sm rounded-md border bg-white hover:bg-slate-50 disabled:opacity-50"
                >{saving ? 'Saving…' : 'Save notes'}</button>
              </div>
            </div>
          ) : null}

          {tab === 'activity' ? (
            <div className="space-y-3">
              <div className="rounded-md border bg-white p-3 space-y-2">
                <div className="text-sm text-slate-700"><span className="font-medium">Verification level:</span> {reporter?.verificationLevel || '—'}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50" disabled={!reporter?.id} onClick={() => applyStatusPatch({ verificationLevel: 'pending' }, 'Verification requested')}>Request verification</button>
                  <button className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50" disabled={!reporter?.id} onClick={() => applyStatusPatch({ verificationLevel: 'verified' }, 'Marked verified')}>Verify</button>
                  <button className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50" disabled={!reporter?.id} onClick={() => applyStatusPatch({ verificationLevel: 'limited' }, 'Limited verification')}>Limit</button>
                  <button className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50" disabled={!reporter?.id} onClick={() => applyStatusPatch({ verificationLevel: 'revoked' }, 'Verification revoked')}>Revoke</button>
                </div>
              </div>

              <div className="rounded-md border bg-white p-3 space-y-2">
                <div className="text-sm text-slate-700"><span className="font-medium">Status:</span> {reporter?.status || '—'}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50" disabled={!reporter?.id} onClick={() => applyStatusPatch({ status: 'watchlist' }, 'Marked watchlist')}>Mark watchlist</button>
                  <button className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50" disabled={!reporter?.id} onClick={() => { if (window.confirm('Suspend this reporter?')) void applyStatusPatch({ status: 'suspended' }, 'Suspended'); }}>Suspend</button>
                  <button className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50 text-red-700" disabled={!reporter?.id} onClick={() => { if (window.confirm('Ban this reporter?')) void applyStatusPatch({ status: 'banned' }, 'Banned'); }}>Ban</button>
                  <button className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50" disabled={!reporter?.id} onClick={() => applyStatusPatch({ addStrike: true }, 'Ethics strike added')}>Add strike</button>
                </div>
              </div>

              <div className="text-sm text-slate-700"><span className="font-medium">Ethics strikes:</span> {typeof reporter?.ethicsStrikes === 'number' ? reporter.ethicsStrikes : '—'}</div>
              <div className="flex flex-wrap items-center gap-2">
                <button className="px-3 py-2 text-sm rounded-md border hover:bg-slate-50" disabled={!reporter?.id} onClick={() => applyStatusPatch({ status: 'archived' as any }, 'Archived')}>Archive reporter</button>
              </div>
              {Array.isArray((reporter as any)?.behaviourNotes) && ((reporter as any).behaviourNotes.length > 0) ? (
                <div className="text-sm">
                  <span className="font-medium">Behaviour notes:</span>
                  <div className="mt-2 space-y-1">
                    {((reporter as any).behaviourNotes as Array<{ date?: string; note: string }>).map((n, idx) => (
                      <div key={idx} className="text-xs text-slate-700">
                        <span className="text-slate-500 mr-1">{n.date ? new Date(n.date).toLocaleString() : ''}</span>
                        {n.note}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
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

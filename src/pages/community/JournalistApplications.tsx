import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { listJournalistApplications, verifyJournalist, rejectJournalist, JournalistApplication, updateReporterStatus } from '@/lib/api/communityAdmin';

function Badge({ label, tone }: { label: string; tone: 'blue'|'purple'|'green'|'yellow'|'gray' }) {
  const toneMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 border-blue-200',
    purple: 'bg-purple-100 text-purple-700 border-purple-200',
    green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    yellow: 'bg-amber-100 text-amber-800 border-amber-200',
    gray: 'bg-slate-100 text-slate-700 border-slate-200',
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${toneMap[tone]}`}>{label}</span>;
}

export default function JournalistApplications() {
  const qc = useQueryClient();
  const [status] = useState<'pending'|'all'>('pending');
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['journalist-applications', status],
    queryFn: () => listJournalistApplications({ status }),
    staleTime: 20_000,
  });
  const items = useMemo(() => (data?.items ?? []) as JournalistApplication[], [data]);

  const { mutate: doVerify, isPending: verifying } = useMutation({
    mutationFn: async (id: string) => verifyJournalist(id),
    onSuccess: () => { toast.success('Verified as journalist'); qc.invalidateQueries({ queryKey: ['journalist-applications'] }); },
    onError: (e:any) => toast.error(e?.message || 'Failed to verify'),
  });
  const { mutate: doReject, isPending: rejecting } = useMutation({
    mutationFn: async (id: string) => rejectJournalist(id),
    onSuccess: () => { toast.success('Marked as community reporter'); qc.invalidateQueries({ queryKey: ['journalist-applications'] }); },
    onError: (e:any) => toast.error(e?.message || 'Failed to reject'),
  });

  return (
    <div className="px-6 py-4 max-w-7xl mx-auto space-y-6">
      <div className="text-sm text-slate-600">Home e Community e <span className="font-medium">Journalist Applications</span></div>
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Journalist Applications</h1>
        <p className="text-sm text-slate-600">Review and verify professional journalist applications.</p>
      </header>

      {isLoading && (
        <div className="rounded-xl border border-slate-200 p-6 text-sm">Loading applications…</div>
      )}
      {isError && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-sm text-red-700">{(error as any)?.message || 'Failed to load applications'}</div>
      )}

      {!isLoading && !isError && (
        <div className="rounded-xl border border-slate-200 overflow-x-auto bg-white">
          <table className="min-w-[1000px] w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Name / Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Organisation / Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Beats</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Type / Verification</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Status / Strikes</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Stories</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-600">No applications found.</td></tr>
              ) : items.map(app => (
                <tr key={app._id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="flex flex-col">
                      <button className="text-blue-600 hover:underline text-left" title="View profile" onClick={() => { /* optional: open drawer if wired */ }}>
                        {app.name || '—'}
                      </button>
                      <span className="text-xs text-slate-600">{app.email ? <a className="text-blue-600 hover:underline" href={`mailto:${app.email}`}>{app.email}</a> : '—'}</span>
                      {app.journalistCharterAccepted && (
                        <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200" title={app.charterAcceptedAt ? `Accepted at ${new Date(app.charterAcceptedAt).toLocaleString()}` : 'Charter accepted'}>
                          Charter ✔
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {app.organisationName ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="font-medium">{app.organisationName}</span>
                        {app.positionTitle && <span className="text-xs text-slate-600">· {app.positionTitle}</span>}
                        {app.organisationType && <span className="text-xs text-slate-500">({app.organisationType})</span>}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {Array.isArray(app.beatsProfessional) && app.beatsProfessional.length > 0 ? app.beatsProfessional.join(', ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {([app.city, app.state, app.country].filter(Boolean).join(', ')) || '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge label={app.reporterType === 'journalist' ? 'Journalist' : 'Community Reporter'} tone={app.reporterType==='journalist'?'blue':'purple'} />
                      <Badge label={app.verificationLevel === 'verified' ? 'Verified' : app.verificationLevel === 'pending' ? 'Pending' : app.verificationLevel === 'limited' ? 'Limited' : app.verificationLevel === 'revoked' ? 'Revoked' : 'Community Default'} tone={app.verificationLevel==='verified'?'green':app.verificationLevel==='pending'?'yellow':app.verificationLevel==='limited'?'yellow':app.verificationLevel==='revoked'?'gray':'gray'} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      {(() => {
                        const s = app.status || 'active';
                        const map: Record<string, { label: string; cls: string }> = {
                          active: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
                          watchlist: { label: 'Watchlist', cls: 'bg-amber-100 text-amber-800 border-amber-200' },
                          suspended: { label: 'Suspended', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
                          banned: { label: 'Banned', cls: 'bg-red-100 text-red-700 border-red-200' },
                        };
                        const info = map[s];
                        return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${info.cls}`}>{info.label}</span>;
                      })()}
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs border bg-slate-100 text-slate-700 border-slate-200">Strikes: {app.ethicsStrikes ?? 0}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">{typeof app.storyCount === 'number' ? app.storyCount : '—'}</td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Optional profile drawer reuse could be wired here */}
                      <Link to={`/community/reporter-stories?reporterKey=${encodeURIComponent(app.email || app._id)}`} className="text-xs px-3 py-1 rounded border hover:bg-slate-50">View Stories</Link>
                      <button
                        className="text-xs px-3 py-1 rounded bg-emerald-600 text-white disabled:opacity-60"
                        disabled={verifying}
                        onClick={() => doVerify(app._id)}
                      >Verify</button>
                      <button
                        className="text-xs px-3 py-1 rounded bg-red-600 text-white disabled:opacity-60"
                        disabled={rejecting}
                        onClick={() => doReject(app._id)}
                      >Reject</button>
                      {/* More actions */}
                      <div className="relative inline-block">
                        <details>
                          <summary className="cursor-pointer list-none inline-flex items-center text-xs px-3 py-1 rounded border bg-white hover:bg-slate-50">More ▾</summary>
                          <div className="absolute z-10 mt-1 w-44 rounded border bg-white shadow p-1">
                            <button className="w-full text-left text-xs px-2 py-1 rounded hover:bg-slate-50" onClick={async ()=> { await updateReporterStatus(app._id, { status: 'watchlist' }); toast.success('Marked watchlist'); qc.invalidateQueries({ queryKey: ['journalist-applications'] }); }}>Mark Watchlist</button>
                            <button className="w-full text-left text-xs px-2 py-1 rounded hover:bg-slate-50" onClick={async ()=> { if (window.confirm('Suspend this reporter?')) { await updateReporterStatus(app._id, { status: 'suspended' }); toast.success('Suspended'); qc.invalidateQueries({ queryKey: ['journalist-applications'] }); } }}>Suspend</button>
                            <button className="w-full text-left text-xs px-2 py-1 rounded hover:bg-slate-50 text-red-700" onClick={async ()=> { if (window.confirm('Ban this reporter? This is sensitive.')) { await updateReporterStatus(app._id, { status: 'banned' }); toast.success('Banned'); qc.invalidateQueries({ queryKey: ['journalist-applications'] }); } }}>Ban</button>
                            <button className="w-full text-left text-xs px-2 py-1 rounded hover:bg-slate-50" onClick={async ()=> { await updateReporterStatus(app._id, { addStrike: true }); toast.success('Ethics strike added'); qc.invalidateQueries({ queryKey: ['journalist-applications'] }); }}>Add ethics strike</button>
                          </div>
                        </details>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

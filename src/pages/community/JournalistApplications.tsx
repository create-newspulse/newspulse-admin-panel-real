import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { listJournalistApplications, verifyJournalist, rejectJournalist, JournalistApplication } from '@/lib/api/communityAdmin';

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
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Organisation</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Beats</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Type / Verification</th>
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
                    <div className="flex items-center gap-2">
                      <button className="text-blue-600 hover:underline" title="View profile" onClick={() => { /* optional: open drawer if wired */ }}>
                        {app.name || '—'}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {app.email ? <a className="text-blue-600 hover:underline" href={`mailto:${app.email}`}>{app.email}</a> : '—'}
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
                      <Badge label={app.verificationLevel === 'verified' ? 'Verified' : app.verificationLevel === 'pending' ? 'Pending' : 'Unverified'} tone={app.verificationLevel==='verified'?'green':app.verificationLevel==='pending'?'yellow':'gray'} />
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

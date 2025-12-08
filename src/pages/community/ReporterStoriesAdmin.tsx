import { useMemo } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listReporterStoriesForAdmin } from '@/lib/community';

function useQueryParam(name: string) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name) || '', [search, name]);
}

export default function ReporterStoriesAdmin() {
  const location = useLocation();
  const reporterKeyFromQuery = useQueryParam('reporterKey');
  const reporterName = useQueryParam('name') || (location.state as any)?.reporterName || '';
  const reporterKeyFromState = (location.state as any)?.reporterKey || '';
  const reporterKey = (reporterKeyFromQuery || reporterKeyFromState).trim();

  // React Query for stories (auto manages loading/error states)
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['reporter-stories-admin', reporterKey],
    queryFn: () => listReporterStoriesForAdmin(reporterKey, { page: 1, limit: 20 }),
    enabled: !!reporterKey,
    staleTime: 15_000,
  });
  const stories = data?.items || [];
  const errorMessage = (error as any)?.message || 'Failed to load stories';

  return (
    <div className="px-6 py-4 max-w-6xl mx-auto space-y-6">
      <header className="space-y-2">
        <div>
          <Link to="/community/reporter-contacts" className="text-sm text-slate-600 hover:text-slate-800">← Back to Reporter Contact Directory</Link>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Reporter stories – {reporterName || 'Unknown reporter'}</h1>
        <p className="text-sm text-slate-600">Founder/Admin view · read-only history of this reporter.</p>
        <div className="text-xs text-slate-500">Reporter key: <span className="font-mono">{reporterKey || '—'}</span></div>
      </header>

      {!reporterKey ? (
        <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-600 space-y-3">
          <div className="font-semibold">No reporter selected.</div>
          <p>Open the Reporter Contact Directory and choose a reporter to view their stories.</p>
          <Link to="/community/reporter-contacts" className="inline-flex items-center px-3 py-1.5 rounded-md border text-sm hover:bg-slate-50">Go to Directory</Link>
        </div>
      ) : isLoading ? (
        <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-600">Loading stories…</div>
      ) : isError ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-6 space-y-4">
          <div className="font-semibold text-red-800">Failed to load stories</div>
          <div className="text-sm text-red-700">{errorMessage}</div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center px-3 py-1.5 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm"
          >Retry</button>
        </div>
      ) : (
        stories.length === 0 ? (
          <div className="rounded-xl border border-slate-200 p-12 text-center space-y-3 bg-white">
            <div className="text-lg font-semibold">No stories yet</div>
            <p className="text-sm text-slate-600">This reporter has not submitted any stories.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Language</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">City</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">AI risk</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Created</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Last updated</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {stories.map(s => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 text-sm">{s.title}</td>
                    <td className="px-4 py-3 text-sm">{s.status}</td>
                    <td className="px-4 py-3 text-sm">{s.language}</td>
                    <td className="px-4 py-3 text-sm">{s.category || '—'}</td>
                    <td className="px-4 py-3 text-sm">{s.city || '—'}</td>
                    <td className="px-4 py-3 text-sm">{s.aiRisk || '—'}</td>
                    <td className="px-4 py-3 text-sm">{s.priority || '—'}</td>
                    <td className="px-4 py-3 text-sm">{new Date(s.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">{new Date(s.updatedAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm">
                      <Link
                        to={`/admin/community-reporter/${encodeURIComponent(s.id)}`}
                        state={{ reporterKey, reporterName }}
                        className="text-blue-600 hover:text-blue-800"
                      >View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

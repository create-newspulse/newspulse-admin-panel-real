import { useMemo, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { listReporterStoriesByEmail } from '@/lib/community';
import type { ReporterAdminStory } from '@/lib/community';

function useQueryParam(name: string) {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search).get(name) || '', [search, name]);
}

export default function ReporterStoriesAdmin() {
  const location = useLocation();
  function useQueryParam(name: string) {
    const { search } = useLocation();
    return useMemo(() => new URLSearchParams(search).get(name) || '', [search, name]);
  }
  const reporterKeyFromQuery = useQueryParam('reporterKey');
  const emailFromQuery = useQueryParam('email');
  const reporterName = useQueryParam('name') || (location.state as any)?.reporterName || '';
  const reporterKeyFromState = (location.state as any)?.reporterKey || '';
  const inferredInitial = (emailFromQuery || reporterKeyFromQuery || reporterKeyFromState).trim();

  const [emailInput, setEmailInput] = useState<string>(inferredInitial);
  const [activeEmail, setActiveEmail] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchText, setSearchText] = useState('');
  const [stories, setStories] = useState<ReporterAdminStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const email = (activeEmail || '').trim();
    if (!email) { setError('Enter reporter email first'); return; }
    setLoading(true); setError(null);
    try {
      const res = await listReporterStoriesByEmail(email, { status: statusFilter === 'all' ? undefined : statusFilter, q: searchText || undefined });
      setStories(res.items || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load stories');
      setStories([]);
    } finally {
      setLoading(false);
    }
  }

      return (
        <div className="px-6 py-4 max-w-6xl mx-auto space-y-6">
          <header className="space-y-2">
            <div>
              <Link to="/community/reporter-contacts" className="text-sm text-slate-600 hover:text-slate-800">← Back to Reporter Contact Directory</Link>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">My Community Stories</h1>
            <p className="text-sm text-slate-600">Admin view – load stories by reporter email.</p>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="Reporter email"
                className="border rounded-md px-3 py-1.5 text-sm w-80"
              />
              <button
                onClick={() => setActiveEmail(emailInput.trim())}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm"
              >Load</button>
            </div>
            <div className="text-xs text-slate-500">Loaded email: <span className="font-mono">{activeEmail || '—'}</span></div>
          </header>

          {loading ? (
            <div className="rounded-xl border border-slate-200 p-6 text-sm text-slate-600">Loading stories…</div>
          ) : error ? (
            <div className="rounded-xl border border-red-300 bg-red-50 p-6 space-y-4">
              <div className="font-semibold text-red-800">Failed to load stories</div>
              <div className="text-sm text-red-700">{error}</div>
              <button
                onClick={() => load()}
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
                <div className="p-3 bg-white border-b border-slate-200 flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Status</label>
                    <select value={statusFilter} onChange={(e)=> setStatusFilter(e.target.value as any)} className="border rounded px-2 py-1 text-sm">
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Search</label>
                    <input value={searchText} onChange={(e)=> setSearchText(e.target.value)} placeholder="Title contains…" className="border rounded px-2 py-1 text-sm w-64" />
                    <button onClick={() => load()} className="inline-flex items-center px-3 py-1.5 rounded-md border text-sm hover:bg-slate-50">Apply</button>
                  </div>
                </div>
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Summary</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Language</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">City</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Created</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Last updated</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {stories.map(s => (
                      <tr key={s.id}>
                        <td className="px-4 py-3 text-sm">{s.title}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{s.summary || '—'}</td>
                        <td className="px-4 py-3 text-sm">{s.status}</td>
                        <td className="px-4 py-3 text-sm">{s.language}</td>
                        <td className="px-4 py-3 text-sm">{s.category || '—'}</td>
                        <td className="px-4 py-3 text-sm">{s.city || '—'}</td>
                        <td className="px-4 py-3 text-sm">{new Date(s.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">{new Date(s.updatedAt).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm">
                          <Link
                            to={`/admin/community-reporter/${encodeURIComponent(s.id)}`}
                            state={{ reporterKey: activeEmail, reporterName }}
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

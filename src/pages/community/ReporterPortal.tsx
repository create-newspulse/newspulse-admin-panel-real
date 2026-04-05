import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { fetchCommunityStats, fetchCommunitySubmissions } from '@/lib/communityAdminApi';
import { listReporterContacts } from '@/lib/api/reporterDirectory';
import { Users, FileText, PenSquare, BarChart3, ArrowRight, AlertCircle } from 'lucide-react';
import MyCommunityStories from '@/pages/community/MyCommunityStories';

interface StatsShape { total: number; pending: number; approved: number; rejected: number; }

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s === 'draft') return 'bg-slate-100 text-slate-700 border border-slate-200';
  if (['pending','under_review','scheduled'].includes(s)) return 'bg-amber-100 text-amber-700 border border-amber-200';
  if (['approved','published'].includes(s)) return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
  if (['rejected','deleted'].includes(s)) return 'bg-red-100 text-red-700 border border-red-200';
  if (s === 'archived') return 'bg-gray-100 text-gray-700 border border-gray-200';
  return 'bg-slate-100 text-slate-600 border border-slate-200';
}

export default function ReporterPortal() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const isFounder = !!(user?.role && String(user.role).toLowerCase().includes('founder'));
  const isAdmin = !!(user?.role && String(user.role).toLowerCase().includes('admin'));
  const { data: submissions, isLoading, isError, error } = useQuery({
    queryKey: ['community-admin-submissions'],
    queryFn: async () => {
      const raw = await fetchCommunitySubmissions({ status: 'pending' });
      const list: any[] = Array.isArray(raw?.items) ? raw.items : Array.isArray(raw) ? raw : Array.isArray((raw as any)?.submissions) ? (raw as any).submissions : [];
      return list.map(s => ({
        id: String(s.id || s._id || s.ID || s.uuid || 'missing-id'),
        headline: s.headline || '',
        title: s.headline || '',
        status: String(s.status || 'pending').toLowerCase(),
        createdAt: s.createdAt,
        city: s.city || s.location || '',
        state: s.state || s.region || '',
        country: s.country || '',
        reporterName: s.userName || s.name || '',
        contactName: s.contactName,
        contactEmail: s.contactEmail || s.email,
        contactPhone: s.contactPhone,
        body: s.body,
      }));
    },
    staleTime: 20_000,
  });

  const { data: statsData } = useQuery({
    queryKey: ['community-admin-stats'],
    queryFn: async () => await fetchCommunityStats(),
    staleTime: 20_000,
  });

  const { data: reporterContactsData, isLoading: reporterContactsLoading } = useQuery({
    queryKey: ['community-reporter-accounts-overview'],
    queryFn: async () => await listReporterContacts({ page: 1, limit: 6 }),
    staleTime: 20_000,
  });

  const items = useMemo(() => (Array.isArray(submissions) ? submissions : []), [submissions]);

  const stats = useMemo<StatsShape>(() => {
    const s = statsData as any;
    if (s && typeof s === 'object') {
      return {
        total: Number(s.totalStories ?? s.total ?? 0),
        pending: Number(s.pendingCount ?? s.pending ?? 0),
        approved: Number(s.approvedCount ?? s.approved ?? 0),
        rejected: Number(s.rejectedCount ?? s.rejected ?? 0),
      };
    }
    const total = items.length;
    const pending = items.filter(s => ['pending','new','under_review'].includes(String(s.status))).length;
    const approved = items.filter(s => ['approved','published'].includes(String(s.status))).length;
    const rejected = items.filter(s => ['rejected','trash'].includes(String(s.status))).length;
    return { total, pending, approved, rejected };
  }, [items, statsData]);

  const recent = useMemo(() => items.slice().sort((a,b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  }).slice(0,5), [items]);

  const reporterAccounts = useMemo(() => {
    const rows = Array.isArray(reporterContactsData?.rows)
      ? reporterContactsData.rows
      : Array.isArray(reporterContactsData?.items)
        ? reporterContactsData.items
        : [];

    return rows
      .slice()
      .sort((left, right) => {
        const leftMs = new Date(left.lastSubmissionAt || left.lastStoryAt || 0).getTime() || 0;
        const rightMs = new Date(right.lastSubmissionAt || right.lastStoryAt || 0).getTime() || 0;
        return rightMs - leftMs;
      })
      .slice(0, 5);
  }, [reporterContactsData]);

  const totalReporterAccounts = typeof reporterContactsData?.total === 'number'
    ? reporterContactsData.total
    : reporterAccounts.length;
  const verifiedReporterAccounts = reporterAccounts.filter((reporter) => reporter.verificationLevel === 'verified').length;
  const restrictedReporterAccounts = reporterAccounts.filter((reporter) => reporter.status === 'suspended' || reporter.status === 'banned').length;

  if (!(isFounder || isAdmin)) {
    return (
      <div className="px-6 py-4 max-w-6xl mx-auto">
        <div className="p-4 border border-red-200 bg-red-50 rounded text-red-700 text-sm">
          Access restricted. Reporter Portal oversight is available to Founder/Admin only.
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-4 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="text-xs text-slate-500">Home {'>'} Community {'>'} Reporter Portal</div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Reporter Portal</h1>
            <p className="text-sm text-slate-600 mt-1">Admin oversight for the live Reporter Portal login, dashboard, submissions, profile activity, and reporter-owned story records.</p>
            {isLoading && (
              <p className="text-xs text-slate-500 mt-1">Loading portal activity…</p>
            )}
            {isError && (
              <p className="text-xs text-red-600 mt-1">{(error as any)?.message || 'Failed to load submissions.'}</p>
            )}
          </div>
        </div>
        <div className="text-sm text-slate-600 md:text-right">
          {isFounder ? (
            <span className="inline-block px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">Founder oversight</span>
          ) : (
            <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Admin oversight: {user?.name || user?.email || 'Unknown user'}</span>
          )}
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 flex items-start gap-2 text-sm">
        <AlertCircle className="w-5 h-5 mt-0.5" />
        <div>
          This admin view mirrors the live Reporter Portal. Reporters keep ownership of their own records while Founder/Admin can monitor login-linked identity context, dashboard activity, submissions, profile signals, and moderation needs here.
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <StatCard icon={<BarChart3 className="w-5 h-5" />} label="Total" value={stats.total} loading={isLoading} />
        <StatCard icon={<PenSquare className="w-5 h-5" />} label="Pending" value={stats.pending} loading={isLoading} />
        <StatCard icon={<Users className="w-5 h-5" />} label="Approved" value={stats.approved} loading={isLoading} />
        <StatCard icon={<AlertCircle className="w-5 h-5" />} label="Rejected" value={stats.rejected} loading={isLoading} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Reporter Accounts Snapshot</h2>
            <p className="mt-1 text-sm text-slate-600">Lightweight visibility into live reporter accounts without leaving the current admin workflow.</p>
          </div>
          <div className="text-sm text-slate-500">
            {reporterContactsLoading ? 'Loading accounts…' : `${totalReporterAccounts} reporter account${totalReporterAccounts === 1 ? '' : 's'}`}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Reporter accounts</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{reporterContactsLoading ? '…' : totalReporterAccounts}</div>
            <div className="mt-1 text-sm text-slate-600">Total accounts currently visible to admin oversight.</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">Identity trust snapshot</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{reporterContactsLoading ? '…' : verifiedReporterAccounts}</div>
            <div className="mt-1 text-sm text-slate-600">Verified reporter identities in the current snapshot. Restricted accounts: {reporterContactsLoading ? '…' : restrictedReporterAccounts}.</div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {reporterContactsLoading && (
            <div className="text-sm text-slate-500">Loading reporter accounts…</div>
          )}

          {!reporterContactsLoading && reporterAccounts.length === 0 && (
            <div className="text-sm text-slate-500">No reporter accounts are available in the admin directory yet.</div>
          )}

          {!reporterContactsLoading && reporterAccounts.map((reporter) => (
            <div key={reporter.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-medium text-slate-900">{reporter.name || reporter.email || 'Unnamed reporter'}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {[reporter.city, reporter.state, reporter.country].filter(Boolean).join(', ') || 'Location pending'}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {reporter.verificationLevel && (
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${reporter.verificationLevel === 'verified' ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : reporter.verificationLevel === 'pending' ? 'border-amber-200 bg-amber-100 text-amber-800' : reporter.verificationLevel === 'limited' ? 'border-amber-200 bg-amber-100 text-amber-800' : reporter.verificationLevel === 'revoked' ? 'border-red-200 bg-red-100 text-red-700' : 'border-slate-200 bg-slate-100 text-slate-700'}`}>
                      {reporter.verificationLevel === 'verified' ? 'Verified identity' : reporter.verificationLevel === 'pending' ? 'Verification pending' : reporter.verificationLevel === 'limited' ? 'Verification limited' : reporter.verificationLevel === 'revoked' ? 'Verification revoked' : 'Identity unverified'}
                    </span>
                  )}
                  {typeof reporter.emailVerified === 'boolean' && (
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${reporter.emailVerified ? 'border-emerald-200 bg-emerald-100 text-emerald-700' : 'border-amber-200 bg-amber-100 text-amber-800'}`}>
                      {reporter.emailVerified ? 'Verified email' : 'Email not verified'}
                    </span>
                  )}
                  {reporter.status && reporter.status !== 'active' && (
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${reporter.status === 'watchlist' ? 'border-amber-200 bg-amber-100 text-amber-800' : 'border-red-200 bg-red-100 text-red-700'}`}>
                      {reporter.status === 'watchlist' ? 'Watchlist' : reporter.status === 'suspended' ? 'Access locked' : 'Blocked'}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-sm text-slate-600 md:text-right">
                <div>{reporter.totalStories} stor{reporter.totalStories === 1 ? 'y' : 'ies'} total</div>
                <div>{reporter.pendingStories} pending</div>
                <div>{reporter.authStatus || 'Auth status unavailable'}{reporter.authProvider ? ` · ${reporter.authProvider}` : ''}</div>
                <div>{reporter.lastSubmissionAt || reporter.lastStoryAt ? `Last submission ${new Date(reporter.lastSubmissionAt || reporter.lastStoryAt || '').toLocaleDateString()}` : 'No submission date yet'}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/community/reporter-contacts" className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Open Reporter Accounts
          </Link>
          <Link to="/community/reporter" className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Open Review Queue
          </Link>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mt-2">
        <Link to="/community/my-stories" className="flex-1 min-w-[220px] bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between hover:bg-indigo-700 transition-colors" onClick={(e)=>{e.preventDefault(); navigate('/community/my-stories');}}>
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <div>
              <div className="font-semibold">Open My Community Stories</div>
              <div className="text-xs text-indigo-200">Review reporter-owned submissions and history</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5" />
        </Link>
        <Link to="/community/submit" className="flex-1 min-w-[220px] bg-white text-slate-900 rounded-xl p-4 flex items-center justify-between border border-slate-200 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <PenSquare className="w-6 h-6" />
            <div>
              <div className="font-semibold">Open Submission Flow</div>
              <div className="text-xs text-slate-500">Use the same reporter-compatible submit story path</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>

      {/* Recent stories */}
      <div className="space-y-3 mt-6">
        <h2 className="text-lg font-semibold">Recent stories</h2>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {isLoading && (
            <div className="p-4 text-sm text-slate-600">Loading…</div>
          )}
          {!isLoading && isError && (
            <div className="p-4 text-sm text-red-600">{(error as any)?.message || 'Failed to load your stories.'}</div>
          )}
          {!isLoading && !isError && recent.length === 0 && (
            <div className="p-4 text-sm text-slate-600">No stories yet. Use “Submit New Story” to send your first report.</div>
          )}
          {!isLoading && !isError && recent.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-2 text-left">Headline</th>
                  <th className="p-2 text-left">Status</th>
                  <th className="p-2 text-left">Reporter</th>
                  <th className="p-2 text-left">Location</th>
                  <th className="p-2 text-left">Created</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(r => (
                  <tr key={r.id} className="border-t hover:bg-slate-50">
                    <td className="p-2 max-w-[260px] truncate" title={r.headline}>{r.headline || 'Untitled'}</td>
                    <td className="p-2"><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] ${statusBadge(String(r.status))}`}>{r.status}</span></td>
                    <td className="p-2 max-w-[160px] truncate" title={r.reporterName}>{r.reporterName || '—'}</td>
                    <td className="p-2 max-w-[160px] truncate" title={[r.city,r.state,r.country].filter(Boolean).join(', ')}>{[r.city,r.state,r.country].filter(Boolean).join(', ') || '—'}</td>
                    <td className="p-2" title={r.createdAt || ''}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Embedded My Community Stories table for reuse */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-3">My Community Stories</h2>
        <MyCommunityStories />
      </div>
    </div>
  );
}

interface StatCardProps { icon: React.ReactNode; label: string; value: number; loading?: boolean }
function StatCard({ icon, label, value, loading }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-sm">
        {icon}
      </div>
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-slate-500">{label}</span>
        <span className="text-xl font-semibold">{loading ? '…' : value}</span>
      </div>
    </div>
  );
}

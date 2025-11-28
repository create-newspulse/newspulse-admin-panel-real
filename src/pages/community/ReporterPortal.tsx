import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { fetchCommunityReporterSubmissions } from '@/api/adminCommunityReporterApi';
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
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['community-admin-portal'],
    queryFn: async () => {
      const raw = await fetchCommunityReporterSubmissions();
      const list: any[] = Array.isArray(raw?.submissions) ? raw.submissions : [];
      // Normalize status lower-case
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

  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const stats = useMemo<StatsShape>(() => {
    const total = items.length;
    const pending = items.filter(s => ['pending','new','under_review'].includes(String(s.status))).length;
    const approved = items.filter(s => ['approved','published'].includes(String(s.status))).length;
    const rejected = items.filter(s => ['rejected','trash'].includes(String(s.status))).length;
    return { total, pending, approved, rejected };
  }, [items]);

  const recent = useMemo(() => items.slice().sort((a,b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bt - at;
  }).slice(0,5), [items]);
  if (!(isFounder || isAdmin)) {
    return (
      <div className="px-6 py-4 max-w-6xl mx-auto">
        <div className="p-4 border border-red-200 bg-red-50 rounded text-red-700 text-sm">
          Access restricted. Reporter Portal is currently a Founder/Admin preview.
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
            <p className="text-sm text-slate-600 mt-1">Founder preview – this is how the Community Reporter workspace will look.</p>
            {isLoading && (
              <p className="text-xs text-slate-500 mt-1">Loading your stories…</p>
            )}
            {isError && (
              <p className="text-xs text-red-600 mt-1">{(error as any)?.message || 'Failed to load submissions.'}</p>
            )}
          </div>
        </div>
        <div className="text-sm text-slate-600 md:text-right">
          {isFounder ? (
            <span className="inline-block px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">Logged in as Founder Preview</span>
          ) : (
            <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Reporter: {user?.name || user?.email || 'Unknown user'}</span>
          )}
        </div>
      </div>

      {/* Warning for non-founder */}
      {!isFounder && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 flex items-start gap-2 text-sm">
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <div>This page is primarily designed for the Founder preview. In future, it will be the main dashboard for Community Reporters.</div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
        <StatCard icon={<BarChart3 className="w-5 h-5" />} label="Total" value={stats.total} loading={isLoading} />
        <StatCard icon={<PenSquare className="w-5 h-5" />} label="Pending" value={stats.pending} loading={isLoading} />
        <StatCard icon={<Users className="w-5 h-5" />} label="Approved" value={stats.approved} loading={isLoading} />
        <StatCard icon={<AlertCircle className="w-5 h-5" />} label="Rejected" value={stats.rejected} loading={isLoading} />
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4 mt-2">
        <Link to="/community/my-stories" className="flex-1 min-w-[220px] bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between hover:bg-indigo-700 transition-colors" onClick={(e)=>{e.preventDefault(); navigate('/community/my-stories');}}>
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6" />
            <div>
              <div className="font-semibold">Open My Stories</div>
              <div className="text-xs text-indigo-200">View and manage your submissions</div>
            </div>
          </div>
          <ArrowRight className="w-5 h-5" />
        </Link>
        <Link to="/community/submit" className="flex-1 min-w-[220px] bg-white text-slate-900 rounded-xl p-4 flex items-center justify-between border border-slate-200 hover:bg-slate-50 transition-colors">
          <div className="flex items-center gap-3">
            <PenSquare className="w-6 h-6" />
            <div>
              <div className="font-semibold">Submit New Story</div>
              <div className="text-xs text-slate-500">Write and send a new report</div>
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

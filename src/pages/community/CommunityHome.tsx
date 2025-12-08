import { Link } from 'react-router-dom';
import { Users, LayoutGrid, FileText, PenSquare } from 'lucide-react';
import { ContactRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import adminApi from '@/api/adminApi';

type CommunityStats = {
  pendingStories: number;
  approvedStories: number;
  rejectedStories: number;
  totalReporters: number;
  verifiedJournalists: number;
};

export default function CommunityHome() {
  const [stats, setStats] = useState<CommunityStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await adminApi.get<any>('/api/admin/community/stats');
        const s = res?.data ?? {};
        const norm: CommunityStats = {
          pendingStories: Number(s.pendingStories ?? s.pending ?? 0),
          approvedStories: Number(s.approvedStories ?? s.approved ?? 0),
          rejectedStories: Number(s.rejectedStories ?? s.rejected ?? 0),
          totalReporters: Number(s.totalReporters ?? s.reporters ?? 0),
          verifiedJournalists: Number(s.verifiedJournalists ?? s.verified ?? 0),
        };
        if (!cancelled) setStats(norm);
      } catch (e: any) {
        if (!cancelled) setStatsError('Failed to load stats');
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);
  // Breadcrumbs are globally rendered; keep local minimal description
  return (
    <div className="px-6 py-4 max-w-6xl mx-auto space-y-8">
      {/* Local breadcrumb (optional) omitted since global <Breadcrumbs /> handles it */}
      <header className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow">
          <LayoutGrid className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Community Hub</h1>
          <p className="text-sm text-slate-600 mt-1">Central place for all Community Reporter tools.</p>
          {/* Top stats pills with higher contrast for accessibility */}
          <div className="mt-3 grid grid-cols-3 gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-4 py-1 text-xs md:text-sm text-slate-700 dark:bg-slate-700 dark:text-slate-100"
            >
              <span>Pending stories</span>
              <span className="font-semibold text-slate-900 dark:text-white">{stats?.pendingStories ?? 0}</span>
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-4 py-1 text-xs md:text-sm text-slate-700 dark:bg-slate-700 dark:text-slate-100"
            >
              <span>Total reporters</span>
              <span className="font-semibold text-slate-900 dark:text-white">{stats?.totalReporters ?? 0}</span>
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-4 py-1 text-xs md:text-sm text-slate-700 dark:bg-slate-700 dark:text-slate-100"
            >
              <span>Verified journalists</span>
              <span className="font-semibold text-slate-900 dark:text-white">{stats?.verifiedJournalists ?? 0}</span>
            </button>
          </div>
          {statsError && (
            <div className="mt-2 text-xs text-red-700">{statsError}</div>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Reporter Portal */}
        <HubCard
          to="/community/portal"
          title="Reporter Portal"
          description="Dashboard view, stats & recent stories"
          icon={<Users className="w-6 h-6" />}
          variant="primary"
        />
        {/* Community Reporter Queue */}
        <HubCard
          to="/community/reporter"
          title="Community Reporter Queue"
          description="Founder/Admin review & moderation"
          icon={<FileText className="w-6 h-6" />}
          variant="secondary"
        />
        {/* My Community Stories (route exists) */}
        <HubCard
          to="/community/my-stories"
          title="My Community Stories"
          description="Manage and track your submissions"
          icon={<PenSquare className="w-6 h-6" />}
          variant="neutral"
        />
        {/* Reporter Contact Directory */}
        <HubCard
          to="/community/reporter-contacts"
          title="Reporter Contact Directory"
          description="Secure list of reporters’ contact & location for follow-up."
          icon={<ContactRound className="w-6 h-6" />}
          variant="secondary"
        />
        {/* Journalist Applications */}
        <HubCard
          to="/community/journalist-applications"
          title="Journalist Applications"
          description="Review and verify professional journalist applicants."
          icon={<ContactRound className="w-6 h-6" />}
          variant="secondary"
        />
        {/* Founder-only: Community Reporter Feature Toggles */}
        <HubCard
          to="/founder/feature-toggles"
          title="Community Reporter Feature Toggles – Founder only"
          description="Configure visibility of the public Reporter Portal features."
          icon={<LayoutGrid className="w-6 h-6" />}
          variant="secondary"
        />
      </section>

      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-indigo-700 text-sm">
        This hub will expand as new Community features are introduced. Use the cards above to access current tools.
      </div>
    </div>
  );
}

interface HubCardProps {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'neutral';
}

function HubCard({ to, title, description, icon, variant = 'neutral' }: HubCardProps) {
  const base = 'group rounded-xl border p-5 flex flex-col gap-3 transition shadow-sm';
  const styles = {
    primary: 'bg-slate-900 border-slate-900 text-white hover:bg-indigo-700',
    secondary: 'bg-white border-slate-200 hover:bg-slate-50 text-slate-900',
    neutral: 'bg-white border-slate-200 hover:bg-slate-50 text-slate-900'
  }[variant];
  return (
    <Link to={to} className={`${base} ${styles}`}>      
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center shadow-inner ${variant==='primary'?'bg-black/30':'bg-slate-100 group-hover:bg-slate-200'} text-current`}>{icon}</div>
        <div className="flex-1">
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
          <p className={`text-xs mt-1 ${variant==='primary'?'text-indigo-200':'text-slate-600'}`}>{description}</p>
        </div>
      </div>
      <div className={`mt-auto text-xs font-medium ${variant==='primary'?'text-indigo-200':'text-slate-500'} underline-offset-2 group-hover:underline`}>Open →</div>
    </Link>
  );
}

// StatChip removed in favor of higher contrast pills

import { Link } from 'react-router-dom';
import { Users, LayoutGrid, FileText, PenSquare } from 'lucide-react';
import { ContactRound } from 'lucide-react';

export default function CommunityHome() {
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

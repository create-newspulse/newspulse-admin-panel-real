import React from 'react';

type NavItem = { label: string; href: string; icon?: React.ReactNode };

const nav: NavItem[] = [
  { label: 'Dashboard', href: '/admin/V2Dashboard' },
  { label: 'All News', href: '/AllNews' },
  { label: 'Manage News', href: '/ManageNews' },
  { label: 'Embeds', href: '/admin/EmbedManager' },
  { label: 'Moderation', href: '/admin/Moderation' },
  { label: 'Analytics', href: '/AnalyticsDashboard' },
  { label: 'Settings', href: '/admin/Settings' },
];

export function ThemeToggle() {
  const [isDark, setIsDark] = React.useState<boolean>(false);
  React.useEffect(() => {
    const root = document.documentElement;
    const next = isDark ? 'dark' : '';
    root.classList.toggle('dark', isDark);
    localStorage.setItem('np-theme', next);
  }, [isDark]);
  React.useEffect(() => {
    const saved = localStorage.getItem('np-theme');
    if (saved === 'dark') setIsDark(true);
  }, []);
  return (
    <button
      type="button"
      onClick={() => setIsDark(v => !v)}
      className="px-3 py-2 rounded-lg text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
      aria-label="Toggle theme"
      title="Toggle theme"
    >
      {isDark ? '🌙 Dark' : '☀️ Light'}
    </button>
  );
}

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [path, setPath] = React.useState<string>('');
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setPath(window.location.pathname);
    }
  }, []);

  const NavLinks = (
    <nav className="p-3 space-y-1">
      {nav.map(item => {
        const isActive = path && path.toLowerCase().startsWith(item.href.toLowerCase());
        return (
          <a
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-150 
              ${isActive ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-100' : 'hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800'}`}
          >
            <span aria-hidden>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${isActive ? 'bg-blue-600' : 'bg-blue-500'}`} />
            </span>
            {item.label}
          </a>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#0b1725] text-slate-900 dark:text-slate-100">
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className={`hidden md:block w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur sticky top-0 h-screen`}>
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="text-xl font-extrabold tracking-tight"><span className="text-blue-600">News</span>Pulse Admin</div>
          </div>
          {NavLinks}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800">
            <ThemeToggle />
          </div>
        </aside>

        {/* Mobile Drawer */}
        {open && (
          <div className="md:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-xl">
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="text-lg font-bold"><span className="text-blue-600">News</span>Pulse</div>
                <button className="p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setOpen(false)} aria-label="Close">✕</button>
              </div>
              {NavLinks}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800"><ThemeToggle /></div>
            </div>
          </div>
        )}

        {/* Main */}
        <div className="flex-1 min-w-0">
          {/* Topbar */}
          <header className="sticky top-0 z-40 bg-white/70 dark:bg-slate-900/60 backdrop-blur border-b border-slate-200 dark:border-slate-800">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button className="md:hidden p-2 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800" onClick={() => setOpen(v => !v)} aria-label="Toggle menu">☰</button>
                <div className="font-semibold">Admin Panel</div>
                <div className="hidden sm:flex items-center gap-2 ml-4 text-xs text-slate-500 dark:text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">v2</span>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200">Design System</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input placeholder="Search…" className="hidden md:block px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
                <ThemeToggle />
                <div className="ml-2 w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500" aria-label="User" />
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

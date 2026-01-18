import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { useAuthZ } from '@/store/auth';
import { useTranslation } from 'react-i18next';
import { useStats } from '@/store/stats';
import { mockStats } from '@/lib/mock';
import { Link } from 'react-router-dom';
import { Toaster } from 'sonner';
import { translationUiEnabled } from '@/config/featureFlags';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuthZ();
  const { i18n } = useTranslation();
  const { setStats } = useStats();
  const [theme, setTheme] = useState<'light'|'dark'>(() => (localStorage.getItem('np_theme') as 'light'|'dark') || 'light');
  const showTranslationUi = translationUiEnabled();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('np_theme', theme);
  }, [theme]);

  // Initialize some mock stats for badges/quick cards
  useEffect(() => {
    setStats(mockStats());
  }, [setStats]);

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50">
      <Sidebar />
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur sticky top-0 z-10 flex items-center justify-between px-4">
          <div className="text-sm text-slate-500">{user?.role === 'founder' ? <span>Welcome back, {user?.name || 'Founder'} 👑</span> : <span>Welcome</span>}</div>
          <div className="flex items-center gap-2">
            {showTranslationUi ? (
              <select
                className="text-sm bg-transparent border rounded px-2 py-1 dark:border-slate-700"
                value={i18n.language}
                onChange={(e) => i18n.changeLanguage(e.target.value)}
              >
                <option value="en">EN</option>
                <option value="hi">HN</option>
                <option value="gu">GJ</option>
              </select>
            ) : null}
            <button className="text-sm border rounded px-2 py-1 dark:border-slate-700" onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Light' : 'Dark'}</button>
            <Link className="text-xs underline opacity-70 hover:opacity-100" to="/admin/dashboard">Back to classic</Link>
          </div>
        </div>
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}

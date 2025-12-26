import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import StatsCards from '@components/StatsCards';
import LiveTicker from '@components/LiveTicker';
import ChartComponent from '@components/ChartComponent';
import SystemHealthBadge from '@components/SystemHealthBadge';
import { apiUrl } from '@/lib/apiBase';
import api from '@/utils/api';

type AdminStats = {
  totalNews: number;
  categoriesCount: number;
  languagesCount: number;
  activeUsersCount: number;
  aiLogsCount: number;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'disabled'>('loading');
  const [statsState, setStatsState] = useState<'loading' | 'ready' | 'disabled'>('loading');
  const [statsErrorText, setStatsErrorText] = useState<string | undefined>(undefined);
  const [banner, setBanner] = useState<null | { type: 'error' | 'forbidden' | 'expired'; title: string; subtitle?: string }>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setState('loading');
      setStatsState('loading');
      setStatsErrorText(undefined);
      setBanner(null);
      setStats(null);

      try {
        const res = await api.get('/admin/stats', { timeout: 12000 });
        // Backend wraps as { data: { ...counters } }. Some deployments may return the payload directly.
        const payload = (res as any)?.data?.data ?? (res as any)?.data ?? {};

        const normalized: AdminStats = {
          totalNews: Number((payload as any)?.totalNews ?? 0),
          categoriesCount: Number((payload as any)?.categories ?? 0),
          languagesCount: Number((payload as any)?.languages ?? 0),
          activeUsersCount: Number((payload as any)?.activeUsers ?? 0),
          aiLogsCount: Number((payload as any)?.aiLogs ?? 0),
        };

        if (cancelled) return;
        setStats(normalized);
        setStatsState('ready');
        setState('ready');
      } catch (err: any) {
        if (cancelled) return;
        const status = err?.response?.status as number | undefined;

        if (status === 401) {
          setBanner({
            type: 'expired',
            title: 'Session expired',
            subtitle: 'Please log in again.',
          });
          setState('disabled');
          setStatsState('disabled');
          setStatsErrorText('Failed to load stats');
          // Let global interceptors clear auth, but also redirect here for correctness.
          try {
            navigate('/admin/login', { replace: true });
          } catch {}
          return;
        }

        if (status === 403) {
          setBanner({
            type: 'forbidden',
            title: 'Access denied',
            subtitle: 'Your account does not have permission to view these stats.',
          });
          setState('disabled');
          setStatsState('disabled');
          setStatsErrorText('Failed to load stats');
          return;
        }

        // Non-auth failures: keep the dashboard usable, but show stats as unavailable.
        const isNetworkLike = !status || status >= 500;
        setBanner({
          type: 'error',
          title: isNetworkLike
            ? 'Backend unreachable. Check API URL / CORS / Render status.'
            : 'Failed to load dashboard stats.',
          subtitle: isNetworkLike ? undefined : `Request failed (HTTP ${status}).`,
        });

        setState('disabled');
        setStatsState('disabled');
        setStatsErrorText('Failed to load stats');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // Feature flag: disable the yellow scrolling ticker by default.
  // Enable by setting VITE_SHOW_TICKER=true at build time.
  const SHOW_TICKER = (import.meta.env.VITE_SHOW_TICKER === 'true');

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-100 dark:from-slate-900 dark:to-slate-800 text-gray-900 dark:text-white transition-all duration-500">
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-12">
        <header
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="space-y-3">
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white">Admin Dashboard</h1>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/add')}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Add News
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/articles')}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Manage News
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/drafts')}
                className="rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Draft Desk
              </button>
            </div>
          </div>
          <div className="mt-1 sm:mt-0">
            <SystemHealthBadge />
          </div>
  </header>

        {banner?.type === 'error' ? (
          <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-5">
            <div className="text-lg font-semibold text-red-800 dark:text-red-200">{banner.title}</div>
            {banner.subtitle ? (
              <div className="mt-1 text-sm text-red-700/90 dark:text-red-200/80">{banner.subtitle}</div>
            ) : null}
          </div>
        ) : null}

        {banner?.type === 'forbidden' ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-5">
            <div className="text-lg font-semibold text-amber-900 dark:text-amber-200">{banner.title}</div>
            {banner.subtitle ? (
              <div className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/80">{banner.subtitle}</div>
            ) : null}
          </div>
        ) : null}

        {banner?.type === 'expired' ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-5">
            <div className="text-lg font-semibold text-amber-900 dark:text-amber-200">{banner.title}</div>
            {banner.subtitle ? (
              <div className="mt-1 text-sm text-amber-800/90 dark:text-amber-200/80">{banner.subtitle}</div>
            ) : null}
          </div>
        ) : null}

        <section>
          <StatsCards
            state={statsState}
            errorText={statsErrorText}
            values={
              stats
                ? {
                    totalNews: stats.totalNews,
                    categoriesCount: stats.categoriesCount,
                    languagesCount: stats.languagesCount,
                    activeUsersCount: stats.activeUsersCount,
                    aiLogsCount: stats.aiLogsCount,
                  }
                : undefined
            }
          />
        </section>

        {state === 'ready' ? (
          <>

            <ChartComponent />

            {SHOW_TICKER && (
              <section>
                <LiveTicker apiUrl={apiUrl('/news-ticker')} position="top" />
              </section>
            )}
          </>
        ) : null}

        <section aria-labelledby="ai-insights" className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
          <h2 id="ai-insights" className="text-2xl font-semibold text-slate-700 dark:text-slate-100 mb-2">
            AI Insights
          </h2>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            AI insights will appear after launch when real analytics are available.
          </div>
        </section>
      </div>
    </main>
  );
};

export default Dashboard;

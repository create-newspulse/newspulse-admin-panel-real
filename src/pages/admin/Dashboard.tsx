import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import StatsCards from '@components/StatsCards';
import NewsCard from '@components/NewsCard';
import LiveTicker from '@components/LiveTicker';
import VoicePlayer from '@components/VoicePlayer';
import ChartComponent from '@components/ChartComponent';
import VoiceAndExplainer from '@components/VoiceAndExplainer';
import SystemHealthBadge from '@components/SystemHealthBadge';
import SystemHealthPanel from '@components/SystemHealthPanel';
import { fetchJson } from '@lib/fetchJson';
import { adminRoot } from '@lib/adminApi';

// api client from src/lib/api.ts (default export = axios instance)
import apiClient from '@lib/api';

type DashboardStats = {
  total: number;
  // When arrays are available we keep them, but we also compute numeric totals for cards.
  byCategory: { _id: string | null; count: number }[];
  byLanguage: { _id: string | null; count: number }[];
  categoriesTotal: number;
  languagesTotal: number;
  recent: {
    _id: string;
    title: string;
    trendingScore: number;
    isTrending?: boolean;
    isTopPick?: boolean;
    createdAt: string | null;
  }[];
  aiLogs: number;
  activeUsers: number;
};

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [aiCommand, setAiCommand] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugExpanded, setDebugExpanded] = useState(false);

  // Build base aware of proxy usage. If adminRoot is '/admin-api' we do not append '/api'.
  const API_BASE = adminRoot.startsWith('/admin-api') ? adminRoot : `${adminRoot}/api`;

  const articles = useMemo(
    () => [
      { _id: '1', title: t('aiSummaryTitle'), summary: t('aiSummaryBody') },
      { _id: '2', title: t('topNewsTitle'), summary: t('topNewsBody') },
    ],
    [t]
  );

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);

      // normalize payload into your DashboardStats shape
      const normalize = (raw: any): DashboardStats => {
        const totals = raw?.totals || {};
        const byCategory = Array.isArray(raw?.byCategory) ? raw.byCategory : [];
        const byLanguage = Array.isArray(raw?.byLanguage) ? raw.byLanguage : [];
        const categoriesTotal = Number(
          totals.categories ?? raw?.categories ?? (Array.isArray(byCategory) ? byCategory.length : 0)
        );
        const languagesTotal = Number(
          totals.languages ?? raw?.languages ?? (Array.isArray(byLanguage) ? byLanguage.length : 0)
        );
        return {
          total: Number(raw?.total ?? totals.news ?? 0),
          byCategory,
          byLanguage,
          categoriesTotal,
          languagesTotal,
          recent: Array.isArray(raw?.recent) ? raw.recent : [],
          aiLogs: Number(raw?.aiLogs ?? totals.aiLogs ?? 0),
          activeUsers: Number(raw?.activeUsers ?? totals.users ?? 0),
        };
      };

      try {
        // Prefer the centralized axios client (handles base, creds, errors)
        try {
          const r1 = await apiClient.get('/dashboard-stats');
          const payload = r1.data?.data ?? r1.data;
          setStats(normalize(payload));
          return;
        } catch (e1: any) {
          // Fallback alias
          const r2 = await apiClient.get('/stats');
          const payload2 = r2.data?.data ?? r2.data;
          setStats(normalize(payload2));
        }
      } catch (err: any) {
        console.error('❌ Dashboard API Error:', err?.message || err);
        setError('Failed to load dashboard stats. Please ensure the backend server is running.');
      } finally {
        setLoading(false);
      }
    };

    const fetchAICommand = async () => {
      try {
        // Use fallback-aware helper to handle misrouted /admin-api proxy
        const json = await fetchJson(`${API_BASE}/system/health`);
        setAiCommand(json);
      } catch (err: any) {
        console.error('❌ AI Command API Error:', err?.message || err);
        // If the server returned HTML/Not Found, surface that preview in the panel
        setAiCommand({ _nonJson: true, contentType: 'unknown', preview: String(err?.message || 'Unknown error') });
      }
    };

    fetchStats();
    fetchAICommand();
  }, [API_BASE, t]);

  const langCode = (i18n.language?.split('-')[0] || 'en') as 'en' | 'hi' | 'gu';
  // Feature flag: disable the yellow scrolling ticker by default.
  // Enable by setting VITE_SHOW_TICKER=true at build time.
  const SHOW_TICKER = (import.meta.env.VITE_SHOW_TICKER === 'true');

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-100 dark:from-slate-900 dark:to-slate-800 text-gray-900 dark:text-white transition-all duration-500">
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-12">
        <header
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            📊 {t('dashboard')}
          </h1>
          <div className="mt-1 sm:mt-0">
            <SystemHealthBadge />
          </div>
  </header>

        {loading && (
          <div className="text-center text-gray-500 dark:text-gray-400">
            ⏳ {t('loadingDashboard')}
          </div>
        )}

        {error && (
          <div className="text-center text-red-600 font-medium">
            ❌ {error}
          </div>
        )}

        {stats && (
          <>
            <section>
              <StatsCards
                totalNews={stats.total}
                categoryCount={stats.categoriesTotal}
                languageCount={stats.languagesTotal}
                activeUsers={stats.activeUsers}
                aiLogs={stats.aiLogs}
              />
            </section>

            <section>
              <ChartComponent />
            </section>

            <section>
              <SystemHealthPanel />
            </section>

            {SHOW_TICKER && (
              <section>
                <LiveTicker apiUrl={`${API_BASE}/news-ticker`} position="top" />
              </section>
            )}

            <section>
              <VoiceAndExplainer text={t('aiSummaryBody')} />
              <VoicePlayer text={t('topNewsBody')} language={langCode} />
            </section>
          </>
        )}

        <section aria-labelledby="ai-insights">
          <h2
            id="ai-insights"
            className="text-2xl font-semibold text-slate-700 dark:text-slate-100 mb-6 flex items-center gap-2"
          >
            🧠 {t('weeklyAiInsights')}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {articles.map((article) => (
              <NewsCard key={article._id} article={article} />
            ))}
          </div>

          {aiCommand && (
            <div className="mt-10 p-4 bg-slate-100 dark:bg-slate-700 rounded">
              <h2 className="text-lg font-semibold">🔐 AI Command Debug</h2>
              {aiCommand._nonJson ? (
                <div className="text-xs text-red-200/90 bg-red-700/30 border border-red-400/40 rounded p-3 mt-2">
                  <p className="mb-2 font-medium">Non-JSON response from /system/ai-command</p>
                  <p className="mb-2">content-type: <code>{aiCommand.contentType}</code></p>
                  <pre className="ai-debug-box text-[11px]">
                    {debugExpanded ? aiCommand.preview : String(aiCommand.preview ?? '').slice(0, 300) + (String(aiCommand.preview ?? '').length > 300 ? '…' : '')}
                  </pre>
                  <button
                    className="mt-2 inline-flex items-center px-3 py-1 rounded bg-slate-800 text-white text-xs hover:bg-slate-900 disabled:opacity-60"
                    onClick={() => setDebugExpanded((v) => !v)}
                  >
                    {debugExpanded ? 'Show Less' : 'Show More'}
                  </button>
                  <p className="mt-2 opacity-80">Tip: ensure this endpoint returns application/json in production; if unauthorized, the backend should return 401 with a JSON body.</p>
                </div>
              ) : (
                <div>
                  <pre className="ai-debug-box text-sm">
                    {debugExpanded
                      ? JSON.stringify(aiCommand, null, 2)
                      : JSON.stringify(aiCommand, null, 2).slice(0, 600) + (JSON.stringify(aiCommand, null, 2).length > 600 ? '…' : '')}
                  </pre>
                  <button
                    className="mt-2 inline-flex items-center px-3 py-1 rounded bg-slate-800 text-white text-xs hover:bg-slate-900 disabled:opacity-60"
                    onClick={() => setDebugExpanded((v) => !v)}
                  >
                    {debugExpanded ? 'Show Less' : 'Show More'}
                  </button>
                </div>
              )}
            </div>
          )}
  </section>
      </div>
    </main>
  );
};

export default Dashboard;

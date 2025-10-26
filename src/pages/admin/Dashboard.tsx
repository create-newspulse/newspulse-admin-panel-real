import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import StatsCards from '@components/StatsCards';
import NewsCard from '@components/NewsCard';
import LiveTicker from '@components/LiveTicker';
import VoicePlayer from '@components/VoicePlayer';
import ChartComponent from '@components/ChartComponent';
import VoiceAndExplainer from '@components/VoiceAndExplainer';

// api client from src/lib/api.ts (default export = axios instance)
import apiClient from '@lib/api';

type DashboardStats = {
  total: number;
  byCategory: { _id: string | null; count: number }[];
  byLanguage: { _id: string | null; count: number }[];
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

  // Use relative /api so Vite proxy handles the active backend port in development
  const API_BASE = '/api';

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
        if (raw?.total !== undefined && raw?.byCategory && raw?.byLanguage) {
          return raw as DashboardStats;
        }
        const totals = raw?.totals || {};
        return {
          total: Number(totals.news ?? 0),
          byCategory: Array.isArray(raw?.byCategory) ? raw.byCategory : [],
          byLanguage: Array.isArray(raw?.byLanguage) ? raw.byLanguage : [],
          recent: Array.isArray(raw?.recent) ? raw.recent : [],
          aiLogs: Number(raw?.aiLogs ?? 0),
          activeUsers: Number(raw?.activeUsers ?? 0),
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
        const res = await apiClient.get('/system/ai-command');
        setAiCommand(res.data);
      } catch (err: any) {
        console.error('❌ AI Command API Error:', err.response?.data || err.message);
      }
    };

    fetchStats();
    fetchAICommand();
  }, [API_BASE, t]);

  const langCode = (i18n.language?.split('-')[0] || 'en') as 'en' | 'hi' | 'gu';

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-100 dark:from-slate-900 dark:to-slate-800 text-gray-900 dark:text-white transition-all duration-500">
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-12">
        <header
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white">
            📊 {t('dashboard')}
          </h1>
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
                categoryCount={stats.byCategory.length}
                languageCount={stats.byLanguage.length}
                activeUsers={stats.activeUsers}
                aiLogs={stats.aiLogs}
              />
            </section>

            <section>
              <ChartComponent />
            </section>

            <section>
              <LiveTicker apiUrl={`${API_BASE}/news-ticker`} position="top" />
            </section>

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
              <pre className="text-sm">{JSON.stringify(aiCommand, null, 2)}</pre>
            </div>
          )}
  </section>
      </div>
    </main>
  );
};

export default Dashboard;

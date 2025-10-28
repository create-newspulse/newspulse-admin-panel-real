import React, { useEffect, useState } from 'react';
import axios, { AxiosResponse } from 'axios';

interface CategoryCount {
  _id: string | null;
  count: number;
}
interface LanguageCount {
  _id: string | null;
  count: number;
}
interface NewsItem {
  _id: string;
  title: string;
  createdAt?: string | null;
}

interface DashboardStats {
  total: number;
  byCategory: CategoryCount[];
  byLanguage: LanguageCount[];
  recent: NewsItem[];
  aiLogs: number;
  activeUsers: number;
  lastTraining?: string | null;
}

// ---- WORKAROUND: Safe env access for broken TS configs ----
const VITE_API_URL: string =
  (import.meta as any).env?.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.origin + '/api') ||
  '/api';

const API_BASE = VITE_API_URL.replace(/\/$/, '');

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      setLoading(true);
      setError(null);
      try {
        const response: AxiosResponse<any> = await axios.get(`${API_BASE}/dashboard-stats`);
        if (!cancelled) {
          if (response.data?.success && response.data.data) {
            setStats(response.data.data);
          } else {
            setError('❌ Failed to load dashboard stats (invalid response).');
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Dashboard API Error:', err);
          setError(
            err?.response?.data?.message ||
              '❌ Failed to load dashboard stats. Please ensure the backend server is running.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchStats();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="p-6 text-gray-500 animate-pulse">
        <span role="status">⏳ Loading dashboard...</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-6 text-red-600 flex items-center gap-2">
        <span>❌</span> <span>{error}</span>
      </div>
    );
  }
  if (!stats) {
    return (
      <div className="p-6 text-red-500">
        ⚠️ No dashboard data available. Please try again.
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">📊 Admin Dashboard</h1>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <div className="bg-white dark:bg-gray-800 shadow rounded p-4">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">📰 Total Articles</h2>
          <p className="text-2xl font-bold text-blue-600">{stats.total ?? 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded p-4">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">🟢 Active Users</h2>
          <p className="text-2xl font-bold text-green-600">{stats.activeUsers ?? 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded p-4">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">🧠 AI Logs</h2>
          <p className="text-2xl font-bold text-purple-600">{stats.aiLogs ?? 0}</p>
        </div>
      </div>

      {/* Latest News */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">📰 Latest News</h2>
        <ul>
          {(stats.recent || []).map((news) => (
            <li key={news._id} className="mb-1">
              <span className="font-mono">{news.title}</span>
              {news.createdAt && (
                <span className="ml-2 text-xs text-gray-500">
                  {new Date(news.createdAt).toLocaleString()}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default Dashboard;

// 📁 src/pages/AnalyticsDashboard.tsx

import { useEffect, useState } from 'react';
import { useTranslate } from '../hooks/useTranslate';
import useAuthGuard from '../hooks/useAuthGuard'; // 🔐 Guard
import { adminApi, resolveAdminPath } from '@lib/adminApi';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';

interface TopPage {
  _id: string;
  count: number;
}

interface Summary {
  totalViews: number;
  viewsToday: number;
  topPages: TopPage[];
}

export default function AnalyticsDashboard() {
  useAuthGuard(); // 🔐 Redirects if not logged in
  const t = useTranslate();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const candidates = [
          '/api/dashboard-stats',
          '/dashboard-stats',
          '/api/stats',
          '/stats',
          '/admin/stats',
          '/api/admin/stats',
        ];
        let ok = false;
        for (const c of candidates) {
          try {
            const p = resolveAdminPath(c);
            const res = await adminApi.get(p);
            const data = res.data?.data ?? res.data;
            if (data) {
              setSummary({
                totalViews: data.totalViews ?? data?.totals?.views ?? 0,
                viewsToday: data.viewsToday ?? data?.totals?.viewsToday ?? 0,
                topPages: data.topPages ?? [],
              });
              ok = true;
              break;
            }
          } catch (e: any) {
            if (e?.response?.status && e.response.status !== 404) throw e;
            continue;
          }
        }
        if (!ok) throw new Error('No analytics endpoint available');
      } catch (err: any) {
        console.error('❌ Failed to load analytics:', err?.message);
        setError(err?.message || 'Analytics fetch failed');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const chartData =
    summary?.topPages.map((page) => ({
      name: page._id?.length > 20 ? page._id.slice(0, 20) + '…' : page._id,
      views: page.count,
    })) || [];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">
        📊 {t('analyticsDashboard') || 'Analytics Dashboard'}
      </h1>

      {loading && <p>Loading data...</p>}
      {error && <p className="text-red-600">{error}</p>}

      {summary && (
        <div className="space-y-6">
          {/* ✅ Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white shadow p-4 rounded border">
              <h2 className="text-xl font-semibold">👥 Total Views</h2>
              <p className="text-3xl mt-2">{summary.totalViews}</p>
            </div>
            <div className="bg-white shadow p-4 rounded border">
              <h2 className="text-xl font-semibold">📅 Views Today</h2>
              <p className="text-3xl mt-2">{summary.viewsToday}</p>
            </div>
          </div>

          {/* 🔥 Top Pages List */}
          <div className="bg-white shadow p-4 rounded border">
            <h2 className="text-xl font-semibold mb-2">🔥 Top Pages</h2>
            <ul className="space-y-1">
              {summary.topPages.length === 0 && (
                <li className="text-gray-500">No top pages found.</li>
              )}
              {summary.topPages.map((page, index) => (
                <li key={index} className="text-gray-700">
                  <span className="font-mono">{page._id}</span> —{' '}
                  <strong>{page.count}</strong> views
                </li>
              ))}
            </ul>
          </div>

          {/* 📊 Chart */}
          <div className="bg-white shadow p-4 rounded border">
            <h2 className="text-xl font-semibold mb-4">📈 Views by Page</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="views" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

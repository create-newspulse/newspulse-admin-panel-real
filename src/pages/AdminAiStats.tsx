// 📁 src/pages/AdminAiStats.tsx
import React, { useEffect, useState, useRef } from 'react';
import { fetchJson } from '@/lib/fetchJson';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

interface EngineStat {
  name: string;
  value: number;
  [key: string]: unknown;
}

interface DailyStat {
  date: string;
  count: number;
}

const COLORS = ['#007aff', '#00c49f', '#ff6384'];

const AdminAiStats: React.FC = () => {
  const [stats, setStats] = useState<EngineStat[]>([]);
  const [dailyData, setDailyData] = useState<DailyStat[]>([]);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const fetchEngineStats = async () => {
      try {
        const data = await fetchJson<any>('/ai/logs/engine-stats');
        if (data.success && data.stats) {
          const converted: EngineStat[] = Object.entries(data.stats).map(
            ([engine, count]) => ({
              name: engine.toUpperCase(),
              value: Number(count),
            })
          );
          setStats(converted);
        }
      } catch (err) {
        console.error('Failed to fetch engine stats:', err);
      }
    };

    const fetchDailyStats = async () => {
      try {
        const data = await fetchJson<any>('/ai/logs/daily-stats');
        if (data.success && Array.isArray(data.data)) {
          setDailyData(data.data);
        }
      } catch (err) {
        console.error('Failed to fetch daily stats:', err);
      }
    };

    fetchEngineStats();
    fetchDailyStats();
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-blue-700 mb-6">📊 AI Engine Usage</h1>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={stats}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label
          >
            {stats.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>

      <h2 className="text-xl font-semibold mt-10 mb-4 text-blue-700">📆 Daily AI Usage</h2>

      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={dailyData}>
          <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#007aff" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AdminAiStats;

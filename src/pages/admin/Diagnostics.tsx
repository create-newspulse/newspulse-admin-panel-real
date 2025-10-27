// src/pages/admin/Diagnostics.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_PATH } from "@lib/api";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import { Link } from "react-router-dom";
import AITrainerPanel from "./AITrainerPanel";

interface DiagnosticsData {
  timeSeries: { date: string; commands: number }[];
  mostUsed: [string, number];
  patternHits: Record<string, number>;
  total?: number;
  lastUsed?: string;
  lockedByFounder?: boolean;
  status?: string;
}

export default function Diagnostics() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  useEffect(() => {
    const fetchDiagnostics = async () => {
      try {
  const res = await axios.get(`${API_BASE_PATH}/system/ai-diagnostics`, { withCredentials: true });
        setData(res.data);
        setError(null);
        setLastRefresh(new Date().toLocaleTimeString());
      } catch (err) {
        console.error(err);
        setError("❌ Failed to load diagnostics.");
      }
    };

    fetchDiagnostics();
    const id = setInterval(fetchDiagnostics, 20000);
    return () => clearInterval(id);
  }, []);

  if (error) {
    return (
      <div className="p-6 text-red-600 font-medium bg-red-50 dark:bg-red-900 dark:text-red-200 rounded shadow">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-blue-600 font-medium bg-blue-50 dark:bg-blue-900 dark:text-blue-200 rounded shadow">
        ⏳ Loading AI diagnostics...
      </div>
    );
  }

  if (!data.timeSeries || data.timeSeries.length === 0) {
    return (
      <div className="p-6 text-yellow-600 font-medium bg-yellow-50 dark:bg-yellow-900 dark:text-yellow-200 rounded shadow">
        ⚠️ No diagnostic data available yet. Please try again later.
      </div>
    );
  }

  const chartData = {
    labels: data.timeSeries.map((i) => i.date),
    datasets: [
      {
        label: "🧠 Commands Executed",
        data: data.timeSeries.map((i) => i.commands),
        fill: true,
        borderColor: "#6366f1",
        backgroundColor: "rgba(99, 102, 241, 0.1)",
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { ticks: { color: "#94a3b8" } },
      y: { beginAtZero: true, ticks: { color: "#94a3b8" } },
    },
    plugins: {
      legend: { labels: { color: "#334155" } },
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-300">
          🧬 AI Diagnostics Overview
        </h1>
        <Link
          to="/admin"
          className="text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 px-4 py-1 rounded"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* Chart */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded shadow-xl h-96">
        <Line data={chartData} options={chartOptions as any} />
        <p className="text-xs text-right text-gray-500 mt-1">
          🔄 Auto-refreshed at: {lastRefresh}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div className="bg-blue-50 dark:bg-blue-900 text-blue-900 dark:text-blue-200 p-4 rounded shadow border border-blue-200 dark:border-blue-700">
          <p className="text-xs uppercase font-semibold">Top Command</p>
          <p className="text-lg font-bold">{data.mostUsed?.[0]}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900 text-green-900 dark:text-green-200 p-4 rounded shadow border border-green-200 dark:border-green-700">
          <p className="text-xs uppercase font-semibold">Total Commands</p>
          <p className="text-lg font-bold">{data.total ?? "—"}</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-200 p-4 rounded shadow border border-yellow-200 dark:border-yellow-700">
          <p className="text-xs uppercase font-semibold">Last Used</p>
          <p className="text-lg font-bold">{data.lastUsed ?? "—"}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900 text-red-900 dark:text-red-200 p-4 rounded shadow border border-red-200 dark:border-red-700">
          <p className="text-xs uppercase font-semibold">Founder Lock</p>
          <p className="text-lg font-bold">
            {data.lockedByFounder ? "✅ Active" : "❌ Not Active"}
          </p>
        </div>
      </div>

      {/* Summary + Trainer Panel */}
      <div className="mt-6 bg-white dark:bg-slate-800 p-5 rounded shadow">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-3">
          🧠 Full Summary
        </h2>

        {data.status && (
          <p className="text-sm text-slate-700 dark:text-slate-300">
            📡 <strong>Status:</strong> {data.status}
          </p>
        )}

        {data.patternHits && Object.keys(data.patternHits).length > 0 && (
          <ul className="mt-4 list-disc pl-5 text-sm text-slate-600 dark:text-slate-400">
            {Object.entries(data.patternHits).map(([pattern, count], idx) => (
              <li key={idx}>
                {pattern}: <strong>{count}</strong> matches
              </li>
            ))}
          </ul>
        )}

        <AITrainerPanel />
      </div>
    </div>
  );
}

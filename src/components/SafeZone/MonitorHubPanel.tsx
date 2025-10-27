import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE_PATH } from '@lib/api';
import {
  FaChartLine, FaTrafficLight, FaUserShield, FaMapMarkedAlt,
  FaRobot, FaShieldAlt, FaFileExport
} from 'react-icons/fa';

interface MonitorData {
  activeUsers: number;
  mobilePercent: number;
  avgSession: string;
  newsApi: number;
  weatherApi: number;
  twitterApi: number;
  loginAttempts: number;
  autoPatches: number;
  topRegions: string[];
  aiTools: string[];
  ptiScore: number;
  flags: number;
  success?: boolean; // tolerate APIs that include or omit this
}

const MonitorHubPanel: React.FC = () => {
  const [data, setData] = useState<MonitorData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeUsers, setActiveUsers] = useState<number | null>(null);

  // Small helper to ensure JSON & better errors
  const getJSON = async (url: string) => {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status} ${res.statusText} :: ${text.slice(0, 180)}`);
    }
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('application/json')) {
      const text = await res.text().catch(() => '');
      throw new Error(`Expected JSON, got "${ct}". Body: ${text.slice(0, 180)}`);
    }
    return res.json();
  };

  // 🔁 Fetch Live Data
  const fetchStatus = async () => {
    try {
      const json: MonitorData = await getJSON(`${API_BASE_PATH}/system/monitor-hub`);
      // Accept either {success:true, ...} or plain object
      const success = json.success ?? true;
      if (!success) throw new Error('API success=false');
      setData(json);
      setActiveUsers(json.activeUsers);
      setError(null);
    } catch (err: any) {
      console.error('❌ Monitor Hub Fetch Error:', err);
      setError(err?.message || 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // 📦 Initial + Interval Fetch
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30_000); // every 30s
    return () => clearInterval(interval);
  }, []);

  // 🧠 Real-Time User Count via Socket (same-origin -> Vite proxy -> backend)
  useEffect(() => {
    const SOCKET_URL = (import.meta.env.VITE_API_WS ?? import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '') || undefined;
    const socket: Socket = io(SOCKET_URL || '/', {
      path: '/socket.io',
      transports: ['websocket'],
      withCredentials: true,
    });

    socket.on('connect', () => {
      console.log('🔌 Connected to backend', socket.id);
    });

    socket.on('activeUserCount', (count: number) => {
      setActiveUsers(count);
    });

    socket.on('connect_error', (e) => {
      console.error('Socket connect error:', e);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // 📤 Export PDF Report
  const exportReport = async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/reports/export?type=pdf`, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `news-monitor-report-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('⚠️ PDF Export failed. Please try again.');
      console.error('PDF Export Error:', err);
    }
  };

  // 📧 Toggle Email Summary Setting
  const toggleEmailSummary = async () => {
    try {
      const res = await fetch(`${API_BASE_PATH}/system/daily-summary-toggle`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toggle: true }),
      });
      const json = await res.json().catch(() => ({}));
      const enabled = json?.enabled ?? false;
      alert(enabled ? '✅ Daily email summary enabled' : '❌ Email summary disabled');
    } catch (err) {
      console.error('Email toggle failed:', err);
    }
  };

  // 🧪 Load States
  if (loading) return <div className="text-sm text-slate-500">⏳ Loading Monitor Hub...</div>;
  if (error || !data) return <div className="text-sm text-red-500">❌ Error loading system monitor data<br />{error}</div>;

  return (
    <div className="space-y-4 text-sm text-slate-700 dark:text-slate-200">
      <Panel title="Real-Time Traffic" icon={<FaChartLine />} color="text-blue-800" bgColor="bg-blue-50 dark:bg-blue-900/30">
        📊 {activeUsers ?? data.activeUsers} active users | {data.mobilePercent}% mobile | Avg session: {data.avgSession}
      </Panel>

      <Panel title="API Uptime Monitor" icon={<FaTrafficLight />} color="text-orange-800" bgColor="bg-orange-50 dark:bg-orange-900/30">
        🟢 News API: {data.newsApi}% | 🟡 Weather API: {data.weatherApi}% | 🔴 Twitter API: {data.twitterApi}%
      </Panel>

      <Panel title="Watchdog Alerts" icon={<FaUserShield />} color="text-red-800" bgColor="bg-red-50 dark:bg-red-900/30">
        <ul className="list-disc ml-6 space-y-1">
          <li>⚠️ {data.loginAttempts} suspicious logins blocked</li>
          <li>🛡️ Auto-patch on {data.autoPatches} backend services</li>
        </ul>
      </Panel>

      <Panel title="Region Heatmap" icon={<FaMapMarkedAlt />} color="text-purple-800" bgColor="bg-purple-50 dark:bg-purple-900/30">
        🔥 Top readers: {data.topRegions.join(', ')}
      </Panel>

      <Panel title="AI Activity Log" icon={<FaRobot />} color="text-green-800" bgColor="bg-green-50 dark:bg-green-900/30">
        <ul className="list-disc ml-6 space-y-1">
          {data.aiTools.map((tool, i) => (
            <li key={i}>✅ {tool}</li>
          ))}
        </ul>
      </Panel>

      <Panel title="Security & Compliance" icon={<FaShieldAlt />} color="text-yellow-800" bgColor="bg-yellow-50 dark:bg-yellow-900/30">
        <p>🔐 Login Attempts: {data.loginAttempts}</p>
        <p>🛡️ PTI Compliance Score: <strong>{data.ptiScore}</strong></p>
        <p>🚨 Content Flags: {data.flags}</p>
      </Panel>

      {/* ✅ PDF Export Button */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow flex justify-between items-center">
        <h2 className="text-lg font-bold text-purple-600 dark:text-purple-300 flex items-center gap-2">
          <FaFileExport /> Smart Export
        </h2>
        <button
          onClick={exportReport}
          className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm"
        >
          Export PDF Report
        </button>
      </div>

      <label className="inline-flex items-center gap-2 mt-4">
        <input
          type="checkbox"
          className="accent-blue-600"
          onChange={toggleEmailSummary}
        />
        Send daily summary to my email
      </label>
    </div>
  );
};

// 📦 Panel UI Component
const Panel = ({
  title,
  icon,
  color,
  bgColor,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  children: React.ReactNode;
}) => (
  <div className={`p-4 rounded-xl shadow ${bgColor}`}>
    <h2 className={`text-lg font-bold flex items-center gap-2 mb-2 ${color}`}>
      {icon} {title}
    </h2>
    {children}
  </div>
);

export default MonitorHubPanel;

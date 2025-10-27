// 📁 frontend/components/SafeZone/ThreatDashboard.tsx
import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import type { ReactNode } from 'react';
import {
  FaShieldAlt, FaBug, FaRobot, FaHistory, FaCheck, FaTimes, FaDownload
} from 'react-icons/fa';

type ThreatLog = {
  ipReputationScore: number;
  credentialsLeaked: boolean;
  proxyDetected?: boolean;
  lastScan: string;
  origin: string;
  createdAt: string;
};

type StatsResponse = {
  success: boolean;
  totalScans: number;
  flaggedScans: number;
  autoTriggered: number;
  recentLogs: ThreatLog[];
};

const ThreatDashboard = () => {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = async () => {
    try {
  const res = await fetch(`${API_BASE_PATH}/dashboard/threat-stats`);
      const json = await res.json();
      if (json.success) {
        setStats(json);
      } else {
        throw new Error('Invalid data structure');
      }
    } catch (err) {
      console.error('❌ Failed to load threat stats:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Optional Auto Refresh:
    // const interval = setInterval(fetchStats, 60000);
    // return () => clearInterval(interval);
  }, []);

  const exportLogs = () => {
    if (!stats) return;
    const blob = new Blob([JSON.stringify(stats.recentLogs, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `threat-logs-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-600 dark:text-blue-300">
        <FaShieldAlt /> Threat Intelligence Dashboard
      </h2>

      {loading ? (
        <p className="text-gray-500">Loading threat stats...</p>
      ) : error || !stats ? (
        <p className="text-red-600">❌ Failed to load threat data</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <ColorCard
              color="bg-blue-100 dark:bg-blue-900/30"
              icon={<FaBug className="text-2xl text-blue-600 mx-auto mb-2" />}
              label="Total Scans"
              value={stats.totalScans}
            />
            <ColorCard
              color="bg-yellow-100 dark:bg-yellow-900/30"
              icon={<FaRobot className="text-2xl text-yellow-600 mx-auto mb-2" />}
              label="Flagged Threats"
              value={stats.flaggedScans}
            />
            <ColorCard
              color="bg-red-100 dark:bg-red-900/30"
              icon={<FaHistory className="text-2xl text-red-600 mx-auto mb-2" />}
              label="Auto-Triggered"
              value={stats.autoTriggered}
            />
          </div>

          <div className="flex items-center justify-between mb-2">
            <h3 className="text-md font-semibold text-gray-600 dark:text-gray-300">
              🕵️ Recent Logs:
            </h3>
            <button
              onClick={exportLogs}
              className="text-blue-600 text-xs flex items-center gap-1 hover:underline"
            >
              <FaDownload /> Export Logs
            </button>
          </div>

          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 max-h-60 overflow-y-auto pr-2">
            {stats.recentLogs.map((log, idx) => (
              <li key={idx} className="border-b border-gray-200 dark:border-gray-700 pb-2">
                <div className="flex justify-between items-center">
                  <div>
                    <strong>Score:</strong>{' '}
                    <span className={log.ipReputationScore < 50 ? 'text-red-500' : 'text-green-600'}>
                      {log.ipReputationScore}
                    </span>{' '}
                    <RiskBadge score={log.ipReputationScore} />
                    {' | '}
                    <strong>Leaked:</strong>{' '}
                    {log.credentialsLeaked ? (
                      <span className="text-red-600 inline-flex items-center"><FaTimes className="mr-1" />Yes</span>
                    ) : (
                      <span className="text-green-600 inline-flex items-center"><FaCheck className="mr-1" />No</span>
                    )}
                    {' | '}
                    <strong>From:</strong> {log.origin}
                  </div>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

// 🔷 Colored Summary Card
const ColorCard = ({
  color,
  icon,
  label,
  value,
}: {
  color: string;
  icon: ReactNode;
  label: string;
  value: number;
}) => (
  <div className={`${color} p-4 rounded shadow text-center`}>
    {icon}
    <p className="text-sm">{label}</p>
    <p className="text-xl font-bold">{value}</p>
  </div>
);

// 🧠 Score Risk Badge
const RiskBadge = ({ score }: { score: number }) => {
  let label = 'Low';
  let style = 'bg-green-100 text-green-700';

  if (score < 50) {
    label = 'High';
    style = 'bg-red-100 text-red-700';
  } else if (score < 80) {
    label = 'Medium';
    style = 'bg-yellow-100 text-yellow-700';
  }

  return (
    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-semibold ${style}`}>
      {label}
    </span>
  );
};

export default ThreatDashboard;

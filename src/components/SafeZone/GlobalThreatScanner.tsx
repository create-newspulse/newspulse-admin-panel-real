// 📁 src/components/SafeZone/GlobalThreatScanner.tsx
import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import {
  FaShieldAlt, FaLock, FaGlobe, FaCheckCircle, FaSyncAlt
} from 'react-icons/fa';

type ThreatStatus = {
  xssDetected: boolean;
  credentialsLeaked: boolean;
  ipReputationScore: number; // 0–100
  lastScan: string;
};

const getStatusBadge = (condition: boolean, label: string) => (
  <span
    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
      condition
        ? 'bg-red-100 text-red-700 dark:bg-red-800/30 dark:text-red-300'
        : 'bg-green-100 text-green-700 dark:bg-green-800/30 dark:text-green-300'
    }`}
  >
    {condition ? `⚠️ ${label}` : `✅ Secure`}
  </span>
);

const GlobalThreatScanner = () => {
  const [data, setData] = useState<ThreatStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);

  const fetchThreatData = async () => {
    const controller = new AbortController();
    try {
      setLoading(true);
      setLastError(null);
      const res = await fetch(`${API_BASE_PATH}/system/threat-status`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('❌ API response not OK');

      const json = await res.json();

      if (
        typeof json.xssDetected === 'boolean' &&
        typeof json.credentialsLeaked === 'boolean' &&
        typeof json.ipReputationScore === 'number' &&
        typeof json.lastScan === 'string'
      ) {
        setData(json);
      } else {
        throw new Error('⚠️ Unexpected response format');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('[GlobalThreatScanner]', err);
        setLastError(err?.message || 'Unknown error');
      }
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  };

  useEffect(() => {
    fetchThreatData(); // Initial fetch
    const interval = setInterval(fetchThreatData, 900000); // ⏱️ 15 min auto-refresh
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="p-5 md:p-6 bg-fuchsia-50 dark:bg-fuchsia-950 border border-fuchsia-300 dark:border-fuchsia-700 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto">
      <div className="flex justify-between items-center mb-3">
        <p className="text-green-500 font-mono text-sm flex items-center gap-1">
          <FaCheckCircle /> GlobalThreatScanner Loaded
        </p>
        <button
          onClick={fetchThreatData}
          className="text-xs text-fuchsia-600 dark:text-fuchsia-300 hover:underline flex items-center gap-1"
        >
          <FaSyncAlt className="inline-block" /> Refresh
        </button>
      </div>

      <h2 className="text-xl font-bold text-fuchsia-700 dark:text-fuchsia-300 mb-2 flex items-center gap-2">
        🌍 Global Threat Scanner
      </h2>

      <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
        Monitors security risks globally and flags threat vectors across your platform.
      </p>

      {loading ? (
        <p className="text-sm text-slate-500">⏳ Scanning for vulnerabilities and IP risks...</p>
      ) : lastError ? (
        <p className="text-sm text-red-500 font-mono">❌ {lastError}</p>
      ) : data ? (
        <ul className="space-y-3 text-sm text-slate-800 dark:text-slate-100">
          <li className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <FaShieldAlt className="text-blue-500" />
              XSS Attempt Detection
            </div>
            {getStatusBadge(data.xssDetected, 'XSS Risk')}
          </li>
          <li className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <FaLock className="text-orange-500" />
              Credential Breach Monitor
            </div>
            {getStatusBadge(data.credentialsLeaked, 'Leak Detected')}
          </li>
          <li className="flex items-center justify-between border-b pb-2">
            <div className="flex items-center gap-2">
              <FaGlobe className="text-cyan-600" />
              IP Reputation Score
            </div>
            <span
              className={`text-xs font-semibold ${
                data.ipReputationScore < 50
                  ? 'text-red-600'
                  : data.ipReputationScore < 80
                  ? 'text-yellow-600'
                  : 'text-green-600'
              }`}
            >
              {data.ipReputationScore}/100
            </span>
          </li>
          <li className="text-xs text-slate-500 dark:text-slate-400 italic mt-2">
            Last Scan:{' '}
            {data.lastScan
              ? new Date(data.lastScan).toLocaleString()
              : 'Unavailable'}
          </li>
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No data available.</p>
      )}

      <div className="mt-5 text-xs text-slate-500 dark:text-slate-400 italic">
        🧠 AI-integrated healing logic and threat automation in development.
      </div>
    </section>
  );
};

export default GlobalThreatScanner;

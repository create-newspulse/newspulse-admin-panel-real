import { useEffect, useState } from 'react';
import { fetchJson } from '@lib/fetchJson';
import {
  FaClock, FaLink, FaRobot, FaBell
} from 'react-icons/fa';

interface Incident {
  timestamp: string;
  level: 'ERROR' | 'WARNING' | 'INFO';
  source: string;
  message: string;
}

const SECURITY_ENABLED = import.meta.env.VITE_SECURITY_SYSTEM_ENABLED !== 'false';

const IncidentResponseModule = () => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let routeAvailable: boolean | null = null; // null = unknown, true = exists, false = stub
    const fetchIncidents = async () => {
      if (routeAvailable === false) return; // hard stub mode
      try {
        const data = await fetchJson<{ incidents?: Incident[]; lastSync?: string }>(`/system/incidents`, {
          timeoutMs: 15000,
        });
        routeAvailable = true;
        setIncidents(data.incidents || []);
        setLastSync(data.lastSync || null);
        setLoading(false);
        const errorLogs = (data.incidents || []).filter((log: Incident) => log.level === 'ERROR');
        if (errorLogs.length > 0) console.warn('🚨 Critical Error Detected:', errorLogs[0].message);
      } catch (err: any) {
        if (/route not found|404\b/i.test(err?.message || '')) {
          if (routeAvailable === null) console.warn('[IncidentResponseModule] route missing; switching to stub mode');
          routeAvailable = false;
          setIncidents([]);
          setLastSync(new Date().toISOString());
          setLoading(false);
        } else {
          console.error('❌ Failed to fetch incidents:', err);
          setLoading(false);
        }
      }
    };
    if (!SECURITY_ENABLED) {
      console.warn('[IncidentResponseModule] disabled via VITE_SECURITY_SYSTEM_ENABLED=false');
      routeAvailable = false;
      setIncidents([]);
      setLastSync(new Date().toISOString());
      setLoading(false);
      return;
    }
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 30000);
    return () => clearInterval(interval);
  }, []);

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(incidents, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'incident-log.json';
    a.click();
  };

  const downloadCSV = () => {
    const header = 'Timestamp,Level,Source,Message\n';
    const rows = incidents
      .map(
        (log) =>
          `"${new Date(log.timestamp).toLocaleString()}","${log.level}","${log.source}","${log.message.replace(/"/g, '""')}"`
      )
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'incident-log.csv';
    a.click();
  };

  return (
    <section className="p-5 md:p-6 bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-600 rounded-2xl shadow max-h-[90vh] overflow-y-auto">
      <div className="mb-3 flex items-center gap-2 text-green-600 font-mono text-sm">
        ✅ IncidentResponseModule Loaded
      </div>

      <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">
        🚨 Incident Response Module
      </h2>

      <p className="text-sm text-slate-700 dark:text-slate-200 mb-3">
        This security module monitors, logs, and responds to live system incidents including backend failures, unauthorized actions, and AI malfunctions.
      </p>

      <ul className="space-y-2 text-sm text-slate-800 dark:text-slate-100 mb-4">
        <li className="flex items-center gap-2">
          <FaRobot className="text-pink-500" />
          Capture real-time error logs & crash snapshots
        </li>
        <li className="flex items-center gap-2">
          <FaBell className="text-red-500" />
          Auto-alerts to founder on breach-level activity
        </li>
        <li className="flex items-center gap-2">
          <FaClock className="text-blue-400" />
          Timestamped logs for all recovery & mitigation actions
        </li>
        <li className="flex items-center gap-2">
          <FaLink className="text-purple-500" />
          Integrates with Lockdown & Compliance Control Panels
        </li>
      </ul>

      <div className="text-xs text-slate-500 dark:text-slate-400 italic mb-3">
        📌 Advanced forensic trace & rollback tools coming soon...
      </div>

      <div className="flex gap-3 mb-4">
        <button
          onClick={downloadJSON}
          className="text-xs px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
        >
          📄 Export JSON
        </button>
        <button
          onClick={downloadCSV}
          className="text-xs px-3 py-1 bg-green-100 dark:bg-green-900 rounded hover:bg-green-200 dark:hover:bg-green-800"
        >
          📊 Export CSV
        </button>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">🔄 Loading incidents...</p>
        ) : incidents.length === 0 ? (
          <p className="text-xs text-slate-400">(No incidents logged yet)</p>
        ) : (
          <div className="bg-white dark:bg-slate-900 border rounded p-3 text-xs font-mono max-h-[300px] overflow-y-auto">
            {incidents.map((log, idx) => (
              <div key={idx} className="mb-2">
                <span className="text-slate-500 dark:text-slate-400">
                  [{new Date(log.timestamp).toLocaleString()}]
                </span>{' '}
                <span
                  className={`font-bold ${
                    log.level === 'ERROR'
                      ? 'text-red-500'
                      : log.level === 'WARNING'
                      ? 'text-yellow-500'
                      : 'text-green-500'
                  }`}
                >
                  {log.level}
                </span>{' '}
                <span className="text-slate-700 dark:text-slate-200">
                  ({log.source}) — {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
        {lastSync && (
          <p className="text-xs mt-3 text-slate-400 italic">
            ⏱️ Last sync: {new Date(lastSync).toLocaleString()}
          </p>
        )}
      </div>
    </section>
  );
};

export default IncidentResponseModule;

import { useEffect, useState } from "react";

const API_ORIGIN = (import.meta.env.VITE_API_URL?.toString() || 'https://newspulse-backend-real.onrender.com').replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;
import {
  FaComments,
  FaRobot,
  FaUserShield,
  FaCheckCircle,
  FaExclamationCircle,
} from "react-icons/fa";

interface LogEntry {
  timestamp: string;
  type: "AI" | "ADMIN" | "ERROR";
  message: string;
  origin?: string;
}

const AdminChatAudit = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true; // To avoid state updates on unmounted component
    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/admin-chat-audit`, { credentials: 'include' });
        const ct = res.headers.get('content-type') || '';
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}. Body: ${txt.slice(0, 160)}`);
        }
        if (!/application\/json/i.test(ct)) {
          const txt = await res.text().catch(() => '');
          throw new Error(`Expected JSON, got ${ct}. Body: ${txt.slice(0, 160)}`);
        }
        const data = await res.json();

        // Check for both res.ok and data.logs is array
        if (data && Array.isArray(data.logs)) {
          if (isMounted) setLogs(data.logs);
        } else {
          if (isMounted)
            setError(
              data && data.message
                ? data.message
                : "No logs found or wrong API format"
            );
        }
      } catch (err: any) {
        if (isMounted) setError(err?.message || "Server error while fetching logs");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLogs();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="p-5 md:p-6 bg-yellow-50 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-2xl shadow max-h-[90vh] overflow-y-auto">
      <p className="text-green-600 font-mono text-sm mb-2 flex items-center gap-2">
        <FaCheckCircle className="text-green-400" />
        ✅ AdminChatAudit Panel Initialized
      </p>

      <h2 className="text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2">
        <FaComments />
        Admin Chat Audit
      </h2>

      <p className="text-sm text-slate-800 dark:text-slate-100 mb-2">
        This panel monitors all system-level AI communications and logs any
        founder/admin interactions:
      </p>

      <ul className="list-disc list-inside ml-2 space-y-2 text-slate-800 dark:text-slate-100 text-sm">
        <li className="flex items-center gap-2">
          <FaRobot className="text-blue-400" />
          AI system messages & smart command traces
        </li>
        <li className="flex items-center gap-2">
          <FaUserShield className="text-yellow-500" />
          Admin or moderator-triggered actions
        </li>
        <li className="flex items-center gap-2">
          <FaExclamationCircle className="text-red-500" />
          Success, warning, or error logs from AI modules
        </li>
      </ul>

      <div className="mt-5">
        {loading ? (
          <div className="text-sm text-center text-slate-500 dark:text-slate-400">
            🔄 Loading logs...
          </div>
        ) : error ? (
          <div className="text-sm text-center text-red-600">{error}</div>
        ) : logs.length === 0 ? (
          <div className="text-sm text-center text-slate-500">
            (No logs yet)
          </div>
        ) : (
          <div className="mt-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-3 max-h-[50vh] overflow-y-auto text-sm font-mono text-slate-700 dark:text-slate-200">
            {logs.map((log, idx) => (
              <div key={idx} className="mb-2">
                <span className="text-green-600">
                  [{new Date(log.timestamp).toLocaleString()}]
                </span>{" "}
                <span
                  className={`font-bold ${
                    log.type === "AI"
                      ? "text-blue-600"
                      : log.type === "ADMIN"
                      ? "text-yellow-600"
                      : "text-red-600"
                  }`}
                >
                  {log.type}
                </span>{" "}
                — <span>{log.message}</span>
                {log.origin ? (
                  <span className="ml-2 text-xs text-slate-500">
                    ({log.origin})
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminChatAudit;

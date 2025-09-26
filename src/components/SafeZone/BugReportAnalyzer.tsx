import React, { useEffect, useState } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaSyncAlt, FaBug, FaDownload, FaBell } from 'react-icons/fa';

interface BugEntry {
  type: string;
  message: string;
  timestamp: string;
  autoFixed?: boolean;
  severity?: 'low' | 'medium' | 'high';
  aiSummary?: string;
}

const BugReportAnalyzer: React.FC = () => {
  const [logs, setLogs] = useState<BugEntry[]>([]);
  const [error, setError] = useState(false);
  const [showHighAlert, setShowHighAlert] = useState(false);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/system/bug-reports');
      const data = await res.json();
      if (Array.isArray(data.logs)) {
        setLogs(data.logs);
        setError(false);

        const hasHighSeverity = data.logs.some((log: BugEntry) => log.severity === 'high');
        setShowHighAlert(hasHighSeverity);

        // Auto-hide high severity alert after 5 seconds
        if (hasHighSeverity) {
          setTimeout(() => setShowHighAlert(false), 5000);
        }
      } else {
        throw new Error('Invalid data format');
      }
    } catch (err) {
      console.error('❌ Bug Report Fetch Error:', err);
      setError(true);
      setShowHighAlert(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 300000); // 5 min
    return () => clearInterval(interval);
  }, []);

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bug-reports.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-green-500';
      default: return 'text-slate-500';
    }
  };

  return (
    <section className="p-5 md:p-6 bg-red-50 dark:bg-red-900/10 border border-red-400/30 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto relative">
      {/* In-app high severity alert */}
      {showHighAlert && (
        <div className="fixed bottom-6 right-6 bg-red-600 text-white px-5 py-3 rounded shadow-lg animate-bounce z-50 flex items-center gap-2">
          <FaExclamationCircle className="text-2xl" />
          <span className="font-semibold">⚠️ High-severity bugs detected!</span>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {error ? (
            <>
              <FaExclamationCircle className="text-red-500" />
              <p className="font-mono text-sm text-red-600">❌ BugReportAnalyzer Failed</p>
            </>
          ) : (
            <>
              <FaCheckCircle className="text-green-500" />
              <p className="font-mono text-sm text-green-600 dark:text-green-400">✅ BugReportAnalyzer Loaded</p>
            </>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={fetchLogs} title="Refresh Logs" className="text-sm text-slate-500 dark:text-slate-300 hover:text-blue-500">
            <FaSyncAlt />
          </button>
          <button onClick={exportLogs} title="Export Logs" className="text-sm text-slate-500 dark:text-slate-300 hover:text-green-500">
            <FaDownload />
          </button>
        </div>
      </div>

      <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">
        🐞 Bug Report Analyzer
      </h2>

      <div className="space-y-3 text-sm md:text-base text-slate-700 dark:text-slate-200">
        <p>This module scans logs and helps flag bugs in system operations and AI workflows.</p>
        <ul className="list-disc list-inside ml-3 space-y-1">
          <li>Track backend/server-side errors</li>
          <li>Analyze frontend/UI crashes and warnings</li>
          <li>Generate automatic debug summaries for quick fixes</li>
          <li>Trigger critical alerts to admins via dashboard popup</li>
        </ul>

        {logs.length > 0 ? (
          <div className="mt-4">
            <h3 className="text-sm font-semibold mb-2 text-red-700 dark:text-red-300">⚠️ Detected Bugs</h3>
            <ul className="text-xs space-y-2">
              {logs.map((log, idx) => (
                <li key={idx} className="bg-white dark:bg-slate-800 p-3 rounded border border-red-300 dark:border-red-600">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${getSeverityColor(log.severity)}`}>
                        <FaBug className="inline mr-1" />{log.type}
                      </p>
                      {log.severity && <span className="text-xs">• {log.severity.toUpperCase()} severity</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      {log.autoFixed && <span className="text-green-500 text-xs">🔧 Auto-fixed</span>}
                      {log.severity === 'high' && <FaBell className="text-red-500 animate-ping-slow" title="Admin Alert Triggered" />}
                    </div>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300">{log.message}</p>
                  {log.aiSummary && (
                    <p className="text-blue-500 dark:text-blue-300 mt-1">🧠 Summary: {log.aiSummary}</p>
                  )}
                  <p className="text-slate-400 dark:text-slate-500 text-xs">🕒 {new Date(log.timestamp).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          !error && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
              ✅ No critical bugs found in the current session.
            </p>
          )
        )}

        <div className="mt-6 text-xs text-slate-500 dark:text-slate-400 italic">
          🧠 AI-powered debugging, severity scoring, and real-time dashboard alerts are now active.
        </div>
      </div>
    </section>
  );
};

export default BugReportAnalyzer;

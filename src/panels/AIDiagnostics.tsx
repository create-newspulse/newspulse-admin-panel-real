import { useEffect, useState } from 'react';
import axios from 'axios';
import {
  FaHeartbeat,
  FaCogs,
  FaSyncAlt,
  FaBug,
  FaTools,
  FaSatelliteDish,
  FaExclamationTriangle,
} from 'react-icons/fa';

interface DiagnosticsData {
  status: string;
  modules: string[];
  lastCheck: string;
  warnings?: string[];
  errors?: string[];
}

export default function AIDiagnostics() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Fetch diagnostics from backend
  const fetchDiagnostics = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await axios.get<{ status: string; modules: string[]; lastCheck: string; warnings?: string[]; errors?: string[] }>('/api/system/ai-diagnostics');
      setData(res.data);
    } catch (err) {
      console.error('❌ Failed to load diagnostics:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
    // eslint-disable-next-line
  }, []);

  // Status badge coloring
  const StatusBadge = ({ status }: { status: string }) => {
    const statusColor =
      status === 'Operational'
        ? 'bg-green-600'
        : status === 'Degraded'
        ? 'bg-yellow-600'
        : 'bg-red-600';
    return (
      <span className={`px-3 py-1 rounded-full text-white text-xs ${statusColor}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="ai-diagnostics futuristic-glow border border-blue-700 dark:border-purple-400 p-6 rounded-xl shadow-lg bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white">
      <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-blue-400 animate-pulse">
        <FaSatelliteDish className="text-purple-400" />
        AI Diagnostics Panel
      </h2>

      {loading ? (
        <p className="text-yellow-400 animate-pulse">⏳ Booting diagnostic engines...</p>
      ) : error ? (
        <p className="text-red-400">❌ Connection error. Unable to fetch diagnostics.</p>
      ) : data ? (
        <div className="space-y-3">
          <p>
            <FaHeartbeat className="inline mr-1 text-green-400" />
            <strong>Status:</strong> <StatusBadge status={data.status} />
          </p>
          <p>
            <FaCogs className="inline mr-1 text-blue-300" />
            <strong>Active Modules:</strong>{' '}
            <span className="text-sm italic text-blue-200">{(data.modules || []).join(', ') || 'None'}</span>
          </p>
          <p>
            <FaTools className="inline mr-1 text-gray-300" />
            <strong>Last Check:</strong>{' '}
            <span className="text-sm text-gray-300">
              {data.lastCheck ? new Date(data.lastCheck).toLocaleString() : '—'}
            </span>
          </p>
          {!!data.warnings?.length && (
            <div className="bg-yellow-900 bg-opacity-20 border border-yellow-500 text-yellow-300 p-3 rounded-md">
              <FaExclamationTriangle className="inline mr-1" />
              <strong>Warnings:</strong>
              <ul className="mt-1 list-disc list-inside text-sm">
                {data.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          {!!data.errors?.length && (
            <div className="bg-red-900 bg-opacity-20 border border-red-500 text-red-300 p-3 rounded-md">
              <FaBug className="inline mr-1" />
              <strong>Errors:</strong>
              <ul className="mt-1 list-disc list-inside text-sm">
                {data.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-gray-400">ℹ️ No diagnostics available.</p>
      )}

      <div className="mt-6">
        <button
          onClick={fetchDiagnostics}
          disabled={loading}
          className={`bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 transition-all duration-300 px-5 py-2 rounded-full shadow-lg flex items-center gap-2 text-white font-semibold ${
            loading ? 'opacity-60 cursor-not-allowed' : ''
          }`}
        >
          <FaSyncAlt className={loading ? 'animate-spin-slow' : ''} /> Refresh Panel
        </button>
      </div>
    </div>
  );
}

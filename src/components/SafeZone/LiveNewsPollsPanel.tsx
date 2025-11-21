import { useEffect, useState } from 'react';
import { api } from '@lib/api';

// Unified base: prefer explicit admin backend origin from VITE_ADMIN_API_BASE_URL; fallback to legacy VITE_API_URL.
// Avoid hard-coded host; placeholder domain only in env configuration.
const ORIGIN = (import.meta.env.VITE_ADMIN_API_BASE_URL || import.meta.env.VITE_API_URL || '').toString().trim().replace(/\/+$/, '') || '/admin-api';
// When using rewrite '/admin-api' base we do NOT append '/api' here; relative paths must include '/api/'.
// For direct origin we append '/api' for convenience building explicit endpoints below.
const API_BASE = ORIGIN === '/admin-api' ? ORIGIN : `${ORIGIN}`;
import { useNotification } from '@context/NotificationContext';
import {
  FaPoll,
  FaDownload,
  FaToggleOn,
  FaChevronDown,
  FaChevronUp,
} from 'react-icons/fa';

interface PollStats {
  totalPolls: number;
  totalVotes: number;
  topPoll: { question: string; total: number };
}

const LiveNewsPollsPanel = () => {
  const notify = useNotification();
  const [stats, setStats] = useState<PollStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [votingEnabled, setVotingEnabled] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const fetchStats = async () => {
    try {
  const json: any = await api.pollsLiveStats();
      if (json.success) setStats(json.data);
      else throw new Error('Invalid response');
    } catch (err) {
      console.error('Poll fetch error:', err);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const exportPDF = async () => {
    try {
      setIsExporting(true);
      const res = await fetch(`${API_BASE === '/admin-api' ? API_BASE + '/polls/export-pdf' : API_BASE + '/api/polls/export-pdf'}`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const ct = res.headers.get('content-type') || '';
      if (!/application\/(pdf|octet-stream)/i.test(ct)) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Unexpected content-type: ${ct}. Preview: ${txt.slice(0, 200)}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `poll-report-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      notify.success('📊 Poll report exported');
    } catch (err) {
      notify.error('❌ Failed to export poll report');
    } finally {
      setIsExporting(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow text-slate-700 dark:text-slate-200 border-l-4 border-pink-500 mt-4">
      {/* Header */}
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <h2 className="text-lg font-bold text-pink-600 flex gap-2 items-center">
          <FaPoll /> Live News Polls
        </h2>
        {isExpanded ? (
          <FaChevronUp className="text-pink-400" />
        ) : (
          <FaChevronDown className="text-pink-400" />
        )}
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="mt-3 space-y-3 text-sm">
          {loading ? (
            <p className="text-slate-500">Loading poll stats...</p>
          ) : stats ? (
            <ul className="space-y-1">
              <li>
                📌 Total Active Polls: <strong>{stats.totalPolls}</strong>
              </li>
              <li>
                🗳️ Total Votes Cast: <strong>{stats.totalVotes}</strong>
              </li>
              <li>
                🔥 Most Voted Poll:{' '}
                <strong>{stats.topPoll?.question}</strong> ({stats.topPoll?.total}{' '}
                votes)
              </li>
            </ul>
          ) : (
            <p className="text-red-500">❌ Failed to load stats</p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              onClick={exportPDF}
              disabled={isExporting}
              className={`bg-pink-600 text-white px-4 py-1.5 rounded hover:bg-pink-700 text-sm flex items-center gap-2 ${
                isExporting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <FaDownload />
              {isExporting ? 'Exporting...' : 'Export PDF'}
            </button>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <FaToggleOn className="text-blue-600" />
              <input
                type="checkbox"
                checked={votingEnabled}
                onChange={() => setVotingEnabled(!votingEnabled)}
                className="accent-pink-600"
              />
              Allow New Voting
            </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveNewsPollsPanel;

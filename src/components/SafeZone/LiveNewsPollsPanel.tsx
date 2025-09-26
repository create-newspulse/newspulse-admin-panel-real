import { useEffect, useState } from 'react';
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
  const [stats, setStats] = useState<PollStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [votingEnabled, setVotingEnabled] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/polls/live-stats');
      const json = await res.json();
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
      const res = await fetch('/api/polls/export-pdf', { method: 'POST' });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `poll-report-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('❌ Failed to export');
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

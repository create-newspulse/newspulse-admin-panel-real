import { useEffect, useState } from 'react';
import api, { default as apiClient } from '../lib/api';
import { useLockdownCheck } from '@hooks/useLockdownCheck';

interface PushEntry {
  _id: string;
  title: string;
  category: string;
  score: number;
  type: string;
  triggeredAt: string;
}

export default function PushHistory() {
  const [entries, setEntries] = useState<PushEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ lockdown: false });

  useEffect(() => {
    apiClient
      .get('/settings/load')
      .then((res) => setSettings(((res as any)?.data ?? res) || { lockdown: false }))
      .catch(() => setSettings({ lockdown: false }));
  }, []);

  useLockdownCheck(settings);

  const fetchHistory = async () => {
    try {
  const res = await api.get('/alerts/history');
  const data = (res as any)?.data ?? res;
  setEntries(data.data);
    } catch {
      alert('❌ Failed to fetch push history');
    } finally {
      setLoading(false);
    }
  };

  const deleteAll = async () => {
    if (!window.confirm('Are you sure you want to delete all history?')) return;
    try {
      await api.delete('/alerts/history');
      alert('🗑️ Deleted!');
      fetchHistory();
    } catch {
      alert('❌ Delete failed');
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  if (settings.lockdown) {
    return (
      <div className="p-6 text-center text-red-600 dark:text-red-400">
        🔒 Push history access is disabled in lockdown mode.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* ✅ Title Section with Icon */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-white">
          <span>🔔</span>
          <h2>Push History</h2>
        </div>
        <button
          onClick={deleteAll}
          className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded shadow-sm text-sm"
        >
          🗑️ Delete All
        </button>
      </div>

      {/* ✅ Table or Empty State */}
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-300">Loading...</p>
      ) : entries.length === 0 ? (
        <div className="text-center py-20 text-slate-500 dark:text-slate-300">
          <p className="text-xl flex items-center justify-center gap-2">
            📭 <span>No push history found.</span>
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 shadow rounded-xl p-4 overflow-x-auto">
          <table className="min-w-full text-sm text-slate-700 dark:text-slate-200">
            <thead>
              <tr className="border-b border-slate-300 dark:border-slate-600 text-left text-xs uppercase text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Time</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry._id}
                  className="border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                >
                  <td className="px-3 py-2">{entry.title}</td>
                  <td className="px-3 py-2">{entry.category}</td>
                  <td className="px-3 py-2">{entry.score}</td>
                  <td className="px-3 py-2">{entry.type}</td>
                  <td className="px-3 py-2">
                    {new Date(entry.triggeredAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { FaIdCard, FaTools, FaBrain, FaFileExport } from 'react-icons/fa';

type VersionEntry = {
  id: string;
  timestamp: string;
  notes: string;
};

type VersionData = {
  updates: VersionEntry[];
  lastSync: string | null;
};

const SystemVersionControl = () => {
  const [data, setData] = useState<VersionData | null>(null);

  useEffect(() => {
    fetchJson<VersionData>(`${API_BASE_PATH}/system/version-log`)
      .then(setData)
      .catch((err) => {
        console.error('❌ Failed to fetch version log:', err);
      });
  }, []);

  return (
    <section className="p-5 md:p-6 bg-sky-50 dark:bg-sky-900/10 border border-sky-300 dark:border-sky-700 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto">
      <p className="text-green-600 dark:text-green-400 font-mono text-sm mb-2">
        ✅ SystemVersionControl Loaded
      </p>

      <h2 className="text-xl font-bold text-sky-700 dark:text-sky-300 mb-2">
        🧾 System Version Control
      </h2>

      <p className="text-sm text-slate-700 dark:text-slate-200 mb-3">
        This module tracks all system-level updates, deployment logs, rollback history, and patch versions for audit and recovery purposes.
      </p>

      {data?.updates?.length ? (
        <ul className="space-y-3 mb-5 text-sm text-slate-800 dark:text-slate-100">
          {data.updates.map((entry) => (
            <li key={entry.id} className="bg-white dark:bg-slate-800 border-l-4 border-sky-400 pl-3 py-2 rounded shadow-sm">
              <p className="flex items-center gap-2 font-semibold text-sky-700 dark:text-sky-300">
                <FaIdCard /> {entry.id}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                🕒 {new Date(entry.timestamp).toLocaleString()}
              </p>
              <p className="text-sm mt-1">{entry.notes}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">⏳ Loading version history...</p>
      )}

      <ul className="mt-4 space-y-2 text-sm md:text-base text-slate-800 dark:text-slate-100">
        <li className="flex items-center gap-2">
          <FaIdCard className="text-indigo-500" /> Log every deployment ID and timestamp
        </li>
        <li className="flex items-center gap-2">
          <FaTools className="text-amber-500" /> Maintain rollback points for each patch
        </li>
        <li className="flex items-center gap-2">
          <FaBrain className="text-pink-500" /> Version notes for AI engine & backend logic
        </li>
        <li className="flex items-center gap-2">
          <FaFileExport className="text-green-500" /> Export full version history as CSV or JSON
        </li>
      </ul>

      <p className="text-xs text-slate-500 dark:text-slate-400 mt-4">
        Last sync:{' '}
        {data?.lastSync
          ? new Date(data.lastSync).toLocaleString()
          : 'Loading...'} — more controls coming soon…
      </p>
    </section>
  );
};

export default SystemVersionControl;

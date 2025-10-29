import React, { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { FaPlay, FaPause, FaSyncAlt, FaClock, FaCogs } from 'react-icons/fa';

type JobKey = 'autoNews' | 'dailyQuote' | 'dailyWonder' | 'todayHistory' | 'pollSeed' | 'pushAlerts';

interface JobStatus {
  key: JobKey;
  label: string;
  running: boolean;
  lastRun?: string;
  error?: string | null;
}

const DEFAULT_JOBS: JobStatus[] = [
  { key: 'autoNews', label: 'Auto News Ingestion', running: false },
  { key: 'dailyQuote', label: 'Daily Quote', running: false },
  { key: 'dailyWonder', label: 'Daily Wonder', running: false },
  { key: 'todayHistory', label: "Today in History", running: false },
  { key: 'pollSeed', label: 'Seed Sample Poll', running: false },
  { key: 'pushAlerts', label: 'Push Alerts', running: false },
];

export default function AutomationCenter() {
  const [jobs, setJobs] = useState<JobStatus[]>(DEFAULT_JOBS);
  const [loading, setLoading] = useState(false);
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      // Try read status from backend; tolerate absence by keeping defaults
      const data = await fetchJson<{ jobs?: Partial<Record<JobKey, { running: boolean; lastRun?: string }>> }>(`${API_BASE_PATH}/system/jobs/status`).catch(() => ({ jobs: {} }));
      setJobs(prev => prev.map(j => ({
        ...j,
        running: data.jobs?.[j.key]?.running ?? j.running,
        lastRun: data.jobs?.[j.key]?.lastRun ?? j.lastRun,
      })));
      setServerOnline(true);
    } catch {
      setServerOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const toggleJob = async (key: JobKey, start: boolean) => {
    try {
      const path = start ? 'start' : 'stop';
      const res = await fetch(`${API_BASE_PATH}/system/jobs/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key }),
      });
      if (!res.ok) throw new Error('Request failed');
      const now = new Date().toISOString();
      setJobs(prev => prev.map(j => j.key === key ? { ...j, running: start, lastRun: start ? now : j.lastRun, error: null } : j));
    } catch (e: any) {
      setJobs(prev => prev.map(j => j.key === key ? { ...j, error: e?.message || 'Failed' } : j));
    }
  };

  const runOnce = async (key: JobKey) => {
    try {
      const res = await fetch(`${API_BASE_PATH}/system/jobs/run-once`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key }),
      });
      if (!res.ok) throw new Error('Request failed');
      const now = new Date().toISOString();
      setJobs(prev => prev.map(j => j.key === key ? { ...j, lastRun: now, error: null } : j));
    } catch (e: any) {
      setJobs(prev => prev.map(j => j.key === key ? { ...j, error: e?.message || 'Failed' } : j));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <FaCogs /> Automation Center
        </h3>
        <button onClick={refresh} className="px-3 py-1.5 text-xs bg-slate-700 text-white rounded hover:bg-slate-600 flex items-center gap-1">
          <FaSyncAlt className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {serverOnline === false && (
        <div className="p-3 rounded bg-yellow-100 text-yellow-800 text-sm">
          Backend job API not available; controls will simulate state locally.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {jobs.map(job => (
          <div key={job.key} className="p-4 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-800 dark:text-slate-100">{job.label}</div>
                <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded ${job.running ? 'bg-green-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>{job.running ? 'RUNNING' : 'STOPPED'}</span>
                  {job.lastRun && (<span className="inline-flex items-center gap-1"><FaClock /> {new Date(job.lastRun).toLocaleString()}</span>)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleJob(job.key, true)}
                  className="px-3 py-2 rounded bg-green-600 text-white text-xs hover:bg-green-700 flex items-center gap-1"
                  disabled={job.running}
                  title="Start"
                >
                  <FaPlay /> Start
                </button>
                <button
                  onClick={() => toggleJob(job.key, false)}
                  className="px-3 py-2 rounded bg-red-600 text-white text-xs hover:bg-red-700 flex items-center gap-1"
                  disabled={!job.running}
                  title="Stop"
                >
                  <FaPause /> Stop
                </button>
                <button
                  onClick={() => runOnce(job.key)}
                  className="px-3 py-2 rounded bg-blue-600 text-white text-xs hover:bg-blue-700"
                  title="Run Once"
                >Run</button>
              </div>
            </div>
            {job.error && <div className="text-xs text-red-600 mt-2">{job.error}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

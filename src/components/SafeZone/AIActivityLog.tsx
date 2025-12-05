import React, { useCallback, useEffect, useState } from "react";
import { AxiosError } from "axios";
import { api } from '@lib/api';

import { ADMIN_API_BASE } from '../../lib/adminApi';
const API_BASE = /\/api$/.test(ADMIN_API_BASE)
  ? ADMIN_API_BASE
  : `${ADMIN_API_BASE}/api`;

type ActivityData = {
  autoPublished: number;
  flagged: number;
  suggestedHeadlines: number;
  lastTrustUpdate: string;
};

const AIActivityLog: React.FC = () => {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [waking, setWaking] = useState(false);

  const coerceNumber = (v: any): number | null => {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.trim());
      return Number.isFinite(n) ? n : null;
    }
    return null;
  };

  const normalize = (raw: any): ActivityData | null => {
    const src = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
    const autoPublished = coerceNumber(src?.autoPublished);
    const flagged = coerceNumber(src?.flagged);
    const suggestedHeadlines = coerceNumber(src?.suggestedHeadlines);
    let lastTrustUpdate: string | null = null;
    const ltu = src?.lastTrustUpdate;
    if (typeof ltu === 'string') lastTrustUpdate = ltu;
    else if (typeof ltu === 'number' && Number.isFinite(ltu)) {
      try { lastTrustUpdate = new Date(ltu).toISOString(); } catch {}
    }

    if (
      autoPublished !== null &&
      flagged !== null &&
      suggestedHeadlines !== null &&
      typeof lastTrustUpdate === 'string'
    ) {
      return { autoPublished, flagged, suggestedHeadlines, lastTrustUpdate };
    }
    return null;
  };

  const fetchData = useCallback(async () => {
    let didCancel = false;
    try {
      setLoading(true);
      setError(null);
      setNote(null);
      const json = await api.aiActivityLog() as any;
      const normalized = normalize(json);
      if (!normalized) {
        // Backend may not implement this endpoint in some environments (e.g., prod Render repo).
        // Degrade gracefully to an empty state instead of showing a red error.
        if (!didCancel) {
          setData({ autoPublished: 0, flagged: 0, suggestedHeadlines: 0, lastTrustUpdate: new Date(0).toISOString() });
          setNote('AI Activity endpoint not available on this backend. Showing an empty placeholder.');
        }
        return;
      }
      if (!didCancel) setData(normalized);
    } catch (err: any) {
      const ax = err as AxiosError<any>;
      const status = ax?.response?.status;
      const msg = (ax?.response?.data && (ax.response.data.message || ax.response.data.error)) || ax?.message || "Unknown error";
      if (didCancel) return;
      // If unauthorized, surface the error (interceptor will redirect to /auth in prod)
      if (status === 401) {
        setError(`⚠️ Failed to load AI activity (unauthorized). ${msg}`);
      } else {
        // Soft-fail to empty placeholder for 404/5xx or network/shape issues
        setData({ autoPublished: 0, flagged: 0, suggestedHeadlines: 0, lastTrustUpdate: new Date(0).toISOString() });
        setNote('AI Activity endpoint did not return expected data. Showing an empty placeholder.');
      }
    } finally {
      if (!didCancel) setLoading(false);
    }
    return () => { didCancel = true; };
  }, []);

  const wakeAndRetry = useCallback(async () => {
    try {
      setWaking(true);
      // Hit serverless health to wake upstream backend (Render may be sleeping)
      await fetch(`${API_BASE}/system/health`, { credentials: 'include' });
    } catch {
      // ignore; we'll still retry
    } finally {
      setWaking(false);
      fetchData();
    }
  }, [fetchData]);

  useEffect(() => {
    let cleanup: any;
    (async () => { cleanup = await fetchData(); })();
    return () => { if (typeof cleanup === 'function') cleanup(); };
  }, [fetchData]);

  return (
    <section className="p-5 md:p-6 bg-purple-50 dark:bg-purple-900/10 border border-purple-300 dark:border-purple-700 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto">
      <p className="text-green-600 dark:text-green-400 font-mono text-sm mb-2">
        ✅ AIActivityLog Loaded
      </p>
      <h2 className="text-xl font-bold text-purple-700 dark:text-purple-300 mb-3">
        🧠 AI Activity Log
      </h2>

      {loading ? (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          ⏳ Loading real AI activity data...
        </div>
      ) : error ? (
        <div className="text-sm text-red-500 space-y-3">
          <div>{error}</div>
          <div className="flex gap-2">
            <button
              className="px-3 py-1.5 rounded-md bg-purple-600 text-white disabled:opacity-60"
              onClick={wakeAndRetry}
              disabled={waking}
            >{waking ? 'Waking…' : 'Wake backend then retry'}</button>
            <button
              className="px-3 py-1.5 rounded-md border border-purple-400 text-purple-700 dark:text-purple-300"
              onClick={fetchData}
              disabled={loading}
            >Retry</button>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Tip: Ensure you are logged in via <a className="underline" href="/auth">/auth</a> and that the proxy <code>/admin-api</code> can reach your backend.
            Quick check: <a className="underline" href="/admin-api/system/status" target="_blank" rel="noreferrer">/admin-api/system/status</a>
          </div>
        </div>
      ) : data ? (
        <ul className="text-sm space-y-2 text-slate-700 dark:text-slate-200 list-disc list-inside ml-2">
          <li>
            <strong>Auto-published:</strong>{" "}
            {data.autoPublished.toLocaleString()} stories today
          </li>
          <li>
            <strong>Flagged:</strong>{" "}
            {data.flagged.toLocaleString()} articles for review
          </li>
          <li>
            <strong>Suggestions:</strong>{" "}
            {data.suggestedHeadlines.toLocaleString()} trending headlines
          </li>
          <li>
            <strong>Last Trust Update:</strong> {data.lastTrustUpdate}
          </li>
          {note && (
            <li className="list-none text-xs italic text-slate-500 dark:text-slate-400 mt-1">
              {note}
            </li>
          )}
        </ul>
      ) : (
        <div className="text-sm text-gray-400 dark:text-gray-500">
          No activity data available yet.
          {note && (
            <div className="text-xs italic text-slate-500 dark:text-slate-400 mt-1">{note}</div>
          )}
        </div>
      )}
    </section>
  );
};

export default AIActivityLog;

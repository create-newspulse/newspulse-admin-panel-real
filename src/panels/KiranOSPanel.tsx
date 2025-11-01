import React, { useEffect, useState, useRef } from 'react';
import { FaTrash, FaDownload, FaComments } from 'react-icons/fa';
import axios from 'axios';
import apiClient, { API_BASE_PATH } from '@lib/api';
import { useAITrainingInfo } from '@context/AITrainingInfoContext';

// ---------- Types ----------
interface CommandLog {
  command: string;
  timestamp: string;
  trigger: string;
  result: string;
  tag?: string;
}

interface ThinkingFeedRes {
  insights?: string[];
  items?: string[]; // tolerate alt shape
}

interface QueueItem {
  title: string;
  status: string;
}

interface QueueRes {
  pendingItems?: QueueItem[];
  queue?: QueueItem[]; // tolerate alt shape
}

interface DiagnosticsRes {
  mostUsed?: [string, number] | null;
  sources?: { manual?: number; voice?: number; api?: number };
  patternHits?: Record<string, number>;
}

interface IntegrityScanRes {
  flaggedIssues?: any[];
  [k: string]: any;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

// ---------- Axios defaults (so cookies/auth work via proxy) ----------
// Prefer the shared apiClient which already has baseURL, credentials, and Authorization set by AuthContext
axios.defaults.withCredentials = true; // keep legacy callers safe

// Small helper: safe JSON fetch using the shared apiClient (returns data or throws)
const resolve = (url: string) => (url.startsWith('/api/') ? `${API_BASE_PATH}${url.slice(4)}` : url);
const get = async <T,>(path: string) => {
  // Accept absolute URLs (legacy) and relative API paths
  if (path.startsWith('http') || path.startsWith('/api/')) {
    const res = await axios.get<T>(resolve(path), { withCredentials: true });
    return res.data as T;
  }
  const res = await apiClient.get<T>(path);
  return res.data as T;
};
const del = async (path: string) => {
  if (path.startsWith('http') || path.startsWith('/api/')) {
    await axios.delete(resolve(path), { withCredentials: true });
    return;
  }
  await apiClient.delete(path);
};

// ---------- Component ----------
export default function KiranOSPanel() {
  // State hooks
  const [manualCommand, setManualCommand] = useState('');
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [thinking, setThinking] = useState<string[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<{
    mostUsed: [string, number] | null;
    sources: { manual?: number; voice?: number; api?: number };
    topPattern: string | null;
    lastUpdated: string | null;
  } | null>(null);
  const [aiStats, setAiStats] = useState<IntegrityScanRes | null>(null);

  // 🧠 Global AI trainer context
  const { info: trainerInfo, loading: trainerLoading, error: trainerError } = useAITrainingInfo();

  // Speech Recognition Ref to prevent re-trigger
  const recognitionRef = useRef<any>(null);

  // ---------- Voice command effect ----------
  useEffect(() => {
    const SpeechCtor =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (SpeechCtor && !recognitionRef.current) {
      try {
        const recognition = new SpeechCtor();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-IN';

        recognition.onresult = async (event: any) => {
          const last = event.results.length - 1;
          const command = (event.results[last]?.[0]?.transcript ?? '')
            .trim()
            .toLowerCase();
          if (!command) return;

          try {
            const res = await apiClient.post('/system/ai-command', {
              command,
              trigger: 'voice',
            });
            alert(`🤖 ${res.data?.result ?? 'Done.'}`);
          } catch {
            alert('⚠️ Command failed. Check logs.');
          }
        };

        recognition.onerror = (e: any) => console.warn('🎤 Voice error:', e);
        recognition.start();
        recognitionRef.current = recognition;
      } catch (e) {
        console.warn('Speech init failed:', e);
      }
    }

    // Cleanup
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } finally {
          recognitionRef.current = null;
        }
      }
    };
  }, []);

  // ---------- Thinking Feed & AI Queue polling ----------
  useEffect(() => {
    let stopped = false;
    const loadStatus = async () => {
      try {
        const [thinkingRes, queueRes] = await Promise.all([
          get<ThinkingFeedRes>('/system/thinking-feed'),
          get<QueueRes>('/system/ai-queue'),
        ]);

        if (stopped) return;

        const insights = Array.isArray(thinkingRes?.insights)
          ? thinkingRes.insights
          : Array.isArray(thinkingRes?.items)
          ? thinkingRes.items
          : [];

        const pending = Array.isArray(queueRes?.pendingItems)
          ? queueRes.pendingItems
          : Array.isArray(queueRes?.queue)
          ? queueRes.queue
          : [];

        setThinking(insights);
        setQueue(pending);
      } catch (err) {
        if (!stopped) {
          setThinking([]);
          setQueue([]);
        }
      }
    };

    if (!showChat) {
      // Only poll when chat modal is closed to reduce flicker and network churn
      loadStatus();
    }
    const interval = showChat ? null : setInterval(loadStatus, 10_000);
    return () => {
      stopped = true;
      if (interval) clearInterval(interval);
    };
  }, [showChat]);

  // ---------- Analytics polling ----------
  useEffect(() => {
    let stopped = false;
    const fetchAnalytics = async () => {
      try {
  const res = await get<DiagnosticsRes>('/system/ai-diagnostics');
        if (stopped) return;

        const topPattern =
          res?.patternHits && Object.keys(res.patternHits).length > 0
            ? Object.entries(res.patternHits).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0][0]
            : null;

        setAnalytics({
          mostUsed: res?.mostUsed ?? null,
          sources: res?.sources ?? {},
          topPattern,
          lastUpdated: new Date().toLocaleTimeString(),
        });
      } catch {
        if (!stopped) {
          setAnalytics(null);
        }
      }
    };

    if (!showChat) {
      fetchAnalytics();
    }
    const interval = showChat ? null : setInterval(fetchAnalytics, 10_000);
    return () => {
      stopped = true;
      if (interval) clearInterval(interval);
    };
  }, [showChat]);

  // ---------- Integrity scan (on load) ----------
  useEffect(() => {
    (async () => {
      try {
  const data = await get<IntegrityScanRes>('/api/system/integrity-scan');
        setAiStats(data ?? null);
      } catch {
        setAiStats(null);
      }
    })();
  }, []);

  // ---------- Manual command send ----------
  const handleManualCommand = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && manualCommand.trim()) {
      try {
        const res = await apiClient.post('/system/ai-command', {
          command: manualCommand.trim(),
          trigger: 'manual',
        });
        alert(`🤖 ${res.data?.result ?? 'Done.'}`);
        setManualCommand('');
      } catch {
        alert('⚠️ Command failed.');
      }
    }
  };

  // ---------- Logs fetch, clear, export ----------
  const fetchLogs = async () => {
    try {
      const res = await get<{ logs?: CommandLog[] }>('/system/view-logs');
      setLogs(Array.isArray(res?.logs) ? res.logs : []);
    } catch {
      alert('❌ Failed to fetch logs.');
    }
  };

  const clearLogs = async () => {
    if (!window.confirm('Are you sure you want to delete all logs?')) return;
    try {
      await del('/system/clear-logs');
      alert('🗑️ Logs cleared.');
      setLogs([]);
    } catch {
      alert('❌ Failed to clear logs.');
    }
  };

  const exportLogs = () => {
    const header = 'Command,Timestamp,Trigger,Result,Tag\n';
    const csvLines = logs.map(
      (log) =>
        `"${(log.command ?? '').replaceAll('"', '""')}","${log.timestamp ?? ''}","${log.trigger ?? ''}","${(log.result ?? '').replaceAll('"', '""')}","${(log.tag ?? '').replaceAll('"', '""')}"`
    );
    const blob = new Blob([header + csvLines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kiranos_logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------- Diagnostics alert ----------
  const fetchDiagnostics = async () => {
    try {
      const res = await get<DiagnosticsRes>('/system/ai-diagnostics');
      const top = res?.mostUsed ?? null;
      if (top) {
        alert(`📊 Top command: ${top[0]} (${top[1]} times)`);
      } else {
        alert('📊 No usage data yet.');
      }
    } catch {
      alert('❌ Diagnostics failed.');
    }
  };

  // ---------- Ask KiranOS ----------
  const handleAskKiranOS = async () => {
    if (!chatInput.trim()) return;
    try {
      const res = await apiClient.post('/system/ask-kiranos', { prompt: chatInput.trim() });
      // API returns { success, answer } (legacy demos used { reply })
      setChatResponse((res.data as any)?.answer ?? (res.data as any)?.reply ?? '🤖 No response.');
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.error || err?.message || '';
      if (status === 401 || /AI_AUTH/i.test(msg)) {
        setChatResponse('🔐 KiranOS is locked: missing or invalid OPENAI_API_KEY on the server.');
      } else if (status === 429 || /rate/i.test(msg)) {
        setChatResponse('⏳ KiranOS is rate-limited. Please try again in a minute.');
      } else {
        setChatResponse('⚠️ Failed to get response from KiranOS.');
      }
    }
  };

  // ---------- UI ----------
  return (
    <div className="ai-card glow-panel ai-highlight hover-glow border border-blue-500 shadow-xl rounded-xl p-5 bg-white dark:bg-slate-900 transition-all duration-300">
      {/* Manual Command */}
      <input
        type="text"
        placeholder="🧠 Type a command (e.g., ai status)"
        value={manualCommand}
        onChange={(e) => setManualCommand(e.target.value)}
        onKeyDown={handleManualCommand}
        className="mt-3 w-full px-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-black dark:text-white shadow-sm focus:ring-2 focus:ring-blue-400"
      />

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mt-4 text-sm font-medium text-blue-600 dark:text-blue-300">
        <button onClick={fetchLogs}>🔁 View Logs</button>
        <button onClick={fetchDiagnostics} className="text-green-700 dark:text-green-400">🧬 Diagnostics</button>
        <button onClick={exportLogs} className="flex items-center gap-1 text-blue-500"><FaDownload /> Export</button>
        <button onClick={clearLogs} className="flex items-center gap-1 text-red-500"><FaTrash /> Clear</button>
        <button onClick={() => setShowChat(true)} className="flex items-center gap-1 text-purple-600"><FaComments /> Ask KiranOS</button>
      </div>

      {/* Info Blocks */}
      <div className="mt-6 space-y-5">
        {/* Thinking Feed */}
        <div className="bg-blue-50 dark:bg-slate-800 p-4 rounded shadow">
          <h3 className="text-md font-bold text-blue-600 dark:text-blue-300">🧠 Real-Time Thinking Feed</h3>
          <ul className="list-disc ml-5 text-sm text-slate-700 dark:text-slate-300 space-y-1">
            {thinking.length > 0 ? thinking.map((item, idx) => <li key={idx}>{item}</li>) : <li>⚠️ No insights available.</li>}
          </ul>
        </div>

        {/* AI Mission Queue */}
        <div className="bg-purple-50 dark:bg-slate-800 p-4 rounded shadow">
          <h3 className="text-md font-bold text-purple-600 dark:text-purple-300">🎯 AI Mission Queue</h3>
          <ul className="list-disc ml-5 text-sm text-slate-700 dark:text-slate-300 space-y-1">
            {queue.length > 0
              ? queue.map((task, idx) => (
                  <li key={idx}>
                    {task.title} — <span className="italic text-xs">{task.status}</span>
                  </li>
                ))
              : <li>—</li>}
          </ul>
        </div>

        {/* Analytics */}
        {analytics && (
          <div className="bg-yellow-50 dark:bg-slate-800 p-4 rounded shadow">
            <h3 className="text-md font-bold text-yellow-700 dark:text-yellow-300">📊 KiranOS AI Analytics</h3>
            <ul className="list-disc ml-5 text-sm text-slate-700 dark:text-slate-300 mt-2 space-y-1">
              <li>Top Command Today: <strong>{analytics.mostUsed?.[0] ?? '—'}</strong></li>
              <li>Times Used: <strong>{analytics.mostUsed?.[1] ?? 0}</strong></li>
              <li>Sources:
                <ul className="ml-4 list-square">
                  <li>Manual: {analytics.sources?.manual ?? 0}</li>
                  <li>Voice: {analytics.sources?.voice ?? 0}</li>
                  <li>API: {analytics.sources?.api ?? 0}</li>
                </ul>
              </li>
              <li>Most Used Pattern: <strong>{analytics.topPattern ?? '—'}</strong></li>
              <li>Last Updated: <strong>{analytics.lastUpdated ?? '—'}</strong></li>
            </ul>
          </div>
        )}

        {/* Trainer Info */}
        <div className="bg-indigo-50 dark:bg-slate-800 p-4 rounded shadow">
          <h3 className="text-md font-bold text-indigo-700 dark:text-indigo-300">🧠 AI Training Overview</h3>
          {trainerLoading && <p>Loading training info...</p>}
          {trainerError && <p className="text-red-500">{trainerError}</p>}
          {trainerInfo && (
            <ul className="list-disc ml-5 text-sm text-slate-700 dark:text-slate-300 mt-2 space-y-1">
              <li>Last Trained: <strong>{trainerInfo.lastTraining}</strong></li>
              <li>Next Training: <strong>{trainerInfo.nextTraining}</strong></li>
              <li>Articles Analyzed: <strong>{trainerInfo.articlesAnalyzed}</strong></li>
              <li>Pattern Focus: <strong>{trainerInfo.patternFocus}</strong></li>
              <li>Modules Trained: <strong>{trainerInfo.modulesTrained?.length ?? 0}</strong></li>
              <li>Keywords Indexed: <strong>{trainerInfo.keywords}</strong></li>
              <li>Status: <span className="text-green-600 dark:text-green-400 font-bold">Ready</span></li>
            </ul>
          )}
        </div>

        {/* AI Integrity Scan */}
        {aiStats && (
          <div className="bg-green-50 dark:bg-slate-800 p-4 rounded shadow">
            <h3 className="text-md font-bold text-green-700 dark:text-green-300">🛡️ AI Integrity Scan</h3>
            {(aiStats?.flaggedIssues?.length ?? 0) > 0 ? (
              <pre className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {JSON.stringify(aiStats, null, 2)}
              </pre>
            ) : (
              <p className="text-green-700 dark:text-green-200 mt-1 font-semibold">✅ System Clean — No issues found.</p>
            )}
          </div>
        )}
      </div>

      {/* Ask KiranOS Modal */}
      {showChat && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-lg w-full max-w-lg shadow-lg border border-blue-400">
            <h3 className="text-lg font-bold text-blue-600 dark:text-blue-300 mb-2">💬 Ask KiranOS</h3>
            <input
              type="text"
              className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-black dark:text-white mb-3"
              placeholder="Ask your question..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAskKiranOS(); }}
              autoFocus
            />
            <button onClick={handleAskKiranOS} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mb-2">Ask</button>
            {chatResponse && (
              <div className="mt-2 text-sm text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 p-3 rounded">
                {chatResponse}
              </div>
            )}
            <button onClick={() => setShowChat(false)} className="mt-4 px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

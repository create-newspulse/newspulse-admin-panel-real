import { useEffect, useState, useRef } from 'react';
import { FaTrash, FaDownload, FaComments } from 'react-icons/fa';
import axios from 'axios';
import { useAITrainingInfo } from '@context/AITrainingInfoContext';

interface CommandLog {
  command: string;
  timestamp: string;
  trigger: string;
  result: string;
  tag?: string;
}

export default function KiranOSPanel() {
  // State hooks
  const [manualCommand, setManualCommand] = useState('');
  const [logs, setLogs] = useState<CommandLog[]>([]);
  const [thinking, setThinking] = useState<string[]>([]);
  const [queue, setQueue] = useState<{ title: string; status: string }[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [aiStats, setAiStats] = useState<any>(null);

  // 🧠 Use global AI trainer context
  const { info: trainerInfo, loading: trainerLoading, error: trainerError } = useAITrainingInfo();

  // Speech Recognition Ref to prevent re-trigger
  const recognitionRef = useRef<any>(null);

  // -- Voice command effect
  useEffect(() => {
    if ('webkitSpeechRecognition' in window && !recognitionRef.current) {
      const recognition = new (window as any).webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onresult = async (event: any) => {
        const last = event.results.length - 1;
        const command = event.results[last][0].transcript.trim().toLowerCase();

        try {
          const res = await axios.post('/api/system/ai-command', {
            command,
            trigger: 'voice',
          });
          alert(`🤖 ${res.data.result}`);
        } catch {
          alert('⚠️ Command failed. Check logs.');
        }
      };
      recognition.onerror = (e: any) => console.warn('🎤 Voice error:', e);

      recognition.start();
      recognitionRef.current = recognition;
    }
    // Cleanup voice recognition on unmount
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, []);

  // -- Thinking Feed and AI Queue polling
  useEffect(() => {
    let stopped = false;
    const loadStatus = async () => {
      try {
        const [thinkingRes, queueRes] = await Promise.all([
          axios.get('/api/system/thinking-feed'),
          axios.get('/api/system/ai-queue')
        ]);
        if (!stopped) {
          setThinking(Array.isArray(thinkingRes.data?.insights) ? thinkingRes.data.insights : []);
          setQueue(Array.isArray(queueRes.data?.pendingItems) ? queueRes.data.pendingItems : []);
        }
      } catch (err) {
        if (!stopped) {
          setThinking([]);
          setQueue([]);
        }
      }
    };
    loadStatus();
    const interval = setInterval(loadStatus, 10000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, []);

  // -- Analytics polling
  useEffect(() => {
    let stopped = false;
    const fetchAnalytics = async () => {
      try {
        const res = await axios.get('/api/system/ai-diagnostics');
        if (!stopped) {
          setAnalytics({
            mostUsed: res.data.mostUsed,
            sources: res.data.sources,
            topPattern: Object.entries(res.data.patternHits || {})?.[0]?.[0] || null,
            lastUpdated: new Date().toLocaleTimeString(),
          });
        }
      } catch {}
    };
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 10000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, []);

  // -- Integrity scan (on load)
  useEffect(() => {
    fetch('/api/system/integrity-scan')
      .then(res => res.json())
      .then(setAiStats)
      .catch(() => {});
  }, []);

  // -- Manual command send
  const handleManualCommand = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && manualCommand.trim()) {
      try {
        const res = await axios.post('/api/system/ai-command', {
          command: manualCommand.trim(),
          trigger: 'manual',
        });
        alert(`🤖 ${res.data.result}`);
        setManualCommand('');
      } catch {
        alert('⚠️ Command failed.');
      }
    }
  };

  // -- Logs fetch, clear, export
  const fetchLogs = async () => {
    try {
      const res = await axios.get('/api/system/view-logs');
      setLogs(res.data.logs || []);
    } catch {
      alert('❌ Failed to fetch logs.');
    }
  };
  const clearLogs = async () => {
    if (!window.confirm('Are you sure you want to delete all logs?')) return;
    try {
      await axios.delete('/api/system/clear-logs');
      alert('🗑️ Logs cleared.');
      setLogs([]);
    } catch {
      alert('❌ Failed to clear logs.');
    }
  };
  const exportLogs = () => {
    const csv = logs.map(log =>
      `"${log.command}","${log.timestamp}","${log.trigger}","${log.result}","${log.tag || ''}"`
    );
    const blob = new Blob([`Command,Timestamp,Trigger,Result,Tag\n${csv.join('\n')}`], {
      type: 'text/csv'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kiranos_logs.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // -- Diagnostics alert
  const fetchDiagnostics = async () => {
    try {
      const res = await axios.get('/api/system/ai-diagnostics');
      alert(`📊 Top command: ${res.data.mostUsed[0]} (${res.data.mostUsed[1]} times)`);
    } catch {
      alert('❌ Diagnostics failed.');
    }
  };

  // -- Ask KiranOS
  const handleAskKiranOS = async () => {
    if (!chatInput.trim()) return;
    try {
      const res = await axios.post('/api/system/ask-kiranos', { prompt: chatInput });
      setChatResponse(res.data.reply || '🤖 No response.');
    } catch {
      setChatResponse('⚠️ Failed to get response from KiranOS.');
    }
  };

  // --- UI ---
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
            {queue.map((task, idx) => <li key={idx}>{task.title} — <span className="italic text-xs">{task.status}</span></li>)}
          </ul>
        </div>
        {/* Analytics */}
        {analytics && (
          <div className="bg-yellow-50 dark:bg-slate-800 p-4 rounded shadow">
            <h3 className="text-md font-bold text-yellow-700 dark:text-yellow-300">📊 KiranOS AI Analytics</h3>
            <ul className="list-disc ml-5 text-sm text-slate-700 dark:text-slate-300 mt-2 space-y-1">
              <li>Top Command Today: <strong>{analytics?.mostUsed?.[0] || '—'}</strong></li>
              <li>Times Used: <strong>{analytics?.mostUsed?.[1] || 0}</strong></li>
              <li>Sources:
                <ul className="ml-4 list-square">
                  <li>Manual: {analytics?.sources?.manual || 0}</li>
                  <li>Voice: {analytics?.sources?.voice || 0}</li>
                  <li>API: {analytics?.sources?.api || 0}</li>
                </ul>
              </li>
              <li>Most Used Pattern: <strong>{analytics?.topPattern || '—'}</strong></li>
              <li>Last Updated: <strong>{analytics?.lastUpdated || '—'}</strong></li>
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
              <li>Modules Trained: <strong>{trainerInfo.modulesTrained?.length}</strong></li>
              <li>Keywords Indexed: <strong>{trainerInfo.keywords}</strong></li>
              <li>Status: <span className="text-green-600 dark:text-green-400 font-bold">Ready</span></li>
            </ul>
          )}
        </div>
        {/* AI Integrity Scan */}
        {aiStats && (
          <div className="bg-green-50 dark:bg-slate-800 p-4 rounded shadow">
            <h3 className="text-md font-bold text-green-700 dark:text-green-300">🛡️ AI Integrity Scan</h3>
            {aiStats?.flaggedIssues?.length > 0 ? (
              <pre className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap">{JSON.stringify(aiStats, null, 2)}</pre>
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
              onKeyDown={e => { if (e.key === "Enter") handleAskKiranOS(); }}
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

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useRef } from 'react';
import { FaTrash, FaDownload, FaComments } from 'react-icons/fa';
import axios from 'axios';
import apiClient, { API_BASE_PATH } from '@lib/api';
import { useAITrainingInfo } from '@context/AITrainingInfoContext';
// ---------- Axios defaults (so cookies/auth work via proxy) ----------
// Prefer the shared apiClient which already has baseURL, credentials, and Authorization set by AuthContext
axios.defaults.withCredentials = true; // keep legacy callers safe
// Small helper: safe JSON fetch using the shared apiClient (returns data or throws)
const resolve = (url) => (url.startsWith('/api/') ? `${API_BASE_PATH}${url.slice(4)}` : url);
const get = async (path) => {
    // Accept absolute URLs (legacy) and relative API paths
    if (path.startsWith('http') || path.startsWith('/api/')) {
        const res = await axios.get(resolve(path), { withCredentials: true });
        return res.data;
    }
    const res = await apiClient.get(path);
    return res.data;
};
const del = async (path) => {
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
    const [logs, setLogs] = useState([]);
    const [thinking, setThinking] = useState([]);
    const [queue, setQueue] = useState([]);
    const [showChat, setShowChat] = useState(false);
    const [chatInput, setChatInput] = useState('');
    const [chatResponse, setChatResponse] = useState(null);
    const [isAsking, setIsAsking] = useState(false);
    // While typing, pause background polling and heavy glow to prevent focus flicker
    const [isTyping, setIsTyping] = useState(false);
    const [analytics, setAnalytics] = useState(null);
    const [aiStats, setAiStats] = useState(null);
    // ≡ƒºá Global AI trainer context
    const { info: trainerInfo, loading: trainerLoading, error: trainerError } = useAITrainingInfo();
    // Speech Recognition Ref to prevent re-trigger
    const recognitionRef = useRef(null);
    // ---------- Voice command effect ----------
    useEffect(() => {
        // (Engine label intentionally hidden)
        const SpeechCtor = window.SpeechRecognition ||
            window.webkitSpeechRecognition;
        if (SpeechCtor && !recognitionRef.current) {
            try {
                const recognition = new SpeechCtor();
                recognition.continuous = true;
                recognition.interimResults = false;
                recognition.lang = 'en-IN';
                recognition.onresult = async (event) => {
                    const last = event.results.length - 1;
                    const command = (event.results[last]?.[0]?.transcript ?? '')
                        .trim()
                        .toLowerCase();
                    if (!command)
                        return;
                    try {
                        const res = await apiClient.post('/system/ai-command', {
                            command,
                            trigger: 'voice',
                        });
                        alert(`≡ƒñû ${res.data?.result ?? 'Done.'}`);
                    }
                    catch {
                        alert('ΓÜá∩╕Å Command failed. Check logs.');
                    }
                };
                recognition.onerror = (e) => console.warn('≡ƒÄñ Voice error:', e);
                recognition.start();
                recognitionRef.current = recognition;
            }
            catch (e) {
                console.warn('Speech init failed:', e);
            }
        }
        // Cleanup
        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                }
                finally {
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
                    get('/system/thinking-feed'),
                    get('/system/ai-queue'),
                ]);
                if (stopped)
                    return;
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
            }
            catch (err) {
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
            if (interval)
                clearInterval(interval);
        };
    }, [showChat, isTyping]);
    // ---------- Analytics polling ----------
    useEffect(() => {
        let stopped = false;
        const fetchAnalytics = async () => {
            try {
                const res = await get('/system/ai-diagnostics');
                if (stopped)
                    return;
                const topPattern = res?.patternHits && Object.keys(res.patternHits).length > 0
                    ? Object.entries(res.patternHits).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0][0]
                    : null;
                setAnalytics({
                    mostUsed: res?.mostUsed ?? null,
                    sources: res?.sources ?? {},
                    topPattern,
                    lastUpdated: new Date().toLocaleTimeString(),
                });
            }
            catch {
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
            if (interval)
                clearInterval(interval);
        };
    }, [showChat, isTyping]);
    // ---------- Integrity scan (on load) ----------
    useEffect(() => {
        (async () => {
            try {
                const data = await get('/api/system/integrity-scan');
                setAiStats(data ?? null);
            }
            catch {
                setAiStats(null);
            }
        })();
    }, []);
    // ---------- Manual command send ----------
    const handleManualCommand = async (e) => {
        if (e.key === 'Enter' && manualCommand.trim()) {
            try {
                const res = await apiClient.post('/system/ai-command', {
                    command: manualCommand.trim(),
                    trigger: 'manual',
                });
                alert(`≡ƒñû ${res.data?.result ?? 'Done.'}`);
                setManualCommand('');
            }
            catch {
                alert('ΓÜá∩╕Å Command failed.');
            }
        }
    };
    // ---------- Logs fetch, clear, export ----------
    const fetchLogs = async () => {
        try {
            const res = await get('/system/view-logs');
            setLogs(Array.isArray(res?.logs) ? res.logs : []);
        }
        catch {
            alert('Γ¥î Failed to fetch logs.');
        }
    };
    const clearLogs = async () => {
        if (!window.confirm('Are you sure you want to delete all logs?'))
            return;
        try {
            await del('/system/clear-logs');
            alert('≡ƒùæ∩╕Å Logs cleared.');
            setLogs([]);
        }
        catch {
            alert('Γ¥î Failed to clear logs.');
        }
    };
    const exportLogs = () => {
        const header = 'Command,Timestamp,Trigger,Result,Tag\n';
        const csvLines = logs.map((log) => `"${(log.command ?? '').replaceAll('"', '""')}","${log.timestamp ?? ''}","${log.trigger ?? ''}","${(log.result ?? '').replaceAll('"', '""')}","${(log.tag ?? '').replaceAll('"', '""')}"`);
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
            const res = await get('/system/ai-diagnostics');
            const top = res?.mostUsed ?? null;
            if (top) {
                alert(`≡ƒôè Top command: ${top[0]} (${top[1]} times)`);
            }
            else {
                alert('≡ƒôè No usage data yet.');
            }
        }
        catch {
            alert('Γ¥î Diagnostics failed.');
        }
    };
    // ---------- Ask KiranOS ----------
    const handleAskKiranOS = async () => {
        const prompt = chatInput.trim();
        if (!prompt || isAsking)
            return;
        setIsAsking(true);
        const maxRetries = 0; // fast path: avoid repeated attempts for responsiveness
        const baseDelay = 4000; // 4s
        let attempt = 0;
        let lastErr = null;
        while (attempt <= maxRetries) {
            try {
                const res = await apiClient.post('/system/ask-kiranos', { prompt }, { timeout: 20_000 });
                setChatResponse(res.data?.answer ?? res.data?.reply ?? '≡ƒñû No response.');
                setIsAsking(false);
                return;
            }
            catch (err) {
                lastErr = err;
                const status = err?.response?.status;
                const msg = err?.response?.data?.error || err?.message || '';
                const isAuth = status === 401 || /AI_AUTH/i.test(msg);
                const isBusy = /AI_BUSY/i.test(msg) || /queue/i.test(String(err?.response?.data?.message || ''));
                if (isAuth) {
                    setChatResponse('≡ƒöÉ KiranOS is locked: missing or invalid OPENAI_API_KEY on the server.');
                    setIsAsking(false);
                    return;
                }
                // Only auto-retry for transient busy/queue signals, not hard rate limits
                if (isBusy && attempt < maxRetries) {
                    const delay = Math.min(12000, Math.round(baseDelay * Math.pow(1.8, attempt) * (0.7 + Math.random() * 0.6)));
                    setChatResponse(`ΓÅ│ KiranOS is busy. Retrying in ${Math.ceil(delay / 1000)}sΓÇª`);
                    await new Promise(r => setTimeout(r, delay));
                    attempt++;
                    continue;
                }
                break;
            }
        }
        // Final error
        const status = lastErr?.response?.status;
        const msg = lastErr?.response?.data?.error || lastErr?.message || '';
        if (status === 429 || /rate/i.test(msg)) {
            setChatResponse('ΓÅ│ KiranOS is busy. Please try again in a few seconds.');
        }
        else {
            setChatResponse('ΓÜá∩╕Å Failed to get response from KiranOS.');
        }
        setIsAsking(false);
    };
    // ---------- UI ----------
    return (_jsxs("div", { className: `ai-card ${isTyping ? '' : 'glow-panel ai-highlight hover-glow'} border border-blue-500 shadow-xl rounded-xl p-5 bg-white dark:bg-slate-900 transition-all duration-300`, children: [_jsx("input", { type: "text", placeholder: "\uD83E\uDDE0 Type a command (e.g., ai status)", value: manualCommand, onChange: (e) => setManualCommand(e.target.value), onKeyDown: handleManualCommand, onFocus: () => setIsTyping(true), onBlur: () => setIsTyping(false), autoComplete: "off", className: "mt-3 w-full px-4 py-2 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-black dark:text-white shadow-sm focus:ring-2 focus:ring-blue-400" }), _jsxs("div", { className: "flex flex-wrap gap-4 mt-4 text-sm font-medium text-blue-600 dark:text-blue-300", children: [_jsx("button", { onClick: fetchLogs, children: "\uD83D\uDD01 View Logs" }), _jsx("button", { onClick: fetchDiagnostics, className: "text-green-700 dark:text-green-400", children: "\uD83E\uDDEC Diagnostics" }), _jsxs("button", { onClick: exportLogs, className: "flex items-center gap-1 text-blue-500", children: [_jsx(FaDownload, {}), " Export"] }), _jsxs("button", { onClick: clearLogs, className: "flex items-center gap-1 text-red-500", children: [_jsx(FaTrash, {}), " Clear"] }), _jsxs("button", { onClick: () => window.dispatchEvent(new CustomEvent('open-kiranos-hub')), className: "flex items-center gap-1 text-purple-600", children: [_jsx(FaComments, {}), " Ask KiranOS"] })] }), _jsxs("div", { className: "mt-6 space-y-5", children: [_jsxs("div", { className: "bg-blue-50 dark:bg-slate-800 p-4 rounded shadow", children: [_jsx("h3", { className: "text-md font-bold text-blue-600 dark:text-blue-300", children: "\uD83E\uDDE0 Real-Time Thinking Feed" }), _jsx("ul", { className: "list-disc ml-5 text-sm text-slate-700 dark:text-slate-300 space-y-1", children: thinking.length > 0 ? thinking.map((item, idx) => _jsx("li", { children: item }, idx)) : _jsx("li", { children: "\u26A0\uFE0F No insights available." }) })] }), _jsxs("div", { className: "bg-purple-50 dark:bg-slate-800 p-4 rounded shadow", children: [_jsx("h3", { className: "text-md font-bold text-purple-600 dark:text-purple-300", children: "\uD83C\uDFAF AI Mission Queue" }), _jsx("ul", { className: "list-disc ml-5 text-sm text-slate-700 dark:text-slate-300 space-y-1", children: queue.length > 0
                                    ? queue.map((task, idx) => (_jsxs("li", { children: [task.title, " \u2014 ", _jsx("span", { className: "italic text-xs", children: task.status })] }, idx)))
                                    : _jsx("li", { children: "\u2014" }) })] }), analytics && (_jsxs("div", { className: "bg-yellow-50 dark:bg-slate-800 p-4 rounded shadow", children: [_jsx("h3", { className: "text-md font-bold text-yellow-700 dark:text-yellow-300", children: "\uD83D\uDCCA KiranOS AI Analytics" }), _jsxs("ul", { className: "list-disc ml-5 text-sm text-slate-700 dark:text-slate-300 mt-2 space-y-1", children: [_jsxs("li", { children: ["Top Command Today: ", _jsx("strong", { children: analytics.mostUsed?.[0] ?? 'ΓÇö' })] }), _jsxs("li", { children: ["Times Used: ", _jsx("strong", { children: analytics.mostUsed?.[1] ?? 0 })] }), _jsxs("li", { children: ["Sources:", _jsxs("ul", { className: "ml-4 list-square", children: [_jsxs("li", { children: ["Manual: ", analytics.sources?.manual ?? 0] }), _jsxs("li", { children: ["Voice: ", analytics.sources?.voice ?? 0] }), _jsxs("li", { children: ["API: ", analytics.sources?.api ?? 0] })] })] }), _jsxs("li", { children: ["Most Used Pattern: ", _jsx("strong", { children: analytics.topPattern ?? 'ΓÇö' })] }), _jsxs("li", { children: ["Last Updated: ", _jsx("strong", { children: analytics.lastUpdated ?? 'ΓÇö' })] })] })] })), _jsxs("div", { className: "bg-indigo-50 dark:bg-slate-800 p-4 rounded shadow", children: [_jsx("h3", { className: "text-md font-bold text-indigo-700 dark:text-indigo-300", children: "\uD83E\uDDE0 AI Training Overview" }), trainerLoading && _jsx("p", { children: "Loading training info..." }), trainerError && _jsx("p", { className: "text-red-500", children: trainerError }), trainerInfo && (_jsxs("ul", { className: "list-disc ml-5 text-sm text-slate-700 dark:text-slate-300 mt-2 space-y-1", children: [_jsxs("li", { children: ["Last Trained: ", _jsx("strong", { children: trainerInfo.lastTraining })] }), _jsxs("li", { children: ["Next Training: ", _jsx("strong", { children: trainerInfo.nextTraining })] }), _jsxs("li", { children: ["Articles Analyzed: ", _jsx("strong", { children: trainerInfo.articlesAnalyzed })] }), _jsxs("li", { children: ["Pattern Focus: ", _jsx("strong", { children: trainerInfo.patternFocus })] }), _jsxs("li", { children: ["Modules Trained: ", _jsx("strong", { children: trainerInfo.modulesTrained?.length ?? 0 })] }), _jsxs("li", { children: ["Keywords Indexed: ", _jsx("strong", { children: trainerInfo.keywords })] }), _jsxs("li", { children: ["Status: ", _jsx("span", { className: "text-green-600 dark:text-green-400 font-bold", children: "Ready" })] })] }))] }), aiStats && (_jsxs("div", { className: "bg-green-50 dark:bg-slate-800 p-4 rounded shadow", children: [_jsx("h3", { className: "text-md font-bold text-green-700 dark:text-green-300", children: "\uD83D\uDEE1\uFE0F AI Integrity Scan" }), (aiStats?.flaggedIssues?.length ?? 0) > 0 ? (_jsx("pre", { className: "text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap", children: JSON.stringify(aiStats, null, 2) })) : (_jsx("p", { className: "text-green-700 dark:text-green-200 mt-1 font-semibold", children: "\u2705 System Clean \u2014 No issues found." }))] }))] })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
const statusChip = {
    healthy: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
    warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
    unknown: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
};
function deriveStatus(data) {
    try {
        if (!data)
            return 'unknown';
        const b = data.backend;
        if (b && typeof b === 'object') {
            const s = (b.status || b.health || '').toString().toLowerCase();
            if (s === 'healthy')
                return 'healthy';
            if (s === 'warning' || s === 'degraded' || s === 'degrade')
                return 'warning';
            if (s === 'critical' || s === 'down' || s === 'error')
                return 'critical';
            const cpu = Number(b.cpu ?? b.cpuUsage ?? NaN);
            const mem = Number(b.memory ?? b.memoryUsage ?? NaN);
            if (!Number.isNaN(cpu) || !Number.isNaN(mem)) {
                if (cpu > 80 || mem > 85)
                    return 'critical';
                if (cpu > 60 || mem > 75)
                    return 'warning';
                return 'healthy';
            }
        }
        if (typeof data.status === 'number') {
            if (data.status >= 500)
                return 'critical';
            if (data.status >= 400)
                return 'warning';
            if (data.status >= 200 && data.status < 300)
                return 'healthy';
        }
        return data.success ? 'healthy' : 'unknown';
    }
    catch {
        return 'unknown';
    }
}
export default function SystemHealthPanel() {
    const [env, setEnv] = useState(null);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [refreshTick, setRefreshTick] = useState(0);
    const status = useMemo(() => deriveStatus(env || {}), [env]);
    const latency = typeof env?.latencyMs === 'number' ? `${Math.round(env.latencyMs)}ms` : '—';
    useEffect(() => {
        let mounted = true;
        let timer;
        const pull = async () => {
            try {
                const r = await fetch('/api/system/health', { credentials: 'include' });
                const ct = r.headers.get('content-type') || '';
                if (!/application\/json/i.test(ct)) {
                    const txt = await r.text().catch(() => '');
                    if (mounted)
                        setEnv({ success: false, status: r.status, contentType: ct, backend: { nonJson: true, text: txt } });
                    return;
                }
                const json = (await r.json());
                if (mounted) {
                    setEnv(json);
                    setError(null);
                }
            }
            catch (e) {
                if (mounted) {
                    setError(e?.message || 'Failed to load system health');
                    setEnv({ success: false });
                }
            }
            finally {
                if (autoRefresh)
                    timer = setTimeout(pull, 10_000);
            }
        };
        pull();
        return () => {
            mounted = false;
            if (timer)
                clearTimeout(timer);
        };
    }, [autoRefresh, refreshTick]);
    const refreshNow = async () => setRefreshTick((t) => t + 1);
    const b = env?.backend || {};
    const num = (v) => (typeof v === 'number' && !Number.isNaN(v) ? v : null);
    const cpu = num(b.cpu ?? b.cpuUsage);
    const mem = num(b.memory ?? b.memoryUsage);
    const storage = num(b.storage ?? b.disk ?? b.diskUsage);
    const activeUsers = num(b.activeUsers);
    const rpm = num(b.requestsPerMinute ?? b.rpm);
    const uptime = (b.uptime || b.uptimeMs || b.uptimeSeconds || '');
    const waking = useMemo(() => {
        const d = env || {};
        return d?.proxied && d?.success === false && typeof d?.status !== 'number' && typeof d?.latencyMs !== 'number';
    }, [env]);
    // When waking, trigger a no-cors warm-up to backend origin to accelerate wake from the browser.
    useEffect(() => {
        if (!waking)
            return;
        let cancelled = false;
        (async () => {
            try {
                const meta = await fetch('/api/system/backend-origin', { credentials: 'include' }).then(r => r.json()).catch(() => null);
                const origin = meta?.origin || null;
                if (!origin)
                    return;
                if (!cancelled) {
                    fetch(origin, { mode: 'no-cors' }).catch(() => { });
                    fetch(`${origin}/api/health`, { mode: 'no-cors' }).catch(() => { });
                    fetch(`${origin}/api/system/health`, { mode: 'no-cors' }).catch(() => { });
                }
            }
            catch { }
        })();
        return () => { cancelled = true; };
    }, [waking]);
    return (_jsxs("section", { className: "mt-8", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("h3", { className: "text-xl font-semibold", children: "\uD83E\uDE7A System Health" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `px-2 py-1 text-xs rounded ${statusChip[status]}`, children: status.toUpperCase() }), _jsxs("span", { className: "text-xs text-slate-500 dark:text-slate-400", children: ["Latency: ", latency] }), _jsx("button", { className: "text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800", onClick: () => setAutoRefresh((v) => !v), "aria-pressed": autoRefresh, children: autoRefresh ? 'Pause' : 'Resume' }), _jsx("button", { className: "text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800", onClick: () => setExpanded((v) => !v), "aria-expanded": expanded, children: expanded ? 'Hide Raw' : 'Show Raw' })] })] }), (waking || error) && (_jsxs("div", { className: "text-sm text-red-600 dark:text-red-400 mb-3", children: ["\u274C ", error] })), waking && (_jsxs("div", { className: "mb-3 p-3 rounded-md border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/15 text-sm text-purple-800 dark:text-purple-200 flex items-center justify-between", children: [_jsx("div", { children: "\u23F3 Backend waking\u2026 we\u2019ll auto-refresh. You can also retry now." }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { className: "text-xs px-2 py-1 rounded bg-purple-600 text-white", onClick: refreshNow, children: "Retry now" }), _jsx("button", { className: "text-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-600", onClick: () => setAutoRefresh((v) => !v), children: autoRefresh ? 'Pause' : 'Resume' })] })] })), _jsxs("div", { className: "grid md:grid-cols-3 gap-4", children: [_jsxs("div", { className: "p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700", children: [_jsx("div", { className: "text-xs text-slate-500 mb-1", children: "CPU" }), _jsx("div", { className: "text-2xl font-bold", children: cpu !== null ? `${cpu.toFixed(1)}%` : '—' }), _jsx("div", { className: "mt-2 h-2 rounded bg-slate-200 dark:bg-slate-700", children: _jsx("div", { className: `h-2 rounded ${cpu !== null ? (cpu > 80 ? 'bg-red-500' : cpu > 60 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-slate-400'}`, style: { width: `${Math.max(0, Math.min(100, cpu ?? 0))}%` } }) })] }), _jsxs("div", { className: "p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700", children: [_jsx("div", { className: "text-xs text-slate-500 mb-1", children: "Memory" }), _jsx("div", { className: "text-2xl font-bold", children: mem !== null ? `${mem.toFixed(1)}%` : '—' }), _jsx("div", { className: "mt-2 h-2 rounded bg-slate-200 dark:bg-slate-700", children: _jsx("div", { className: `h-2 rounded ${mem !== null ? (mem > 85 ? 'bg-red-500' : mem > 75 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-slate-400'}`, style: { width: `${Math.max(0, Math.min(100, mem ?? 0))}%` } }) })] }), _jsxs("div", { className: "p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700", children: [_jsx("div", { className: "text-xs text-slate-500 mb-1", children: "Storage" }), _jsx("div", { className: "text-2xl font-bold", children: storage !== null ? `${storage.toFixed(1)}%` : '—' }), _jsx("div", { className: "mt-2 h-2 rounded bg-slate-2 00 dark:bg-slate-700", children: _jsx("div", { className: `h-2 rounded ${storage !== null ? (storage > 90 ? 'bg-red-500' : storage > 75 ? 'bg-yellow-500' : 'bg-green-500') : 'bg-slate-400'}`, style: { width: `${Math.max(0, Math.min(100, storage ?? 0))}%` } }) })] }), _jsxs("div", { className: "p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700", children: [_jsx("div", { className: "text-xs text-slate-500 mb-1", children: "Uptime" }), _jsx("div", { className: "text-xl font-semibold", children: uptime || '—' }), _jsxs("div", { className: "text-xs text-slate-500 mt-1", children: ["Target: ", env?.target || '—'] })] }), _jsxs("div", { className: "p-4 rounded-lg border bg-white dark:bg-slate-8 00 border-slate-200 dark:border-slate-700", children: [_jsx("div", { className: "text-xs text-slate-500 mb-1", children: "Active Users" }), _jsx("div", { className: "text-2xl font-bold", children: activeUsers !== null ? activeUsers : '—' })] }), _jsxs("div", { className: "p-4 rounded-lg border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700", children: [_jsx("div", { className: "text-xs text-slate-500 mb-1", children: "Requests / min" }), _jsx("div", { className: "text-2xl font-bold", children: rpm !== null ? rpm : '—' })] })] }), expanded && (_jsxs("div", { className: "mt-4", children: [_jsx("div", { className: "text-xs text-slate-500 mb-1", children: "Raw payload" }), _jsx("pre", { className: "ai-debug-box text-xs", children: JSON.stringify(env, null, 2) })] }))] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { api } from '@lib/api';
const AIActivityLog = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [note, setNote] = useState(null);
    const [waking, setWaking] = useState(false);
    const coerceNumber = (v) => {
        if (typeof v === 'number' && Number.isFinite(v))
            return v;
        if (typeof v === 'string') {
            const n = Number(v.trim());
            return Number.isFinite(n) ? n : null;
        }
        return null;
    };
    const normalize = (raw) => {
        const src = raw?.data && typeof raw.data === 'object' ? raw.data : raw;
        const autoPublished = coerceNumber(src?.autoPublished);
        const flagged = coerceNumber(src?.flagged);
        const suggestedHeadlines = coerceNumber(src?.suggestedHeadlines);
        let lastTrustUpdate = null;
        const ltu = src?.lastTrustUpdate;
        if (typeof ltu === 'string')
            lastTrustUpdate = ltu;
        else if (typeof ltu === 'number' && Number.isFinite(ltu)) {
            try {
                lastTrustUpdate = new Date(ltu).toISOString();
            }
            catch { }
        }
        if (autoPublished !== null &&
            flagged !== null &&
            suggestedHeadlines !== null &&
            typeof lastTrustUpdate === 'string') {
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
            const json = await api.aiActivityLog();
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
            if (!didCancel)
                setData(normalized);
        }
        catch (err) {
            const ax = err;
            const status = ax?.response?.status;
            const msg = (ax?.response?.data && (ax.response.data.message || ax.response.data.error)) || ax?.message || "Unknown error";
            if (didCancel)
                return;
            // If unauthorized, surface the error (interceptor will redirect to /auth in prod)
            if (status === 401) {
                setError(`ΓÜá∩╕Å Failed to load AI activity (unauthorized). ${msg}`);
            }
            else {
                // Soft-fail to empty placeholder for 404/5xx or network/shape issues
                setData({ autoPublished: 0, flagged: 0, suggestedHeadlines: 0, lastTrustUpdate: new Date(0).toISOString() });
                setNote('AI Activity endpoint did not return expected data. Showing an empty placeholder.');
            }
        }
        finally {
            if (!didCancel)
                setLoading(false);
        }
        return () => { didCancel = true; };
    }, []);
    const wakeAndRetry = useCallback(async () => {
        try {
            setWaking(true);
            // Hit serverless health to wake upstream backend (Render may be sleeping)
            await fetch('/api/system/health', { credentials: 'include' });
        }
        catch {
            // ignore; we'll still retry
        }
        finally {
            setWaking(false);
            fetchData();
        }
    }, [fetchData]);
    useEffect(() => {
        let cleanup;
        (async () => { cleanup = await fetchData(); })();
        return () => { if (typeof cleanup === 'function')
            cleanup(); };
    }, [fetchData]);
    return (_jsxs("section", { className: "p-5 md:p-6 bg-purple-50 dark:bg-purple-900/10 border border-purple-300 dark:border-purple-700 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto", children: [_jsx("p", { className: "text-green-600 dark:text-green-400 font-mono text-sm mb-2", children: "\u2705 AIActivityLog Loaded" }), _jsx("h2", { className: "text-xl font-bold text-purple-700 dark:text-purple-300 mb-3", children: "\uD83E\uDDE0 AI Activity Log" }), loading ? (_jsx("div", { className: "text-sm text-slate-500 dark:text-slate-400", children: "\u23F3 Loading real AI activity data..." })) : error ? (_jsxs("div", { className: "text-sm text-red-500 space-y-3", children: [_jsx("div", { children: error }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { className: "px-3 py-1.5 rounded-md bg-purple-600 text-white disabled:opacity-60", onClick: wakeAndRetry, disabled: waking, children: waking ? 'WakingΓÇª' : 'Wake backend then retry' }), _jsx("button", { className: "px-3 py-1.5 rounded-md border border-purple-400 text-purple-700 dark:text-purple-300", onClick: fetchData, disabled: loading, children: "Retry" })] }), _jsxs("div", { className: "text-xs text-slate-500 dark:text-slate-400", children: ["Tip: Ensure you are logged in via ", _jsx("a", { className: "underline", href: "/auth", children: "/auth" }), " and that the proxy ", _jsx("code", { children: "/admin-api" }), " can reach your backend. Quick check: ", _jsx("a", { className: "underline", href: "/admin-api/system/status", target: "_blank", rel: "noreferrer", children: "/admin-api/system/status" })] })] })) : data ? (_jsxs("ul", { className: "text-sm space-y-2 text-slate-700 dark:text-slate-200 list-disc list-inside ml-2", children: [_jsxs("li", { children: [_jsx("strong", { children: "Auto-published:" }), " ", data.autoPublished.toLocaleString(), " stories today"] }), _jsxs("li", { children: [_jsx("strong", { children: "Flagged:" }), " ", data.flagged.toLocaleString(), " articles for review"] }), _jsxs("li", { children: [_jsx("strong", { children: "Suggestions:" }), " ", data.suggestedHeadlines.toLocaleString(), " trending headlines"] }), _jsxs("li", { children: [_jsx("strong", { children: "Last Trust Update:" }), " ", data.lastTrustUpdate] }), note && (_jsx("li", { className: "list-none text-xs italic text-slate-500 dark:text-slate-400 mt-1", children: note }))] })) : (_jsxs("div", { className: "text-sm text-gray-400 dark:text-gray-500", children: ["No activity data available yet.", note && (_jsx("div", { className: "text-xs italic text-slate-500 dark:text-slate-400 mt-1", children: note }))] }))] }));
};
export default AIActivityLog;

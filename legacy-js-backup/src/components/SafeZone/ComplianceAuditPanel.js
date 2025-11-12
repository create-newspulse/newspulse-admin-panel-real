import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { FaCheckCircle, FaExclamationCircle, FaSyncAlt, FaBug, FaDownload, FaBell } from 'react-icons/fa';
const BugReportAnalyzer = () => {
    const [logs, setLogs] = useState([]);
    const [error, setError] = useState(false);
    const [showHighAlert, setShowHighAlert] = useState(false);
    // Hide high severity alert automatically
    useEffect(() => {
        let timer;
        if (showHighAlert) {
            timer = setTimeout(() => setShowHighAlert(false), 5000);
        }
        return () => {
            if (timer)
                clearTimeout(timer);
        };
    }, [showHighAlert]);
    const fetchLogs = async () => {
        try {
            const data = await fetchJson(`${API_BASE_PATH}/system/bug-reports`);
            if (Array.isArray(data.logs)) {
                setLogs(data.logs);
                setError(false);
                const hasHighSeverity = data.logs.some((log) => log.severity === 'high');
                setShowHighAlert(hasHighSeverity);
            }
            else {
                throw new Error('Invalid data format');
            }
        }
        catch (err) {
            console.error('Γ¥î Bug Report Fetch Error:', err);
            setError(true);
            setShowHighAlert(false);
        }
    };
    useEffect(() => {
        fetchLogs();
        const interval = setInterval(fetchLogs, 300000); // 5 min
        return () => clearInterval(interval);
    }, []);
    const exportLogs = () => {
        const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'bug-reports.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100); // clean up
    };
    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'high': return 'text-red-600';
            case 'medium': return 'text-yellow-500';
            case 'low': return 'text-green-500';
            default: return 'text-slate-500';
        }
    };
    return (_jsxs("section", { className: "p-5 md:p-6 bg-red-50 dark:bg-red-900/10 border border-red-400/30 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto relative", children: [showHighAlert && (_jsxs("div", { className: "fixed bottom-6 right-6 bg-red-600 text-white px-5 py-3 rounded shadow-lg animate-bounce z-50 flex items-center gap-2", children: [_jsx(FaExclamationCircle, { className: "text-2xl" }), _jsx("span", { className: "font-semibold", children: "\u26A0\uFE0F High-severity bugs detected!" })] })), _jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("div", { className: "flex items-center gap-2", children: error ? (_jsxs(_Fragment, { children: [_jsx(FaExclamationCircle, { className: "text-red-500" }), _jsx("p", { className: "font-mono text-sm text-red-600", children: "\u274C BugReportAnalyzer Failed" })] })) : (_jsxs(_Fragment, { children: [_jsx(FaCheckCircle, { className: "text-green-500" }), _jsx("p", { className: "font-mono text-sm text-green-600 dark:text-green-400", children: "\u2705 BugReportAnalyzer Loaded" })] })) }), _jsxs("div", { className: "flex gap-3", children: [_jsx("button", { onClick: fetchLogs, title: "Refresh Logs", className: "text-sm text-slate-500 dark:text-slate-300 hover:text-blue-500", children: _jsx(FaSyncAlt, {}) }), _jsx("button", { onClick: exportLogs, title: "Export Logs", className: "text-sm text-slate-500 dark:text-slate-300 hover:text-green-500", children: _jsx(FaDownload, {}) })] })] }), _jsx("h2", { className: "text-xl font-bold text-red-600 dark:text-red-400 mb-2", children: "\uD83D\uDC1E Bug Report Analyzer" }), _jsxs("div", { className: "space-y-3 text-sm md:text-base text-slate-700 dark:text-slate-200", children: [_jsx("p", { children: "This module scans logs and helps flag bugs in system operations and AI workflows." }), _jsxs("ul", { className: "list-disc list-inside ml-3 space-y-1", children: [_jsx("li", { children: "Track backend/server-side errors" }), _jsx("li", { children: "Analyze frontend/UI crashes and warnings" }), _jsx("li", { children: "Generate automatic debug summaries for quick fixes" }), _jsx("li", { children: "Trigger critical alerts to admins via dashboard popup" })] }), logs.length > 0 ? (_jsxs("div", { className: "mt-4", children: [_jsx("h3", { className: "text-sm font-semibold mb-2 text-red-700 dark:text-red-300", children: "\u26A0\uFE0F Detected Bugs" }), _jsx("ul", { className: "text-xs space-y-2", children: logs.map((log, idx) => (_jsxs("li", { className: "bg-white dark:bg-slate-800 p-3 rounded border border-red-300 dark:border-red-600", children: [_jsxs("div", { className: "flex justify-between items-center mb-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("p", { className: `text-sm font-medium ${getSeverityColor(log.severity)}`, children: [_jsx(FaBug, { className: "inline mr-1" }), log.type] }), log.severity && _jsxs("span", { className: "text-xs", children: ["\u2022 ", log.severity.toUpperCase(), " severity"] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [log.autoFixed && _jsx("span", { className: "text-green-500 text-xs", children: "\uD83D\uDD27 Auto-fixed" }), log.severity === 'high' && _jsx(FaBell, { className: "text-red-500 animate-ping-slow", title: "Admin Alert Triggered" })] })] }), _jsx("p", { className: "text-slate-600 dark:text-slate-300", children: log.message }), log.aiSummary && (_jsxs("p", { className: "text-blue-500 dark:text-blue-300 mt-1", children: ["\uD83E\uDDE0 Summary: ", log.aiSummary] })), _jsxs("p", { className: "text-slate-400 dark:text-slate-500 text-xs", children: ["\uD83D\uDD52 ", new Date(log.timestamp).toLocaleString()] })] }, idx))) })] })) : (!error && (_jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400 mt-4", children: "\u2705 No critical bugs found in the current session." }))), _jsx("div", { className: "mt-6 text-xs text-slate-500 dark:text-slate-400 italic", children: "\uD83E\uDDE0 AI-powered debugging, severity scoring, and real-time dashboard alerts are now active." })] })] }));
};
export default BugReportAnalyzer;

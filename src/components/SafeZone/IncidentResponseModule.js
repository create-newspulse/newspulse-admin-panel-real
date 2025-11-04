import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { FaClock, FaLink, FaRobot, FaBell } from 'react-icons/fa';
const IncidentResponseModule = () => {
    const [incidents, setIncidents] = useState([]);
    const [lastSync, setLastSync] = useState(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const fetchIncidents = async () => {
            try {
                const data = await fetchJson(`${API_BASE_PATH}/system/incidents`, {
                    timeoutMs: 15000,
                });
                setIncidents(data.incidents || []);
                setLastSync(data.lastSync || null);
                setLoading(false);
                const errorLogs = (data.incidents || []).filter((log) => log.level === 'ERROR');
                if (errorLogs.length > 0) {
                    console.warn('🚨 Critical Error Detected:', errorLogs[0].message);
                }
            }
            catch (err) {
                console.error('❌ Failed to fetch incidents:', err);
                setLoading(false);
            }
        };
        fetchIncidents(); // initial load
        const interval = setInterval(fetchIncidents, 30000); // auto-refresh every 30s
        return () => clearInterval(interval); // cleanup
    }, []);
    const downloadJSON = () => {
        const blob = new Blob([JSON.stringify(incidents, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'incident-log.json';
        a.click();
    };
    const downloadCSV = () => {
        const header = 'Timestamp,Level,Source,Message\n';
        const rows = incidents
            .map((log) => `"${new Date(log.timestamp).toLocaleString()}","${log.level}","${log.source}","${log.message.replace(/"/g, '""')}"`)
            .join('\n');
        const blob = new Blob([header + rows], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'incident-log.csv';
        a.click();
    };
    return (_jsxs("section", { className: "p-5 md:p-6 bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-600 rounded-2xl shadow max-h-[90vh] overflow-y-auto", children: [_jsx("div", { className: "mb-3 flex items-center gap-2 text-green-600 font-mono text-sm", children: "\u2705 IncidentResponseModule Loaded" }), _jsx("h2", { className: "text-xl font-bold text-red-700 dark:text-red-400 mb-2", children: "\uD83D\uDEA8 Incident Response Module" }), _jsx("p", { className: "text-sm text-slate-700 dark:text-slate-200 mb-3", children: "This security module monitors, logs, and responds to live system incidents including backend failures, unauthorized actions, and AI malfunctions." }), _jsxs("ul", { className: "space-y-2 text-sm text-slate-800 dark:text-slate-100 mb-4", children: [_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FaRobot, { className: "text-pink-500" }), "Capture real-time error logs & crash snapshots"] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FaBell, { className: "text-red-500" }), "Auto-alerts to founder on breach-level activity"] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FaClock, { className: "text-blue-400" }), "Timestamped logs for all recovery & mitigation actions"] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FaLink, { className: "text-purple-500" }), "Integrates with Lockdown & Compliance Control Panels"] })] }), _jsx("div", { className: "text-xs text-slate-500 dark:text-slate-400 italic mb-3", children: "\uD83D\uDCCC Advanced forensic trace & rollback tools coming soon..." }), _jsxs("div", { className: "flex gap-3 mb-4", children: [_jsx("button", { onClick: downloadJSON, className: "text-xs px-3 py-1 bg-blue-100 dark:bg-blue-900 rounded hover:bg-blue-200 dark:hover:bg-blue-800", children: "\uD83D\uDCC4 Export JSON" }), _jsx("button", { onClick: downloadCSV, className: "text-xs px-3 py-1 bg-green-100 dark:bg-green-900 rounded hover:bg-green-200 dark:hover:bg-green-800", children: "\uD83D\uDCCA Export CSV" })] }), _jsxs("div", { className: "mt-4", children: [loading ? (_jsx("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: "\uD83D\uDD04 Loading incidents..." })) : incidents.length === 0 ? (_jsx("p", { className: "text-xs text-slate-400", children: "(No incidents logged yet)" })) : (_jsx("div", { className: "bg-white dark:bg-slate-900 border rounded p-3 text-xs font-mono max-h-[300px] overflow-y-auto", children: incidents.map((log, idx) => (_jsxs("div", { className: "mb-2", children: [_jsxs("span", { className: "text-slate-500 dark:text-slate-400", children: ["[", new Date(log.timestamp).toLocaleString(), "]"] }), ' ', _jsx("span", { className: `font-bold ${log.level === 'ERROR'
                                        ? 'text-red-500'
                                        : log.level === 'WARNING'
                                            ? 'text-yellow-500'
                                            : 'text-green-500'}`, children: log.level }), ' ', _jsxs("span", { className: "text-slate-700 dark:text-slate-200", children: ["(", log.source, ") \u2014 ", log.message] })] }, idx))) })), lastSync && (_jsxs("p", { className: "text-xs mt-3 text-slate-400 italic", children: ["\u23F1\uFE0F Last sync: ", new Date(lastSync).toLocaleString()] }))] })] }));
};
export default IncidentResponseModule;

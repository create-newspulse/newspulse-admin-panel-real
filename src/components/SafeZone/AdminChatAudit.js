import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from "react";
import { API_BASE_PATH } from '@lib/api';
import { FaComments, FaRobot, FaUserShield, FaCheckCircle, FaExclamationCircle, } from "react-icons/fa";
const AdminChatAudit = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        let isMounted = true; // To avoid state updates on unmounted component
        const fetchLogs = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await fetch(`${API_BASE_PATH}/admin-chat-audit`, { credentials: 'include' });
                const ct = res.headers.get('content-type') || '';
                if (!res.ok) {
                    const txt = await res.text().catch(() => '');
                    throw new Error(`HTTP ${res.status}. Body: ${txt.slice(0, 160)}`);
                }
                if (!/application\/json/i.test(ct)) {
                    const txt = await res.text().catch(() => '');
                    throw new Error(`Expected JSON, got ${ct}. Body: ${txt.slice(0, 160)}`);
                }
                const data = await res.json();
                // Check for both res.ok and data.logs is array
                if (data && Array.isArray(data.logs)) {
                    if (isMounted)
                        setLogs(data.logs);
                }
                else {
                    if (isMounted)
                        setError(data && data.message
                            ? data.message
                            : "No logs found or wrong API format");
                }
            }
            catch (err) {
                if (isMounted)
                    setError(err?.message || "Server error while fetching logs");
            }
            finally {
                if (isMounted)
                    setLoading(false);
            }
        };
        fetchLogs();
        return () => {
            isMounted = false;
        };
    }, []);
    return (_jsxs("div", { className: "p-5 md:p-6 bg-yellow-50 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded-2xl shadow max-h-[90vh] overflow-y-auto", children: [_jsxs("p", { className: "text-green-600 font-mono text-sm mb-2 flex items-center gap-2", children: [_jsx(FaCheckCircle, { className: "text-green-400" }), "\u2705 AdminChatAudit Panel Initialized"] }), _jsxs("h2", { className: "text-xl font-bold text-yellow-800 dark:text-yellow-200 mb-3 flex items-center gap-2", children: [_jsx(FaComments, {}), "Admin Chat Audit"] }), _jsx("p", { className: "text-sm text-slate-800 dark:text-slate-100 mb-2", children: "This panel monitors all system-level AI communications and logs any founder/admin interactions:" }), _jsxs("ul", { className: "list-disc list-inside ml-2 space-y-2 text-slate-800 dark:text-slate-100 text-sm", children: [_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FaRobot, { className: "text-blue-400" }), "AI system messages & smart command traces"] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FaUserShield, { className: "text-yellow-500" }), "Admin or moderator-triggered actions"] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FaExclamationCircle, { className: "text-red-500" }), "Success, warning, or error logs from AI modules"] })] }), _jsx("div", { className: "mt-5", children: loading ? (_jsx("div", { className: "text-sm text-center text-slate-500 dark:text-slate-400", children: "\uD83D\uDD04 Loading logs..." })) : error ? (_jsx("div", { className: "text-sm text-center text-red-600", children: error })) : logs.length === 0 ? (_jsx("div", { className: "text-sm text-center text-slate-500", children: "(No logs yet)" })) : (_jsx("div", { className: "mt-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-3 max-h-[50vh] overflow-y-auto text-sm font-mono text-slate-700 dark:text-slate-200", children: logs.map((log, idx) => (_jsxs("div", { className: "mb-2", children: [_jsxs("span", { className: "text-green-600", children: ["[", new Date(log.timestamp).toLocaleString(), "]"] }), " ", _jsx("span", { className: `font-bold ${log.type === "AI"
                                    ? "text-blue-600"
                                    : log.type === "ADMIN"
                                        ? "text-yellow-600"
                                        : "text-red-600"}`, children: log.type }), " ", "\u2014 ", _jsx("span", { children: log.message }), log.origin ? (_jsxs("span", { className: "ml-2 text-xs text-slate-500", children: ["(", log.origin, ")"] })) : null] }, idx))) })) })] }));
};
export default AdminChatAudit;

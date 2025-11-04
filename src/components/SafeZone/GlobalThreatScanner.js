import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 📁 src/components/SafeZone/GlobalThreatScanner.tsx
import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { FaShieldAlt, FaLock, FaGlobe, FaCheckCircle, FaSyncAlt } from 'react-icons/fa';
const getStatusBadge = (condition, label) => (_jsx("span", { className: `text-xs px-2 py-0.5 rounded-full font-semibold ${condition
        ? 'bg-red-100 text-red-700 dark:bg-red-800/30 dark:text-red-300'
        : 'bg-green-100 text-green-700 dark:bg-green-800/30 dark:text-green-300'}`, children: condition ? `⚠️ ${label}` : `✅ Secure` }));
const GlobalThreatScanner = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastError, setLastError] = useState(null);
    const fetchThreatData = async () => {
        try {
            setLoading(true);
            setLastError(null);
            const json = await fetchJson(`${API_BASE_PATH}/system/threat-status`, {
                cache: 'no-store',
                timeoutMs: 15000,
            });
            if (typeof json.xssDetected === 'boolean' &&
                typeof json.credentialsLeaked === 'boolean' &&
                typeof json.ipReputationScore === 'number' &&
                typeof json.lastScan === 'string') {
                setData(json);
            }
            else {
                throw new Error('⚠️ Unexpected response format');
            }
        }
        catch (err) {
            console.error('[GlobalThreatScanner]', err);
            setLastError(err?.message || 'Unknown error');
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchThreatData(); // Initial fetch
        const interval = setInterval(fetchThreatData, 900000); // ⏱️ 15 min auto-refresh
        return () => clearInterval(interval);
    }, []);
    return (_jsxs("section", { className: "p-5 md:p-6 bg-fuchsia-50 dark:bg-fuchsia-950 border border-fuchsia-300 dark:border-fuchsia-700 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-3", children: [_jsxs("p", { className: "text-green-500 font-mono text-sm flex items-center gap-1", children: [_jsx(FaCheckCircle, {}), " GlobalThreatScanner Loaded"] }), _jsxs("button", { onClick: fetchThreatData, className: "text-xs text-fuchsia-600 dark:text-fuchsia-300 hover:underline flex items-center gap-1", children: [_jsx(FaSyncAlt, { className: "inline-block" }), " Refresh"] })] }), _jsx("h2", { className: "text-xl font-bold text-fuchsia-700 dark:text-fuchsia-300 mb-2 flex items-center gap-2", children: "\uD83C\uDF0D Global Threat Scanner" }), _jsx("p", { className: "text-sm text-slate-700 dark:text-slate-300 mb-4", children: "Monitors security risks globally and flags threat vectors across your platform." }), loading ? (_jsx("p", { className: "text-sm text-slate-500", children: "\u23F3 Scanning for vulnerabilities and IP risks..." })) : lastError ? (_jsxs("p", { className: "text-sm text-red-500 font-mono", children: ["\u274C ", lastError] })) : data ? (_jsxs("ul", { className: "space-y-3 text-sm text-slate-800 dark:text-slate-100", children: [_jsxs("li", { className: "flex items-center justify-between border-b pb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(FaShieldAlt, { className: "text-blue-500" }), "XSS Attempt Detection"] }), getStatusBadge(data.xssDetected, 'XSS Risk')] }), _jsxs("li", { className: "flex items-center justify-between border-b pb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(FaLock, { className: "text-orange-500" }), "Credential Breach Monitor"] }), getStatusBadge(data.credentialsLeaked, 'Leak Detected')] }), _jsxs("li", { className: "flex items-center justify-between border-b pb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(FaGlobe, { className: "text-cyan-600" }), "IP Reputation Score"] }), _jsxs("span", { className: `text-xs font-semibold ${data.ipReputationScore < 50
                                    ? 'text-red-600'
                                    : data.ipReputationScore < 80
                                        ? 'text-yellow-600'
                                        : 'text-green-600'}`, children: [data.ipReputationScore, "/100"] })] }), _jsxs("li", { className: "text-xs text-slate-500 dark:text-slate-400 italic mt-2", children: ["Last Scan:", ' ', data.lastScan
                                ? new Date(data.lastScan).toLocaleString()
                                : 'Unavailable'] })] })) : (_jsx("p", { className: "text-sm text-slate-500", children: "No data available." })), _jsx("div", { className: "mt-5 text-xs text-slate-500 dark:text-slate-400 italic", children: "\uD83E\uDDE0 AI-integrated healing logic and threat automation in development." })] }));
};
export default GlobalThreatScanner;

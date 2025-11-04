import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 📁 frontend/components/SafeZone/ThreatDashboard.tsx
import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { FaShieldAlt, FaBug, FaRobot, FaHistory, FaCheck, FaTimes, FaDownload } from 'react-icons/fa';
const ThreatDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const fetchStats = async () => {
        try {
            const json = await fetchJson(`${API_BASE_PATH}/dashboard/threat-stats`);
            if (json && json.success)
                setStats(json);
            else
                throw new Error('Invalid data structure');
        }
        catch (err) {
            console.error('❌ Failed to load threat stats:', err);
            setError(true);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchStats();
        // Optional Auto Refresh:
        // const interval = setInterval(fetchStats, 60000);
        // return () => clearInterval(interval);
    }, []);
    const exportLogs = () => {
        if (!stats)
            return;
        const blob = new Blob([JSON.stringify(stats.recentLogs, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `threat-logs-${Date.now()}.json`;
        link.click();
        URL.revokeObjectURL(url);
    };
    return (_jsxs("div", { className: "bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6", children: [_jsxs("h2", { className: "text-xl font-bold mb-4 flex items-center gap-2 text-blue-600 dark:text-blue-300", children: [_jsx(FaShieldAlt, {}), " Threat Intelligence Dashboard"] }), loading ? (_jsx("p", { className: "text-gray-500", children: "Loading threat stats..." })) : error || !stats ? (_jsx("p", { className: "text-red-600", children: "\u274C Failed to load threat data" })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-4 mb-6", children: [_jsx(ColorCard, { color: "bg-blue-100 dark:bg-blue-900/30", icon: _jsx(FaBug, { className: "text-2xl text-blue-600 mx-auto mb-2" }), label: "Total Scans", value: stats.totalScans }), _jsx(ColorCard, { color: "bg-yellow-100 dark:bg-yellow-900/30", icon: _jsx(FaRobot, { className: "text-2xl text-yellow-600 mx-auto mb-2" }), label: "Flagged Threats", value: stats.flaggedScans }), _jsx(ColorCard, { color: "bg-red-100 dark:bg-red-900/30", icon: _jsx(FaHistory, { className: "text-2xl text-red-600 mx-auto mb-2" }), label: "Auto-Triggered", value: stats.autoTriggered })] }), _jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("h3", { className: "text-md font-semibold text-gray-600 dark:text-gray-300", children: "\uD83D\uDD75\uFE0F Recent Logs:" }), _jsxs("button", { onClick: exportLogs, className: "text-blue-600 text-xs flex items-center gap-1 hover:underline", children: [_jsx(FaDownload, {}), " Export Logs"] })] }), _jsx("ul", { className: "text-sm text-gray-700 dark:text-gray-300 space-y-2 max-h-60 overflow-y-auto pr-2", children: stats.recentLogs.map((log, idx) => (_jsxs("li", { className: "border-b border-gray-200 dark:border-gray-700 pb-2", children: [_jsx("div", { className: "flex justify-between items-center", children: _jsxs("div", { children: [_jsx("strong", { children: "Score:" }), ' ', _jsx("span", { className: log.ipReputationScore < 50 ? 'text-red-500' : 'text-green-600', children: log.ipReputationScore }), ' ', _jsx(RiskBadge, { score: log.ipReputationScore }), ' | ', _jsx("strong", { children: "Leaked:" }), ' ', log.credentialsLeaked ? (_jsxs("span", { className: "text-red-600 inline-flex items-center", children: [_jsx(FaTimes, { className: "mr-1" }), "Yes"] })) : (_jsxs("span", { className: "text-green-600 inline-flex items-center", children: [_jsx(FaCheck, { className: "mr-1" }), "No"] })), ' | ', _jsx("strong", { children: "From:" }), " ", log.origin] }) }), _jsx("div", { className: "text-xs text-gray-500 dark:text-gray-400 mt-1", children: new Date(log.createdAt).toLocaleString() })] }, idx))) })] }))] }));
};
// 🔷 Colored Summary Card
const ColorCard = ({ color, icon, label, value, }) => (_jsxs("div", { className: `${color} p-4 rounded shadow text-center`, children: [icon, _jsx("p", { className: "text-sm", children: label }), _jsx("p", { className: "text-xl font-bold", children: value })] }));
// 🧠 Score Risk Badge
const RiskBadge = ({ score }) => {
    let label = 'Low';
    let style = 'bg-green-100 text-green-700';
    if (score < 50) {
        label = 'High';
        style = 'bg-red-100 text-red-700';
    }
    else if (score < 80) {
        label = 'Medium';
        style = 'bg-yellow-100 text-yellow-700';
    }
    return (_jsx("span", { className: `ml-2 px-2 py-0.5 text-xs rounded-full font-semibold ${style}`, children: label }));
};
export default ThreatDashboard;

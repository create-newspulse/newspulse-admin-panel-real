import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import apiClient from '@lib/api';
import { FaHeartbeat, FaCogs, FaSyncAlt, FaBug, FaTools, FaSatelliteDish, FaExclamationTriangle, } from 'react-icons/fa';
export default function AIDiagnostics() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    // Fetch diagnostics from backend
    const fetchDiagnostics = async () => {
        setLoading(true);
        setError(false);
        try {
            const res = await apiClient.get('/system/ai-diagnostics');
            const data = res?.data ?? res;
            setData(data);
        }
        catch (err) {
            console.error('Γ¥î Failed to load diagnostics:', err);
            setError(true);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchDiagnostics();
        // eslint-disable-next-line
    }, []);
    // Status badge coloring
    const StatusBadge = ({ status }) => {
        const statusColor = status === 'Operational'
            ? 'bg-green-600'
            : status === 'Degraded'
                ? 'bg-yellow-600'
                : 'bg-red-600';
        return (_jsx("span", { className: `px-3 py-1 rounded-full text-white text-xs ${statusColor}`, children: status }));
    };
    return (_jsxs("div", { className: "ai-diagnostics futuristic-glow border border-blue-700 dark:border-purple-400 p-6 rounded-xl shadow-lg bg-gradient-to-br from-black via-gray-900 to-gray-800 text-white", children: [_jsxs("h2", { className: "text-xl font-bold flex items-center gap-2 mb-4 text-blue-400 animate-pulse", children: [_jsx(FaSatelliteDish, { className: "text-purple-400" }), "AI Diagnostics Panel"] }), loading ? (_jsx("p", { className: "text-yellow-400 animate-pulse", children: "\u23F3 Booting diagnostic engines..." })) : error ? (_jsx("p", { className: "text-red-400", children: "\u274C Connection error. Unable to fetch diagnostics." })) : data ? (_jsxs("div", { className: "space-y-3", children: [_jsxs("p", { children: [_jsx(FaHeartbeat, { className: "inline mr-1 text-green-400" }), _jsx("strong", { children: "Status:" }), " ", _jsx(StatusBadge, { status: data.status })] }), _jsxs("p", { children: [_jsx(FaCogs, { className: "inline mr-1 text-blue-300" }), _jsx("strong", { children: "Active Modules:" }), ' ', _jsx("span", { className: "text-sm italic text-blue-200", children: (data.modules || []).join(', ') || 'None' })] }), _jsxs("p", { children: [_jsx(FaTools, { className: "inline mr-1 text-gray-300" }), _jsx("strong", { children: "Last Check:" }), ' ', _jsx("span", { className: "text-sm text-gray-300", children: data.lastCheck ? new Date(data.lastCheck).toLocaleString() : 'ΓÇö' })] }), !!data.warnings?.length && (_jsxs("div", { className: "bg-yellow-900 bg-opacity-20 border border-yellow-500 text-yellow-300 p-3 rounded-md", children: [_jsx(FaExclamationTriangle, { className: "inline mr-1" }), _jsx("strong", { children: "Warnings:" }), _jsx("ul", { className: "mt-1 list-disc list-inside text-sm", children: data.warnings.map((warning, i) => (_jsx("li", { children: warning }, i))) })] })), !!data.errors?.length && (_jsxs("div", { className: "bg-red-900 bg-opacity-20 border border-red-500 text-red-300 p-3 rounded-md", children: [_jsx(FaBug, { className: "inline mr-1" }), _jsx("strong", { children: "Errors:" }), _jsx("ul", { className: "mt-1 list-disc list-inside text-sm", children: data.errors.map((err, i) => (_jsx("li", { children: err }, i))) })] }))] })) : (_jsx("p", { className: "text-gray-400", children: "\u2139\uFE0F No diagnostics available." })), _jsx("div", { className: "mt-6", children: _jsxs("button", { onClick: fetchDiagnostics, disabled: loading, className: `bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 transition-all duration-300 px-5 py-2 rounded-full shadow-lg flex items-center gap-2 text-white font-semibold ${loading ? 'opacity-60 cursor-not-allowed' : ''}`, children: [_jsx(FaSyncAlt, { className: loading ? 'animate-spin-slow' : '' }), " Refresh Panel"] }) })] }));
}

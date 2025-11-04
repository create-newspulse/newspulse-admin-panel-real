import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { FaIdCard, FaTools, FaBrain, FaFileExport } from 'react-icons/fa';
const SystemVersionControl = () => {
    const [data, setData] = useState(null);
    useEffect(() => {
        fetchJson(`${API_BASE_PATH}/system/version-log`)
            .then(setData)
            .catch((err) => {
            console.error('❌ Failed to fetch version log:', err);
        });
    }, []);
    return (_jsxs("section", { className: "p-5 md:p-6 bg-sky-50 dark:bg-sky-900/10 border border-sky-300 dark:border-sky-700 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto", children: [_jsx("p", { className: "text-green-600 dark:text-green-400 font-mono text-sm mb-2", children: "\u2705 SystemVersionControl Loaded" }), _jsx("h2", { className: "text-xl font-bold text-sky-700 dark:text-sky-300 mb-2", children: "\uD83E\uDDFE System Version Control" }), _jsx("p", { className: "text-sm text-slate-700 dark:text-slate-200 mb-3", children: "This module tracks all system-level updates, deployment logs, rollback history, and patch versions for audit and recovery purposes." }), data?.updates?.length ? (_jsx("ul", { className: "space-y-3 mb-5 text-sm text-slate-800 dark:text-slate-100", children: data.updates.map((entry) => (_jsxs("li", { className: "bg-white dark:bg-slate-800 border-l-4 border-sky-400 pl-3 py-2 rounded shadow-sm", children: [_jsxs("p", { className: "flex items-center gap-2 font-semibold text-sky-700 dark:text-sky-300", children: [_jsx(FaIdCard, {}), " ", entry.id] }), _jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400", children: ["\uD83D\uDD52 ", new Date(entry.timestamp).toLocaleString()] }), _jsx("p", { className: "text-sm mt-1", children: entry.notes })] }, entry.id))) })) : (_jsx("p", { className: "text-sm text-slate-500", children: "\u23F3 Loading version history..." })), _jsxs("ul", { className: "mt-4 space-y-2 text-sm md:text-base text-slate-800 dark:text-slate-100", children: [_jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FaIdCard, { className: "text-indigo-500" }), " Log every deployment ID and timestamp"] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FaTools, { className: "text-amber-500" }), " Maintain rollback points for each patch"] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FaBrain, { className: "text-pink-500" }), " Version notes for AI engine & backend logic"] }), _jsxs("li", { className: "flex items-center gap-2", children: [_jsx(FaFileExport, { className: "text-green-500" }), " Export full version history as CSV or JSON"] })] }), _jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-4", children: ["Last sync:", ' ', data?.lastSync
                        ? new Date(data.lastSync).toLocaleString()
                        : 'Loading...', " \u2014 more controls coming soon\u2026"] })] }));
};
export default SystemVersionControl;

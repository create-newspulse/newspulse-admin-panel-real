import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import api, { default as apiClient } from '../lib/api';
import { useLockdownCheck } from '@hooks/useLockdownCheck';
export default function PushHistory() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState({ lockdown: false });
    useEffect(() => {
        apiClient
            .get('/settings/load')
            .then((res) => setSettings((res?.data ?? res) || { lockdown: false }))
            .catch(() => setSettings({ lockdown: false }));
    }, []);
    useLockdownCheck(settings);
    const fetchHistory = async () => {
        try {
            const res = await api.get('/alerts/history');
            const data = res?.data ?? res;
            setEntries(data.data);
        }
        catch {
            alert('Γ¥î Failed to fetch push history');
        }
        finally {
            setLoading(false);
        }
    };
    const deleteAll = async () => {
        if (!window.confirm('Are you sure you want to delete all history?'))
            return;
        try {
            await api.delete('/alerts/history');
            alert('≡ƒùæ∩╕Å Deleted!');
            fetchHistory();
        }
        catch {
            alert('Γ¥î Delete failed');
        }
    };
    useEffect(() => {
        fetchHistory();
    }, []);
    if (settings.lockdown) {
        return (_jsx("div", { className: "p-6 text-center text-red-600 dark:text-red-400", children: "\uD83D\uDD12 Push history access is disabled in lockdown mode." }));
    }
    return (_jsxs("div", { className: "p-6 max-w-6xl mx-auto", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-2xl font-bold text-slate-800 dark:text-white", children: [_jsx("span", { children: "\uD83D\uDD14" }), _jsx("h2", { children: "Push History" })] }), _jsx("button", { onClick: deleteAll, className: "bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded shadow-sm text-sm", children: "\uD83D\uDDD1\uFE0F Delete All" })] }), loading ? (_jsx("p", { className: "text-sm text-slate-500 dark:text-slate-300", children: "Loading..." })) : entries.length === 0 ? (_jsx("div", { className: "text-center py-20 text-slate-500 dark:text-slate-300", children: _jsxs("p", { className: "text-xl flex items-center justify-center gap-2", children: ["\uD83D\uDCED ", _jsx("span", { children: "No push history found." })] }) })) : (_jsx("div", { className: "bg-white dark:bg-slate-800 shadow rounded-xl p-4 overflow-x-auto", children: _jsxs("table", { className: "min-w-full text-sm text-slate-700 dark:text-slate-200", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-slate-300 dark:border-slate-600 text-left text-xs uppercase text-slate-500 dark:text-slate-400", children: [_jsx("th", { className: "px-3 py-2", children: "Title" }), _jsx("th", { className: "px-3 py-2", children: "Category" }), _jsx("th", { className: "px-3 py-2", children: "Score" }), _jsx("th", { className: "px-3 py-2", children: "Type" }), _jsx("th", { className: "px-3 py-2", children: "Time" })] }) }), _jsx("tbody", { children: entries.map((entry) => (_jsxs("tr", { className: "border-t border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30", children: [_jsx("td", { className: "px-3 py-2", children: entry.title }), _jsx("td", { className: "px-3 py-2", children: entry.category }), _jsx("td", { className: "px-3 py-2", children: entry.score }), _jsx("td", { className: "px-3 py-2", children: entry.type }), _jsx("td", { className: "px-3 py-2", children: new Date(entry.triggeredAt).toLocaleString() })] }, entry._id))) })] }) }))] }));
}

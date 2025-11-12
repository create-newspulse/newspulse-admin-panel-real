import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
const AdminAiLogs = () => {
    const [logs, setLogs] = useState([]);
    const [filteredLogs, setFilteredLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    // const { user } = useAuth();
    // if (user?.role !== 'admin' && user?.role !== 'founder') {
    //   return <p className="text-red-500 p-4">≡ƒöÆ Access Denied</p>;
    // }
    const fetchLogs = () => {
        setLoading(true);
        fetch(`${API_BASE_PATH}/ai/logs/all`, { credentials: 'include' })
            .then(async (res) => {
            const ct = res.headers.get('content-type') || '';
            if (!res.ok || !ct.includes('application/json')) {
                const txt = await res.text().catch(() => '');
                throw new Error(`Expected JSON, got "${ct}". Body: ${txt.slice(0, 160)}`);
            }
            return res.json();
        })
            .then(data => {
            setLogs(data.logs || []);
            setFilteredLogs(data.logs || []);
            setLoading(false);
        })
            .catch(() => setLoading(false));
    };
    useEffect(() => {
        fetchLogs();
    }, []);
    const handleSearch = (value) => {
        setSearch(value);
        const query = value.toLowerCase();
        const results = logs.filter((log) => log.taskType.toLowerCase().includes(query) ||
            log.language.toLowerCase().includes(query) ||
            log.engine.toLowerCase().includes(query));
        setFilteredLogs(results);
    };
    const exportToCSV = () => {
        const csvHeader = 'Task,Language,Engine,Input,Output,Timestamp\n';
        const csvRows = filteredLogs
            .map((log) => [
            log.taskType,
            log.language,
            log.engine,
            `"${log.input.replace(/"/g, '""')}"`,
            `"${log.output.replace(/"/g, '""')}"`,
            new Date(log.timestamp).toLocaleString(),
        ].join(','))
            .join('\n');
        const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `AI_Logs_${Date.now()}.csv`;
        link.click();
    };
    return (_jsxs("div", { className: "p-6 max-w-6xl mx-auto", children: [_jsxs("div", { className: "flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6", children: [_jsx("h1", { className: "text-2xl font-bold text-blue-700", children: "\uD83E\uDDE0 AI Logs Viewer" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("input", { type: "text", placeholder: "Search by task, lang, engine...", className: "border p-2 rounded w-full md:w-72 text-sm", value: search, onChange: (e) => handleSearch(e.target.value) }), _jsx("button", { onClick: exportToCSV, className: "bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-sm", children: "\uD83D\uDCE4 Export CSV" }), _jsx("button", { onClick: fetchLogs, className: "bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded text-sm", children: "\uD83D\uDD04 Refresh" })] })] }), loading ? (_jsx("p", { className: "text-sm text-gray-500", children: "Loading logs..." })) : filteredLogs.length === 0 ? (_jsx("p", { className: "text-gray-600", children: "No logs found." })) : (_jsx("div", { className: "space-y-6", children: filteredLogs.map((log) => (_jsxs("div", { className: "border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition", children: [_jsxs("div", { className: "text-xs text-gray-500 mb-2", children: ["\uD83D\uDCC5 ", new Date(log.timestamp).toLocaleString(), " | \uD83D\uDEE0 ", log.taskType, " | \uD83D\uDDE3 ", log.language, " | \u2699\uFE0F ", log.engine] }), _jsxs("div", { className: "mb-3", children: [_jsx("label", { className: "block text-sm font-semibold mb-1", children: "Input:" }), _jsx("pre", { className: "bg-gray-100 text-xs p-2 rounded whitespace-pre-wrap", children: log.input })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-semibold mb-1", children: "Output:" }), _jsx("pre", { className: "bg-blue-50 text-xs p-2 rounded whitespace-pre-wrap", children: log.output })] })] }, log._id))) }))] }));
};
export default AdminAiLogs;

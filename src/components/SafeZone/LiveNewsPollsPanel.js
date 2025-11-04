import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api, API_BASE_PATH } from '@lib/api';
import { useNotification } from '@context/NotificationContext';
import { FaPoll, FaDownload, FaToggleOn, FaChevronDown, FaChevronUp, } from 'react-icons/fa';
const LiveNewsPollsPanel = () => {
    const notify = useNotification();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [votingEnabled, setVotingEnabled] = useState(true);
    const [isExpanded, setIsExpanded] = useState(true);
    const [isExporting, setIsExporting] = useState(false);
    const fetchStats = async () => {
        try {
            const json = await api.pollsLiveStats();
            if (json.success)
                setStats(json.data);
            else
                throw new Error('Invalid response');
        }
        catch (err) {
            console.error('Poll fetch error:', err);
            setStats(null);
        }
        finally {
            setLoading(false);
        }
    };
    const exportPDF = async () => {
        try {
            setIsExporting(true);
            const res = await fetch(`${API_BASE_PATH}/polls/export-pdf`, { method: 'POST', credentials: 'include' });
            if (!res.ok)
                throw new Error(`HTTP ${res.status} ${res.statusText}`);
            const ct = res.headers.get('content-type') || '';
            if (!/application\/(pdf|octet-stream)/i.test(ct)) {
                const txt = await res.text().catch(() => '');
                throw new Error(`Unexpected content-type: ${ct}. Preview: ${txt.slice(0, 200)}`);
            }
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `poll-report-${Date.now()}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            notify.success('📊 Poll report exported');
        }
        catch (err) {
            notify.error('❌ Failed to export poll report');
        }
        finally {
            setIsExporting(false);
        }
    };
    useEffect(() => {
        fetchStats();
    }, []);
    return (_jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-xl shadow text-slate-700 dark:text-slate-200 border-l-4 border-pink-500 mt-4", children: [_jsxs("div", { className: "flex justify-between items-center cursor-pointer", onClick: () => setIsExpanded((prev) => !prev), children: [_jsxs("h2", { className: "text-lg font-bold text-pink-600 flex gap-2 items-center", children: [_jsx(FaPoll, {}), " Live News Polls"] }), isExpanded ? (_jsx(FaChevronUp, { className: "text-pink-400" })) : (_jsx(FaChevronDown, { className: "text-pink-400" }))] }), isExpanded && (_jsxs("div", { className: "mt-3 space-y-3 text-sm", children: [loading ? (_jsx("p", { className: "text-slate-500", children: "Loading poll stats..." })) : stats ? (_jsxs("ul", { className: "space-y-1", children: [_jsxs("li", { children: ["\uD83D\uDCCC Total Active Polls: ", _jsx("strong", { children: stats.totalPolls })] }), _jsxs("li", { children: ["\uD83D\uDDF3\uFE0F Total Votes Cast: ", _jsx("strong", { children: stats.totalVotes })] }), _jsxs("li", { children: ["\uD83D\uDD25 Most Voted Poll:", ' ', _jsx("strong", { children: stats.topPoll?.question }), " (", stats.topPoll?.total, ' ', "votes)"] })] })) : (_jsx("p", { className: "text-red-500", children: "\u274C Failed to load stats" })), _jsxs("div", { className: "flex flex-wrap items-center gap-4", children: [_jsxs("button", { onClick: exportPDF, disabled: isExporting, className: `bg-pink-600 text-white px-4 py-1.5 rounded hover:bg-pink-700 text-sm flex items-center gap-2 ${isExporting ? 'opacity-50 cursor-not-allowed' : ''}`, children: [_jsx(FaDownload, {}), isExporting ? 'Exporting...' : 'Export PDF'] }), _jsxs("label", { className: "flex items-center gap-2 text-sm cursor-pointer", children: [_jsx(FaToggleOn, { className: "text-blue-600" }), _jsx("input", { type: "checkbox", checked: votingEnabled, onChange: () => setVotingEnabled(!votingEnabled), className: "accent-pink-600" }), "Allow New Voting"] })] })] }))] }));
};
export default LiveNewsPollsPanel;

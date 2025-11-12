import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { FaBrain, FaTrafficLight, FaMoneyBill, FaHeartbeat, FaTools, FaExclamationTriangle, FaLock, FaRedoAlt, FaChevronDown, FaChevronUp } from 'react-icons/fa';
export default function MissionControlSidebar({ onExportSettings, onBackupSite, onRestoreBackup, }) {
    const [expanded, setExpanded] = useState(null);
    const [syncStatus, setSyncStatus] = useState(null);
    const [lastCheck, setLastCheck] = useState("");
    useEffect(() => {
        fetchJson(`${API_BASE_PATH}/system/constitution-status`)
            .then((data) => {
            setSyncStatus(data.status === 'ok' ? 'ok' : 'fail');
            setLastCheck(new Date().toLocaleTimeString());
        })
            .catch(() => {
            setSyncStatus('fail');
            setLastCheck(new Date().toLocaleTimeString());
        });
    }, []);
    const toggleSection = (key) => {
        setExpanded(prev => (prev === key ? null : key));
    };
    const panels = [
        {
            id: 'ai',
            icon: _jsx(FaBrain, {}),
            title: 'AI Status',
            content: (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-green-300 text-sm mb-1", children: "Auto-Mode Active" }), _jsxs("ul", { className: "list-disc pl-5 text-xs space-y-0.5", children: [_jsxs("li", { children: ["Summarizer ", _jsx("span", { className: "text-green-400", children: "\u2705" })] }), _jsxs("li", { children: ["Fact Checker ", _jsx("span", { className: "text-green-400", children: "\u2705" })] }), _jsxs("li", { children: ["AI Voice ", _jsx("span", { className: "text-green-400", children: "\u2705" })] })] })] }))
        },
        {
            id: 'traffic',
            icon: _jsx(FaTrafficLight, {}),
            title: 'Traffic',
            content: (_jsxs(_Fragment, { children: [_jsxs("p", { className: "text-sm", children: ["\uD83D\uDFE2 ", _jsx("span", { className: "font-medium", children: "183" }), " live users"] }), _jsxs("p", { className: "text-xs text-muted", children: ["Top page: ", _jsx("strong", { children: "Youth Pulse Zone" })] })] }))
        },
        {
            id: 'revenue',
            icon: _jsx(FaMoneyBill, {}),
            title: "Today's Revenue",
            content: (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-yellow-300 text-sm font-semibold", children: "\u20B91,920.00" }), _jsx("p", { className: "text-xs text-muted", children: "AdSense + Affiliates" })] }))
        },
        {
            id: 'health',
            icon: _jsx(FaHeartbeat, {}),
            title: 'System Health',
            content: (_jsxs("ul", { className: "text-xs pl-4 list-disc", children: [_jsxs("li", { children: ["DB: ", _jsx("span", { className: "text-green-400", children: "\u2705" })] }), _jsxs("li", { children: ["Voice Engine: ", _jsx("span", { className: "text-green-400", children: "\u2705" })] }), _jsxs("li", { children: ["News Crawler: ", _jsx("span", { className: "text-green-400", children: "\u2705" })] })] }))
        },
        {
            id: 'tools',
            icon: _jsx(FaTools, {}),
            title: 'Quick Tools',
            content: (_jsxs("div", { className: "text-xs space-y-2", children: [_jsx("button", { onClick: onExportSettings, className: "text-blue-300 hover:underline", children: "\uD83D\uDCE4 Export Settings PDF" }), _jsx("br", {}), _jsx("button", { onClick: onBackupSite, className: "text-blue-300 hover:underline", children: "\uD83D\uDCBE Backup Site Now" }), _jsx("br", {}), _jsxs("button", { onClick: onRestoreBackup, className: "text-blue-300 hover:underline", children: [_jsx(FaRedoAlt, { className: "inline mr-1" }), " Restore Backup"] })] }))
        },
        {
            id: 'alerts',
            icon: _jsx(FaExclamationTriangle, {}),
            title: 'Alerts',
            content: (_jsxs("p", { className: "text-xs text-red-300", children: ["\u26A0\uFE0F 3 flagged stories", _jsx("br", {}), "\u26A0\uFE0F 1 missing backup"] }))
        },
        {
            id: 'lock',
            icon: _jsx(FaLock, {}),
            title: 'Founder Lock',
            content: (_jsxs("p", { className: "text-xs text-orange-300", children: ["\uD83D\uDEE1\uFE0F Emergency Lock: ", _jsx("span", { className: "text-green-400 font-semibold", children: "OFF" })] }))
        },
        {
            id: 'constitution',
            icon: _jsx(FaLock, {}),
            title: 'Constitution Status',
            content: (_jsxs("div", { className: "text-xs space-y-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `text-sm font-bold ${syncStatus === 'ok' ? 'text-green-400' : 'text-red-400'}`, children: syncStatus === 'ok' ? '≡ƒƒó Verified' : '≡ƒö┤ Not Synced' }), _jsx("span", { className: "text-[10px] text-gray-400", children: "Status from KiranOS" })] }), _jsx("p", { className: "text-blue-300 text-sm", children: _jsx("a", { href: "/admin/control-constitution", className: "hover:underline", children: "\uD83D\uDD0E View Constitution Page" }) }), _jsxs("p", { className: "text-[10px] text-gray-500 italic", children: ["Last Check: ", lastCheck] })] }))
        }
    ];
    return (_jsxs("aside", { className: "w-full md:w-72 bg-slate-800 text-white rounded-xl p-4 space-y-4 shadow-2xl sticky top-4 h-fit", children: [_jsx("h2", { className: "text-2xl font-bold mb-3 flex items-center gap-2 text-white z-10 relative", children: "Mission Control" }), panels.map(({ id, icon, title, content }) => (_jsxs("div", { className: "bg-slate-700 p-3 rounded-lg", children: [_jsxs("div", { className: "font-semibold flex items-center justify-between cursor-pointer", onClick: () => toggleSection(id), title: `Toggle ${title}`, children: [_jsxs("span", { className: "flex items-center gap-2", children: [icon, " ", title] }), expanded === id ? _jsx(FaChevronUp, {}) : _jsx(FaChevronDown, {})] }), expanded === id && (_jsx("div", { className: "mt-2 text-slate-100", children: content }))] }, id)))] }));
}

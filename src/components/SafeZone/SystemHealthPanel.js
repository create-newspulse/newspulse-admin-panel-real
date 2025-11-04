import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import html2pdf from 'html2pdf.js';
import { api, API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
const SystemHealthPanel = () => {
    const [healthData, setHealthData] = useState(null);
    const [unlocked, setUnlocked] = useState(false);
    const [input, setInput] = useState('');
    const [error, setError] = useState('');
    const PANEL_KEY = 'safezone:unlocked:SystemHealthPanel';
    const PANEL_PASSWORD = 'news2025';
    useEffect(() => {
        const saved = localStorage.getItem(PANEL_KEY);
        if (saved === 'true')
            setUnlocked(true);
    }, []);
    const handleUnlock = () => {
        if (input === PANEL_PASSWORD) {
            localStorage.setItem(PANEL_KEY, 'true');
            setUnlocked(true);
            setError('');
        }
        else {
            setError('❌ Incorrect password');
        }
    };
    const exportPanelPDF = () => {
        const element = document.getElementById('system-health-panel');
        if (!element)
            return;
        html2pdf().set({ filename: 'SystemHealthPanel_Report.pdf' }).from(element).save();
    };
    useEffect(() => {
        if (unlocked) {
            api.systemHealth()
                .then((data) => setHealthData(data))
                .catch((err) => console.error('Health fetch error:', err));
        }
    }, [unlocked]);
    useEffect(() => {
        if (healthData && (!healthData.apiGateway || !healthData.voiceEngine)) {
            (async () => {
                try {
                    await fetchJson(`${API_BASE_PATH}/notify-down`, { method: 'POST' });
                }
                catch (e) {
                    console.warn('notify-down failed:', e);
                }
            })();
        }
    }, [healthData]);
    return (_jsxs("section", { id: "system-health-panel", className: "p-5 md:p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-400/30 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h2", { className: "text-xl font-bold text-blue-700 dark:text-blue-300", children: "\uD83D\uDEE1\uFE0F System Health" }), unlocked && (_jsx("button", { onClick: exportPanelPDF, className: "text-xs text-blue-600 hover:underline", children: "\uD83D\uDCC4 Export Panel" }))] }), !unlocked ? (_jsxs("div", { className: "bg-slate-100 dark:bg-slate-800 p-4 rounded border border-slate-300 dark:border-slate-600", children: [_jsx("label", { className: "block mb-2 text-sm font-medium text-slate-700 dark:text-slate-200", children: "\uD83D\uDD12 Enter Panel Password" }), _jsx("input", { type: "password", placeholder: "Enter password", value: input, onChange: (e) => setInput(e.target.value), className: "w-full px-3 py-2 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-black dark:text-white focus:outline-none focus:ring" }), error && _jsx("p", { className: "text-red-500 text-sm mt-2", children: error }), _jsx("button", { onClick: handleUnlock, className: "mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded", children: "Unlock Panel" })] })) : (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-green-600 dark:text-green-400 font-mono text-sm mb-4", children: "\u2705 SystemHealthPanel Loaded" }), healthData ? (_jsxs("ul", { className: "text-sm space-y-2 text-slate-700 dark:text-slate-200", children: [_jsxs("li", { children: ["\u2705 MongoDB: ", _jsx("span", { className: "font-mono", children: healthData.mongodb })] }), _jsxs("li", { children: ["\u2705 API Gateway: ", _jsx("span", { className: "font-mono", children: healthData.apiGateway })] }), _jsxs("li", { children: ["\u2705 News Crawler: ", _jsx("span", { className: "font-mono", children: healthData.newsCrawler })] }), _jsxs("li", { children: ["\u2705 Voice Engine: ", _jsx("span", { className: "font-mono", children: healthData.voiceEngine })] }), _jsxs("li", { children: ["\uD83C\uDF10 Domain: ", _jsx("span", { className: "font-mono", children: healthData.domain })] })] })) : (_jsx("p", { className: "text-slate-500 dark:text-slate-400 text-sm mt-2", children: "Loading system stats..." }))] }))] }));
};
export default SystemHealthPanel;

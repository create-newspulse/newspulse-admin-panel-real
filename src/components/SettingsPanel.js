import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useAdminSettings } from '../context/AdminSettingsContext';
const settingKeys = [
    'panelGuideVisible',
    'showLoginRecords',
    'showBackupPanel',
    'restrictToFounder',
    'showSystemHealth',
    'showTrafficAnalytics',
    'showAIActivityLog',
    'showRevenuePanel',
    'enableExportPDF',
    'allowEditorMode',
    'enableAITrainer',
];
const settingLabels = {
    panelGuideVisible: '📘 Show Panel Guide',
    showLoginRecords: '🔐 Show Login Tracker',
    showBackupPanel: '📂 Enable Backup & Recovery',
    restrictToFounder: '🛡️ Restrict View to Founder Only',
    showSystemHealth: '🩺 Show System Health Panel',
    showTrafficAnalytics: '📊 Show Traffic Analytics',
    showAIActivityLog: '🧠 Show AI Activity Log',
    showRevenuePanel: '💰 Show Revenue Panel',
    enableExportPDF: '📤 Enable Export to PDF',
    allowEditorMode: '👥 Allow Editor-Level View',
    enableAITrainer: '🧬 Enable AI Trainer',
};
const SectionGroup = ({ title, children, }) => (_jsxs("details", { className: "bg-slate-800 rounded-xl shadow p-4 border border-slate-600 mb-4 group open:ring-1 open:ring-blue-500", children: [_jsx("summary", { className: "cursor-pointer font-bold text-lg text-white mb-2", children: title }), _jsx("ul", { className: "space-y-2 text-sm text-slate-100 pl-2", children: children })] }));
const SettingsPanel = () => {
    const settings = useAdminSettings();
    const [aiSuggestion, setAiSuggestion] = useState(null);
    const isEditorPreview = localStorage.getItem('previewAsEditor') === 'true';
    const isFounder = localStorage.getItem('userRole') === 'founder';
    const FOUNDER_PASS = 'NewsPulse#80121972';
    let founderUnlocked = false;
    useEffect(() => {
        if (isEditorPreview) {
            alert('🔒 Restricted Zone – Admins Only');
            window.location.href = '/';
        }
    }, []);
    const handleToggle = (key) => {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] 🔧 ${key} → ${!settings[key]}`;
        const logs = JSON.parse(localStorage.getItem('adminSettingsLog') || '[]');
        logs.unshift(logEntry);
        localStorage.setItem('adminSettingsLog', JSON.stringify(logs.slice(0, 50)));
        settings.toggleSetting(key);
        setTimeout(() => {
            const updated = settingKeys.reduce((acc, key) => {
                acc[key] = settings[key];
                return acc;
            }, {});
            localStorage.setItem('adminSettings', JSON.stringify(updated));
        }, 0);
    };
    const handleProtectedToggle = (key) => {
        const confirmed = window.confirm('🔐 Founder Reactivation Required');
        if (confirmed) {
            const input = window.prompt('Enter Reactivation Code:');
            if (input === FOUNDER_PASS) {
                founderUnlocked = true;
                handleToggle(key);
            }
            else {
                alert('❌ Incorrect Founder Code.');
            }
        }
    };
    useEffect(() => {
        const saved = localStorage.getItem('adminSettings');
        if (saved) {
            const parsed = JSON.parse(saved);
            Object.entries(parsed).forEach(([key, value]) => {
                if (typeof value === 'boolean' && settingKeys.includes(key)) {
                    if (settings[key] !== value) {
                        settings.toggleSetting(key);
                    }
                }
            });
        }
    }, []);
    useEffect(() => {
        if (!settings.showRevenuePanel) {
            setAiSuggestion({
                message: '💰 Revenue Panel is hidden. Turn it on to monitor ad earnings.',
                action: () => handleToggle('showRevenuePanel'),
            });
        }
        else {
            setAiSuggestion(null);
        }
    }, [settings.showRevenuePanel]);
    const renderToggle = (key) => {
        const isProtected = key === 'restrictToFounder' ||
            key === 'showRevenuePanel' ||
            key === 'enableAITrainer';
        const shouldDisable = (!founderUnlocked && key === 'restrictToFounder') ||
            (isEditorPreview && isProtected);
        return (_jsxs("li", { className: "flex items-center justify-between opacity-100", children: [_jsx("span", { children: settingLabels[key] }), _jsx("input", { type: "checkbox", checked: settings[key], disabled: shouldDisable, onChange: () => key === 'restrictToFounder' && !founderUnlocked
                        ? handleProtectedToggle(key)
                        : handleToggle(key), className: "scale-125 accent-blue-500" })] }, key));
    };
    if (isEditorPreview) {
        return (_jsxs("section", { className: "p-6 text-center text-slate-200", children: [_jsx("h2", { className: "text-2xl font-bold mb-4", children: "\uD83D\uDC64 Editor Preview Mode" }), _jsx("p", { className: "mb-4", children: "You are now simulating limited access." }), _jsx("button", { className: "bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded", onClick: () => {
                        localStorage.removeItem('previewAsEditor');
                        window.location.reload();
                    }, children: "\uD83D\uDD01 Exit Preview Mode" })] }));
    }
    return (_jsxs("section", { className: "p-6 text-white", children: [_jsxs("div", { className: "ai-card glow-panel ai-highlight hover-glow mb-4", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h2", { className: "text-2xl font-bold", children: "\u2699\uFE0F Admin Control Center \u2013 Phase 15" }), _jsx("button", { onClick: () => {
                                    const preview = confirm('🧪 Preview As Editor Mode?');
                                    if (preview)
                                        localStorage.setItem('previewAsEditor', 'true');
                                    else
                                        localStorage.removeItem('previewAsEditor');
                                    window.location.reload();
                                }, className: "px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-sm text-white", children: "\uD83D\uDC64 Preview As Editor" })] }), aiSuggestion && (_jsxs("div", { className: "bg-yellow-100 text-yellow-800 p-4 rounded mt-4 shadow-md", children: [_jsx("strong", { children: aiSuggestion.message }), _jsx("button", { onClick: aiSuggestion.action, className: "ml-4 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm", children: "\u2705 Apply Suggestion" })] }))] }), _jsxs(SectionGroup, { title: "\uD83D\uDD10 Access Control", children: [renderToggle('restrictToFounder'), renderToggle('allowEditorMode')] }), _jsxs(SectionGroup, { title: "\uD83E\uDDE0 AI Modules", children: [renderToggle('enableAITrainer'), renderToggle('showAIActivityLog')] }), _jsxs(SectionGroup, { title: "\uD83D\uDCCA Analytics Visibility", children: [renderToggle('showTrafficAnalytics'), renderToggle('showRevenuePanel')] }), _jsxs(SectionGroup, { title: "\uD83D\uDCE6 Backup & Export", children: [renderToggle('showBackupPanel'), renderToggle('enableExportPDF')] }), _jsxs(SectionGroup, { title: "\uD83D\uDD27 Live UI Panels", children: [renderToggle('panelGuideVisible'), renderToggle('showLoginRecords'), renderToggle('showSystemHealth')] }), isFounder && _jsx(SettingsLogViewer, {})] }));
};
export default SettingsPanel;
function SettingsLogViewer() {
    const [logs, setLogs] = useState([]);
    useEffect(() => {
        const stored = localStorage.getItem('adminSettingsLog');
        if (stored) {
            setLogs(JSON.parse(stored));
        }
    }, []);
    const handleClear = () => {
        localStorage.removeItem('adminSettingsLog');
        setLogs([]);
        alert('✅ Logs cleared!');
    };
    const handleExport = () => {
        const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `admin-settings-log-${Date.now()}.txt`;
        anchor.click();
        URL.revokeObjectURL(url);
    };
    return (_jsxs("section", { className: "mt-8", children: [_jsx("h3", { className: "text-lg font-semibold mb-2", children: "\uD83E\uDDFE Settings Activity Log" }), _jsx("div", { className: "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white p-4 rounded max-h-72 overflow-y-auto text-sm", children: logs.length === 0 ? (_jsx("p", { className: "text-gray-500 dark:text-gray-300", children: "No activity logs yet." })) : (_jsx("ul", { className: "list-disc ml-4 space-y-1", children: logs.map((log, idx) => (_jsx("li", { children: log }, idx))) })) }), _jsxs("div", { className: "mt-4 flex gap-4", children: [_jsx("button", { onClick: handleClear, className: "bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600", children: "\uD83D\uDDD1 Clear Logs" }), _jsx("button", { onClick: handleExport, className: "bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700", children: "\uD83D\uDCE4 Export Logs" })] })] }));
}

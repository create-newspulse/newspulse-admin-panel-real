import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { useNotification } from '@context/NotificationContext';
const FounderControlPanel = () => {
    const [loading, setLoading] = useState(false);
    const [action, setAction] = useState(null);
    const notify = useNotification();
    const handleLockdown = async () => {
        setLoading(true);
        setAction('lockdown');
        try {
            const json = await fetchJson(`${API_BASE_PATH}/emergency-lockdown`, { method: 'POST' });
            if (json.success ?? true)
                notify.success('≡ƒÜ¿ Emergency Lockdown Triggered');
            else
                notify.error('Γ¥î Lockdown request failed');
        }
        catch (error) {
            console.error('Lockdown error:', error);
            notify.error('ΓÜá∩╕Å Server error during lockdown');
        }
        finally {
            setLoading(false);
            setAction(null);
        }
    };
    const handleExportLogs = async () => {
        setLoading(true);
        setAction('export');
        try {
            const json = await fetchJson(`${API_BASE_PATH}/export-logs`, { method: 'GET' });
            if (json.success ?? true)
                notify.success('≡ƒôñ Logs exported successfully');
            else
                notify.error('Γ¥î Export failed. Try again.');
        }
        catch (error) {
            console.error('Export logs error:', error);
            notify.error('ΓÜá∩╕Å Server error during export');
        }
        finally {
            setLoading(false);
            setAction(null);
        }
    };
    const handleReactivate = async () => {
        setLoading(true);
        setAction('reactivate');
        try {
            const json = await fetchJson(`${API_BASE_PATH}/reactivate-system`, { method: 'POST' });
            if (json.success ?? true)
                notify.success('Γ£à System reactivated successfully');
            else
                notify.error('Γ¥î Failed to reactivate system');
        }
        catch (err) {
            console.error('Reactivation error:', err);
            notify.error('ΓÜá∩╕Å Server error during reactivation');
        }
        finally {
            setLoading(false);
            setAction(null);
        }
    };
    return (_jsxs("section", { className: "p-5 md:p-6 bg-rose-50 dark:bg-rose-900/10 border border-red-300/40 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto", children: [_jsx("p", { className: "text-green-600 dark:text-green-400 font-mono text-sm mb-3", children: "\u2705 FounderControlPanel Loaded" }), _jsx("h2", { className: "text-xl font-bold text-red-700 dark:text-red-400 mb-3", children: "\uD83D\uDEE1\uFE0F Founder Controls" }), _jsxs("div", { className: "space-y-3 text-sm md:text-base text-slate-700 dark:text-slate-200", children: [_jsxs("p", { children: ["Access level: ", _jsx("strong", { className: "text-green-600 dark:text-green-400", children: "FULL" })] }), _jsxs("ul", { className: "list-disc list-inside ml-2 space-y-1", children: [_jsx("li", { children: "Change AI automation modes" }), _jsx("li", { children: "Trigger emergency system lockdown" }), _jsx("li", { children: "Grant or revoke editor/admin access" }), _jsx("li", { children: "\uD83D\uDD01 Reactivate the system manually" })] })] }), _jsxs("div", { className: "flex flex-wrap gap-4 mt-6", children: [_jsx("button", { onClick: handleLockdown, className: "bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-60", disabled: loading && action === 'lockdown', children: "\uD83D\uDED1 Emergency Lockdown" }), _jsx("button", { onClick: handleExportLogs, className: "bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60", disabled: loading && action === 'export', children: "\uD83D\uDCE4 Export Logs" }), _jsx("button", { onClick: handleReactivate, className: "bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-60", disabled: loading && action === 'reactivate', children: "\uD83D\uDD01 Reactivate System" })] })] }));
};
export default FounderControlPanel;

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { FaCheckCircle, FaExclamationTriangle, FaEnvelope } from 'react-icons/fa';
const SmartAlertSystem = () => {
    const [status, setStatus] = useState('loading');
    useEffect(() => {
        // Simulate system check (replace with real fetch later)
        const fetchAlertConfig = async () => {
            try {
                const data = await fetchJson(`${API_BASE_PATH}/system/alert-config`, {
                    timeoutMs: 15000,
                });
                if (data && (data.success ?? true)) {
                    setStatus('loaded');
                }
                else {
                    throw new Error('Failed to load config');
                }
            }
            catch (err) {
                console.error('❌ Alert config error:', err);
                setStatus('error');
            }
        };
        fetchAlertConfig();
    }, []);
    return (_jsxs("section", { className: "p-4 md:p-6 overflow-y-auto max-h-[90vh] bg-gradient-to-br from-yellow-50 via-white to-yellow-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-2xl shadow-lg border border-yellow-200 dark:border-yellow-700", children: [_jsxs("div", { className: "mb-4 flex items-center gap-2", children: [status === 'loaded' && _jsx(FaCheckCircle, { className: "text-green-500" }), status === 'error' && _jsx(FaExclamationTriangle, { className: "text-red-500" }), _jsx("p", { className: `font-mono text-sm ${status === 'loaded' ? 'text-green-600' : 'text-red-500'}`, children: status === 'loaded' ? '✅ SmartAlertSystem Loaded' : '❌ Alert System Load Failed' })] }), _jsx("h2", { className: "text-xl font-bold text-yellow-700 dark:text-yellow-300 mb-2", children: "\uD83D\uDCA1 Smart Alert System" }), _jsxs("div", { className: "space-y-2 text-sm md:text-base text-slate-700 dark:text-slate-300", children: [_jsx("p", { children: "This panel allows admins to configure alerts for critical activity or potential threats in real-time." }), _jsxs("ul", { className: "list-disc list-inside ml-2 mt-2 space-y-1 text-slate-700 dark:text-slate-400", children: [_jsx("li", { children: "\uD83D\uDCE3 Auto-notify on suspicious events" }), _jsxs("li", { children: [_jsx(FaEnvelope, { className: "inline mr-1 text-blue-600" }), " Custom alert channels (Email, Dashboard)"] }), _jsxs("li", { children: [_jsx(FaExclamationTriangle, { className: "inline mr-1 text-yellow-600" }), " AI-priority tagging for urgent incidents"] })] }), _jsx("p", { className: "text-xs text-slate-500 dark:text-slate-500 mt-4 italic", children: "\uD83D\uDD27 More configuration options coming soon..." })] })] }));
};
export default SmartAlertSystem;

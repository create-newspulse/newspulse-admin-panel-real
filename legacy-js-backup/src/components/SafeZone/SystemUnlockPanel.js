import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Γ£à File: components/SafeZone/SystemUnlockPanel.tsx
import { useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { FaUnlockAlt } from 'react-icons/fa';
const SystemUnlockPanel = () => {
    const [pin, setPin] = useState('');
    const [status, setStatus] = useState('idle');
    const handleUnlock = async () => {
        if (!pin)
            return;
        setStatus('loading');
        try {
            const data = await fetchJson(`${API_BASE_PATH}/system/reactivate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin }),
            });
            if (data.success ?? true) {
                setStatus('success');
            }
            else {
                setStatus('error');
            }
        }
        catch (err) {
            console.error('Unlock error:', err);
            setStatus('error');
        }
    };
    return (_jsxs("section", { className: "p-5 md:p-6 bg-green-50 dark:bg-green-900/10 border border-green-400/30 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto", children: [_jsx("p", { className: "text-green-600 dark:text-green-400 font-mono text-sm mb-2", children: "\u2705 SystemUnlockPanel Loaded" }), _jsxs("h2", { className: "text-xl font-bold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2", children: [_jsx(FaUnlockAlt, { className: "text-green-600" }), "Reactivate System"] }), _jsx("input", { type: "password", placeholder: "Enter Unlock PIN", value: pin, onChange: (e) => setPin(e.target.value), className: "mt-3 px-3 py-2 rounded border border-green-400 text-sm w-full dark:bg-green-800/10" }), _jsx("button", { onClick: handleUnlock, disabled: !pin || status === 'loading', className: `mt-3 px-4 py-2 rounded-md font-semibold text-white transition duration-200 flex items-center gap-2 ${pin ? 'bg-green-600 hover:bg-green-700' : 'bg-green-300 cursor-not-allowed'}`, children: status === 'loading' ? 'Reactivating...' : 'ΓÖ╗∩╕Å Reactivate System' }), status === 'success' && (_jsx("p", { className: "text-green-600 font-mono mt-2", children: "\u2705 System reactivated successfully!" })), status === 'error' && (_jsx("p", { className: "text-red-600 font-mono mt-2", children: "\u274C Invalid PIN or server error." }))] }));
};
export default SystemUnlockPanel;

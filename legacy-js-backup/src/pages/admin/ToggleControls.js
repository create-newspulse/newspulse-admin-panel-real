import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// File: src/pages/admin/ToggleControls.tsx
import { useEffect, useState } from 'react';
import apiClient from '@lib/api';
export default function ToggleControls() {
    const [toggles, setToggles] = useState({
        parliamentSessionEnabled: false,
        lokSabhaLive: false,
        rajyaSabhaLive: false,
    });
    const fetchToggles = async () => {
        try {
            const res = await apiClient.get('/toggles/parliament-session');
            const data = res?.data ?? res;
            if (data?.success && data?.config) {
                setToggles(data.config);
            }
            else {
                console.warn('ΓÜá∩╕Å No toggle config returned from server.');
            }
        }
        catch (err) {
            console.error('Γ¥î Failed to load toggles:', err.message);
        }
    };
    const updateToggle = async (key) => {
        const updated = { ...toggles, [key]: !toggles[key] };
        setToggles(updated);
        try {
            await apiClient.post('/toggles/parliament-session', updated);
        }
        catch (err) {
            console.error(`Γ¥î Failed to update toggle "${key}":`, err.message);
        }
    };
    useEffect(() => {
        fetchToggles();
    }, []);
    return (_jsxs("section", { className: "max-w-3xl mx-auto px-4 py-8 space-y-6", children: [_jsx("h1", { className: "text-3xl font-bold text-slate-800 dark:text-slate-100", children: "\uD83D\uDEE0\uFE0F Parliament Feed Toggle Controls" }), _jsx(ToggleSwitch, { label: "Parliament Session Tab", enabled: toggles.parliamentSessionEnabled, onToggle: () => updateToggle('parliamentSessionEnabled') }), _jsx(ToggleSwitch, { label: "Lok Sabha Feed (Sansad TV 2)", enabled: toggles.lokSabhaLive, onToggle: () => updateToggle('lokSabhaLive') }), _jsx(ToggleSwitch, { label: "Rajya Sabha Feed (Sansad TV 1)", enabled: toggles.rajyaSabhaLive, onToggle: () => updateToggle('rajyaSabhaLive') })] }));
}
function ToggleSwitch({ label, enabled, onToggle }) {
    return (_jsxs("div", { className: "flex items-center justify-between px-5 py-4 rounded border bg-white dark:bg-slate-800 dark:border-slate-700 shadow-sm transition", children: [_jsx("span", { className: "text-base font-medium text-slate-800 dark:text-slate-100", children: label }), _jsx("button", { onClick: onToggle, "aria-pressed": enabled, "aria-label": `Toggle ${label}`, className: `px-4 py-1 rounded font-semibold text-sm transition-colors duration-200 shadow ${enabled ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'}`, children: enabled ? '≡ƒƒó ON' : '≡ƒö┤ OFF' })] }));
}

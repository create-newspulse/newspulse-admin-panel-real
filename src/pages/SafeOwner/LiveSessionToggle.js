import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// 📁 src/pages/SafeOwner/LiveSessionToggle.tsx
import { useEffect, useState } from 'react';
import apiClient from '@lib/api';
const LiveSessionToggle = () => {
    const [config, setConfig] = useState({
        isFeedOn: true,
        activeFeed: 'sansad_tv',
    });
    useEffect(() => {
        apiClient.get('/live-session')
            .then(res => {
            const data = res?.data ?? res;
            setConfig(data);
        })
            .catch(() => console.warn('Could not load session config'));
    }, []);
    const updateSession = (update) => {
        const newConfig = { ...config, ...update };
        setConfig(newConfig);
        apiClient.post('/live-session', newConfig)
            .then(() => console.log('✅ Session updated'))
            .catch(() => alert('Failed to update config'));
    };
    return (_jsxs("div", { className: "max-w-3xl mx-auto px-4 py-10", children: [_jsx("h1", { className: "text-2xl font-bold text-slate-800 dark:text-white mb-6", children: "\uD83D\uDD27 Manage Live Feed Toggle" }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center gap-4", children: [_jsx("label", { className: "text-sm font-medium", children: "Feed Status:" }), _jsx("button", { className: `px-4 py-1 rounded font-semibold ${config.isFeedOn ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`, onClick: () => updateSession({ isFeedOn: !config.isFeedOn }), children: config.isFeedOn ? '✅ ON' : '❌ OFF' })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium block mb-2", children: "Select Feed Source:" }), _jsx("div", { className: "flex gap-3", children: ['sansad_tv', 'lok_sabha', 'rajya_sabha', 'event'].map(feed => (_jsx("button", { className: `px-3 py-1 rounded border ${config.activeFeed === feed ? 'bg-blue-700 text-white' : 'bg-gray-200'}`, onClick: () => updateSession({ activeFeed: feed }), children: feed.replace('_', ' ').toUpperCase() }, feed))) })] })] }), _jsx("div", { className: "mt-6 text-sm text-gray-600 dark:text-gray-400", children: "\uD83D\uDEE1\uFE0F This configuration updates the Civic Hub live section in real-time." })] }));
};
export default LiveSessionToggle;

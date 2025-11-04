import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// 📂 components/SafeZone/TrafficAnalytics.tsx
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
const TrafficAnalytics = () => {
    const [data, setData] = useState(null);
    const [lastUpdated, setLastUpdated] = useState('');
    useEffect(() => {
        const fetchTraffic = async () => {
            try {
                const json = await api.monitorHub();
                setData({
                    viewsToday: json.viewsToday,
                    peakTime: json.peakTime,
                    topRegion: json.topRegion,
                    bounceRate: json.bounceRate
                });
                const now = new Date();
                setLastUpdated(now.toLocaleTimeString());
            }
            catch (err) {
                console.error('❌ Error fetching traffic data:', err);
            }
        };
        fetchTraffic();
    }, []);
    return (_jsxs("section", { className: "p-5 md:p-6 bg-orange-50 dark:bg-orange-900/10 border border-orange-300 dark:border-orange-700 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto", children: [_jsx("p", { className: "text-green-600 dark:text-green-400 font-mono text-sm mb-1", children: "\u2705 TrafficAnalytics Loaded" }), _jsx("h2", { className: "text-xl font-bold text-orange-700 dark:text-orange-300 mb-2", children: "\uD83D\uDCCA Traffic Analytics" }), data ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-slate-700 dark:text-slate-300 text-sm mb-2", children: "Real-time visitor tracking is active. Summary:" }), _jsxs("ul", { className: "list-disc list-inside text-sm space-y-1 text-slate-800 dark:text-slate-200", children: [_jsxs("li", { children: ["\uD83D\uDCCD ", _jsx("strong", { children: data.viewsToday }), " views today"] }), _jsxs("li", { children: ["\uD83D\uDCC5 Peak traffic at ", _jsx("strong", { children: data.peakTime })] }), _jsxs("li", { children: ["\uD83C\uDF0E Top region: ", _jsx("strong", { children: data.topRegion })] }), _jsxs("li", { children: ["\uD83D\uDD01 Bounce Rate: ", _jsxs("strong", { children: [data.bounceRate, "%"] })] })] }), _jsxs("p", { className: "text-xs text-slate-500 dark:text-slate-400 mt-3", children: ["Stats updated ", lastUpdated] })] })) : (_jsx("p", { className: "text-sm text-slate-500 dark:text-slate-400", children: "\u23F3 Loading traffic data..." }))] }));
};
export default TrafficAnalytics;

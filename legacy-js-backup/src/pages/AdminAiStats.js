import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ≡ƒôü src/pages/AdminAiStats.tsx
import { useEffect, useState, useRef } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, } from 'recharts';
const COLORS = ['#007aff', '#00c49f', '#ff6384'];
const AdminAiStats = () => {
    const [stats, setStats] = useState([]);
    const [dailyData, setDailyData] = useState([]);
    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current)
            return;
        initialized.current = true;
        const fetchEngineStats = async () => {
            try {
                const res = await fetch(`${API_BASE_PATH}/ai/logs/engine-stats`, { credentials: 'include' });
                const ct = res.headers.get('content-type') || '';
                if (!res.ok || !ct.includes('application/json')) {
                    const txt = await res.text().catch(() => '');
                    throw new Error(`Expected JSON, got "${ct}". Body: ${txt.slice(0, 160)}`);
                }
                const data = await res.json();
                if (data.success && data.stats) {
                    const converted = Object.entries(data.stats).map(([engine, count]) => ({
                        name: engine.toUpperCase(),
                        value: Number(count),
                    }));
                    setStats(converted);
                }
            }
            catch (err) {
                console.error('Failed to fetch engine stats:', err);
            }
        };
        const fetchDailyStats = async () => {
            try {
                const res = await fetch(`${API_BASE_PATH}/ai/logs/daily-stats`, { credentials: 'include' });
                const ct = res.headers.get('content-type') || '';
                if (!res.ok || !ct.includes('application/json')) {
                    const txt = await res.text().catch(() => '');
                    throw new Error(`Expected JSON, got "${ct}". Body: ${txt.slice(0, 160)}`);
                }
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    setDailyData(data.data);
                }
            }
            catch (err) {
                console.error('Failed to fetch daily stats:', err);
            }
        };
        fetchEngineStats();
        fetchDailyStats();
    }, []);
    return (_jsxs("div", { className: "p-6 max-w-5xl mx-auto", children: [_jsx("h1", { className: "text-2xl font-bold text-blue-700 mb-6", children: "\uD83D\uDCCA AI Engine Usage" }), _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(PieChart, { children: [_jsx(Pie, { data: stats, dataKey: "value", nameKey: "name", cx: "50%", cy: "50%", outerRadius: 100, label: true, children: stats.map((entry, index) => (_jsx(Cell, { fill: COLORS[index % COLORS.length] }, `cell-${index}`))) }), _jsx(Tooltip, {}), _jsx(Legend, {})] }) }), _jsx("h2", { className: "text-xl font-semibold mt-10 mb-4 text-blue-700", children: "\uD83D\uDCC6 Daily AI Usage" }), _jsx(ResponsiveContainer, { width: "100%", height: 250, children: _jsxs(LineChart, { data: dailyData, children: [_jsx(CartesianGrid, { stroke: "#ccc", strokeDasharray: "5 5" }), _jsx(XAxis, { dataKey: "date" }), _jsx(YAxis, { allowDecimals: false }), _jsx(Tooltip, {}), _jsx(Line, { type: "monotone", dataKey: "count", stroke: "#007aff", strokeWidth: 2 })] }) })] }));
};
export default AdminAiStats;

import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
// 📁 src/pages/AnalyticsDashboard.tsx
import { useEffect, useState } from 'react';
import { useTranslate } from '../hooks/useTranslate';
import useAuthGuard from '../hooks/useAuthGuard'; // 🔐 Guard
import api from '../utils/api'; // ✅ Axios with token (should use baseURL: '/api')
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, } from 'recharts';
export default function AnalyticsDashboard() {
    useAuthGuard(); // 🔐 Redirects if not logged in
    const t = useTranslate();
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                // ✅ USE this for all API calls (no localhost, no hardcoded full URLs)
                const res = await api.get('/dashboard-stats');
                if (res.data?.success && res.data.data) {
                    setSummary({
                        totalViews: res.data.data.totalViews ?? 0,
                        viewsToday: res.data.data.viewsToday ?? 0,
                        topPages: res.data.data.topPages ?? [],
                    });
                }
                else {
                    setError(res.data?.message || 'Failed to load analytics data');
                }
            }
            catch (err) {
                console.error('❌ Failed to load analytics:', err?.message);
                setError(err?.message || 'Analytics fetch failed');
            }
            finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, []);
    const chartData = summary?.topPages.map((page) => ({
        name: page._id?.length > 20 ? page._id.slice(0, 20) + '…' : page._id,
        views: page.count,
    })) || [];
    return (_jsxs("div", { className: "p-6", children: [_jsxs("h1", { className: "text-2xl font-bold mb-6", children: ["\uD83D\uDCCA ", t('analyticsDashboard') || 'Analytics Dashboard'] }), loading && _jsx("p", { children: "Loading data..." }), error && _jsx("p", { className: "text-red-600", children: error }), summary && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: [_jsxs("div", { className: "bg-white shadow p-4 rounded border", children: [_jsx("h2", { className: "text-xl font-semibold", children: "\uD83D\uDC65 Total Views" }), _jsx("p", { className: "text-3xl mt-2", children: summary.totalViews })] }), _jsxs("div", { className: "bg-white shadow p-4 rounded border", children: [_jsx("h2", { className: "text-xl font-semibold", children: "\uD83D\uDCC5 Views Today" }), _jsx("p", { className: "text-3xl mt-2", children: summary.viewsToday })] })] }), _jsxs("div", { className: "bg-white shadow p-4 rounded border", children: [_jsx("h2", { className: "text-xl font-semibold mb-2", children: "\uD83D\uDD25 Top Pages" }), _jsxs("ul", { className: "space-y-1", children: [summary.topPages.length === 0 && (_jsx("li", { className: "text-gray-500", children: "No top pages found." })), summary.topPages.map((page, index) => (_jsxs("li", { className: "text-gray-700", children: [_jsx("span", { className: "font-mono", children: page._id }), " \u2014", ' ', _jsx("strong", { children: page.count }), " views"] }, index)))] })] }), _jsxs("div", { className: "bg-white shadow p-4 rounded border", children: [_jsx("h2", { className: "text-xl font-semibold mb-4", children: "\uD83D\uDCC8 Views by Page" }), _jsx(ResponsiveContainer, { width: "100%", height: 300, children: _jsxs(BarChart, { data: chartData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3" }), _jsx(XAxis, { dataKey: "name" }), _jsx(YAxis, {}), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Bar, { dataKey: "views", fill: "#10b981" })] }) })] })] }))] }));
}

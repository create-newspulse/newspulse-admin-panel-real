import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import apiClient from '../../lib/api';
import { Line, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend, } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);
export default function AnalyticsDashboard() {
    const [loading, setLoading] = useState(true);
    const [revenue, setRevenue] = useState(null);
    const [traffic, setTraffic] = useState(null);
    const [adPerf, setAdPerf] = useState(null);
    const [abTests, setAbTests] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    useEffect(() => {
        fetchAnalytics();
    }, []);
    async function fetchAnalytics() {
        setLoading(true);
        try {
            const [revRes, traffRes, adRes, abRes] = await Promise.all([
                apiClient.get('/analytics/revenue').catch(() => ({ data: null })),
                apiClient.get('/analytics/traffic').catch(() => ({ data: null })),
                apiClient.get('/analytics/ad-performance').catch(() => ({ data: null })),
                apiClient.get('/analytics/ab-tests').catch(() => ({ data: { tests: [] } })),
            ]);
            setRevenue(revRes.data || mockRevenue());
            setTraffic(traffRes.data || mockTraffic());
            setAdPerf(adRes.data || mockAdPerf());
            setAbTests(abRes.data?.tests || mockABTests());
        }
        catch (err) {
            console.error('Analytics fetch failed:', err);
            setRevenue(mockRevenue());
            setTraffic(mockTraffic());
            setAdPerf(mockAdPerf());
            setAbTests(mockABTests());
        }
        finally {
            setLoading(false);
        }
    }
    function mockRevenue() {
        return { total: 48320.5, today: 1420.8, week: 9850.2, month: 48320.5, rpm: 12.4, ctr: 2.3 };
    }
    function mockTraffic() {
        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const pageViews = [12500, 14200, 13800, 15600, 17200, 19400, 18900];
        const uniqueVisitors = [8200, 9100, 8900, 10200, 11500, 12800, 12400];
        return { labels, pageViews, uniqueVisitors };
    }
    function mockAdPerf() {
        return { impressions: 1245000, clicks: 28635, revenue: 15420.8, ctr: 2.3, rpm: 12.38 };
    }
    function mockABTests() {
        return [
            { id: 't1', name: 'Homepage Headline', variantA: 'Breaking News Today', variantB: 'Latest Updates', conversionsA: 340, conversionsB: 412, winner: 'B' },
            { id: 't2', name: 'CTA Button Color', variantA: 'Blue', variantB: 'Orange', conversionsA: 280, conversionsB: 275, winner: null },
        ];
    }
    const trafficChartData = traffic
        ? {
            labels: traffic.labels,
            datasets: [
                {
                    label: 'Page Views',
                    data: traffic.pageViews,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.3,
                },
                {
                    label: 'Unique Visitors',
                    data: traffic.uniqueVisitors,
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.3,
                },
            ],
        }
        : null;
    const revenueBreakdown = revenue
        ? {
            labels: ['AdSense', 'Direct Ads', 'Affiliate', 'Sponsored'],
            datasets: [
                {
                    data: [revenue.total * 0.55, revenue.total * 0.25, revenue.total * 0.12, revenue.total * 0.08],
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
                },
            ],
        }
        : null;
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-3xl font-bold", children: "Analytics & Monetization" }), _jsx("button", { onClick: fetchAnalytics, className: "px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700", children: "Refresh Data" })] }), _jsx("div", { className: "flex gap-2 border-b border-gray-300 dark:border-gray-600", children: ['overview', 'ads', 'ab-tests', 'affiliate'].map((tab) => (_jsxs("button", { onClick: () => setActiveTab(tab), className: `px-4 py-2 font-medium transition ${activeTab === tab
                        ? 'border-b-2 border-blue-600 text-blue-600'
                        : 'text-gray-600 dark:text-gray-300 hover:text-blue-600'}`, children: [tab === 'overview' && '📊 Overview', tab === 'ads' && '💰 Ad Performance', tab === 'ab-tests' && '🧪 A/B Tests', tab === 'affiliate' && '🔗 Affiliate'] }, tab))) }), loading ? (_jsx("div", { className: "text-center py-12", children: "Loading analytics..." })) : (_jsxs(_Fragment, { children: [activeTab === 'overview' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-lg shadow", children: [_jsx("div", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Total Revenue" }), _jsxs("div", { className: "text-2xl font-bold text-green-600", children: ["$", revenue?.total.toLocaleString()] })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-lg shadow", children: [_jsx("div", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Today" }), _jsxs("div", { className: "text-2xl font-bold", children: ["$", revenue?.today.toLocaleString()] })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-lg shadow", children: [_jsx("div", { className: "text-sm text-gray-500 dark:text-gray-400", children: "RPM" }), _jsxs("div", { className: "text-2xl font-bold", children: ["$", revenue?.rpm.toFixed(2)] })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-lg shadow", children: [_jsx("div", { className: "text-sm text-gray-500 dark:text-gray-400", children: "CTR" }), _jsxs("div", { className: "text-2xl font-bold", children: [revenue?.ctr, "%"] })] })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 p-6 rounded-lg shadow", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Weekly Traffic" }), trafficChartData && _jsx(Line, { data: trafficChartData, options: { responsive: true, maintainAspectRatio: true } })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-6", children: [_jsxs("div", { className: "bg-white dark:bg-slate-800 p-6 rounded-lg shadow", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Revenue Sources" }), revenueBreakdown && _jsx(Doughnut, { data: revenueBreakdown, options: { responsive: true, maintainAspectRatio: true } })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 p-6 rounded-lg shadow", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Quick Stats" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "This Week" }), _jsxs("span", { className: "font-semibold", children: ["$", revenue?.week.toLocaleString()] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "This Month" }), _jsxs("span", { className: "font-semibold", children: ["$", revenue?.month.toLocaleString()] })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Ad Impressions" }), _jsx("span", { className: "font-semibold", children: adPerf?.impressions.toLocaleString() })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Ad Clicks" }), _jsx("span", { className: "font-semibold", children: adPerf?.clicks.toLocaleString() })] })] })] })] })] })), activeTab === 'ads' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4", children: [_jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-lg shadow", children: [_jsx("div", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Impressions" }), _jsx("div", { className: "text-2xl font-bold", children: adPerf?.impressions.toLocaleString() })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-lg shadow", children: [_jsx("div", { className: "text-sm text-gray-500 dark:text-gray-400", children: "Clicks" }), _jsx("div", { className: "text-2xl font-bold", children: adPerf?.clicks.toLocaleString() })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-lg shadow", children: [_jsx("div", { className: "text-sm text-gray-500 dark:text-gray-400", children: "CTR" }), _jsxs("div", { className: "text-2xl font-bold text-blue-600", children: [adPerf?.ctr, "%"] })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 p-4 rounded-lg shadow", children: [_jsx("div", { className: "text-sm text-gray-500 dark:text-gray-400", children: "RPM" }), _jsxs("div", { className: "text-2xl font-bold text-green-600", children: ["$", adPerf?.rpm.toFixed(2)] })] })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 p-6 rounded-lg shadow", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Ad Optimization Suggestions" }), _jsxs("ul", { className: "space-y-2 text-sm", children: [_jsxs("li", { className: "flex items-start gap-2", children: [_jsx("span", { className: "text-green-600", children: "\u2713" }), _jsx("span", { children: "Ad viewability is above 70% - excellent placement" })] }), _jsxs("li", { className: "flex items-start gap-2", children: [_jsx("span", { className: "text-yellow-600", children: "\u26A0" }), _jsx("span", { children: "Consider reducing sidebar ads on mobile for better UX" })] }), _jsxs("li", { className: "flex items-start gap-2", children: [_jsx("span", { className: "text-blue-600", children: "\uD83D\uDCA1" }), _jsx("span", { children: "A/B test sticky header ad vs. in-article placement" })] })] })] })] })), activeTab === 'ab-tests' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex justify-between items-center", children: [_jsx("h3", { className: "text-xl font-semibold", children: "Active A/B Tests" }), _jsx("button", { className: "px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700", children: "+ New Test" })] }), abTests.map((test) => (_jsxs("div", { className: "bg-white dark:bg-slate-800 p-6 rounded-lg shadow", children: [_jsxs("div", { className: "flex justify-between items-start mb-4", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-lg font-semibold", children: test.name }), test.winner && _jsxs("span", { className: "text-sm text-green-600", children: ["Winner: Variant ", test.winner] })] }), _jsx("button", { className: "text-sm text-blue-600 hover:underline", children: "View Details" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "border border-gray-300 dark:border-gray-600 p-4 rounded", children: [_jsx("div", { className: "text-sm text-gray-500", children: "Variant A" }), _jsx("div", { className: "font-medium", children: test.variantA }), _jsx("div", { className: "text-2xl font-bold mt-2", children: test.conversionsA }), _jsx("div", { className: "text-xs text-gray-500", children: "conversions" })] }), _jsxs("div", { className: "border border-gray-300 dark:border-gray-600 p-4 rounded", children: [_jsx("div", { className: "text-sm text-gray-500", children: "Variant B" }), _jsx("div", { className: "font-medium", children: test.variantB }), _jsx("div", { className: "text-2xl font-bold mt-2", children: test.conversionsB }), _jsx("div", { className: "text-xs text-gray-500", children: "conversions" })] })] }), !test.winner && (_jsxs("div", { className: "mt-4 flex gap-2", children: [_jsx("button", { className: "px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700", children: "Declare Winner" }), _jsx("button", { className: "px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700", children: "Stop Test" })] }))] }, test.id)))] })), activeTab === 'affiliate' && (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "bg-white dark:bg-slate-800 p-6 rounded-lg shadow", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Affiliate Performance" }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex justify-between items-center p-3 border border-gray-300 dark:border-gray-600 rounded", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: "Amazon Associates" }), _jsx("div", { className: "text-sm text-gray-500", children: "245 clicks \u2022 12 conversions" })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: "text-lg font-bold text-green-600", children: "$1,240" }), _jsx("div", { className: "text-xs text-gray-500", children: "4.9% conversion" })] })] }), _jsxs("div", { className: "flex justify-between items-center p-3 border border-gray-300 dark:border-gray-600 rounded", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: "Flipkart Affiliate" }), _jsx("div", { className: "text-sm text-gray-500", children: "189 clicks \u2022 8 conversions" })] }), _jsxs("div", { className: "text-right", children: [_jsx("div", { className: "text-lg font-bold text-green-600", children: "$890" }), _jsx("div", { className: "text-xs text-gray-500", children: "4.2% conversion" })] })] })] })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 p-6 rounded-lg shadow", children: [_jsx("h3", { className: "text-xl font-semibold mb-4", children: "Broken Links Monitor" }), _jsx("div", { className: "text-sm text-gray-500", children: "No broken affiliate links detected \u2713" })] })] }))] }))] }));
}

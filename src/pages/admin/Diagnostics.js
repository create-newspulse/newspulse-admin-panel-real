import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/pages/admin/Diagnostics.tsx
import { useEffect, useState } from "react";
import axios from "axios";
import { API_BASE_PATH } from "@lib/api";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import { Link } from "react-router-dom";
import AITrainerPanel from "./AITrainerPanel";
export default function Diagnostics() {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);
    useEffect(() => {
        const fetchDiagnostics = async () => {
            try {
                const res = await axios.get(`${API_BASE_PATH}/system/ai-diagnostics`, { withCredentials: true });
                setData(res.data);
                setError(null);
                setLastRefresh(new Date().toLocaleTimeString());
            }
            catch (err) {
                console.error(err);
                setError("❌ Failed to load diagnostics.");
            }
        };
        fetchDiagnostics();
        const id = setInterval(fetchDiagnostics, 20000);
        return () => clearInterval(id);
    }, []);
    if (error) {
        return (_jsx("div", { className: "p-6 text-red-600 font-medium bg-red-50 dark:bg-red-900 dark:text-red-200 rounded shadow", children: error }));
    }
    if (!data) {
        return (_jsx("div", { className: "p-6 text-blue-600 font-medium bg-blue-50 dark:bg-blue-900 dark:text-blue-200 rounded shadow", children: "\u23F3 Loading AI diagnostics..." }));
    }
    if (!data.timeSeries || data.timeSeries.length === 0) {
        return (_jsx("div", { className: "p-6 text-yellow-600 font-medium bg-yellow-50 dark:bg-yellow-900 dark:text-yellow-200 rounded shadow", children: "\u26A0\uFE0F No diagnostic data available yet. Please try again later." }));
    }
    const chartData = {
        labels: data.timeSeries.map((i) => i.date),
        datasets: [
            {
                label: "🧠 Commands Executed",
                data: data.timeSeries.map((i) => i.commands),
                fill: true,
                borderColor: "#6366f1",
                backgroundColor: "rgba(99, 102, 241, 0.1)",
                tension: 0.3,
            },
        ],
    };
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: { ticks: { color: "#94a3b8" } },
            y: { beginAtZero: true, ticks: { color: "#94a3b8" } },
        },
        plugins: {
            legend: { labels: { color: "#334155" } },
        },
    };
    return (_jsxs("div", { className: "min-h-screen bg-slate-50 dark:bg-slate-900 p-6", children: [_jsxs("div", { className: "flex justify-between items-center mb-4", children: [_jsx("h1", { className: "text-2xl font-bold text-blue-700 dark:text-blue-300", children: "\uD83E\uDDEC AI Diagnostics Overview" }), _jsx(Link, { to: "/admin", className: "text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400 px-4 py-1 rounded", children: "\u2190 Back to Dashboard" })] }), _jsxs("div", { className: "bg-white dark:bg-slate-800 p-6 rounded shadow-xl h-96", children: [_jsx(Line, { data: chartData, options: chartOptions }), _jsxs("p", { className: "text-xs text-right text-gray-500 mt-1", children: ["\uD83D\uDD04 Auto-refreshed at: ", lastRefresh] })] }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-4 mt-6", children: [_jsxs("div", { className: "bg-blue-50 dark:bg-blue-900 text-blue-900 dark:text-blue-200 p-4 rounded shadow border border-blue-200 dark:border-blue-700", children: [_jsx("p", { className: "text-xs uppercase font-semibold", children: "Top Command" }), _jsx("p", { className: "text-lg font-bold", children: data.mostUsed?.[0] })] }), _jsxs("div", { className: "bg-green-50 dark:bg-green-900 text-green-900 dark:text-green-200 p-4 rounded shadow border border-green-200 dark:border-green-700", children: [_jsx("p", { className: "text-xs uppercase font-semibold", children: "Total Commands" }), _jsx("p", { className: "text-lg font-bold", children: data.total ?? "—" })] }), _jsxs("div", { className: "bg-yellow-50 dark:bg-yellow-900 text-yellow-900 dark:text-yellow-200 p-4 rounded shadow border border-yellow-200 dark:border-yellow-700", children: [_jsx("p", { className: "text-xs uppercase font-semibold", children: "Last Used" }), _jsx("p", { className: "text-lg font-bold", children: data.lastUsed ?? "—" })] }), _jsxs("div", { className: "bg-red-50 dark:bg-red-900 text-red-900 dark:text-red-200 p-4 rounded shadow border border-red-200 dark:border-red-700", children: [_jsx("p", { className: "text-xs uppercase font-semibold", children: "Founder Lock" }), _jsx("p", { className: "text-lg font-bold", children: data.lockedByFounder ? "✅ Active" : "❌ Not Active" })] })] }), _jsxs("div", { className: "mt-6 bg-white dark:bg-slate-800 p-5 rounded shadow", children: [_jsx("h2", { className: "text-lg font-semibold text-slate-800 dark:text-white mb-3", children: "\uD83E\uDDE0 Full Summary" }), data.status && (_jsxs("p", { className: "text-sm text-slate-700 dark:text-slate-300", children: ["\uD83D\uDCE1 ", _jsx("strong", { children: "Status:" }), " ", data.status] })), data.patternHits && Object.keys(data.patternHits).length > 0 && (_jsx("ul", { className: "mt-4 list-disc pl-5 text-sm text-slate-600 dark:text-slate-400", children: Object.entries(data.patternHits).map(([pattern, count], idx) => (_jsxs("li", { children: [pattern, ": ", _jsx("strong", { children: count }), " matches"] }, idx))) })), _jsx(AITrainerPanel, {})] })] }));
}

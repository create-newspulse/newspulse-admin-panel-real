import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { founderApi } from '@/lib/founderApi';
export default function FounderAnalytics() {
    const [growth, setGrowth] = useState([]);
    const [health, setHealth] = useState(null);
    const [insights, setInsights] = useState([]);
    const [heatmap, setHeatmap] = useState([]);
    useEffect(() => {
        founderApi.analyticsTrafficGrowth().then((r) => setGrowth(r.points || []));
        founderApi.analyticsHealth().then(setHealth);
        founderApi.insights().then((r) => setInsights(r.items || []));
        founderApi.analyticsHeatmap().then((r) => setHeatmap(r.matrix || []));
    }, []);
    return (_jsxs("div", { className: "rounded-2xl p-4 bg-executive-card text-white border border-white/5 space-y-3", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Founder Tools & Analytics" }), _jsxs("div", { className: "text-sm", children: ["Traffic Growth: ", _jsx("span", { className: "text-cyan-300", children: growth.join(' ΓåÆ ') || 'ΓÇö' })] }), _jsxs("div", { className: "text-sm", children: ["System Health: ", _jsxs("span", { className: "text-emerald-300", children: ["uptime ", health?.uptime ?? 'ΓÇö', "%"] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs uppercase text-slate-400", children: "Performance Heatmap" }), _jsxs("div", { className: "inline-grid mt-2", style: { gridTemplateColumns: `repeat(${heatmap[0]?.length || 0}, 1.5rem)` }, children: [heatmap.flatMap((row, ri) => row.map((val, ci) => (_jsx("div", { className: "w-6 h-6 m-0.5 rounded-sm", style: { backgroundColor: `rgba(99,102,241,${0.2 + Math.min(1, val / 3) * 0.8})` }, title: `row ${ri} col ${ci}: ${val}` }, `${ri}-${ci}`)))), (!heatmap || heatmap.length === 0) && _jsx("div", { className: "text-slate-400 text-sm", children: "\u2014" })] })] }), _jsxs("div", { children: [_jsx("div", { className: "text-xs uppercase text-slate-400", children: "KiranOS Insights" }), _jsxs("ul", { className: "list-disc list-inside text-slate-200 text-sm", children: [insights.map((i) => _jsx("li", { children: i }, i)), insights.length === 0 && _jsx("li", { children: "\u2014" })] })] })] }));
}

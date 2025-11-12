import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import StatsCards from '@components/StatsCards';
import NewsCard from '@components/NewsCard';
import LiveTicker from '@components/LiveTicker';
import VoicePlayer from '@components/VoicePlayer';
import ChartComponent from '@components/ChartComponent';
import VoiceAndExplainer from '@components/VoiceAndExplainer';
import SystemHealthBadge from '@components/SystemHealthBadge';
import SystemHealthPanel from '@components/SystemHealthPanel';
// api client from src/lib/api.ts (default export = axios instance)
import apiClient from '@lib/api';
const Dashboard = () => {
    const { t, i18n } = useTranslation();
    const [stats, setStats] = useState(null);
    const [aiCommand, setAiCommand] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [debugExpanded, setDebugExpanded] = useState(false);
    // Use relative /api so Vite proxy handles the active backend port in development
    const API_BASE = '/api';
    const articles = useMemo(() => [
        { _id: '1', title: t('aiSummaryTitle'), summary: t('aiSummaryBody') },
        { _id: '2', title: t('topNewsTitle'), summary: t('topNewsBody') },
    ], [t]);
    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            setError(null);
            // normalize payload into your DashboardStats shape
            const normalize = (raw) => {
                const totals = raw?.totals || {};
                const byCategory = Array.isArray(raw?.byCategory) ? raw.byCategory : [];
                const byLanguage = Array.isArray(raw?.byLanguage) ? raw.byLanguage : [];
                const categoriesTotal = Number(totals.categories ?? raw?.categories ?? (Array.isArray(byCategory) ? byCategory.length : 0));
                const languagesTotal = Number(totals.languages ?? raw?.languages ?? (Array.isArray(byLanguage) ? byLanguage.length : 0));
                return {
                    total: Number(raw?.total ?? totals.news ?? 0),
                    byCategory,
                    byLanguage,
                    categoriesTotal,
                    languagesTotal,
                    recent: Array.isArray(raw?.recent) ? raw.recent : [],
                    aiLogs: Number(raw?.aiLogs ?? totals.aiLogs ?? 0),
                    activeUsers: Number(raw?.activeUsers ?? totals.users ?? 0),
                };
            };
            try {
                // Prefer the centralized axios client (handles base, creds, errors)
                try {
                    const r1 = await apiClient.get('/dashboard-stats');
                    const payload = r1.data?.data ?? r1.data;
                    setStats(normalize(payload));
                    return;
                }
                catch (e1) {
                    // Fallback alias
                    const r2 = await apiClient.get('/stats');
                    const payload2 = r2.data?.data ?? r2.data;
                    setStats(normalize(payload2));
                }
            }
            catch (err) {
                console.error('Γ¥î Dashboard API Error:', err?.message || err);
                setError('Failed to load dashboard stats. Please ensure the backend server is running.');
            }
            finally {
                setLoading(false);
            }
        };
        const fetchAICommand = async () => {
            try {
                // Use serverless health endpoint to guarantee JSON for the debug box
                const r = await fetch('/api/system/health', { credentials: 'include' });
                const ct = r.headers.get('content-type') || '';
                if (!ct.includes('application/json')) {
                    const text = await r.text();
                    setAiCommand({ _nonJson: true, contentType: ct || 'unknown', preview: text.slice(0, 600) });
                    return;
                }
                const json = await r.json();
                setAiCommand(json);
            }
            catch (err) {
                console.error('Γ¥î AI Command API Error:', err?.message || err);
                setAiCommand({ _error: err?.message || 'Unknown error' });
            }
        };
        fetchStats();
        fetchAICommand();
    }, [API_BASE, t]);
    const langCode = (i18n.language?.split('-')[0] || 'en');
    // Feature flag: disable the yellow scrolling ticker by default.
    // Enable by setting VITE_SHOW_TICKER=true at build time.
    const SHOW_TICKER = (import.meta.env.VITE_SHOW_TICKER === 'true');
    return (_jsx("main", { className: "min-h-screen bg-gradient-to-b from-white to-gray-100 dark:from-slate-900 dark:to-slate-800 text-gray-900 dark:text-white transition-all duration-500", children: _jsxs("div", { className: "max-w-7xl mx-auto px-6 py-10 space-y-12", children: [_jsxs("header", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-4", children: [_jsxs("h1", { className: "text-4xl font-extrabold tracking-tight text-slate-800 dark:text-white", children: ["\uD83D\uDCCA ", t('dashboard')] }), _jsx("div", { className: "mt-1 sm:mt-0", children: _jsx(SystemHealthBadge, {}) })] }), loading && (_jsxs("div", { className: "text-center text-gray-500 dark:text-gray-400", children: ["\u23F3 ", t('loadingDashboard')] })), error && (_jsxs("div", { className: "text-center text-red-600 font-medium", children: ["\u274C ", error] })), stats && (_jsxs(_Fragment, { children: [_jsx("section", { children: _jsx(StatsCards, { totalNews: stats.total, categoryCount: stats.categoriesTotal, languageCount: stats.languagesTotal, activeUsers: stats.activeUsers, aiLogs: stats.aiLogs }) }), _jsx("section", { children: _jsx(ChartComponent, {}) }), _jsx("section", { children: _jsx(SystemHealthPanel, {}) }), SHOW_TICKER && (_jsx("section", { children: _jsx(LiveTicker, { apiUrl: `${API_BASE}/news-ticker`, position: "top" }) })), _jsxs("section", { children: [_jsx(VoiceAndExplainer, { text: t('aiSummaryBody') }), _jsx(VoicePlayer, { text: t('topNewsBody'), language: langCode })] })] })), _jsxs("section", { "aria-labelledby": "ai-insights", children: [_jsxs("h2", { id: "ai-insights", className: "text-2xl font-semibold text-slate-700 dark:text-slate-100 mb-6 flex items-center gap-2", children: ["\uD83E\uDDE0 ", t('weeklyAiInsights')] }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-6", children: articles.map((article) => (_jsx(NewsCard, { article: article }, article._id))) }), aiCommand && (_jsxs("div", { className: "mt-10 p-4 bg-slate-100 dark:bg-slate-700 rounded", children: [_jsx("h2", { className: "text-lg font-semibold", children: "\uD83D\uDD10 AI Command Debug" }), aiCommand._nonJson ? (_jsxs("div", { className: "text-xs text-red-200/90 bg-red-700/30 border border-red-400/40 rounded p-3 mt-2", children: [_jsx("p", { className: "mb-2 font-medium", children: "Non-JSON response from /system/ai-command" }), _jsxs("p", { className: "mb-2", children: ["content-type: ", _jsx("code", { children: aiCommand.contentType })] }), _jsx("pre", { className: "ai-debug-box text-[11px]", children: debugExpanded ? aiCommand.preview : String(aiCommand.preview ?? '').slice(0, 300) + (String(aiCommand.preview ?? '').length > 300 ? 'ΓÇª' : '') }), _jsx("button", { className: "mt-2 inline-flex items-center px-3 py-1 rounded bg-slate-800 text-white text-xs hover:bg-slate-900 disabled:opacity-60", onClick: () => setDebugExpanded((v) => !v), children: debugExpanded ? 'Show Less' : 'Show More' }), _jsx("p", { className: "mt-2 opacity-80", children: "Tip: ensure this endpoint returns application/json in production; if unauthorized, the backend should return 401 with a JSON body." })] })) : (_jsxs("div", { children: [_jsx("pre", { className: "ai-debug-box text-sm", children: debugExpanded
                                                ? JSON.stringify(aiCommand, null, 2)
                                                : JSON.stringify(aiCommand, null, 2).slice(0, 600) + (JSON.stringify(aiCommand, null, 2).length > 600 ? 'ΓÇª' : '') }), _jsx("button", { className: "mt-2 inline-flex items-center px-3 py-1 rounded bg-slate-800 text-white text-xs hover:bg-slate-900 disabled:opacity-60", onClick: () => setDebugExpanded((v) => !v), children: debugExpanded ? 'Show Less' : 'Show More' })] }))] }))] })] }) }));
};
export default Dashboard;

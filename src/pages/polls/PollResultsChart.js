import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import apiClient from '@lib/api';
export default function PollResultsChart() {
    const { t } = useTranslation();
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        (async () => {
            try {
                setLoading(true);
                // Try serverless first, then fallback to backend
                const endpoints = ['/api/polls/results', '/api/polls/latest/results'];
                let data = null;
                for (const url of endpoints) {
                    try {
                        const res = await apiClient.get(url);
                        data = res?.data ?? res;
                        if (data)
                            break;
                    }
                    catch (_) {
                        // try next
                    }
                }
                if (!data) {
                    setResults([
                        { option: 'Option A', votes: 42 },
                        { option: 'Option B', votes: 35 },
                        { option: 'Option C', votes: 23 },
                    ]);
                }
                else {
                    setResults(Array.isArray(data?.results) ? data.results : []);
                }
            }
            catch (e) {
                setError(e?.message || 'Failed to load results');
            }
            finally {
                setLoading(false);
            }
        })();
    }, []);
    const totalVotes = results.reduce((sum, r) => sum + r.votes, 0) || 1;
    return (_jsxs("div", { className: "max-w-3xl mx-auto bg-white dark:bg-slate-800 p-6 rounded-lg shadow border border-slate-200 dark:border-slate-700", children: [_jsx("h1", { className: "text-2xl font-bold mb-4 text-slate-900 dark:text-white", children: t('pollResults') || 'Poll Results' }), loading && _jsx("div", { className: "text-slate-500", children: t('loading') || 'Loading...' }), error && _jsx("div", { className: "text-red-600", children: error }), !loading && !error && (_jsx("div", { className: "space-y-3", children: results.map((r) => {
                    const pct = Math.round((r.votes / totalVotes) * 100);
                    return (_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { className: "font-medium text-slate-800 dark:text-slate-200", children: r.option }), _jsxs("span", { className: "text-slate-600 dark:text-slate-300", children: [pct, "% \u2022 ", r.votes, " votes"] })] }), _jsx("div", { className: "w-full h-3 bg-slate-200 dark:bg-slate-700 rounded", children: _jsx("div", { className: "h-3 bg-blue-600 rounded", style: { width: `${pct}%` } }) })] }, r.option));
                }) }))] }));
}

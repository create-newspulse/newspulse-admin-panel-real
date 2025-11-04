import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { FaPlay, FaPause, FaSyncAlt, FaClock, FaCogs } from 'react-icons/fa';
const DEFAULT_JOBS = [
    { key: 'autoNews', label: 'Auto News Ingestion', running: false },
    { key: 'dailyQuote', label: 'Daily Quote', running: false },
    { key: 'dailyWonder', label: 'Daily Wonder', running: false },
    { key: 'todayHistory', label: "Today in History", running: false },
    { key: 'pollSeed', label: 'Seed Sample Poll', running: false },
    { key: 'pushAlerts', label: 'Push Alerts', running: false },
];
export default function AutomationCenter() {
    const [jobs, setJobs] = useState(DEFAULT_JOBS);
    const [loading, setLoading] = useState(false);
    const [serverOnline, setServerOnline] = useState(null);
    const refresh = async () => {
        setLoading(true);
        try {
            // Try read status from backend; tolerate absence by keeping defaults
            const data = await fetchJson(`${API_BASE_PATH}/system/jobs/status`).catch(() => ({ jobs: {} }));
            setJobs(prev => prev.map(j => ({
                ...j,
                running: data.jobs?.[j.key]?.running ?? j.running,
                lastRun: data.jobs?.[j.key]?.lastRun ?? j.lastRun,
            })));
            setServerOnline(true);
        }
        catch {
            setServerOnline(false);
        }
        finally {
            setLoading(false);
        }
    };
    useEffect(() => { refresh(); }, []);
    const toggleJob = async (key, start) => {
        try {
            const path = start ? 'start' : 'stop';
            const res = await fetch(`${API_BASE_PATH}/system/jobs/${path}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ key }),
            });
            if (!res.ok)
                throw new Error('Request failed');
            const now = new Date().toISOString();
            setJobs(prev => prev.map(j => j.key === key ? { ...j, running: start, lastRun: start ? now : j.lastRun, error: null } : j));
        }
        catch (e) {
            setJobs(prev => prev.map(j => j.key === key ? { ...j, error: e?.message || 'Failed' } : j));
        }
    };
    const runOnce = async (key) => {
        try {
            const res = await fetch(`${API_BASE_PATH}/system/jobs/run-once`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ key }),
            });
            if (!res.ok)
                throw new Error('Request failed');
            const now = new Date().toISOString();
            setJobs(prev => prev.map(j => j.key === key ? { ...j, lastRun: now, error: null } : j));
        }
        catch (e) {
            setJobs(prev => prev.map(j => j.key === key ? { ...j, error: e?.message || 'Failed' } : j));
        }
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h3", { className: "text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2", children: [_jsx(FaCogs, {}), " Automation Center"] }), _jsxs("button", { onClick: refresh, className: "px-3 py-1.5 text-xs bg-slate-700 text-white rounded hover:bg-slate-600 flex items-center gap-1", children: [_jsx(FaSyncAlt, { className: loading ? 'animate-spin' : '' }), " Refresh"] })] }), serverOnline === false && (_jsx("div", { className: "p-3 rounded bg-yellow-100 text-yellow-800 text-sm", children: "Backend job API not available; controls will simulate state locally." })), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-3", children: jobs.map(job => (_jsxs("div", { className: "p-4 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-semibold text-slate-800 dark:text-slate-100", children: job.label }), _jsxs("div", { className: "text-xs text-slate-500 flex items-center gap-2 mt-1", children: [_jsx("span", { className: `px-2 py-0.5 rounded ${job.running ? 'bg-green-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`, children: job.running ? 'RUNNING' : 'STOPPED' }), job.lastRun && (_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx(FaClock, {}), " ", new Date(job.lastRun).toLocaleString()] }))] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: () => toggleJob(job.key, true), className: "px-3 py-2 rounded bg-green-600 text-white text-xs hover:bg-green-700 flex items-center gap-1", disabled: job.running, title: "Start", children: [_jsx(FaPlay, {}), " Start"] }), _jsxs("button", { onClick: () => toggleJob(job.key, false), className: "px-3 py-2 rounded bg-red-600 text-white text-xs hover:bg-red-700 flex items-center gap-1", disabled: !job.running, title: "Stop", children: [_jsx(FaPause, {}), " Stop"] }), _jsx("button", { onClick: () => runOnce(job.key), className: "px-3 py-2 rounded bg-blue-600 text-white text-xs hover:bg-blue-700", title: "Run Once", children: "Run" })] })] }), job.error && _jsx("div", { className: "text-xs text-red-600 mt-2", children: job.error })] }, job.key))) })] }));
}

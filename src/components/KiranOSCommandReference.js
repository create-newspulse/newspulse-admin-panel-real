import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
const COMMANDS = [
    {
        key: 'ai-status',
        title: 'AI Status',
        description: 'Check whether KiranOS is online and operational.',
        examples: ['ai status', 'check ai status'],
    },
    {
        key: 'system-check',
        title: 'Start System Check',
        description: 'Run a quick diagnostics sweep for core services.',
        examples: ['start system check', 'run system diagnostics'],
    },
    {
        key: 'optimize',
        title: 'Optimize Website',
        description: 'Trigger performance/SEO optimization routines.',
        examples: ['optimize website', 'run optimization'],
    },
    {
        key: 'backup',
        title: 'Backup System',
        description: 'Start a system backup (database + critical files).',
        examples: ['backup system', 'run backup now'],
    },
    {
        key: 'traffic',
        title: 'Traffic Report',
        description: 'Get a snapshot of recent traffic analytics.',
        examples: ['traffic report', 'show analytics'],
    },
    {
        key: 'security',
        title: 'Security Scan',
        description: 'Initiate threat detection and security scan.',
        examples: ['security scan', 'run threat scan'],
    },
    {
        key: 'update-ai',
        title: 'Update AI',
        description: 'Refresh AI models/memory for improved decisions.',
        examples: ['update ai', 'refresh ai'],
    },
    {
        key: 'pause',
        title: 'Pause Automation',
        description: 'Temporarily pause automated AI tasks.',
        examples: ['pause automation', 'pause ai'],
    },
    {
        key: 'resume',
        title: 'Resume AI',
        description: 'Resume automation after a pause.',
        examples: ['resume ai', 'resume automation'],
    },
    {
        key: 'shutdown',
        title: 'Shutdown AI',
        description: 'Emergency stop for AI automation (use with caution).',
        examples: ['shutdown ai', 'stop ai now'],
    },
];
function copyToClipboard(text) {
    try {
        navigator.clipboard?.writeText(text);
    }
    catch { }
}
export default function KiranOSCommandReference() {
    return (_jsx(React.Fragment, { children: _jsxs("div", { className: "p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow", children: [_jsx("h2", { className: "text-xl font-bold text-slate-900 dark:text-slate-100 mb-1", children: "\uD83E\uDDED KiranOS Command Reference" }), _jsx("p", { className: "text-sm text-slate-600 dark:text-slate-300 mb-4", children: "Use these quick commands in the KiranOS panel. Type a phrase (or speak it) and press Enter." }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", children: COMMANDS.map((cmd) => (_jsxs("div", { className: "rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3", children: [_jsx("h3", { className: "font-semibold text-slate-900 dark:text-white mb-1", children: cmd.title }), _jsx("p", { className: "text-xs text-slate-600 dark:text-slate-300 mb-2", children: cmd.description }), _jsx("ul", { className: "space-y-1", children: cmd.examples.map((ex, i) => (_jsxs("li", { className: "flex items-center justify-between text-sm bg-white/50 dark:bg-slate-900/40 rounded px-2 py-1", children: [_jsx("code", { className: "text-slate-800 dark:text-slate-200", children: ex }), _jsx("button", { onClick: () => copyToClipboard(ex), className: "text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700", title: "Copy", children: "Copy" })] }, i))) })] }, cmd.key))) }), _jsxs("div", { className: "mt-4 text-xs text-slate-500 dark:text-slate-400", children: ["New ideas? Add more triggers in ", _jsx("code", { children: "admin-backend/backend/routes/system/ai-command.js" }), " and update this reference."] })] }) }));
}

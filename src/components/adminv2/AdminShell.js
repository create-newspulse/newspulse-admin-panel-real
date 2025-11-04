import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
const nav = [
    { label: 'Dashboard', href: '/admin/V2Dashboard' },
    { label: 'All News', href: '/AllNews' },
    { label: 'Manage News', href: '/ManageNews' },
    { label: 'AI Engine', href: '/admin/ai-engine' },
    { label: 'Embeds', href: '/admin/EmbedManager' },
    { label: 'Moderation', href: '/admin/Moderation' },
    { label: 'Analytics', href: '/AnalyticsDashboard' },
    { label: 'Settings', href: '/admin/Settings' },
];
export function ThemeToggle() {
    const [isDark, setIsDark] = React.useState(false);
    React.useEffect(() => {
        const root = document.documentElement;
        const next = isDark ? 'dark' : '';
        root.classList.toggle('dark', isDark);
        localStorage.setItem('np-theme', next);
    }, [isDark]);
    React.useEffect(() => {
        const saved = localStorage.getItem('np-theme');
        if (saved === 'dark')
            setIsDark(true);
    }, []);
    return (_jsx("button", { type: "button", onClick: () => setIsDark(v => !v), className: "px-3 py-2 rounded-lg text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600", "aria-label": "Toggle theme", title: "Toggle theme", children: isDark ? '🌙 Dark' : '☀️ Light' }));
}
export default function AdminShell({ children }) {
    const [open, setOpen] = React.useState(false);
    const [path, setPath] = React.useState('');
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            setPath(window.location.pathname);
        }
    }, []);
    const NavLinks = (_jsx("nav", { className: "p-3 space-y-1", children: nav.map(item => {
            const isActive = path && path.toLowerCase().startsWith(item.href.toLowerCase());
            return (_jsxs("a", { href: item.href, className: `flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors duration-150 
              ${isActive ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-100' : 'hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-slate-800'}`, children: [_jsx("span", { "aria-hidden": true, children: _jsx("span", { className: `inline-block w-1.5 h-1.5 rounded-full ${isActive ? 'bg-blue-600' : 'bg-blue-500'}` }) }), item.label] }, item.href));
        }) }));
    return (_jsx("div", { className: "min-h-screen bg-slate-100 dark:bg-[#0b1725] text-slate-900 dark:text-slate-100", children: _jsxs("div", { className: "flex", children: [_jsxs("aside", { className: `hidden md:block w-64 shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur sticky top-0 h-screen`, children: [_jsx("div", { className: "p-4 border-b border-slate-200 dark:border-slate-800", children: _jsxs("div", { className: "text-xl font-extrabold tracking-tight", children: [_jsx("span", { className: "text-blue-600", children: "News" }), "Pulse Admin"] }) }), NavLinks, _jsx("div", { className: "p-3 border-t border-slate-200 dark:border-slate-800", children: _jsx(ThemeToggle, {}) })] }), open && (_jsxs("div", { className: "md:hidden fixed inset-0 z-50", children: [_jsx("div", { className: "absolute inset-0 bg-black/40", onClick: () => setOpen(false) }), _jsxs("div", { className: "absolute inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-xl", children: [_jsxs("div", { className: "p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between", children: [_jsxs("div", { className: "text-lg font-bold", children: [_jsx("span", { className: "text-blue-600", children: "News" }), "Pulse"] }), _jsx("button", { className: "p-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800", onClick: () => setOpen(false), "aria-label": "Close", children: "\u2715" })] }), NavLinks, _jsx("div", { className: "p-3 border-t border-slate-200 dark:border-slate-800", children: _jsx(ThemeToggle, {}) })] })] })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("header", { className: "sticky top-0 z-40 bg-white/70 dark:bg-slate-900/60 backdrop-blur border-b border-slate-200 dark:border-slate-800", children: _jsxs("div", { className: "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { className: "md:hidden p-2 rounded hover:bg-slate-200/60 dark:hover:bg-slate-800", onClick: () => setOpen(v => !v), "aria-label": "Toggle menu", children: "\u2630" }), _jsx("div", { className: "font-semibold", children: "Admin Panel" }), _jsxs("div", { className: "hidden sm:flex items-center gap-2 ml-4 text-xs text-slate-500 dark:text-slate-400", children: [_jsx("span", { className: "px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800", children: "v2" }), _jsx("span", { className: "px-2 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200", children: "Design System" })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { placeholder: "Search\u2026", className: "hidden md:block px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 outline-none focus:ring-2 focus:ring-blue-500 text-sm" }), _jsx(ThemeToggle, {}), _jsx("div", { className: "ml-2 w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500", "aria-label": "User" })] })] }) }), _jsx("main", { className: "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6", children: children })] })] }) }));
}

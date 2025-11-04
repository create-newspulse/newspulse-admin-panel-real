import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
export default function GlobalCommandPalette({ open, onClose, }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);
    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 0);
        }
        else {
            setQuery('');
        }
    }, [open]);
    const commands = useMemo(() => [
        { label: 'Go: Dashboard', hint: 'Admin overview', path: '/admin/dashboard' },
        { label: 'Go: Safe Owner Zone', hint: 'Founder hub', path: '/safe-owner' },
        { label: 'Go: Add News', path: '/add' },
        { label: 'Go: Manage News', path: '/manage-news' },
        { label: 'Go: AI Engine', path: '/admin/ai-engine' },
        { label: 'Go: Analytics', path: '/admin/analytics' },
        { label: 'Go: Poll Editor', path: '/poll-editor' },
        { label: 'Go: Poll Results', path: '/poll-results' },
        { label: 'Go: Inspiration Hub', path: '/media/inspiration' },
        {
            label: 'Toggle Theme',
            hint: 'Light/Dark',
            action: () => {
                document.documentElement.classList.toggle('dark');
            },
        },
        {
            label: 'Reload',
            action: () => window.location.reload(),
        },
    ], []);
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q)
            return commands;
        return commands.filter((c) => c.label.toLowerCase().includes(q) || (c.hint || '').toLowerCase().includes(q));
    }, [query, commands]);
    const run = async (cmd) => {
        if (cmd.action)
            await cmd.action();
        if (cmd.path && cmd.path !== location.pathname)
            navigate(cmd.path);
        onClose();
    };
    if (!open)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-[1000] flex items-start justify-center p-4 bg-black/40", onClick: onClose, children: _jsxs("div", { className: "w-full max-w-xl rounded-xl overflow-hidden shadow-2xl", onClick: (e) => e.stopPropagation(), children: [_jsx("div", { className: "bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3", children: _jsx("input", { ref: inputRef, value: query, onChange: (e) => setQuery(e.target.value), placeholder: "Type a command or search\u2026 (esc to close)", className: "w-full bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400" }) }), _jsxs("ul", { className: "max-h-80 overflow-auto bg-white dark:bg-slate-900", children: [filtered.map((c, idx) => (_jsxs("li", { className: "px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between", onClick: () => run(c), children: [_jsx("span", { className: "text-slate-800 dark:text-slate-100", children: c.label }), c.hint && _jsx("span", { className: "text-xs text-slate-500 dark:text-slate-400", children: c.hint })] }, `${c.label}-${idx}`))), filtered.length === 0 && (_jsx("li", { className: "px-4 py-6 text-center text-slate-500 dark:text-slate-400", children: "No results" }))] })] }) }));
}

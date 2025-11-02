import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { founderApi } from '@/lib/founderApi';
export default function AiLogsViewer() {
    const [rows, setRows] = useState([]);
    const [nextCursor, setNextCursor] = useState(null);
    const [prevStack, setPrevStack] = useState([]);
    async function load(cursor) {
        const r = await founderApi.getAiLogs(cursor);
        setRows(r.logs || []);
        setNextCursor(r.nextCursor ?? null);
    }
    useEffect(() => { load(); }, []);
    return (_jsxs("div", { className: "rounded-2xl p-4 bg-executive-card text-white border border-white/5", children: [_jsx("h3", { className: "text-lg font-semibold", children: "AI Logs" }), _jsx("div", { className: "mt-3 overflow-x-auto", children: _jsxs("table", { className: "min-w-full text-sm", children: [_jsx("thead", { className: "text-left text-slate-400", children: _jsxs("tr", { children: [_jsx("th", { className: "py-2", children: "Time" }), _jsx("th", { children: "Action" }), _jsx("th", { children: "Subject" }), _jsx("th", { children: "Result" })] }) }), _jsxs("tbody", { className: "divide-y divide-white/5", children: [rows.map(r => (_jsxs("tr", { className: "hover:bg-white/5", children: [_jsx("td", { className: "py-2", children: new Date(r.time).toLocaleString() }), _jsx("td", { children: r.action }), _jsx("td", { children: r.subject }), _jsx("td", { children: r.result })] }, r.id))), rows.length === 0 && (_jsx("tr", { children: _jsx("td", { className: "py-4 text-slate-400", colSpan: 4, children: "No logs" }) }))] })] }) }), _jsxs("div", { className: "mt-3 flex items-center justify-between text-sm", children: [_jsx("button", { className: "px-3 py-1 rounded bg-slate-700 disabled:opacity-50", onClick: () => { const prev = prevStack[prevStack.length - 1]; const rest = prevStack.slice(0, -1); setPrevStack(rest); load(prev); }, disabled: prevStack.length === 0, children: "Prev" }), _jsx("button", { className: "px-3 py-1 rounded bg-slate-700 disabled:opacity-50", onClick: () => { if (nextCursor) {
                            setPrevStack([...prevStack, nextCursor]);
                            load(nextCursor);
                        } }, disabled: !nextCursor, children: "Next" })] })] }));
}

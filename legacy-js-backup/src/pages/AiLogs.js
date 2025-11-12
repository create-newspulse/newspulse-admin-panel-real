import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ≡ƒôü src/pages/AiLogs.tsx
import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
export default function AiLogs() {
    const [logs, setLogs] = useState([]);
    useEffect(() => {
        fetch(`${API_BASE_PATH}/ai/logs`, { credentials: 'include' })
            .then(async (res) => {
            const ct = res.headers.get('content-type') || '';
            if (!res.ok || !ct.includes('application/json')) {
                const txt = await res.text().catch(() => '');
                throw new Error(`Expected JSON, got "${ct}". Body: ${txt.slice(0, 160)}`);
            }
            return res.json();
        })
            .then((data) => setLogs(data.logs || []))
            .catch(() => setLogs([]));
    }, []);
    return (_jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-xl font-bold mb-4", children: "\uD83D\uDCDC AI Logs" }), _jsxs("div", { className: "space-y-2", children: [logs.map((log, index) => (_jsxs("div", { className: "bg-slate-800 p-3 rounded", children: [_jsxs("p", { className: "text-sm", children: ["\uD83E\uDDE0 ", log.tool] }), _jsx("p", { className: "text-xs text-gray-400", children: log.timestamp })] }, index))), logs.length === 0 && _jsx("p", { className: "text-gray-500", children: "No logs yet." })] })] }));
}

import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { founderApi } from '@/lib/founderApi';
export default function AiManagerPanel() {
    const [trustMeter, setTrust] = useState(true);
    const [factChecker, setFact] = useState(true);
    const [autoDelete, setAuto] = useState(false);
    const [command, setCommand] = useState('');
    async function save() { await founderApi.aiToggles({ trustMeter, factChecker, autoDelete }); }
    async function run() { await founderApi.aiCommand(command); setCommand(''); }
    return (_jsxs("div", { className: "rounded-2xl p-4 bg-executive-card text-white border border-white/5 space-y-3", children: [_jsx("h3", { className: "text-lg font-semibold", children: "AI System Control" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3 text-sm", children: [_jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: trustMeter, onChange: e => setTrust(e.target.checked) }), " TrustMeter"] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: factChecker, onChange: e => setFact(e.target.checked) }), " FactChecker"] }), _jsxs("label", { className: "flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: autoDelete, onChange: e => setAuto(e.target.checked) }), " AutoDelete/Flag"] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: save, className: "px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white ring-1 ring-cyan-400/30", children: "Save" }), _jsx("input", { className: "flex-1 bg-black/40 border border-white/10 rounded px-3", placeholder: "/lock all, /diagnose system", value: command, onChange: e => setCommand(e.target.value) }), _jsx("button", { onClick: run, className: "px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white", children: "Run" })] })] }));
}

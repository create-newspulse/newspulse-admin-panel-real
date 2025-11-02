import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
export default function LegalOwnership() {
    const [certs, setCerts] = useState([]);
    const [pti, setPti] = useState('');
    const [nominee, setNominee] = useState('');
    const [unlockFile, setUnlockFile] = useState(null);
    useEffect(() => {
        fetch('/api/founder/legal/certificates', { headers: { 'x-role': 'founder' } })
            .then(r => r.json()).then((r) => setCerts(r.items || []));
    }, []);
    async function savePTI() {
        await fetch('/api/founder/legal/pti-settings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-role': 'founder' }, body: JSON.stringify({ filters: pti }) });
    }
    async function setSuccessor() {
        const fd = new FormData();
        if (unlockFile)
            fd.append('unlock', unlockFile);
        fd.append('nominee', nominee);
        // For simplicity (and vercel serverless), send as JSON without file in mock mode
        await fetch('/api/founder/legal/successor', { method: 'POST', headers: { 'content-type': 'application/json', 'x-role': 'founder' }, body: JSON.stringify({ nominee }) });
        setNominee('');
    }
    return (_jsxs("div", { className: "rounded-2xl p-4 bg-executive-card text-white border border-white/5 space-y-4", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Legal & Ownership" }), _jsxs("section", { children: [_jsx("div", { className: "text-xs uppercase text-slate-400", children: "Ownership Certificates" }), _jsxs("ul", { className: "list-disc list-inside text-sm mt-2", children: [certs.map(c => (_jsx("li", { children: _jsx("a", { className: "text-cyan-300 underline", href: c.url, target: "_blank", rel: "noreferrer", children: c.name }) }, c.id))), certs.length === 0 && _jsx("li", { className: "text-slate-400", children: "\u2014" })] })] }), _jsxs("section", { className: "space-y-2", children: [_jsx("div", { className: "text-xs uppercase text-slate-400", children: "PTI/Legal Default Filters" }), _jsx("textarea", { className: "w-full bg-black/40 border border-white/10 rounded p-2 text-sm", rows: 3, placeholder: "Enter default filters (one per line)", value: pti, onChange: e => setPti(e.target.value) }), _jsx("button", { onClick: savePTI, className: "px-3 py-2 rounded bg-cyan-700 hover:bg-cyan-600 text-white", children: "Save Filters" })] }), _jsxs("section", { className: "space-y-2", children: [_jsx("div", { className: "text-xs uppercase text-slate-400", children: "Successor Transfer" }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-2", children: [_jsx("input", { className: "bg-black/40 border border-white/10 rounded px-3 py-2", placeholder: "Nominee email", value: nominee, onChange: e => setNominee(e.target.value) }), _jsx("input", { type: "file", className: "bg-black/40 border border-white/10 rounded px-3 py-2", onChange: e => setUnlockFile(e.target.files?.[0] || null) }), _jsx("button", { onClick: setSuccessor, className: "px-3 py-2 rounded bg-amber-700 hover:bg-amber-600 text-white", children: "Upload & Set" })] })] }), _jsxs("div", { className: "flex gap-2 text-sm", children: [_jsx("a", { className: "underline text-cyan-300", href: "/terms", target: "_blank", children: "T&C" }), _jsx("a", { className: "underline text-cyan-300", href: "/privacy", target: "_blank", children: "Privacy" }), _jsx("a", { className: "underline text-cyan-300", href: "/safe-content", target: "_blank", children: "Safe Content Guide" })] })] }));
}

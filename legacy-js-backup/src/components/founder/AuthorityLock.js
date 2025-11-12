import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { founderApi } from '@/lib/founderApi';
export default function AuthorityLock() {
    const [locked, setLocked] = useState(false);
    async function toggle() {
        const next = !locked;
        await founderApi.setAuthorityLock(next);
        setLocked(next);
    }
    return (_jsxs("div", { className: "rounded-2xl p-4 bg-executive-card text-white border border-white/5", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Authority Lock" }), _jsx("button", { onClick: toggle, className: `px-3 py-2 rounded ${locked ? 'bg-rose-600' : 'bg-emerald-600'} text-white`, children: locked ? 'Unlock' : 'Enable Lock' })] }), _jsx("p", { className: "mt-2 text-sm text-slate-300", children: "When enabled, all non-founder admin logins are blocked." })] }));
}

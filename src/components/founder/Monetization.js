import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { founderApi } from '@/lib/founderApi';
export default function Monetization() {
    const [sum, setSum] = useState(null);
    const [earn, setEarn] = useState(null);
    const [locked, setLocked] = useState(false);
    useEffect(() => {
        founderApi.monetizationSummary().then(setSum);
        founderApi.monetizationEarnings('monthly').then(setEarn);
    }, []);
    async function toggleLock() {
        const next = !locked;
        await founderApi.monetizationLock(next);
        setLocked(next);
    }
    async function exportCsv() {
        const r = await founderApi.monetizationExport();
        if (r?.url)
            window.open(r.url, '_blank');
    }
    return (_jsxs("div", { className: "rounded-2xl p-4 bg-executive-card text-white border border-white/5 space-y-2", children: [_jsx("h3", { className: "text-lg font-semibold", children: "Monetization" }), _jsxs("div", { className: "text-sm", children: ["AdSense/Affiliate/Sponsor: ", _jsx("span", { className: "text-emerald-300", children: sum ? `${sum.adsense}/${sum.affiliate}/${sum.sponsor}` : '—' })] }), _jsxs("div", { className: "text-sm", children: ["Founder Earnings: ", _jsx("span", { className: "text-cyan-300", children: earn ? `daily $${earn.daily} • monthly $${earn.monthly}` : '—' })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: exportCsv, className: "px-3 py-2 rounded bg-cyan-700 hover:bg-cyan-600", children: "Export CSV" }), _jsx("button", { onClick: toggleLock, className: `px-3 py-2 rounded ${locked ? 'bg-amber-800' : 'bg-amber-700'} hover:bg-amber-600`, children: locked ? 'Unlock Revenue' : 'Revenue Lock' })] })] }));
}

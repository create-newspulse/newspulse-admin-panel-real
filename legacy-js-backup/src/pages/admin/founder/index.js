import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import FounderProfileCard from '@/components/founder/FounderProfileCard';
import TwoFactorSetup from '@/components/founder/TwoFactorSetup';
import AuthorityLock from '@/components/founder/AuthorityLock';
import AiManagerPanel from '@/components/founder/AiManagerPanel';
import AiLogsViewer from '@/components/founder/AiLogsViewer';
import MasterControls from '@/components/founder/MasterControls';
import LegalOwnership from '@/components/founder/LegalOwnership';
import Monetization from '@/components/founder/Monetization';
import FounderAnalytics from '@/components/founder/FounderAnalytics';
import SecurityEmergency from '@/components/founder/SecurityEmergency';
import FounderRoute from '@/routes/FounderRoute';
import { founderApi } from '@/lib/founderApi';
const tabs = [
    'Identity & Access',
    'AI System Control',
    'Website Master Controls',
    'Legal & Ownership',
    'Monetization',
    'Founder Tools & Analytics',
    'Security & Emergency',
    'AI Logs',
];
export default function FounderControlPage() {
    const [active, setActive] = useState(0);
    const [summary, setSummary] = useState(null);
    useEffect(() => {
        let timer;
        const load = async () => setSummary(await founderApi.getSystemSummary());
        load();
        timer = setInterval(load, 15000);
        return () => clearInterval(timer);
    }, []);
    const content = (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "rounded-xl p-3 bg-gradient-to-r from-black/60 to-executive-card text-slate-200 border border-white/5 flex items-center gap-4 text-sm", children: [_jsxs("div", { children: ["\uD83D\uDFE2 System ", _jsx("span", { className: "text-emerald-300", children: summary?.systems?.system || '...' })] }), _jsxs("div", { children: ["| AI: ", _jsx("span", { className: "text-cyan-300", children: summary?.systems?.ai || '...' })] }), _jsxs("div", { children: ["| Backup: ", _jsx("span", { className: "text-amber-300", children: summary?.systems?.backup || '...' })] }), _jsxs("div", { children: ["| Security: ", _jsx("span", { className: "text-purple-300", children: summary?.systems?.security || '...' })] }), _jsx("div", { className: "ml-auto text-xs text-slate-400", children: summary?.updatedAt ? new Date(summary.updatedAt).toLocaleTimeString() : '' })] }), _jsx("div", { className: "flex flex-wrap gap-2", children: tabs.map((t, i) => (_jsx("button", { onClick: () => setActive(i), className: `px-3 py-2 rounded-full border border-white/10 text-sm ${i === active ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/20' : 'bg-black/40 text-slate-200 hover:bg-black/30'}`, children: t }, t))) }), _jsx("div", { className: "min-h-[300px]", children: _jsx(AnimatePresence, { mode: "wait", children: _jsxs(motion.div, { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.2 }, children: [active === 0 && (_jsxs("div", { className: "grid md:grid-cols-2 gap-4", children: [_jsx(FounderProfileCard, {}), _jsx(TwoFactorSetup, {}), _jsx(AuthorityLock, {})] })), active === 1 && (_jsx(AiManagerPanel, {})), active === 2 && (_jsx(MasterControls, {})), active === 3 && (_jsx(LegalOwnership, {})), active === 4 && (_jsx(Monetization, {})), active === 5 && (_jsx(FounderAnalytics, {})), active === 6 && (_jsx(SecurityEmergency, {})), active === 7 && (_jsx(AiLogsViewer, {}))] }, active) }) })] }));
    return (_jsx(FounderRoute, { children: _jsxs("div", { className: "bg-executive-bg min-h-[60vh] text-white", children: [_jsxs("header", { className: "mb-4", children: [_jsx("h1", { className: "text-2xl font-bold bg-gradient-to-r from-cyan-400 via-amber-300 to-purple-400 bg-clip-text text-transparent", children: "Founder Control" }), _jsx("p", { className: "text-slate-400 text-sm", children: "Strictly founder-only area. Executive dark theme." })] }), content] }) }));
}

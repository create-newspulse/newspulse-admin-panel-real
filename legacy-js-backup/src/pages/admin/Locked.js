import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Γ£à src/pages/admin/Locked.tsx
import { FaLock } from 'react-icons/fa';
export default function LockedPage() {
    return (_jsx("div", { className: "min-h-screen flex items-center justify-center bg-slate-900 text-white px-4", children: _jsxs("div", { className: "bg-slate-800 border border-red-500 rounded-xl shadow-lg p-8 max-w-md text-center", children: [_jsx(FaLock, { className: "text-red-500 text-4xl mb-4 mx-auto" }), _jsx("h1", { className: "text-2xl font-bold mb-2", children: "\uD83D\uDD12 Lockdown Mode Active" }), _jsx("p", { className: "text-sm mb-4", children: "This tool is temporarily disabled by the Founder. Please check back later or contact the admin for more information." }), _jsx("p", { className: "text-xs text-slate-400", children: "Powered by NewsPulse SafeZone" })] }) }));
}

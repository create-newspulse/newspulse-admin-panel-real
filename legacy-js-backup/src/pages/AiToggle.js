import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
// ≡ƒôü src/pages/AiToggle.tsx
import { useState } from 'react';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
export default function AiToggle() {
    const [enabled, setEnabled] = useState({
        summarizer: true,
        explainer: true,
        autoWriter: false,
        trustMeter: true,
    });
    const toggle = (key) => {
        setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
    };
    return (_jsxs("div", { className: "p-6", children: [_jsx("h2", { className: "text-xl font-bold mb-4", children: "\uD83E\uDDE0 AI Toggle Panel (KiranOS)" }), _jsx("ul", { className: "space-y-3", children: Object.entries(enabled).map(([tool, isOn]) => (_jsxs("li", { className: "flex items-center justify-between bg-slate-800 p-4 rounded", children: [_jsx("span", { className: "capitalize", children: tool.replace(/([A-Z])/g, ' $1') }), _jsx("button", { className: `px-3 py-1 rounded text-sm font-semibold ${isOn ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`, onClick: () => toggle(tool), children: isOn ? (_jsxs(_Fragment, { children: [_jsx(FaCheckCircle, { className: "inline mr-1" }), "Enabled"] })) : (_jsxs(_Fragment, { children: [_jsx(FaTimesCircle, { className: "inline mr-1" }), "Disabled"] })) })] }, tool))) })] }));
}

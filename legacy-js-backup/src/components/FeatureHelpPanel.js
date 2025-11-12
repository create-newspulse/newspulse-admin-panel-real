import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// ≡ƒôä src/components/FeatureHelpPanel.tsx
import { useEffect, useRef, useState } from 'react';
const features = [
    {
        title: "≡ƒºá Change AI Automation Modes",
        details: `Switches how your AI behaves ΓÇö from fully autonomous to semi-manual.

≡ƒöº Modes:
ΓÇó Auto-Pilot Mode ΓÇô AI does everything without you
ΓÇó Review Mode ΓÇô Needs your approval before publish
ΓÇó Safe Mode ΓÇô Disables risky features like polls

Γ£à Example:
During elections, you use ΓÇ£Review ModeΓÇ¥ to avoid mistakes.`,
    },
    {
        title: "≡ƒöÉ Trigger Emergency System Lockdown",
        details: `Stops all automation & publishing in case of emergency.

≡ƒöÆ Locked Items:
ΓÇó AI tools
ΓÇó Editor access
ΓÇó Public site content pipeline

Γ£à Example:
You see a flagged story going viral for wrong reasons. Lockdown now.`,
    },
    {
        title: "≡ƒ¢é Grant or Revoke Editor/Admin Access",
        details: `Manage team roles securely.

Γ£à You Can:
ΓÇó Add/Remove editors
ΓÇó Set access level (View, Publish, Moderate)

Γ£à Example:
Give temporary editor rights to a journalist for YouthZone.`,
    },
    {
        title: "≡ƒôè Traffic Analytics",
        details: `Shows full visitor reports:
ΓÇó Pageviews, sources, peak hours
ΓÇó Bounce rates, top regions

Γ£à Example:
Find when users are most active to schedule posts.`,
    },
    // Γ₧ò Add more features as needed...
];
const FeatureHelpPanel = () => {
    const [expandedIndex, setExpandedIndex] = useState(0); // auto-expand first item
    const [filter, setFilter] = useState('');
    const buttonRefs = useRef([]);
    const filtered = features.filter((f) => f.title.toLowerCase().includes(filter.toLowerCase()) ||
        f.details.toLowerCase().includes(filter.toLowerCase()));
    const handleKeyDown = (e, index) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = (index + 1) % filtered.length;
            buttonRefs.current[next]?.focus();
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prev = (index - 1 + filtered.length) % filtered.length;
            buttonRefs.current[prev]?.focus();
        }
        else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpandedIndex(expandedIndex === index ? -1 : index);
        }
    };
    useEffect(() => {
        buttonRefs.current = buttonRefs.current.slice(0, filtered.length);
    }, [filtered]);
    return (_jsxs("section", { className: "p-6 max-h-[90vh] overflow-y-auto text-slate-700 dark:text-slate-200", children: [_jsx("h2", { className: "text-2xl font-bold mb-4", children: "\uD83D\uDCD8 SafeOwnerZone \u2013 Panel Guide" }), _jsx("input", { type: "text", placeholder: "Search a panel...", className: "w-full mb-4 px-3 py-2 border rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-sm", value: filter, onChange: (e) => setFilter(e.target.value) }), filtered.map((feature, i) => (_jsxs("div", { className: "mb-4 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800", children: [_jsx("button", { ref: (el) => {
                            if (el)
                                buttonRefs.current[i] = el;
                        }, onClick: () => setExpandedIndex(expandedIndex === i ? -1 : i), onKeyDown: (e) => handleKeyDown(e, i), className: "w-full text-left px-4 py-2 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring focus:ring-blue-400", children: feature.title }), expandedIndex === i && (_jsx("div", { className: "px-4 pb-4 text-sm whitespace-pre-wrap", children: feature.details }))] }, i)))] }));
};
export default FeatureHelpPanel;

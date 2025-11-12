import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
const features = [
    {
        title: "≡ƒºá Change AI Automation Modes",
        details: `Switch how your AI behaves ΓÇö from full auto to manual.\n\n≡ƒöº Modes:\nΓÇó Auto-Pilot ΓÇô AI handles all actions\nΓÇó Review Mode ΓÇô Needs approval before publishing\nΓÇó Safe Mode ΓÇô Disables risky modules\n\nΓ£à Example:\nUse ΓÇ£Review ModeΓÇ¥ during elections to avoid auto-errors.`,
    },
    {
        title: "≡ƒöÉ Trigger Emergency System Lockdown",
        details: `Stops all automation & publishing if risk is detected.\n\n≡ƒöÆ What Locks:\nΓÇó AI tools\nΓÇó Editor access\nΓÇó Publishing jobs\n\nΓ£à Example:\nLockdown if fake news spreads virally.`,
    },
    {
        title: "≡ƒ¢é Grant or Revoke Editor/Admin Access",
        details: `Manage team access roles.\n\nΓ£à You Can:\nΓÇó Add/remove editors\nΓÇó Define permissions (View / Publish / Moderate)\n\nΓ£à Example:\nTemporary access to guest editor for YouthZone.`,
    },
    {
        title: "≡ƒÜÇ Reactivate Publishing Pipelines",
        details: `Restart paused background jobs:\nΓÇó AI digest\nΓÇó News crawler\nΓÇó Push tools\n\nΓ£à Example:\nAfter backend update, restart pipelines.`,
    },
    {
        title: "≡ƒôè Traffic Analytics",
        details: `See full traffic reports:\nΓÇó Pageviews, top hours, bounce rate\nΓÇó Region heatmap & sources\n\nΓ£à Example:\nSchedule major stories during peak activity.`,
    },
    {
        title: "≡ƒÆ░ Revenue Panel",
        details: `Track real-time earnings from:\nΓÇó AdSense\nΓÇó Affiliates\nΓÇó Sponsors\n\nΓ£à Example:\nCompare this month to last for planning promos.`,
    },
    {
        title: "≡ƒôé Backup & Recovery",
        details: `Secure system backups:\nΓÇó MongoDB\nΓÇó Config files & AI\n\nΓ£à Tools:\nΓÇó Download backup\nΓÇó Restore stable state\nΓÇó Rollback AI engine`,
    },
    {
        title: "≡ƒöÉ Login Record Tracker",
        details: `Track login history:\nΓÇó IP address, location, device ID\nΓÇó Timestamp logs\n\nΓ£à Helps detect security breaches.`,
    },
    {
        title: "≡ƒôï Compliance Audit Panel",
        details: `Auto-checks for:\nΓÇó PTI compliance\nΓÇó Copyright safety\nΓÇó Ethical journalism\nΓÇó AI moderation filters`,
    },
    {
        title: "≡ƒöÆ Auto Lockdown Switch",
        details: `Auto-lock if:\nΓÇó PTI rules are broken\nΓÇó Risk behavior detected\n\nΓ£à Prevents accidental or malicious publishing.`,
    },
    {
        title: "≡ƒöæ API Key Vault",
        details: `Store & rotate API keys:\nΓÇó OpenAI, Twitter, Maps, PTI\n\nΓ£à Features:\nΓÇó Key expiry alerts\nΓÇó Admin-only access`,
    },
    {
        title: "≡ƒôª Version Control",
        details: `Tracks system versions:\nΓÇó Git info\nΓÇó Rollback points\n\nΓ£à Export logs for legal or recovery needs.`,
    },
    {
        title: "≡ƒºá Admin Chat Audit",
        details: `Logs admin+AI convos:\nΓÇó Moderation actions\nΓÇó Command history\n\nΓ£à Enables post-mortem trace.`,
    },
    {
        title: "ΓÜû∩╕Å Guardian Rules Engine",
        details: `Sets safety rules:\nΓÇó Flag risky AI behavior\nΓÇó Auto-disable modules\nΓÇó Notify founder on threats`,
    },
    {
        title: "≡ƒÜ¿ Incident Response Module",
        details: `Handles emergency events:\nΓÇó Crash logs\nΓÇó AI failure\nΓÇó Lockdown sync`,
    },
    {
        title: "≡ƒôª Secure File Vault",
        details: `Encrypted file storage:\nΓÇó Configs\nΓÇó License keys\nΓÇó Snapshots\n\nΓ£à Features: Upload / Wipe / Download securely.`,
    },
    {
        title: "≡ƒôè Earnings Forecast AI",
        details: `Predicts future income:\nΓÇó Traffic-based modeling\nΓÇó Sponsor/AdSense forecast\n\nΓ£à Helps in planning financial goals.`,
    },
    {
        title: "≡ƒº¼ AI Behavior Trainer",
        details: `Set how AI reacts:\nΓÇó Emotion tone\nΓÇó Category-specific rules\nΓÇó Train with examples`,
    },
    {
        title: "≡ƒîì Global Threat Scanner",
        details: `Scans for threats:\nΓÇó Botnet IPs\nΓÇó Unsafe regions\nΓÇó Security risk tags\n\nΓ£à Coming soon: Real-time DB integration.`,
    },
    {
        title: "ΓÜÖ∩╕Å System Optimizer Tool",
        details: `Finds & fixes:\nΓÇó Cache bloat\nΓÇó Dependency lag\nΓÇó Speed bottlenecks`,
    },
    {
        title: "≡ƒÉ₧ Bug Report Analyzer",
        details: `Debug tool for:\nΓÇó Crash reports\nΓÇó AI fails\nΓÇó Auto-detected system bugs`,
    },
    {
        title: "≡ƒÆí Smart Alert System",
        details: `Send alerts for:\nΓÇó Login attempts\nΓÇó API failures\nΓÇó AI violations\n\nΓ£à Alert Types: Email, In-site, Telegram.`,
    },
];
const FeatureHelpPanel = () => {
    const [expandedIndex, setExpandedIndex] = useState(null);
    const [filter, setFilter] = useState('');
    const filteredFeatures = useMemo(() => features.filter((f) => f.title.toLowerCase().includes(filter.toLowerCase()) ||
        f.details.toLowerCase().includes(filter.toLowerCase())), [filter]);
    return (_jsxs("section", { className: "p-6 max-h-[90vh] overflow-y-auto text-slate-700 dark:text-slate-200", children: [_jsx("h2", { className: "text-2xl font-bold mb-4", children: "\uD83D\uDCD8 SafeOwnerZone \u2013 Panel Guide" }), _jsx("input", { type: "text", placeholder: "Search a panel...", className: "w-full mb-4 px-3 py-2 border rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-sm", value: filter, onChange: (e) => setFilter(e.target.value) }), filteredFeatures.map((feature, i) => (_jsxs("div", { className: "mb-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 transition-shadow", children: [_jsx("button", { onClick: () => setExpandedIndex(expandedIndex === i ? null : i), className: "w-full text-left px-4 py-3 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors", "aria-expanded": expandedIndex === i, "aria-controls": `feature-${i}`, children: feature.title }), expandedIndex === i && (_jsx("div", { id: `feature-${i}`, className: "px-4 pb-4 text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-300", children: feature.details }))] }, i))), filteredFeatures.length === 0 && (_jsx("p", { className: "text-center text-slate-500 mt-8", children: "\uD83D\uDD0D No matching features found." }))] }));
};
export default FeatureHelpPanel;

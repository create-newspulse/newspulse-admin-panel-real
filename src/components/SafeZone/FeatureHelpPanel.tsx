import { useState, useMemo } from 'react';

const features = [
  {
    title: "🧠 Change AI Automation Modes",
    details: `Switch how your AI behaves — from full auto to manual.\n\n🔧 Modes:\n• Auto-Pilot – AI handles all actions\n• Review Mode – Needs approval before publishing\n• Safe Mode – Disables risky modules\n\n✅ Example:\nUse “Review Mode” during elections to avoid auto-errors.`,
  },
  {
    title: "🔐 Trigger Emergency System Lockdown",
    details: `Stops all automation & publishing if risk is detected.\n\n🔒 What Locks:\n• AI tools\n• Editor access\n• Publishing jobs\n\n✅ Example:\nLockdown if fake news spreads virally.`,
  },
  {
    title: "🛂 Grant or Revoke Editor/Admin Access",
    details: `Manage team access roles.\n\n✅ You Can:\n• Add/remove editors\n• Define permissions (View / Publish / Moderate)\n\n✅ Example:\nTemporary access to guest editor for YouthZone.`,
  },
  {
    title: "🚀 Reactivate Publishing Pipelines",
    details: `Restart paused background jobs:\n• AI digest\n• News crawler\n• Push tools\n\n✅ Example:\nAfter backend update, restart pipelines.`,
  },
  {
    title: "📊 Traffic Analytics",
    details: `See full traffic reports:\n• Pageviews, top hours, bounce rate\n• Region heatmap & sources\n\n✅ Example:\nSchedule major stories during peak activity.`,
  },
  {
    title: "💰 Revenue Panel",
    details: `Track real-time earnings from:\n• AdSense\n• Affiliates\n• Sponsors\n\n✅ Example:\nCompare this month to last for planning promos.`,
  },
  {
    title: "📂 Backup & Recovery",
    details: `Secure system backups:\n• MongoDB\n• Config files & engine settings\n\n✅ Tools:\n• Download backup\n• Restore stable state\n• Rollback engine settings`,
  },
  {
    title: "🔐 Login Record Tracker",
    details: `Track login history:\n• IP address, location, device ID\n• Timestamp logs\n\n✅ Helps detect security breaches.`,
  },
  {
    title: "📋 Compliance Audit Panel",
    details: `Auto-checks for:\n• PTI compliance\n• Copyright safety\n• Ethical journalism\n• AI moderation filters`,
  },
  {
    title: "🔒 Auto Lockdown Switch",
    details: `Auto-lock if:\n• PTI rules are broken\n• Risk behavior detected\n\n✅ Prevents accidental or malicious publishing.`,
  },
  {
    title: "🔑 API Key Vault",
    details: `Store & rotate API keys:\n• OpenAI, Twitter, Maps, PTI\n\n✅ Features:\n• Key expiry alerts\n• Admin-only access`,
  },
  {
    title: "📦 Version Control",
    details: `Tracks system versions:\n• Git info\n• Rollback points\n\n✅ Export logs for legal or recovery needs.`,
  },
  {
    title: "🧠 Admin Chat Audit",
    details: `Logs admin+AI convos:\n• Moderation actions\n• Command history\n\n✅ Enables post-mortem trace.`,
  },
  {
    title: "⚖️ Guardian Rules Engine",
    details: `Sets safety rules:\n• Flag risky AI behavior\n• Auto-disable modules\n• Notify founder on threats`,
  },
  {
    title: "🚨 Incident Response Module",
    details: `Handles emergency events:\n• Crash logs\n• AI failure\n• Lockdown sync`,
  },
  {
    title: "📦 Secure File Vault",
    details: `Encrypted file storage:\n• Configs\n• License keys\n• Snapshots\n\n✅ Features: Upload / Wipe / Download securely.`,
  },
  {
    title: "📊 Earnings Forecast AI",
    details: `Predicts future income:\n• Traffic-based modeling\n• Sponsor/AdSense forecast\n\n✅ Helps in planning financial goals.`,
  },
  {
    title: "🧬 AI Behavior Trainer",
    details: `Set how AI reacts:\n• Emotion tone\n• Category-specific rules\n• Train with examples`,
  },
  {
    title: "🌍 Global Threat Scanner",
    details: `Scans for threats:\n• Botnet IPs\n• Unsafe regions\n• Security risk tags\n\n✅ Coming soon: Real-time DB integration.`,
  },
  {
    title: "⚙️ System Optimizer Tool",
    details: `Finds & fixes:\n• Cache bloat\n• Dependency lag\n• Speed bottlenecks`,
  },
  {
    title: "🐞 Bug Report Analyzer",
    details: `Debug tool for:\n• Crash reports\n• AI fails\n• Auto-detected system bugs`,
  },
  {
    title: "💡 Smart Alert System",
    details: `Send alerts for:\n• Login attempts\n• API failures\n• AI violations\n\n✅ Alert Types: Email, In-site, Telegram.`,
  },
];

const FeatureHelpPanel = () => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [filter, setFilter] = useState('');

  const filteredFeatures = useMemo(
    () =>
      features.filter(
        (f) =>
          f.title.toLowerCase().includes(filter.toLowerCase()) ||
          f.details.toLowerCase().includes(filter.toLowerCase())
      ),
    [filter]
  );

  return (
    <section className="p-6 max-h-[90vh] overflow-y-auto text-slate-700 dark:text-slate-200">
      <h2 className="text-2xl font-bold mb-4">📘 SafeOwnerZone – Panel Guide</h2>

      <input
        type="text"
        placeholder="Search a panel..."
        className="w-full mb-4 px-3 py-2 border rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-sm"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {filteredFeatures.map((feature, i) => (
        <div
          key={i}
          className="mb-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 transition-shadow"
        >
          <button
            onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
            className="w-full text-left px-4 py-3 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-expanded={expandedIndex === i}
            aria-controls={`feature-${i}`}
          >
            {feature.title}
          </button>
          {expandedIndex === i && (
            <div
              id={`feature-${i}`}
              className="px-4 pb-4 text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-300"
            >
              {feature.details}
            </div>
          )}
        </div>
      ))}

      {filteredFeatures.length === 0 && (
        <p className="text-center text-slate-500 mt-8">🔍 No matching features found.</p>
      )}
    </section>
  );
};

export default FeatureHelpPanel;

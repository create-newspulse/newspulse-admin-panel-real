// 📄 src/components/FeatureHelpPanel.tsx

import { useEffect, useRef, useState } from 'react';

const features = [
  {
    title: "🧠 Change AI Automation Modes",
    details: `Switches how your AI behaves — from fully autonomous to semi-manual.

🔧 Modes:
• Auto-Pilot Mode – AI does everything without you
• Review Mode – Needs your approval before publish
• Safe Mode – Disables risky features like polls

✅ Example:
During elections, you use “Review Mode” to avoid mistakes.`,
  },
  {
    title: "🔐 Trigger Emergency System Lockdown",
    details: `Stops all automation & publishing in case of emergency.

🔒 Locked Items:
• AI tools
• Editor access
• Public site content pipeline

✅ Example:
You see a flagged story going viral for wrong reasons. Lockdown now.`,
  },
  {
    title: "🛂 Grant or Revoke Editor/Admin Access",
    details: `Manage team roles securely.

✅ You Can:
• Add/Remove editors
• Set access level (View, Publish, Moderate)

✅ Example:
Give temporary editor rights to a journalist for YouthZone.`,
  },
  {
    title: "📊 Traffic Analytics",
    details: `Shows full visitor reports:
• Pageviews, sources, peak hours
• Bounce rates, top regions

✅ Example:
Find when users are most active to schedule posts.`,
  },
  // ➕ Add more features as needed...
];

const FeatureHelpPanel = () => {
  const [expandedIndex, setExpandedIndex] = useState<number>(0); // auto-expand first item
  const [filter, setFilter] = useState('');
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const filtered = features.filter(
    (f) =>
      f.title.toLowerCase().includes(filter.toLowerCase()) ||
      f.details.toLowerCase().includes(filter.toLowerCase())
  );

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (index + 1) % filtered.length;
      buttonRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (index - 1 + filtered.length) % filtered.length;
      buttonRefs.current[prev]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setExpandedIndex(expandedIndex === index ? -1 : index);
    }
  };

  useEffect(() => {
    buttonRefs.current = buttonRefs.current.slice(0, filtered.length);
  }, [filtered]);

  return (
    <section className="p-6 max-h-[90vh] overflow-y-auto text-slate-700 dark:text-slate-200">
      <h2 className="text-2xl font-bold mb-4">📘 SafeOwnerZone – Panel Guide</h2>

      {/* 🔍 Search */}
      <input
        type="text"
        placeholder="Search a panel..."
        className="w-full mb-4 px-3 py-2 border rounded bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-sm"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />

      {/* 🧠 Accordion */}
      {filtered.map((feature, i) => (
        <div
          key={i}
          className="mb-4 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800"
        >
          <button
            ref={(el: HTMLButtonElement | null) => {
              if (el) buttonRefs.current[i] = el;
            }}
            onClick={() =>
              setExpandedIndex(expandedIndex === i ? -1 : i)
            }
            onKeyDown={(e) => handleKeyDown(e, i)}
            className="w-full text-left px-4 py-2 font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring focus:ring-blue-400"
          >
            {feature.title}
          </button>
          {expandedIndex === i && (
            <div className="px-4 pb-4 text-sm whitespace-pre-wrap">
              {feature.details}
            </div>
          )}
        </div>
      ))}
    </section>
  );
};

export default FeatureHelpPanel;

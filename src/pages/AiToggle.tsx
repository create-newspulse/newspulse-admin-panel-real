// 📁 src/pages/AiToggle.tsx

import { useState } from 'react';
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa';

export default function AiToggle() {
  const [enabled, setEnabled] = useState({
    summarizer: true,
    explainer: true,
    autoWriter: false,
    trustMeter: true,
  });

  const toggle = (key: keyof typeof enabled) => {
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">🧠 AI Toggle Panel (KiranOS)</h2>
      <ul className="space-y-3">
        {Object.entries(enabled).map(([tool, isOn]) => (
          <li key={tool} className="flex items-center justify-between bg-slate-800 p-4 rounded">
            <span className="capitalize">{tool.replace(/([A-Z])/g, ' $1')}</span>
            <button
              className={`px-3 py-1 rounded text-sm font-semibold ${
                isOn ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
              }`}
              onClick={() => toggle(tool as keyof typeof enabled)}
            >
              {isOn ? (
                <>
                  <FaCheckCircle className="inline mr-1" />
                  Enabled
                </>
              ) : (
                <>
                  <FaTimesCircle className="inline mr-1" />
                  Disabled
                </>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

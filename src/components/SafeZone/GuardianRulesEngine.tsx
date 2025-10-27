import { useEffect, useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import {
  FaThumbtack,
  FaBrain,
  FaBan,
  FaBullhorn,
  FaCheckCircle
} from 'react-icons/fa';

const GuardianRulesEngine = () => {
  const [status, setStatus] = useState<null | {
    aiRulesActive: boolean;
    suspiciousActivityDetected: boolean;
    autoBlockTriggered: boolean;
    lastBreach: string | null;
    syncTime: string;
  }>(null);

  useEffect(() => {
    fetchJson<NonNullable<typeof status>>(`${API_BASE_PATH}/system/guardian-status`)
      .then(setStatus)
      .catch((err) => console.error('GuardianRulesEngine fetch failed:', err));
  }, []);

  return (
    <section className="p-5 md:p-6 bg-orange-50 dark:bg-orange-950 border border-orange-300 dark:border-orange-700 rounded-2xl shadow max-h-[90vh] overflow-y-auto">
      <div className="mb-3 flex items-center gap-2 text-green-600 font-mono text-sm">
        <FaCheckCircle className="text-green-500" />
        ✅ GuardianRulesEngine Loaded
      </div>

      <h2 className="text-xl font-bold text-orange-800 dark:text-orange-300 mb-2">
        🛡️ Guardian Rules Engine
      </h2>

      <p className="text-sm text-slate-700 dark:text-slate-200 mb-3">
        This intelligent module governs your AI defense system. It applies safety protocols, threat detection, and fallback logic to secure platform integrity.
      </p>

      <ul className="space-y-2 text-sm text-slate-800 dark:text-slate-100 ml-2">
        <li className="flex items-center gap-2">
          <FaThumbtack className="text-red-400" />
          Define AI behavior conditions and fallback responses
        </li>
        <li className="flex items-center gap-2">
          <FaBrain className="text-pink-500" />
          Detect suspicious admin activity or automated bot threats
        </li>
        <li className="flex items-center gap-2">
          <FaBan className="text-red-600" />
          Auto-disable risky publishing triggers if rules are violated
        </li>
        <li className="flex items-center gap-2">
          <FaBullhorn className="text-yellow-600" />
          Instantly alert the Founder Control Panel on policy breach
        </li>
      </ul>

      <div className="mt-5 text-xs text-slate-600 dark:text-slate-400 italic bg-white/60 dark:bg-slate-800/30 p-3 rounded-lg border border-dashed border-orange-300 dark:border-orange-700">
        {status ? (
          <>
            <div>🕒 Last Sync: <span className="font-semibold">{new Date(status.syncTime).toLocaleString()}</span></div>
            <div>🧠 AI Rules: {status.aiRulesActive ? '✅ Active' : '⛔ Inactive'}</div>
            <div>🧩 Suspicious Activity: {status.suspiciousActivityDetected ? '⚠️ Detected' : '✅ Clean'}</div>
            <div>🚫 Auto-Block: {status.autoBlockTriggered ? '🔒 Triggered' : '❎ Not Triggered'}</div>
            <div>📛 Last Breach: {status.lastBreach || 'None'}</div>
          </>
        ) : (
          <div>🔄 Loading live rule status...</div>
        )}
        <div className="mt-2">📌 Future updates will include live rule toggles, anomaly logs, and alert configuration.</div>
      </div>
    </section>
  );
};

export default GuardianRulesEngine;

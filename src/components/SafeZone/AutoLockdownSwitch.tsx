import React, { useState } from "react";
import { Link } from 'react-router-dom';
import { ADMIN_API_BASE } from '../../lib/adminApi';
const API_BASE = /\/api$/.test(ADMIN_API_BASE)
  ? ADMIN_API_BASE
  : `${ADMIN_API_BASE}/api`;
import { fetchJson } from '@lib/fetchJson';
import { FaShieldAlt } from "react-icons/fa";
import { useNotification } from '@context/NotificationContext';
import { isOwnerKeyUnlocked, useOwnerKeyStore } from '@/lib/ownerKeyStore';

const AutoLockdownSwitch: React.FC = () => {
  const notify = useNotification();
  const [confirmed, setConfirmed] = useState(false);
  const ownerUnlockedUntilMs = useOwnerKeyStore((s) => s.unlockedUntilMs);
  const [status, setStatus] = useState<
    "idle" | "locking" | "unlocking" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);

  // Hide status after 3 seconds on success or error
  React.useEffect(() => {
  if (status === "success" || status === "error") {
    const timer = setTimeout(() => setStatus("idle"), 2500);
    return () => clearTimeout(timer);
  }
  // Explicitly return nothing (undefined)
  return () => {};
}, [status]);

  const resetStatus = () => {
    setStatus("idle");
    setMessage(null);
  };

  const triggerLockdown = async () => {
    if (!confirmed || status === "locking") return;
    if (!isOwnerKeyUnlocked(ownerUnlockedUntilMs)) return;
    setStatus("locking");
    setMessage(null);
    try {
      const data = await fetchJson<{ success?: boolean; error?: string }>(`${API_BASE}/system/emergency-lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (data.success ?? true) {
        setStatus("success");
        setMessage("✅ Lockdown activated successfully!");
        setConfirmed(false);
        notify.success('🚨 Lockdown activated');
      } else {
        setStatus("error");
        setMessage(data?.error || "❌ Invalid PIN or server error.");
        notify.error(data?.error || '❌ Lockdown activation failed');
      }
    } catch (e) {
      setStatus("error");
      setMessage("❌ Server error. Please try again.");
      notify.error('❌ Server error during lockdown');
    }
  };

  const triggerUnlock = async () => {
    if (status === "unlocking") return;
    if (!isOwnerKeyUnlocked(ownerUnlockedUntilMs)) return;
    setStatus("unlocking");
    setMessage(null);
    try {
      const data = await fetchJson<{ success?: boolean; error?: string }>(`${API_BASE}/system/emergency-unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (data.success ?? true) {
        setStatus("success");
        setMessage("✅ Lockdown deactivated!");
        notify.success('🔓 Lockdown deactivated');
      } else {
        setStatus("error");
        setMessage(data?.error || "❌ Invalid PIN or server error.");
        notify.error(data?.error || '❌ Unlock failed');
      }
    } catch (e) {
      setStatus("error");
      setMessage("❌ Server error. Please try again.");
      notify.error('❌ Server error during unlock');
    }
  };

  return (
    <section className="p-5 md:p-6 bg-red-50 dark:bg-red-900/10 border border-red-500/30 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto">
      <p className="text-green-600 dark:text-green-400 font-mono text-sm mb-2">
        ✅ AutoLockdownSwitch Loaded
      </p>

      <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
        <FaShieldAlt className="text-red-500" />
        Auto Lockdown Switch
      </h2>

      <ul className="list-disc list-inside ml-3 text-sm md:text-base space-y-1 text-gray-800 dark:text-gray-200">
        <li>🍩 Disables all admin tools, pipelines, and AI triggers</li>
        <li>🔒 Blocks new logins and freezes access until reset</li>
        <li>📣 Alerts the founder immediately</li>
      </ul>

      <div className="mt-4 rounded-xl border border-red-500/30 bg-white/70 p-4 text-sm text-slate-700 dark:bg-slate-900/30 dark:text-slate-200">
        <div className="font-semibold">Manage Owner Key</div>
        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">PIN-based unlock has been removed. Use the Safe Owner Zone hub.</div>
        <Link
          to="/admin/safe-owner-zone"
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Manage Owner Key → Safe Owner Zone
        </Link>
      </div>

      <div className="flex items-center gap-2 mt-2">
        <input
          type="checkbox"
          id="confirm"
          checked={confirmed}
          onChange={(e) => {
            setConfirmed(e.target.checked);
            resetStatus();
          }}
          className="accent-red-600"
        />
        <label
          htmlFor="confirm"
          className="text-red-700 dark:text-red-300 text-sm"
        >
          I confirm to initiate full lockdown
        </label>
      </div>

      <button
        onClick={triggerLockdown}
        disabled={!confirmed || !isOwnerKeyUnlocked(ownerUnlockedUntilMs) || status === "locking"}
        className={`mt-3 px-4 py-2 rounded-md font-semibold text-white transition duration-200 w-full ${
          confirmed && isOwnerKeyUnlocked(ownerUnlockedUntilMs)
            ? "bg-red-600 hover:bg-red-700"
            : "bg-red-300 cursor-not-allowed"
        }`}
      >
        {status === "locking" ? "Locking down..." : "🔐 Activate Lockdown"}
      </button>

      <button
        onClick={triggerUnlock}
        disabled={!isOwnerKeyUnlocked(ownerUnlockedUntilMs) || status === "unlocking"}
        className={`mt-2 px-4 py-2 rounded-md font-semibold text-white transition duration-200 w-full ${
          isOwnerKeyUnlocked(ownerUnlockedUntilMs)
            ? "bg-green-600 hover:bg-green-700"
            : "bg-green-300 cursor-not-allowed"
        }`}
      >
        {status === "unlocking" ? "Unlocking..." : "🔓 Deactivate Lockdown"}
      </button>

      {message && (
        <p
          className={`font-mono mt-2 ${
            status === "success"
              ? "text-green-600"
              : status === "error"
              ? "text-red-600"
              : ""
          }`}
        >
          {message}
        </p>
      )}
    </section>
  );
};

export default AutoLockdownSwitch;

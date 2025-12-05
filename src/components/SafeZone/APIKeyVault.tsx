const API_ORIGIN = (
  import.meta.env.VITE_ADMIN_API_BASE_URL?.toString() ||
  import.meta.env.VITE_API_URL?.toString() ||
  (import.meta.env.MODE === 'development' ? 'http://localhost:10000' : 'https://newspulse-backend-real.onrender.com')
).replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;
import { fetchJson } from '@lib/fetchJson';
import React, { useEffect, useState } from "react";
import {
  FaKey,
  FaLock,
  FaCheckCircle,
  FaExclamationTriangle,
} from "react-icons/fa";

interface APIKeyEntry {
  service: string;
  status: "valid" | "missing" | "expired";
  lastChecked: string;
}

const APIKeyVault: React.FC = () => {
  const [keys, setKeys] = useState<APIKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchKeys = async () => {
      setLoading(true);
      setError(null);
      try {
  const data = await fetchJson<any>(`${API_BASE}/system/api-keys`, { timeoutMs: 15000 });

        // Accepts both { keys: [...] } or { data: { keys: [...] } }
        const keysArr =
          Array.isArray(data.keys)
            ? data.keys
            : data.data && Array.isArray(data.data.keys)
            ? data.data.keys
            : null;

        if (Array.isArray(keysArr)) {
          if (isMounted) setKeys(keysArr);
        } else {
          if (isMounted)
            setError(data.message || "Failed to fetch keys");
        }
      } catch (err) {
        if (isMounted)
          setError("Server error while fetching API keys");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchKeys();
    return () => {
      isMounted = false;
    };
  }, []);

  const statusColor = {
    valid: "text-green-500",
    missing: "text-red-500",
    expired: "text-yellow-400",
  } as const;

  return (
    <section className="p-5 md:p-6 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-400/30 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto">
      <div className="mb-3 flex items-center gap-2 text-green-600 dark:text-green-400 font-mono text-sm">
        <FaLock />
        ✅ APIKeyVault Loaded
      </div>

      <h2 className="text-xl font-bold text-yellow-700 dark:text-yellow-300 mb-3 flex items-center gap-2">
        <FaKey className="text-yellow-500" />
        API Key Vault
      </h2>

      {loading ? (
        <p className="text-xs text-yellow-600 dark:text-yellow-300 animate-pulse">
          🔄 Loading API keys...
        </p>
      ) : error ? (
        <p className="text-xs text-red-500">{error}</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-slate-500">
          No API keys found.
        </p>
      ) : (
        <ul className="space-y-3 text-sm md:text-base text-gray-800 dark:text-gray-200">
          {keys.map((key, idx) => (
            <li
              key={idx}
              className="flex justify-between items-center bg-white/5 dark:bg-yellow-800/10 px-3 py-2 rounded-lg border border-yellow-300/20"
            >
              <div className="flex flex-col">
                <span className="font-semibold">{key.service}</span>
                <span className="text-xs text-slate-500">
                  Last checked: {key.lastChecked}
                </span>
              </div>
              <span
                className={`font-mono ${statusColor[key.status]} flex items-center`}
              >
                {key.status === "valid" && (
                  <FaCheckCircle className="inline mr-1" />
                )}
                {(key.status === "expired" || key.status === "missing") && (
                  <FaExclamationTriangle className="inline mr-1" />
                )}
                {key.status.toUpperCase()}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 text-xs text-yellow-700 dark:text-yellow-300 font-mono">
        🔒 Security Tip: Never expose API keys in frontend code. All access should be handled securely via server-side.
      </div>
    </section>
  );
};

export default APIKeyVault;

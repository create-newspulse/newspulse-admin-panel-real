import { useEffect, useState } from 'react';
// Prefer dedicated admin backend base if available; fallback to generic API URL then remote.
const API_ORIGIN = (
  import.meta.env.VITE_ADMIN_API_BASE_URL?.toString() ||
  import.meta.env.VITE_API_URL?.toString() ||
  'https://newspulse-backend-real.onrender.com'
).replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;
import { fetchJson } from '@lib/fetchJson';
import { FaCheckCircle, FaExclamationTriangle, FaEnvelope } from 'react-icons/fa';

const SECURITY_ENABLED = import.meta.env.VITE_SECURITY_SYSTEM_ENABLED !== 'false';

const SmartAlertSystem = () => {
  const [status, setStatus] = useState<'loaded' | 'error' | 'loading'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Simulate system check (replace with real fetch later)
    const fetchAlertConfig = async () => {
      try {
        try {
          const data = await fetchJson<{ success?: boolean }>(`${API_BASE}/system/alert-config`, { timeoutMs: 15000 });
          if (data && (data.success === true || data.success === undefined)) {
            setStatus('loaded');
            return;
          }
          throw new Error('Invalid response');
        } catch (innerErr: any) {
          // Treat plain 404 Not Found or custom 'route not found' as missing route.
          if (/route not found|404\b/i.test(innerErr?.message || '')) {
            console.warn('[SmartAlertSystem] using stub config (404)');
            setStatus('loaded');
            return;
          }
          throw innerErr;
        }
      } catch (err: any) {
        if (!errorMessage) console.error('❌ Alert config error:', err?.message || err);
        setErrorMessage(err?.message || 'Alert System Load Failed');
        setStatus('error');
      }
    };

    if (!SECURITY_ENABLED) {
      console.warn('[SmartAlertSystem] disabled via VITE_SECURITY_SYSTEM_ENABLED=false');
      setStatus('loaded');
      return;
    }
    fetchAlertConfig();
  }, []);

  return (
    <section className="p-4 md:p-6 overflow-y-auto max-h-[90vh] bg-gradient-to-br from-yellow-50 via-white to-yellow-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-2xl shadow-lg border border-yellow-200 dark:border-yellow-700">
      <div className="mb-4 flex items-center gap-2">
        {status === 'loaded' && <FaCheckCircle className="text-green-500" />}
        {status === 'error' && <FaExclamationTriangle className="text-red-500" />}
        <p className={`font-mono text-sm ${status === 'loaded' ? 'text-green-600' : 'text-red-500'}`}>
          {status === 'loaded' ? '✅ SmartAlertSystem Loaded' : `❌ ${errorMessage || 'Alert System Load Failed'}`}
        </p>
      </div>

      <h2 className="text-xl font-bold text-yellow-700 dark:text-yellow-300 mb-2">
        💡 Smart Alert System
      </h2>

      <div className="space-y-2 text-sm md:text-base text-slate-700 dark:text-slate-300">
        <p>
          This panel allows admins to configure alerts for critical activity or potential threats in real-time.
        </p>
        <ul className="list-disc list-inside ml-2 mt-2 space-y-1 text-slate-700 dark:text-slate-400">
          <li>📣 Auto-notify on suspicious events</li>
          <li><FaEnvelope className="inline mr-1 text-blue-600" /> Custom alert channels (Email, Dashboard)</li>
          <li><FaExclamationTriangle className="inline mr-1 text-yellow-600" /> AI-priority tagging for urgent incidents</li>
        </ul>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-4 italic">
          🔧 More configuration options coming soon...
        </p>
      </div>
    </section>
  );
};

export default SmartAlertSystem;

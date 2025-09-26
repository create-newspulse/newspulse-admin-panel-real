import { useEffect, useState } from 'react';
import { FaCheckCircle, FaExclamationTriangle, FaEnvelope } from 'react-icons/fa';

const SmartAlertSystem = () => {
  const [status, setStatus] = useState<'loaded' | 'error' | 'loading'>('loading');

  useEffect(() => {
    // Simulate system check (replace with real fetch later)
    const fetchAlertConfig = async () => {
      try {
        const res = await fetch('/api/system/alert-config');
        const data = await res.json();
        if (data.success) {
          setStatus('loaded');
        } else {
          throw new Error('Failed to load config');
        }
      } catch (err) {
        console.error('❌ Alert config error:', err);
        setStatus('error');
      }
    };

    fetchAlertConfig();
  }, []);

  return (
    <section className="p-4 md:p-6 overflow-y-auto max-h-[90vh] bg-gradient-to-br from-yellow-50 via-white to-yellow-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 rounded-2xl shadow-lg border border-yellow-200 dark:border-yellow-700">
      <div className="mb-4 flex items-center gap-2">
        {status === 'loaded' && <FaCheckCircle className="text-green-500" />}
        {status === 'error' && <FaExclamationTriangle className="text-red-500" />}
        <p className={`font-mono text-sm ${status === 'loaded' ? 'text-green-600' : 'text-red-500'}`}>
          {status === 'loaded' ? '✅ SmartAlertSystem Loaded' : '❌ Alert System Load Failed'}
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

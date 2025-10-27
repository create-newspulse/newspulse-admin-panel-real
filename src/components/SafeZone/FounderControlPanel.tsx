import { useState } from 'react';
import { API_BASE_PATH } from '@lib/api';
import { fetchJson } from '@lib/fetchJson';
import { useNotification } from '@context/NotificationContext';

const FounderControlPanel = () => {
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState<string | null>(null);
  const notify = useNotification();

  const handleLockdown = async () => {
    setLoading(true);
    setAction('lockdown');
    try {
      const json = await fetchJson<{ success?: boolean }>(`${API_BASE_PATH}/emergency-lockdown`, { method: 'POST' });
      if (json.success ?? true) notify.success('🚨 Emergency Lockdown Triggered');
      else notify.error('❌ Lockdown request failed');
    } catch (error) {
      console.error('Lockdown error:', error);
      notify.error('⚠️ Server error during lockdown');
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  const handleExportLogs = async () => {
    setLoading(true);
    setAction('export');
    try {
      const json = await fetchJson<{ success?: boolean }>(`${API_BASE_PATH}/export-logs`, { method: 'GET' });
      if (json.success ?? true) notify.success('📤 Logs exported successfully');
      else notify.error('❌ Export failed. Try again.');
    } catch (error) {
      console.error('Export logs error:', error);
      notify.error('⚠️ Server error during export');
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  const handleReactivate = async () => {
    setLoading(true);
    setAction('reactivate');
    try {
      const json = await fetchJson<{ success?: boolean }>(`${API_BASE_PATH}/reactivate-system`, { method: 'POST' });
      if (json.success ?? true) notify.success('✅ System reactivated successfully');
      else notify.error('❌ Failed to reactivate system');
    } catch (err) {
      console.error('Reactivation error:', err);
      notify.error('⚠️ Server error during reactivation');
    } finally {
      setLoading(false);
      setAction(null);
    }
  };

  return (
    <section className="p-5 md:p-6 bg-rose-50 dark:bg-rose-900/10 border border-red-300/40 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto">
      <p className="text-green-600 dark:text-green-400 font-mono text-sm mb-3">
        ✅ FounderControlPanel Loaded
      </p>

      <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-3">
        🛡️ Founder Controls
      </h2>

      <div className="space-y-3 text-sm md:text-base text-slate-700 dark:text-slate-200">
        <p>
          Access level: <strong className="text-green-600 dark:text-green-400">FULL</strong>
        </p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Change AI automation modes</li>
          <li>Trigger emergency system lockdown</li>
          <li>Grant or revoke editor/admin access</li>
          <li>🔁 Reactivate the system manually</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-4 mt-6">
        <button
          onClick={handleLockdown}
          className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-60"
          disabled={loading && action === 'lockdown'}
        >
          🛑 Emergency Lockdown
        </button>

        <button
          onClick={handleExportLogs}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
          disabled={loading && action === 'export'}
        >
          📤 Export Logs
        </button>

        <button
          onClick={handleReactivate}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-60"
          disabled={loading && action === 'reactivate'}
        >
          🔁 Reactivate System
        </button>
      </div>
    </section>
  );
};

export default FounderControlPanel;

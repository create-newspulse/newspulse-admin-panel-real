import { useEffect, useState } from 'react';
import html2pdf from 'html2pdf.js';
import type { SystemHealth } from '../../types/SafeZone';
import { api, API_BASE_PATH } from '@lib/api';

const SystemHealthPanel = () => {
  const [healthData, setHealthData] = useState<SystemHealth | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const PANEL_KEY = 'safezone:unlocked:SystemHealthPanel';
  const PANEL_PASSWORD = 'news2025';

  useEffect(() => {
    const saved = localStorage.getItem(PANEL_KEY);
    if (saved === 'true') setUnlocked(true);
  }, []);

  const handleUnlock = () => {
    if (input === PANEL_PASSWORD) {
      localStorage.setItem(PANEL_KEY, 'true');
      setUnlocked(true);
      setError('');
    } else {
      setError('❌ Incorrect password');
    }
  };

  const exportPanelPDF = () => {
    const element = document.getElementById('system-health-panel');
    if (!element) return;
    html2pdf().set({ filename: 'SystemHealthPanel_Report.pdf' }).from(element).save();
  };

  useEffect(() => {
    if (unlocked) {
      api.systemHealth()
        .then((data: any) => setHealthData(data))
        .catch((err) => console.error('Health fetch error:', err));
    }
  }, [unlocked]);

  useEffect(() => {
    if (healthData && (!healthData.apiGateway || !healthData.voiceEngine)) {
      fetch(`${API_BASE_PATH}/notify-down`, { method: 'POST' });
    }
  }, [healthData]);

  return (
    <section
      id="system-health-panel"
      className="p-5 md:p-6 bg-blue-50 dark:bg-blue-900/10 border border-blue-400/30 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto"
    >
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-blue-700 dark:text-blue-300">
          🛡️ System Health
        </h2>
        {unlocked && (
          <button
            onClick={exportPanelPDF}
            className="text-xs text-blue-600 hover:underline"
          >
            📄 Export Panel
          </button>
        )}
      </div>

      {!unlocked ? (
        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded border border-slate-300 dark:border-slate-600">
          <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            🔒 Enter Panel Password
          </label>
          <input
            type="password"
            placeholder="Enter password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full px-3 py-2 rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-black dark:text-white focus:outline-none focus:ring"
          />
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          <button
            onClick={handleUnlock}
            className="mt-3 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded"
          >
            Unlock Panel
          </button>
        </div>
      ) : (
        <>
          <p className="text-green-600 dark:text-green-400 font-mono text-sm mb-4">
            ✅ SystemHealthPanel Loaded
          </p>

          {healthData ? (
            <ul className="text-sm space-y-2 text-slate-700 dark:text-slate-200">
              <li>✅ MongoDB: <span className="font-mono">{healthData.mongodb}</span></li>
              <li>✅ API Gateway: <span className="font-mono">{healthData.apiGateway}</span></li>
              <li>✅ News Crawler: <span className="font-mono">{healthData.newsCrawler}</span></li>
              <li>✅ Voice Engine: <span className="font-mono">{healthData.voiceEngine}</span></li>
              <li>🌐 Domain: <span className="font-mono">{healthData.domain}</span></li>
            </ul>
          ) : (
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Loading system stats...</p>
          )}
        </>
      )}
    </section>
  );
};

export default SystemHealthPanel;

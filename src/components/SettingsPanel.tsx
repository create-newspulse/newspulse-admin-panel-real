import { useEffect, useState } from 'react';
import { useAdminSettings } from '../context/AdminSettingsContext';

export type AdminSettingKey =
  | 'panelGuideVisible'
  | 'showLoginRecords'
  | 'showBackupPanel'
  | 'restrictToFounder'
  | 'showSystemHealth'
  | 'showTrafficAnalytics'
  | 'showAIActivityLog'
  | 'showRevenuePanel'
  | 'enableExportPDF'
  | 'allowEditorMode'
  | 'enableAITrainer';

const settingKeys: AdminSettingKey[] = [
  'panelGuideVisible',
  'showLoginRecords',
  'showBackupPanel',
  'restrictToFounder',
  'showSystemHealth',
  'showTrafficAnalytics',
  'showAIActivityLog',
  'showRevenuePanel',
  'enableExportPDF',
  'allowEditorMode',
  'enableAITrainer',
];

const settingLabels: Record<AdminSettingKey, string> = {
  panelGuideVisible: '📘 Show Panel Guide',
  showLoginRecords: '🔐 Show Login Tracker',
  showBackupPanel: '📂 Enable Backup & Recovery',
  restrictToFounder: '🛡️ Restrict View to Founder Only',
  showSystemHealth: '🩺 Show System Health Panel',
  showTrafficAnalytics: '📊 Show Traffic Analytics',
  showAIActivityLog: '🧠 Show AI Activity Log',
  showRevenuePanel: '💰 Show Revenue Panel',
  enableExportPDF: '📤 Enable Export to PDF',
  allowEditorMode: '👥 Allow Editor-Level View',
  enableAITrainer: '🧬 Enable AI Trainer',
};

const SectionGroup = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <details className="bg-slate-800 rounded-xl shadow p-4 border border-slate-600 mb-4 group open:ring-1 open:ring-blue-500">
    <summary className="cursor-pointer font-bold text-lg text-white mb-2">
      {title}
    </summary>
    <ul className="space-y-2 text-sm text-slate-100 pl-2">{children}</ul>
  </details>
);

const SettingsPanel = () => {
  const settings = useAdminSettings();
  const [aiSuggestion, setAiSuggestion] = useState<{
    message: string;
    action: () => void;
  } | null>(null);

  const isEditorPreview = localStorage.getItem('previewAsEditor') === 'true';
  const isFounder = localStorage.getItem('userRole') === 'founder';
  const FOUNDER_PASS = 'NewsPulse#80121972';
  let founderUnlocked = false;

  useEffect(() => {
    if (isEditorPreview) {
      alert('🔒 Restricted Zone – Admins Only');
      window.location.href = '/';
    }
  }, []);

  const handleToggle = (key: AdminSettingKey) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] 🔧 ${key} → ${!settings[key]}`;
    const logs = JSON.parse(localStorage.getItem('adminSettingsLog') || '[]');
    logs.unshift(logEntry);
    localStorage.setItem('adminSettingsLog', JSON.stringify(logs.slice(0, 50)));

    settings.toggleSetting(key);

    setTimeout(() => {
      const updated = settingKeys.reduce((acc, key) => {
        acc[key] = settings[key];
        return acc;
      }, {} as Record<AdminSettingKey, boolean>);
      localStorage.setItem('adminSettings', JSON.stringify(updated));
    }, 0);
  };

  const handleProtectedToggle = (key: AdminSettingKey) => {
    const confirmed = window.confirm('🔐 Founder Reactivation Required');
    if (confirmed) {
      const input = window.prompt('Enter Reactivation Code:');
      if (input === FOUNDER_PASS) {
        founderUnlocked = true;
        handleToggle(key);
      } else {
        alert('❌ Incorrect Founder Code.');
      }
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('adminSettings');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.entries(parsed).forEach(([key, value]) => {
        if (typeof value === 'boolean' && settingKeys.includes(key as AdminSettingKey)) {
          if (settings[key as AdminSettingKey] !== value) {
            settings.toggleSetting(key as AdminSettingKey);
          }
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!settings.showRevenuePanel) {
      setAiSuggestion({
        message: '💰 Revenue Panel is hidden. Turn it on to monitor ad earnings.',
        action: () => handleToggle('showRevenuePanel'),
      });
    } else {
      setAiSuggestion(null);
    }
  }, [settings.showRevenuePanel]);

  const renderToggle = (key: AdminSettingKey) => {
    const isProtected =
      key === 'restrictToFounder' ||
      key === 'showRevenuePanel' ||
      key === 'enableAITrainer';

    const shouldDisable =
      (!founderUnlocked && key === 'restrictToFounder') ||
      (isEditorPreview && isProtected);

    return (
      <li key={key} className="flex items-center justify-between opacity-100">
        <span>{settingLabels[key]}</span>
        <input
          type="checkbox"
          checked={settings[key]}
          disabled={shouldDisable}
          onChange={() =>
            key === 'restrictToFounder' && !founderUnlocked
              ? handleProtectedToggle(key)
              : handleToggle(key)
          }
          className="scale-125 accent-blue-500"
        />
      </li>
    );
  };

  if (isEditorPreview) {
    return (
      <section className="p-6 text-center text-slate-200">
        <h2 className="text-2xl font-bold mb-4">👤 Editor Preview Mode</h2>
        <p className="mb-4">You are now simulating limited access.</p>
        <button
          className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded"
          onClick={() => {
            localStorage.removeItem('previewAsEditor');
            window.location.reload();
          }}
        >
          🔁 Exit Preview Mode
        </button>
      </section>
    );
  }

  return (
    <section className="p-6 text-white">
      <div className="ai-card glow-panel ai-highlight hover-glow mb-4">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold">⚙️ Admin Control Center – Phase 15</h2>
          <button
            onClick={() => {
              const preview = confirm('🧪 Preview As Editor Mode?');
              if (preview) localStorage.setItem('previewAsEditor', 'true');
              else localStorage.removeItem('previewAsEditor');
              window.location.reload();
            }}
            className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-sm text-white"
          >
            👤 Preview As Editor
          </button>
        </div>
        {aiSuggestion && (
          <div className="bg-yellow-100 text-yellow-800 p-4 rounded mt-4 shadow-md">
            <strong>{aiSuggestion.message}</strong>
            <button
              onClick={aiSuggestion.action}
              className="ml-4 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
            >
              ✅ Apply Suggestion
            </button>
          </div>
        )}
      </div>

      <SectionGroup title="🔐 Access Control">
        {renderToggle('restrictToFounder')}
        {renderToggle('allowEditorMode')}
      </SectionGroup>

      <SectionGroup title="🧠 AI Modules">
        {renderToggle('enableAITrainer')}
        {renderToggle('showAIActivityLog')}
      </SectionGroup>

      <SectionGroup title="📊 Analytics Visibility">
        {renderToggle('showTrafficAnalytics')}
        {renderToggle('showRevenuePanel')}
      </SectionGroup>

      <SectionGroup title="📦 Backup & Export">
        {renderToggle('showBackupPanel')}
        {renderToggle('enableExportPDF')}
      </SectionGroup>

      <SectionGroup title="🔧 Live UI Panels">
        {renderToggle('panelGuideVisible')}
        {renderToggle('showLoginRecords')}
        {renderToggle('showSystemHealth')}
      </SectionGroup>

      {isFounder && <SettingsLogViewer />}
    </section>
  );
};

export default SettingsPanel;

function SettingsLogViewer() {
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('adminSettingsLog');
    if (stored) {
      setLogs(JSON.parse(stored));
    }
  }, []);

  const handleClear = () => {
    localStorage.removeItem('adminSettingsLog');
    setLogs([]);
    alert('✅ Logs cleared!');
  };

  const handleExport = () => {
    const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `admin-settings-log-${Date.now()}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="mt-8">
      <h3 className="text-lg font-semibold mb-2">🧾 Settings Activity Log</h3>
      <div className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white p-4 rounded max-h-72 overflow-y-auto text-sm">
        {logs.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-300">No activity logs yet.</p>
        ) : (
          <ul className="list-disc ml-4 space-y-1">
            {logs.map((log, idx) => (
              <li key={idx}>{log}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-4 flex gap-4">
        <button
          onClick={handleClear}
          className="bg-red-500 text-white px-4 py-1 rounded hover:bg-red-600"
        >
          🗑 Clear Logs
        </button>
        <button
          onClick={handleExport}
          className="bg-blue-600 text-white px-4 py-1 rounded hover:bg-blue-700"
        >
          📤 Export Logs
        </button>
      </div>
    </section>
  );
}

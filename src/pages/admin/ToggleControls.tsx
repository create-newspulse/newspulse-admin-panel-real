// File: src/pages/admin/ToggleControls.tsx
import { useEffect, useState } from 'react';
import axios from 'axios';

type ToggleConfig = {
  parliamentSessionEnabled: boolean;
  lokSabhaLive: boolean;
  rajyaSabhaLive: boolean;
};

export default function ToggleControls() {
  const [toggles, setToggles] = useState<ToggleConfig>({
    parliamentSessionEnabled: false,
    lokSabhaLive: false,
    rajyaSabhaLive: false,
  });

  const fetchToggles = async () => {
    try {
      const res = await axios.get('/api/toggles/parliament-session');
      if (res.data?.success && res.data?.config) {
        setToggles(res.data.config);
      } else {
        console.warn('⚠️ No toggle config returned from server.');
      }
    } catch (err: any) {
      console.error('❌ Failed to load toggles:', err.message);
    }
  };

  const updateToggle = async (key: keyof ToggleConfig) => {
    const updated = { ...toggles, [key]: !toggles[key] };
    setToggles(updated);
    try {
      await axios.post('/api/toggles/parliament-session', updated);
    } catch (err: any) {
      console.error(`❌ Failed to update toggle "${key}":`, err.message);
    }
  };

  useEffect(() => {
    fetchToggles();
  }, []);

  return (
    <section className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">
        🛠️ Parliament Feed Toggle Controls
      </h1>

      <ToggleSwitch
        label="Parliament Session Tab"
        enabled={toggles.parliamentSessionEnabled}
        onToggle={() => updateToggle('parliamentSessionEnabled')}
      />
      <ToggleSwitch
        label="Lok Sabha Feed (Sansad TV 2)"
        enabled={toggles.lokSabhaLive}
        onToggle={() => updateToggle('lokSabhaLive')}
      />
      <ToggleSwitch
        label="Rajya Sabha Feed (Sansad TV 1)"
        enabled={toggles.rajyaSabhaLive}
        onToggle={() => updateToggle('rajyaSabhaLive')}
      />
    </section>
  );
}

type ToggleSwitchProps = {
  label: string;
  enabled: boolean;
  onToggle: () => void;
};

function ToggleSwitch({ label, enabled, onToggle }: ToggleSwitchProps) {
  return (
    <div className="flex items-center justify-between px-5 py-4 rounded border bg-white dark:bg-slate-800 dark:border-slate-700 shadow-sm transition">
      <span className="text-base font-medium text-slate-800 dark:text-slate-100">{label}</span>
      <button
        onClick={onToggle}
        aria-pressed={enabled}
        aria-label={`Toggle ${label}`}
        className={`px-4 py-1 rounded font-semibold text-sm transition-colors duration-200 shadow ${
          enabled ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-red-600 hover:bg-red-700 text-white'
        }`}
      >
        {enabled ? '🟢 ON' : '🔴 OFF'}
      </button>
    </div>
  );
}

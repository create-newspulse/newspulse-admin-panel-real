// ✅ File: components/SafeZone/SystemUnlockPanel.tsx

import React, { useState } from 'react';
const API_ORIGIN = (import.meta.env.VITE_API_URL?.toString() || 'https://newspulse-backend-real.onrender.com').replace(/\/+$/, '');
const API_BASE = `${API_ORIGIN}/api`;
import { fetchJson } from '@lib/fetchJson';
import { FaUnlockAlt } from 'react-icons/fa';

const SystemUnlockPanel: React.FC = () => {
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleUnlock = async () => {
    if (!pin) return;
    setStatus('loading');

    try {
      const data = await fetchJson<{ success?: boolean }>(`${API_BASE}/system/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (data.success ?? true) {
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch (err) {
      console.error('Unlock error:', err);
      setStatus('error');
    }
  };

  return (
    <section className="p-5 md:p-6 bg-green-50 dark:bg-green-900/10 border border-green-400/30 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto">
      <p className="text-green-600 dark:text-green-400 font-mono text-sm mb-2">✅ SystemUnlockPanel Loaded</p>

      <h2 className="text-xl font-bold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
        <FaUnlockAlt className="text-green-600" />
        Reactivate System
      </h2>

      <input
        type="password"
        placeholder="Enter Unlock PIN"
        value={pin}
        onChange={(e) => setPin(e.target.value)}
        className="mt-3 px-3 py-2 rounded border border-green-400 text-sm w-full dark:bg-green-800/10"
      />

      <button
        onClick={handleUnlock}
        disabled={!pin || status === 'loading'}
        className={`mt-3 px-4 py-2 rounded-md font-semibold text-white transition duration-200 flex items-center gap-2 ${
          pin ? 'bg-green-600 hover:bg-green-700' : 'bg-green-300 cursor-not-allowed'
        }`}
      >
        {status === 'loading' ? 'Reactivating...' : '♻️ Reactivate System'}
      </button>

      {status === 'success' && (
        <p className="text-green-600 font-mono mt-2">✅ System reactivated successfully!</p>
      )}
      {status === 'error' && (
        <p className="text-red-600 font-mono mt-2">❌ Invalid PIN or server error.</p>
      )}
    </section>
  );
};

export default SystemUnlockPanel;

// ✅ File: components/SafeZone/SystemUnlockPanel.tsx

import React from 'react';
import { Link } from 'react-router-dom';
import { FaUnlockAlt } from 'react-icons/fa';

const SystemUnlockPanel: React.FC = () => {
  return (
    <section className="p-5 md:p-6 bg-green-50 dark:bg-green-900/10 border border-green-400/30 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto">
      <p className="text-green-600 dark:text-green-400 font-mono text-sm mb-2">✅ SystemUnlockPanel Loaded</p>

      <h2 className="text-xl font-bold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
        <FaUnlockAlt className="text-green-600" />
        Reactivate System
      </h2>

      <div className="mt-3 rounded-xl border border-green-400/30 bg-white/70 p-4 text-sm text-slate-700 dark:bg-slate-900/30 dark:text-slate-200">
        <div className="font-semibold">Manage Owner Key</div>
        <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">PIN-based unlock has been removed. Use the Safe Owner Zone hub.</div>
        <Link
          to="/admin/safe-owner-zone"
          className="mt-3 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          Manage Owner Key → Safe Owner Zone
        </Link>
      </div>
    </section>
  );
};

export default SystemUnlockPanel;

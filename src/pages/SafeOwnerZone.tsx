// 📁 src/pages/SafeOwnerZone.tsx

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

import AIActivityLog from '@components/SafeZone/AIActivityLog';
import TrafficAnalytics from '@components/SafeZone/TrafficAnalytics';
import SystemHealthPanel from '@components/SafeZone/SystemHealthPanel';
import FounderControlPanel from '@components/SafeZone/FounderControlPanel';
import BackupAndRecovery from '@components/SafeZone/BackupAndRecovery';
import RevenuePanel from '@components/SafeZone/RevenuePanel';
import SettingsPanel from '@components/SettingsPanel';
import FeatureHelpPanel from '@components/FeatureHelpPanel';
import { useAdminSettings } from '../context/AdminSettingsContext';

const SafeOwnerZone = () => {
  const { t } = useTranslation();
  const [isFounder, setIsFounder] = useState(false);

  const {
    panelGuideVisible,
    showLoginRecords,
    showBackupPanel,
    enableAITrainer,
    restrictToFounder,
  } = useAdminSettings();

  useEffect(() => {
    const founderStatus = localStorage.getItem('isFounder') === 'true';
    setIsFounder(founderStatus);
  }, []);

  if (!isFounder) {
    return (
      <div className="p-8 text-center text-red-600 font-semibold">
        🔒 Access denied. Founder privileges required.
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-100 dark:from-gray-900 dark:to-black text-gray-900 dark:text-white px-6 py-10">
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1 className="text-4xl font-bold tracking-tight">
          🛡️ {t('safeOwnerZone')}
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-2">
          {t('founderAccessOnly')} – {new Date().toLocaleString()}
        </p>
      </motion.header>

      <SettingsPanel />

      {panelGuideVisible && <FeatureHelpPanel />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <FounderControlPanel />
        <SystemHealthPanel />
        <AIActivityLog />
        <TrafficAnalytics />
        <RevenuePanel />
        {showBackupPanel && <BackupAndRecovery />}
      </div>

      {showLoginRecords && (
        <div className="mt-8 p-4 border border-slate-600 rounded">
          <h3 className="text-lg font-semibold">🔐 Login Records</h3>
          <p className="text-sm text-slate-400">Login tracker component coming soon...</p>
        </div>
      )}

      {enableAITrainer && (
        <div className="mt-8 p-4 border border-slate-600 rounded">
          <h3 className="text-lg font-semibold">🧬 AI Trainer</h3>
          <p className="text-sm text-slate-400">AI behavior tuning will be available soon.</p>
        </div>
      )}

      {restrictToFounder && (
        <div className="mt-8 p-4 border border-red-600 rounded">
          <h3 className="text-lg font-semibold text-red-400">🛡️ Founder Mode Only</h3>
          <p className="text-sm text-red-300">Access restricted to founder view only.</p>
        </div>
      )}
    </main>
  );
};

export default SafeOwnerZone;

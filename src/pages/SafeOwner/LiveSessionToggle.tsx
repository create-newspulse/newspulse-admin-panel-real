// 📁 src/pages/SafeOwner/LiveSessionToggle.tsx
import React, { useEffect, useState } from 'react';
import apiClient from '@lib/api';

interface LiveSessionConfig {
  isFeedOn: boolean;
  activeFeed: 'sansad_tv' | 'lok_sabha' | 'rajya_sabha' | 'event';
}

const LiveSessionToggle: React.FC = () => {
  const [config, setConfig] = useState<LiveSessionConfig>({
    isFeedOn: true,
    activeFeed: 'sansad_tv',
  });

  useEffect(() => {
    apiClient.get('/live-session')
      .then(res => {
        const data = (res as any)?.data ?? res;
        setConfig(data);
      })
      .catch(() => console.warn('Could not load session config'));
  }, []);

  const updateSession = (update: Partial<LiveSessionConfig>) => {
    const newConfig = { ...config, ...update };
    setConfig(newConfig);
    apiClient.post('/live-session', newConfig)
      .then(() => console.log('✅ Session updated'))
      .catch(() => alert('Failed to update config'));
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">🔧 Manage Live Feed Toggle</h1>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium">Feed Status:</label>
          <button
            className={`px-4 py-1 rounded font-semibold ${config.isFeedOn ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}
            onClick={() => updateSession({ isFeedOn: !config.isFeedOn })}
          >
            {config.isFeedOn ? '✅ ON' : '❌ OFF'}
          </button>
        </div>

        <div>
          <label className="text-sm font-medium block mb-2">Select Feed Source:</label>
          <div className="flex gap-3">
            {['sansad_tv', 'lok_sabha', 'rajya_sabha', 'event'].map(feed => (
              <button
                key={feed}
                className={`px-3 py-1 rounded border ${config.activeFeed === feed ? 'bg-blue-700 text-white' : 'bg-gray-200'}`}
                onClick={() => updateSession({ activeFeed: feed as LiveSessionConfig['activeFeed'] })}
              >
                {feed.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
        🛡️ This configuration updates the Civic Hub live section in real-time.
      </div>
    </div>
  );
};

export default LiveSessionToggle;

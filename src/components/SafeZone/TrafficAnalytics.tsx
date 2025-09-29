// 📂 components/SafeZone/TrafficAnalytics.tsx
import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

const TrafficAnalytics = () => {
  const [data, setData] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  useEffect(() => {
    const fetchTraffic = async () => {
      try {
        const json: any = await api.monitorHub();
        setData({
          viewsToday: json.viewsToday,
          peakTime: json.peakTime,
          topRegion: json.topRegion,
          bounceRate: json.bounceRate
        });
        const now = new Date();
        setLastUpdated(now.toLocaleTimeString());
      } catch (err) {
        console.error('❌ Error fetching traffic data:', err);
      }
    };

    fetchTraffic();
  }, []);

  return (
    <section className="p-5 md:p-6 bg-orange-50 dark:bg-orange-900/10 border border-orange-300 dark:border-orange-700 rounded-2xl shadow-inner max-h-[90vh] overflow-y-auto">
      <p className="text-green-600 dark:text-green-400 font-mono text-sm mb-1">✅ TrafficAnalytics Loaded</p>
      <h2 className="text-xl font-bold text-orange-700 dark:text-orange-300 mb-2">📊 Traffic Analytics</h2>

      {data ? (
        <>
          <p className="text-slate-700 dark:text-slate-300 text-sm mb-2">
            Real-time visitor tracking is active. Summary:
          </p>
          <ul className="list-disc list-inside text-sm space-y-1 text-slate-800 dark:text-slate-200">
            <li>📍 <strong>{data.viewsToday}</strong> views today</li>
            <li>📅 Peak traffic at <strong>{data.peakTime}</strong></li>
            <li>🌎 Top region: <strong>{data.topRegion}</strong></li>
            <li>🔁 Bounce Rate: <strong>{data.bounceRate}%</strong></li>
          </ul>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">Stats updated {lastUpdated}</p>
        </>
      ) : (
        <p className="text-sm text-slate-500 dark:text-slate-400">⏳ Loading traffic data...</p>
      )}
    </section>
  );
};

export default TrafficAnalytics;

import { useEffect, useState } from 'react';
import { fetchJson } from '@lib/fetchJson';
import type { ReactNode } from 'react';
import { FaShieldAlt, FaBug, FaRobot, FaHistory } from 'react-icons/fa';

// Normalized response shapes
interface ThreatEvent { id?: string; createdAt?: string; severity?: string; message?: string; ip?: string }
interface RegionStat { region?: string; incidents?: number }
interface ThreatStats { cards: any[]; recentEvents: ThreatEvent[]; topRegions: RegionStat[] }

const SECURITY_ENABLED = import.meta.env.VITE_SECURITY_SYSTEM_ENABLED !== 'false';

const ThreatDashboard: React.FC = () => {
  const [stats, setStats] = useState<ThreatStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function loadStats() {
    setLoading(true); setError(null);
    try {
      const data: any = await fetchJson<any>('/api/dashboard/threat-stats');
      setStats({
        cards: Array.isArray(data?.cards) ? data.cards : [],
        recentEvents: Array.isArray(data?.recentEvents) ? data.recentEvents : [],
        topRegions: Array.isArray(data?.topRegions) ? data.topRegions : [],
      });
    } catch (err: any) {
      console.error('[ThreatDashboard] load error:', err?.message || err);
      setStats(null);
      setError(err?.message || 'Failed to load threat stats');
    } finally { setLoading(false); }
  }

  useEffect(() => {
    if (!SECURITY_ENABLED) {
      console.warn('[ThreatDashboard] disabled via VITE_SECURITY_SYSTEM_ENABLED=false');
      setStats({ cards: [], recentEvents: [], topRegions: [] });
      setLoading(false);
      return;
    }
    loadStats();
  }, []);

  if (loading) return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-600 dark:text-blue-300"><FaShieldAlt /> Threat Intelligence Dashboard</h2>
      <p className="text-gray-500 text-sm">Loading threat stats...</p>
    </div>
  );

  if (error || !stats) return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-600 dark:text-blue-300"><FaShieldAlt /> Threat Intelligence Dashboard</h2>
      <div className="text-red-600 text-sm">❌ Failed to load threat stats{error ? `: ${error}` : ''}</div>
    </div>
  );

  const { cards, recentEvents, topRegions } = stats;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mt-6">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-600 dark:text-blue-300"><FaShieldAlt /> Threat Intelligence Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <ColorCard color="bg-blue-100 dark:bg-blue-900/30" icon={<FaBug className="text-2xl text-blue-600 mx-auto mb-2" />} label="Cards" value={cards.length} />
        <ColorCard color="bg-yellow-100 dark:bg-yellow-900/30" icon={<FaRobot className="text-2xl text-yellow-600 mx-auto mb-2" />} label="Recent Events" value={recentEvents.length} />
        <ColorCard color="bg-red-100 dark:bg-red-900/30" icon={<FaHistory className="text-2xl text-red-600 mx-auto mb-2" />} label="Top Regions" value={topRegions.length} />
      </div>
      <div className="mb-4">
        <h3 className="text-md font-semibold text-gray-600 dark:text-gray-300 mb-2">🕵️ Recent Events</h3>
        {recentEvents.length === 0 ? <p className="text-xs text-gray-500">No recent events.</p> : (
          <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2 max-h-60 overflow-y-auto pr-2">
            {recentEvents.map((ev: ThreatEvent, idx: number) => (
              <li key={ev.id || idx} className="border-b border-gray-200 dark:border-gray-700 pb-2">
                <div className="flex justify-between items-center"><div><strong>{ev.severity || 'INFO'}:</strong> {ev.message || '—'}</div></div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{ev.createdAt ? new Date(ev.createdAt).toLocaleString() : 'Unknown time'}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="text-md font-semibold text-gray-600 dark:text-gray-300 mb-2">🌐 Top Regions</h3>
        {topRegions.length === 0 ? <p className="text-xs text-gray-500">No region stats.</p> : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {topRegions.map((r: RegionStat, idx: number) => (
              <div key={r.region || idx} className="text-xs p-2 rounded bg-blue-50 dark:bg-blue-900/30"><span className="font-semibold">{r.region || 'Unknown'}</span>: {r.incidents ?? 0}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const ColorCard = ({ color, icon, label, value }: { color: string; icon: ReactNode; label: string; value: number }) => (
  <div className={`${color} p-4 rounded shadow text-center`}>
    {icon}
    <p className="text-sm">{label}</p>
    <p className="text-xl font-bold">{value}</p>
  </div>
);

export default ThreatDashboard;

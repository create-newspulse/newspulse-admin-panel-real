import { useEffect, useState } from 'react';
import { founderApi } from '@/lib/founderApi';

export default function FounderAnalytics() {
  const [growth, setGrowth] = useState<number[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [heatmap, setHeatmap] = useState<number[][]>([]);
  useEffect(() => {
    founderApi.analyticsTrafficGrowth().then((r:any)=> setGrowth(r.points || []));
    founderApi.analyticsHealth().then(setHealth);
    founderApi.insights().then((r:any)=> setInsights(r.items || []));
    founderApi.analyticsHeatmap().then((r:any)=> setHeatmap(r.matrix || []));
  }, []);

  return (
    <div className="rounded-2xl p-4 bg-executive-card text-white border border-white/5 space-y-3">
      <h3 className="text-lg font-semibold">Founder Tools & Analytics</h3>
      <div className="text-sm">Traffic Growth: <span className="text-cyan-300">{growth.join(' → ') || '—'}</span></div>
      <div className="text-sm">System Health: <span className="text-emerald-300">uptime {health?.uptime ?? '—'}%</span></div>
      <div>
        <div className="text-xs uppercase text-slate-400">Performance Heatmap</div>
        <div className="inline-grid mt-2" style={{ gridTemplateColumns: `repeat(${heatmap[0]?.length || 0}, 1.5rem)` }}>
          {heatmap.flatMap((row, ri) => row.map((val, ci) => (
            <div key={`${ri}-${ci}`} className="w-6 h-6 m-0.5 rounded-sm" style={{ backgroundColor: `rgba(99,102,241,${0.2 + Math.min(1, val/3)*0.8})` }} title={`row ${ri} col ${ci}: ${val}`} />
          )))}
          {(!heatmap || heatmap.length===0) && <div className="text-slate-400 text-sm">—</div>}
        </div>
      </div>
      <div>
        <div className="text-xs uppercase text-slate-400">KiranOS Insights</div>
        <ul className="list-disc list-inside text-slate-200 text-sm">
          {insights.map((i) => <li key={i}>{i}</li>)}
          {insights.length===0 && <li>—</li>}
        </ul>
      </div>
    </div>
  );
}

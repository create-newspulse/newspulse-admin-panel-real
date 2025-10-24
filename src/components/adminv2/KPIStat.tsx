import React from 'react';

export default function KPIStat({ label, value, delta, tone = 'blue' }: { label: string; value: string; delta?: string; tone?: 'blue'|'green'|'rose'|'amber' }) {
  const toneMap: Record<string, string> = {
    blue: 'from-blue-500 to-indigo-500',
    green: 'from-emerald-500 to-green-500',
    rose: 'from-rose-500 to-pink-500',
    amber: 'from-amber-500 to-orange-500',
  };
  return (
    <div className="card hover-glow">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
          {delta && <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">{delta}</div>}
        </div>
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${toneMap[tone]} opacity-90`} />
      </div>
    </div>
  );
}

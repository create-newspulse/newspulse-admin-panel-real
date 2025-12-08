import { useEffect, useState } from 'react';
import { founderApi } from '@/lib/founderApi';

export default function Monetization() {
  const [sum, setSum] = useState<any>(null);
  const [earn, setEarn] = useState<any>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    founderApi.monetizationSummary().then(setSum);
    founderApi.monetizationEarnings('monthly').then(setEarn);
  }, []);

  async function toggleLock() {
    const next = !locked;
    await founderApi.monetizationLock(next);
    setLocked(next);
  }

  async function exportCsv() {
    const r: any = await founderApi.monetizationExport();
    if (r?.url) window.open(r.url, '_blank');
  }
  return (
    <div className="rounded-2xl p-4 bg-executive-card text-white border border-white/5 space-y-2">
      <h3 className="text-lg font-semibold">Monetization</h3>
      <div className="text-sm">AdSense/Affiliate/Sponsor: <span className="text-emerald-300">{sum ? `${sum.adsense}/${sum.affiliate}/${sum.sponsor}` : '—'}</span></div>
      <div className="text-sm">Founder Earnings: <span className="text-cyan-300">{earn ? `daily $${earn.daily} • monthly $${earn.monthly}` : '—'}</span></div>
      <div className="flex gap-2">
        <button onClick={exportCsv} className="px-3 py-2 rounded bg-cyan-700 hover:bg-cyan-600">Export CSV</button>
        <button onClick={toggleLock} className={`px-3 py-2 rounded ${locked ? 'bg-amber-800' : 'bg-amber-700'} hover:bg-amber-600`}>{locked ? 'Unlock Revenue' : 'Revenue Lock'}</button>
      </div>
    </div>
  );
}

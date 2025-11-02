import { useEffect, useState } from 'react';

export default function LegalOwnership() {
  const [certs, setCerts] = useState<any[]>([]);
  const [pti, setPti] = useState('');
  const [nominee, setNominee] = useState('');
  const [unlockFile, setUnlockFile] = useState<File | null>(null);

  useEffect(() => {
    fetch('/api/founder/legal/certificates', { headers: { 'x-role': 'founder' } })
      .then(r=>r.json()).then((r)=> setCerts(r.items || []));
  }, []);

  async function savePTI() {
    await fetch('/api/founder/legal/pti-settings', { method: 'POST', headers: { 'content-type': 'application/json', 'x-role': 'founder' }, body: JSON.stringify({ filters: pti }) });
  }
  async function setSuccessor() {
    const fd = new FormData();
    if (unlockFile) fd.append('unlock', unlockFile);
    fd.append('nominee', nominee);
    // For simplicity (and vercel serverless), send as JSON without file in mock mode
    await fetch('/api/founder/legal/successor', { method: 'POST', headers: { 'content-type': 'application/json', 'x-role': 'founder' }, body: JSON.stringify({ nominee }) });
    setNominee('');
  }

  return (
    <div className="rounded-2xl p-4 bg-executive-card text-white border border-white/5 space-y-4">
      <h3 className="text-lg font-semibold">Legal & Ownership</h3>

      <section>
        <div className="text-xs uppercase text-slate-400">Ownership Certificates</div>
        <ul className="list-disc list-inside text-sm mt-2">
          {certs.map(c=> (<li key={c.id}><a className="text-cyan-300 underline" href={c.url} target="_blank" rel="noreferrer">{c.name}</a></li>))}
          {certs.length===0 && <li className="text-slate-400">—</li>}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="text-xs uppercase text-slate-400">PTI/Legal Default Filters</div>
        <textarea className="w-full bg-black/40 border border-white/10 rounded p-2 text-sm" rows={3} placeholder="Enter default filters (one per line)" value={pti} onChange={e=>setPti(e.target.value)} />
        <button onClick={savePTI} className="px-3 py-2 rounded bg-cyan-700 hover:bg-cyan-600 text-white">Save Filters</button>
      </section>

      <section className="space-y-2">
        <div className="text-xs uppercase text-slate-400">Successor Transfer</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className="bg-black/40 border border-white/10 rounded px-3 py-2" placeholder="Nominee email" value={nominee} onChange={e=>setNominee(e.target.value)} />
          <input type="file" className="bg-black/40 border border-white/10 rounded px-3 py-2" onChange={e=> setUnlockFile(e.target.files?.[0] || null)} />
          <button onClick={setSuccessor} className="px-3 py-2 rounded bg-amber-700 hover:bg-amber-600 text-white">Upload & Set</button>
        </div>
      </section>

      <div className="flex gap-2 text-sm">
        <a className="underline text-cyan-300" href="/terms" target="_blank">T&C</a>
        <a className="underline text-cyan-300" href="/privacy" target="_blank">Privacy</a>
        <a className="underline text-cyan-300" href="/safe-content" target="_blank">Safe Content Guide</a>
      </div>
    </div>
  );
}

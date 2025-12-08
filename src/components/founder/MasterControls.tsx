import { useEffect, useState } from 'react';
import { founderApi } from '@/lib/founderApi';

export default function MasterControls() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('online');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [board, setBoard] = useState<any>(null);

  async function lockdown() { setConfirmOpen(true); }
  async function confirmLockdown() { await founderApi.systemLockdown(); setStatus('locked'); setConfirmOpen(false); }
  async function reactivate() { await founderApi.systemReactivate(code); setStatus('online'); }

  useEffect(() => {
    founderApi.systemStatus?.().then((r:any)=> setBoard(r));
  }, []);

  return (
    <div className="rounded-2xl p-4 bg-executive-card text-white border border-white/5 space-y-3">
      <h3 className="text-lg font-semibold">Website Master Controls</h3>
      <div className="text-sm">Server/API Status: <span className="text-emerald-300">{status}</span></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="rounded bg-black/30 p-2 border border-white/10">Frontend: <span className="text-cyan-300">{board?.frontend ?? '...'}</span></div>
        <div className="rounded bg-black/30 p-2 border border-white/10">Backend: <span className="text-cyan-300">{board?.backend ?? '...'}</span></div>
        <div className="rounded bg-black/30 p-2 border border-white/10">DB: <span className="text-cyan-300">{board?.db ?? '...'}</span></div>
        <div className="rounded bg-black/30 p-2 border border-white/10">Queue: <span className="text-cyan-300">{board?.queue ?? '...'}</span></div>
      </div>
      <div className="flex gap-3">
        <button onClick={lockdown} className="px-3 py-2 rounded bg-rose-700 hover:bg-rose-600 text-white">Full System Lockdown</button>
        <input className="flex-1 bg-black/40 border border-white/10 rounded px-3" placeholder="Reactivation Code" value={code} onChange={e=>setCode(e.target.value)} />
        <button onClick={reactivate} className="px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white">Reactivate</button>
      </div>
      <div className="flex gap-3">
        <button onClick={()=> founderApi.backupTrigger()} className="px-3 py-2 rounded bg-cyan-700 hover:bg-cyan-600 text-white">Trigger Cloud Backup</button>
        <button onClick={()=> founderApi.backupDownload()} className="px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 text-white">Download DB Backup</button>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-executive-card rounded-xl border border-white/10 p-6 w-[90%] max-w-md shadow-xl">
            <h4 className="text-lg font-semibold text-rose-300">Confirm Full System Lockdown</h4>
            <p className="text-sm text-slate-300 mt-2">This will temporarily disable non-founder access. Proceed?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-2 rounded bg-slate-700" onClick={()=> setConfirmOpen(false)}>Cancel</button>
              <button className="px-3 py-2 rounded bg-rose-700" onClick={confirmLockdown}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { founderApi } from '@/lib/founderApi';

export default function SecurityEmergency() {
  const [code, setCode] = useState('');
  const [autoHideEmbeds, setAutoHideEmbeds] = useState(true);
  const [disableAiPosting, setDisableAiPosting] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  useEffect(() => { founderApi.securityLogs().then((r:any)=> setLogs(r.items || [])); }, []);
  async function send() { setConfirmOpen(true); }
  async function confirmSend() { await founderApi.securityEmergency(code); setCode(''); setConfirmOpen(false); }
  async function saveAuto() { await founderApi.securityAutoprotection({ hideEmbeds: autoHideEmbeds, disableAiPosting }); }
  return (
    <div className="rounded-2xl p-4 bg-executive-card text-white border border-white/5 space-y-3">
      <h3 className="text-lg font-semibold">Security & Emergency</h3>
      <div className="flex gap-2">
        <input type="password" className="flex-1 bg-black/40 border border-white/10 rounded px-3" placeholder="Emergency Code" value={code} onChange={e=>setCode(e.target.value)} />
        <button onClick={send} className="px-3 py-2 rounded bg-rose-700 hover:bg-rose-600">Execute</button>
      </div>
      <div className="text-xs text-slate-400">Masked input; requires double confirm in production. Default: NewsPulse#80121972</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded p-3 bg-black/30 border border-white/10">
          <div className="text-xs uppercase text-slate-400 mb-2">Auto-Protection</div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoHideEmbeds} onChange={e=>setAutoHideEmbeds(e.target.checked)} /> Hide unsafe embeds</label>
          <label className="flex items-center gap-2 text-sm mt-1"><input type="checkbox" checked={disableAiPosting} onChange={e=>setDisableAiPosting(e.target.checked)} /> Disable AI posting</label>
          <button onClick={saveAuto} className="mt-2 px-3 py-1 rounded bg-cyan-700 text-white">Save</button>
        </div>
        <div className="rounded p-3 bg-black/30 border border-white/10">
          <div className="text-xs uppercase text-slate-400 mb-2">Threat & Security Logs</div>
          <ul className="text-sm space-y-1 max-h-40 overflow-auto pr-1">
            {logs.map((l, i) => (
              <li key={i} className="text-slate-200"><span className="text-slate-400">{new Date(l.ts).toLocaleString()}:</span> [{l.level}] {l.message}</li>
            ))}
            {logs.length===0 && <li className="text-slate-400">—</li>}
          </ul>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-executive-card rounded-xl border border-white/10 p-6 w-[90%] max-w-md shadow-xl">
            <h4 className="text-lg font-semibold text-rose-300">Confirm Emergency Action</h4>
            <p className="text-sm text-slate-300 mt-2">This will execute an emergency procedure. Proceed?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button className="px-3 py-2 rounded bg-slate-700" onClick={()=> setConfirmOpen(false)}>Cancel</button>
              <button className="px-3 py-2 rounded bg-rose-700" onClick={confirmSend}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

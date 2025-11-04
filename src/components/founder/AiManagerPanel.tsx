import { useState } from 'react';
import { founderApi } from '@/lib/founderApi';

export default function AiManagerPanel() {
  const [trustMeter, setTrust] = useState(true);
  const [factChecker, setFact] = useState(true);
  const [autoDelete, setAuto] = useState(false);
  const [command, setCommand] = useState('');

  async function save() { await founderApi.aiToggles({ trustMeter, factChecker, autoDelete }); }
  async function run() { await founderApi.aiCommand(command); setCommand(''); }

  return (
    <div className="rounded-2xl p-4 bg-executive-card text-white border border-white/5 space-y-3">
      <h3 className="text-lg font-semibold">AI System Control</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={trustMeter} onChange={e=>setTrust(e.target.checked)} /> TrustMeter</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={factChecker} onChange={e=>setFact(e.target.checked)} /> FactChecker</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={autoDelete} onChange={e=>setAuto(e.target.checked)} /> AutoDelete/Flag</label>
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white ring-1 ring-cyan-400/30">Save</button>
        <input className="flex-1 bg-black/40 border border-white/10 rounded px-3" placeholder="/lock all, /diagnose system" value={command} onChange={e=>setCommand(e.target.value)} />
        <button onClick={run} className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-500 text-white">Run</button>
      </div>
    </div>
  );
}

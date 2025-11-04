import { useState } from 'react';
import { founderApi } from '@/lib/founderApi';

export default function TwoFactorSetup() {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [enabled, setEnabled] = useState(true);

  async function enable() {
    await founderApi.aiToggles({}); // no-op placeholder to keep bundle size down
    await fetch('/api/founder/2fa/enable', { method: 'POST', headers: { 'content-type': 'application/json', 'x-role': 'founder' }, body: JSON.stringify({ email, pin }) });
    setEnabled(true);
  }
  async function disable() {
    await fetch('/api/founder/2fa/disable', { method: 'POST', headers: { 'x-role': 'founder' } });
    setEnabled(false);
  }

  return (
    <div className="rounded-2xl p-4 bg-executive-card text-white border border-white/5">
      <h3 className="text-lg font-semibold text-slate-200">Two-Factor Authentication</h3>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <input className="bg-black/40 border border-white/10 rounded px-3 py-2" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="bg-black/40 border border-white/10 rounded px-3 py-2" placeholder="Founder PIN" value={pin} onChange={e=>setPin(e.target.value)} />
        <div className="flex gap-2">
          <button onClick={enable} className="px-3 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30 animate-pulseGlow">Enable</button>
          <button onClick={disable} className="px-3 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white">Disable</button>
        </div>
      </div>
      <div className="mt-2 text-xs text-slate-400">Status: {enabled ? 'Enabled' : 'Disabled'}</div>
    </div>
  );
}

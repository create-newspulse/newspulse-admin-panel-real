"use client";
import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';

export function PasskeyRegisterButton() {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string|undefined>();
  async function go() {
    setLoading(true); setMsg(undefined);
    try {
      const optsRes = await fetch('/api/auth/passkey/register', { method:'POST' });
      const opts = await optsRes.json();
      if (!optsRes.ok) throw new Error(opts.error || 'Failed to get options');
      const attestation = await startRegistration(opts);
      const verifyRes = await fetch('/api/auth/passkey/register', { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify(attestation) });
      const vr = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(vr.error || 'Verification failed');
      setMsg('Passkey registered. You can now sign in with it.');
    } catch (e:any) {
      setMsg(e.message || 'Error');
    } finally { setLoading(false); }
  }
  return (
    <div className="space-y-2">
      <button disabled={loading} onClick={go} className="w-full py-2 rounded bg-emerald-600 text-white disabled:opacity-50">{loading?'Registering...':'Register Passkey'}</button>
      {msg && <div className="text-xs text-emerald-700">{msg}</div>}
    </div>
  );
}
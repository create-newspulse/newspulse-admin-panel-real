"use client";
import { useState } from 'react';
import { startAuthentication } from '@simplewebauthn/browser';

export function PasskeySignInButton({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string|undefined>();
  async function go() {
    if (!email) { setMsg('Email required'); return; }
    setLoading(true); setMsg(undefined);
    try {
      const optsRes = await fetch('/api/auth/passkey/assert', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email }) });
      const opts = await optsRes.json();
      if (!optsRes.ok) throw new Error(opts.error || 'Failed options');
      const assertion = await startAuthentication(opts);
      const verifyRes = await fetch('/api/auth/passkey/assert', { method:'PUT', headers:{'content-type':'application/json'}, body: JSON.stringify({ ...assertion, email }) });
      const vr = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(vr.error || 'Verification failed');
      window.location.href = vr.redirect;
    } catch (e:any) {
      setMsg(e.message || 'Error');
    } finally { setLoading(false); }
  }
  return (
    <div className="space-y-2">
      <button disabled={loading} onClick={go} className="w-full py-2 rounded bg-indigo-600 text-white disabled:opacity-50">{loading?'Authenticating...':'Sign in with Passkey'}</button>
      {msg && <div className="text-xs text-indigo-700">{msg}</div>}
    </div>
  );
}
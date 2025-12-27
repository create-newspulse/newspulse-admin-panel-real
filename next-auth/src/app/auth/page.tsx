"use client";

// Minimal client wrapper to match the requested `api.post(...)->{ data }` shape
// without depending on axios in the Next.js sub-app.
const api = {
  post: async (url: string, body?: any): Promise<{ data: any; status: number }> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err: any = new Error(data?.error || data?.message || 'Request failed');
      err.response = { status: res.status, data };
      throw err;
    }
    return { data, status: res.status };
  },
};
import { useEffect, useState } from 'react';
import { PasskeyRegisterButton } from './components/PasskeyRegisterButton';
import { PasskeySignInButton } from './components/PasskeySignInButton';
import { z } from 'zod';

const schema = z.object({ email: z.string().email(), password: z.string().min(8), lane: z.enum(['owner','team']) });

export default function AuthPage() {
  const [lane, setLane] = useState<'owner'|'team'>('owner');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp] = useState('');
  const [recovery, setRecovery] = useState('');
  const [mfaMode, setMfaMode] = useState<'none'|'totp'|'passkey'|'recovery'|'email'>('none');
  const [message, setMessage] = useState<string | null>(null);
  useEffect(()=>{
    try {
      const stored = window.localStorage.getItem('lane');
      if (stored === 'owner' || stored === 'team') setLane(stored as any);
    } catch {}
  }, []);
  useEffect(()=>{
    try { window.localStorage.setItem('lane', lane); } catch {}
  }, [lane]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    try {
      schema.parse({ email, password, lane });
      const res = await api.post('/api/auth/login', { email, password, lane });
      const data = res.data;
      if (data.mfaRequired) {
        setMfaMode(data.mfaRequired.type);
        if (data.mfaRequired.type === 'passkey') setMessage('Passkey required – click button.');
        else if (data.mfaRequired.type === 'totp') setMessage('Enter your TOTP code to continue.');
        else if (data.mfaRequired.type === 'email') setMessage('We sent a sign-in code to your email.');
        return;
      }
      try {
        if (data?.token) window.localStorage.setItem('np_token', String(data.token));
      } catch {}
      window.location.href = data.redirect || '/admin/dashboard';
    } catch (err:any) {
      setMessage(err.message || 'Login failed');
    }
  }

  async function submitTotp() {
    setMessage(null);
    try {
      const res = await fetch('/api/auth/mfa/totp/verify', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ code: totp }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'TOTP failed');
      try {
        if (data?.token) window.localStorage.setItem('np_token', String(data.token));
      } catch {}
      window.location.href = data.redirect;
    } catch (e:any) { setMessage(e.message); }
  }
  async function submitRecovery() {
    setMessage(null);
    try {
      const res = await fetch('/api/auth/recovery/consume', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ code: recovery }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Recovery failed');
      try {
        if (data?.token) window.localStorage.setItem('np_token', String(data.token));
      } catch {}
      window.location.href = data.redirect;
    } catch (e:any) { setMessage(e.message); }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-xl shadow p-6">
        <div className="flex gap-2 mb-4">
          <button className={`flex-1 py-2 rounded ${lane==='owner'?'bg-blue-600 text-white':'bg-slate-200'}`} onClick={()=>setLane('owner')}>Owner Access</button>
          <button className={`flex-1 py-2 rounded ${lane==='team'?'bg-blue-600 text-white':'bg-slate-200'}`} onClick={()=>setLane('team')}>Team Access</button>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input className="w-full border rounded px-3 py-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium">Password</label>
            <input className="w-full border rounded px-3 py-2" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
          </div>
          {lane==='owner' && mfaMode==='passkey' && (
            <div className="space-y-2">
              <PasskeySignInButton email={email} />
              <div className="flex justify-between items-center">
                <button type="button" onClick={()=>setMfaMode('recovery')} className="text-xs underline">Use recovery code</button>
                <button type="button" onClick={async()=>{ await requestEmailOtp(); setMfaMode('email'); }} className="text-xs underline">Use email OTP</button>
                <PasskeyRegisterButton />
              </div>
            </div>
          )}
          {lane==='owner' && mfaMode==='totp' && (
            <div className="flex items-center gap-2">
              <input placeholder="TOTP" className="flex-1 border rounded px-3 py-2" value={totp} onChange={e=>setTotp(e.target.value)} />
              <button type="button" onClick={submitTotp} className="py-2 px-3 bg-blue-600 text-white rounded">Verify</button>
              <button type="button" onClick={()=>setMfaMode('recovery')} className="text-xs underline">Recovery</button>
              <button type="button" onClick={async()=>{ await requestEmailOtp(); setMfaMode('email'); }} className="text-xs underline">Use email OTP</button>
            </div>
          )}
          {lane==='owner' && mfaMode==='email' && (
            <EmailOtpBlock onBack={()=>setMfaMode('totp')} />
          )}
          {lane==='owner' && mfaMode==='recovery' && (
            <div className="flex items-center gap-2">
              <input placeholder="Recovery code" className="flex-1 border rounded px-3 py-2" value={recovery} onChange={e=>setRecovery(e.target.value)} />
              <button type="button" onClick={submitRecovery} className="py-2 px-3 bg-blue-600 text-white rounded">Use Code</button>
              <button type="button" onClick={()=>setMfaMode('totp')} className="text-xs underline">Back</button>
            </div>
          )}
          {message && <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">{message}</div>}
          <button className="w-full bg-blue-600 text-white py-2 rounded">Sign in</button>
        </form>
      </div>
    </div>
  );
}

function EmailOtpBlock({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string|undefined>();
  async function verify() {
    setMsg(undefined);
    const res = await fetch('/api/auth/mfa/email/verify', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ code }) });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error||'Invalid code'); return; }
    try {
      if (data?.token) window.localStorage.setItem('np_token', String(data.token));
    } catch {}
    window.location.href = data.redirect;
  }
  async function resend() {
    setMsg(undefined);
    const res = await fetch('/api/auth/mfa/email/request', { method:'POST' });
    const data = await res.json();
    if (!res.ok) { setMsg(data.error||'Failed to send'); return; }
    setMsg('Code sent. Check your email.');
  }
  useEffect(()=>{ resend(); }, []);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input placeholder="6-digit code" className="flex-1 border rounded px-3 py-2" value={code} onChange={e=>setCode(e.target.value)} />
        <button type="button" onClick={verify} className="py-2 px-3 bg-blue-600 text-white rounded">Verify</button>
      </div>
      <div className="flex justify-between text-xs">
        <button type="button" onClick={resend} className="underline">Resend code</button>
        <button type="button" onClick={onBack} className="underline">Back</button>
      </div>
      {msg && <div className="text-xs text-amber-700">{msg}</div>}
    </div>
  );
}

async function requestEmailOtp() {
  await fetch('/api/auth/mfa/email/request', { method:'POST' });
  // The server rotates MFA ticket to email method; UI will switch to email mode
  // The caller should set mfaMode('email') after this call.
}

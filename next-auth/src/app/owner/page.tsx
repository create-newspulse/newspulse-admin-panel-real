"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OwnerPage() {
  const [me, setMe] = useState<any>(null);
  const [codes, setCodes] = useState<string[]|null>(null);
  const router = useRouter();
  useEffect(()=>{ (async()=>{
    const res = await fetch('/api/auth/me',{ cache:'no-store' });
    if (!res.ok) { router.replace('/login?next=%2Fowner'); return; }
    setMe((await res.json()).user);
  })(); },[router]);
  async function logout(){
    await fetch('/api/auth/logout',{ method:'POST' });
    // ✅ Fixed: logout now clears session and routes to /login instead of missing /auth.
    router.replace('/login');
  }
  async function genRecovery(){
    const res = await fetch('/api/auth/recovery/generate', { method:'POST' });
    const data = await res.json();
    if (res.ok) { setCodes(data.codes); }
    else alert(data.error || 'Failed to generate');
  }
  return (
    <div className="min-h-screen p-8 bg-slate-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Owner Zone</h1>
          <button onClick={logout} className="px-3 py-2 bg-slate-800 text-white rounded">Logout</button>
        </div>
        <p className="text-slate-600 mb-6">Welcome {me?.id} ({me?.role})</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['Founder Command','Security & Lockdown','AI Control','Compliance','Vaults','Revenue']
            .map((t)=> (
              <div key={t} className="rounded-lg bg-white border p-4 shadow-sm">{t}</div>
            ))}
        </div>
        <div className="mt-8 bg-white border rounded p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recovery Codes</h2>
            <button onClick={genRecovery} className="px-3 py-1.5 bg-emerald-600 text-white rounded">Generate new</button>
          </div>
          {codes && (
            <div className="mt-3 text-sm">
              <p className="text-amber-700 mb-2">Copy these and store securely. They will NOT be shown again.</p>
              <ul className="grid grid-cols-2 gap-2">
                {codes.map((c)=> <li key={c} className="font-mono bg-slate-100 px-2 py-1 rounded">{c}</li>)}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
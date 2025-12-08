"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ConsolePage() {
  const [me, setMe] = useState<any>(null);
  const router = useRouter();
  useEffect(()=>{ (async()=>{
    const res = await fetch('/api/auth/me',{ cache:'no-store' });
    if (!res.ok) { router.replace('/login?next=%2Fconsole'); return; }
    setMe((await res.json()).user);
  })(); },[router]);
  async function logout(){
    await fetch('/api/auth/logout',{ method:'POST' });
    // ✅ Fixed: logout now clears session and routes to /login instead of missing /auth.
    router.replace('/login');
  }
  return (
    <div className="min-h-screen p-8 bg-slate-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Team Console</h1>
          <button onClick={logout} className="px-3 py-2 bg-slate-800 text-white rounded">Logout</button>
        </div>
        <p className="text-slate-600 mb-6">Welcome {me?.id} ({me?.role})</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {['My Queue','Drafts','Reviews','Announcements','PTI Checklist']
            .map((t)=> (
              <div key={t} className="rounded-lg bg-white border p-4 shadow-sm">{t}</div>
            ))}
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { founderApi } from '@/lib/founderApi';

export default function FounderProfileCard() {
  const [profile, setProfile] = useState<any>(null);
  useEffect(() => { founderApi.getProfile().then(setProfile); }, []);

  const p = profile?.profile;
  return (
    <div className="rounded-2xl p-4 md:p-6 bg-executive-card/90 text-white shadow-xl border border-white/5">
      <h3 className="text-lg font-semibold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">Identity & Access</h3>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div>Name: <span className="font-medium text-cyan-300">{p?.name || '—'}</span></div>
        <div>Founder ID: <span className="font-mono text-purple-300">{p?.founderId || '—'}</span></div>
        <div>Access: <span className="text-emerald-300">{p?.accessLevel || '—'}</span></div>
        <div>Last Login: <span className="text-slate-300">{p?.lastLogin ? new Date(p.lastLogin).toLocaleString() : '—'}</span></div>
      </div>
      <div className="mt-3">
        <div className="text-xs uppercase text-slate-400">Devices</div>
        <ul className="list-disc list-inside text-slate-200">
          {p?.devices?.map((d: string) => (<li key={d}>{d}</li>)) || <li>—</li>}
        </ul>
      </div>
      <div className="mt-3 text-sm">2FA: <span className={p?.twoFA?.enabled ? 'text-emerald-300' : 'text-rose-300'}>{p?.twoFA?.enabled ? 'Enabled' : 'Disabled'}</span></div>
    </div>
  );
}

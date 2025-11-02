import { useState } from 'react';
import { founderApi } from '@/lib/founderApi';

export default function AuthorityLock() {
  const [locked, setLocked] = useState(false);
  async function toggle() {
    const next = !locked;
    await founderApi.setAuthorityLock(next);
    setLocked(next);
  }
  return (
    <div className="rounded-2xl p-4 bg-executive-card text-white border border-white/5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Authority Lock</h3>
        <button onClick={toggle} className={`px-3 py-2 rounded ${locked ? 'bg-rose-600' : 'bg-emerald-600'} text-white`}>{locked ? 'Unlock' : 'Enable Lock'}</button>
      </div>
      <p className="mt-2 text-sm text-slate-300">When enabled, all non-founder admin logins are blocked.</p>
    </div>
  );
}

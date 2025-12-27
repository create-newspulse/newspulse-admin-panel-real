import { useEffect, useState } from 'react';
import { useAuth } from '@context/AuthContext';
import api from '@/lib/api.js';

type SessionInfo = { authenticated?: boolean; email?: string };

export default function SecurityAdmin() {
  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/admin-auth/session', { withCredentials: true });
        const data = res.data;
        if (!mounted) return;
        setSession(data);
      } catch {
        if (!mounted) return;
        setSession(null);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Security</div>
        <div className="mt-1 text-sm text-slate-600">Sessions, password policy, and 2FA placeholder.</div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-base font-semibold">Sessions</div>
          {loading ? (
            <div className="mt-3 text-slate-600">Loading…</div>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="font-semibold">Current session</div>
                <div className="text-slate-700">{session?.authenticated ? 'Active' : 'Not authenticated'}</div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="font-semibold">Email</div>
                <div className="text-slate-700">{session?.email || user?.email || '—'}</div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="font-semibold">Role</div>
                <div className="text-slate-700">{role || '—'}</div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <a
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  href="/api/admin-auth/logout"
                >
                  Logout
                </a>
                <a
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100"
                  href="/api/admin-auth/logout"
                  title="Backend does not expose global session revocation; this logs out this browser session."
                >
                  Logout All
                </a>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-base font-semibold">Password Policy</div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Placeholder: define minimum length, rotation rules, and breach checks.
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="text-base font-semibold">2FA</div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Placeholder: enable/disable 2FA and enrollment. (No enforcement wired here yet.)
          </div>
        </div>
      </div>
    </div>
  );
}

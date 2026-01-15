import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { toast } from 'react-hot-toast';
import { adminJson } from '@/lib/http/adminFetch';
import { logoutAll, toFriendlyErrorMessage } from '@/api/adminPanelSettingsApi';

type SessionInfo = { authenticated?: boolean; email?: string };

export default function SecurityAdmin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = String(user?.role || '').toLowerCase();
  const isFounder = role === 'founder';

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoutAllOpen, setLogoutAllOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const data: any = await adminJson('/me', { cache: 'no-store' } as any);
        const email = data?.email || data?.user?.email;
        const authenticated = Boolean(data?.authenticated ?? data?.ok ?? data?.user);
        if (!mounted) return;
        setSession({ authenticated, email });
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

  const doLogout = () => {
    try {
      logout('manual');
      navigate('/login', { replace: true });
    } catch {
      // ignore
    }
  };

  const doLogoutAll = async () => {
    if (!isFounder) {
      toast.error('Access denied (founder only).');
      return;
    }
    setBusy(true);
    try {
      await logoutAll();
      toast.success('Logged out everywhere');
    } catch (e: any) {
      toast.error(toFriendlyErrorMessage(e, 'Logout all failed'));
    } finally {
      setBusy(false);
      setLogoutAllOpen(false);
      doLogout();
    }
  };

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
                <button
                  type="button"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  onClick={doLogout}
                >
                  Logout
                </button>
                <button
                  type="button"
                  disabled={!isFounder || busy}
                  className={
                    'rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-100 ' +
                    (isFounder ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-100 text-slate-400')
                  }
                  onClick={() => setLogoutAllOpen(true)}
                  title={isFounder ? 'Revoke sessions across devices.' : 'Founder only'}
                >
                  Logout All
                </button>
              </div>
            </div>
          )}
        </div>

        {logoutAllOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
              <div className="text-lg font-semibold">Confirm logout all</div>
              <div className="mt-2 text-sm text-slate-700">
                This will revoke all sessions for your account and log you out here.
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100"
                  onClick={() => setLogoutAllOpen(false)}
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                  onClick={doLogoutAll}
                  disabled={busy}
                >
                  {busy ? 'Working…' : 'Logout All'}
                </button>
              </div>
            </div>
          </div>
        )}

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

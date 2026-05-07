import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@context/AuthContext';
import { toast } from 'react-hot-toast';
import {
  activateUser,
  createTeamUser,
  forceResetUser,
  getTeamUsers,
  suspendUser,
  toFriendlyErrorMessage,
  type TeamUser,
} from '@/api/adminPanelSettingsApi';

const FOUNDER_EMAIL = 'newspulse.team@gmail.com';
const FOUNDER_NAME = 'News Pulse Founder';

const PLANNED_EDITOR_RESPONSIBILITIES = [
  'Can access Add News',
  'Can access Draft Desk',
  'Can edit drafts/articles only if permission is granted',
  'Cannot access Safe Zone',
  'Cannot access Settings',
  'Cannot access Ads Manager',
  'Cannot access Broadcast Center',
  'Cannot manage team members',
  'Cannot suspend/reset founder',
  'Cannot change site ownership',
];

export default function TeamManagement() {
  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const isFounder = role === 'founder';

  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    role: 'editor',
    designation: '',
    permissions: '',
  });

  const [items, setItems] = useState<TeamUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);
  const [createdTempPassword, setCreatedTempPassword] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);

  const roles = useMemo(() => ['editor'], []);

  async function fetchStaff() {
    setLoading(true);
    setErr(null);
    try {
      const list = await getTeamUsers();
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setItems([]);
      setErr(toFriendlyErrorMessage(e, 'Failed to load staff.'));
    } finally {
      setLoading(false);
    }
  }

  const parsePermissions = () =>
    createForm.permissions
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);

  const userId = (u: TeamUser) => String(u?._id || u?.id || '');

  const isUserActive = (u: TeamUser): boolean => {
    if (typeof u?.isActive === 'boolean') return u.isActive;
    const s = String(u?.status || '').toLowerCase();
    if (s === 'suspended' || s === 'inactive' || s === 'disabled') return false;
    if (s === 'active') return true;
    return true;
  };

  const isFounderUser = (u: TeamUser): boolean => {
    const normalizedRole = String(u?.role || '').toLowerCase();
    const normalizedEmail = String(u?.email || '').trim().toLowerCase();
    return normalizedRole === 'founder' || normalizedEmail === FOUNDER_EMAIL;
  };

  const founderRow = useMemo<TeamUser>(() => {
    const existing = items.find(isFounderUser);
    if (existing) {
      return {
        ...existing,
        name: FOUNDER_NAME,
        email: FOUNDER_EMAIL,
        role: 'founder',
        isActive: true,
        status: 'active',
      };
    }
    return {
      name: FOUNDER_NAME,
      email: FOUNDER_EMAIL,
      role: 'founder',
      isActive: true,
      status: 'active',
    };
  }, [items]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFounder) {
      toast.error('Access denied (founder only).');
      return;
    }
    const name = String(createForm.name || '').trim();
    const email = String(createForm.email || '').trim();
    if (!name) {
      toast.error('Enter the editor\'s real name.');
      return;
    }
    if (!email || !email.includes('@')) {
      toast.error('Enter a valid email.');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        email,
        name,
        role: 'editor',
        designation: createForm.designation?.trim() || undefined,
        permissions: parsePermissions(),
      };
      const res: any = await createTeamUser(payload);
      const tempPassword =
        res?.tempPassword ||
        res?.password ||
        res?.data?.tempPassword ||
        res?.data?.password ||
        null;
      setCreatedTempPassword(tempPassword ? String(tempPassword) : null);
      setCreatedEmail(email);
      toast.success('Staff created');
      setCreateForm({ name: '', email: '', role: 'editor', designation: '', permissions: '' });
      await fetchStaff();
    } catch (err2: any) {
      toast.error(toFriendlyErrorMessage(err2, 'Create failed'));
    } finally {
      setCreating(false);
    }
  };

  const runRowAction = async (id: string, action: () => Promise<any>, label: string) => {
    if (!isFounder) {
      toast.error('Access denied (founder only).');
      return;
    }
    if (!id) return;
    setRowBusyId(id);
    try {
      await action();
      toast.success(label);
      await fetchStaff();
    } catch (err2: any) {
      toast.error(toFriendlyErrorMessage(err2, 'Action failed'));
    } finally {
      setRowBusyId(null);
    }
  };

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Team Management</div>
            <div className="mt-1 text-sm text-slate-600">Founder and Editor role planning only.</div>
            <div className="mt-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
              For now, News Pulse uses only Founder and Editor roles. More team roles will be added later when responsibilities are finalized.
            </div>
            {!isFounder && (
              <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Access denied: founder-only controls are disabled.
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={fetchStaff}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {createdEmail && createdTempPassword && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <div className="font-semibold">Temporary password (shown once)</div>
          <div className="mt-1 text-sm">
            For: <span className="font-semibold">{createdEmail}</span>
          </div>
          <div className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 font-mono text-sm">
            {createdTempPassword}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
              onClick={async () => {
                try {
                  if (!navigator?.clipboard?.writeText) throw new Error('Clipboard unavailable');
                  await navigator.clipboard.writeText(createdTempPassword);
                  toast.success('Copied');
                } catch {
                  toast.error('Copy failed');
                }
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-emerald-100"
              onClick={() => {
                setCreatedTempPassword(null);
                setCreatedEmail(null);
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-base font-semibold">Invite Editor</div>
          <div className="mt-1 text-sm text-slate-600">Only the Editor role can be assigned from this form.</div>
          <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            Required before activation: real name and verified email.
          </div>

          <form
            className="mt-4 space-y-3"
            onSubmit={handleCreate}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="Full name"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <input
                value={createForm.email}
                onChange={(e) => setCreateForm((s) => ({ ...s, email: e.target.value }))}
                placeholder="Email"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <select
                value={createForm.role}
                onChange={(e) => setCreateForm((s) => ({ ...s, role: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <input
                value={createForm.designation}
                onChange={(e) => setCreateForm((s) => ({ ...s, designation: e.target.value }))}
                placeholder="Designation (optional)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={!isFounder || creating}
                className={
                  'rounded-lg px-4 py-2 text-sm font-semibold ' +
                  (isFounder ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-300 text-slate-700')
                }
              >
                {creating ? 'Creating…' : 'Invite Editor'}
              </button>
              {!isFounder && <div className="text-xs text-slate-600">Founder-only</div>}
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-base font-semibold">Planned Editor Role</div>
          <div className="mt-1 text-sm text-slate-600">Not assigned yet. Responsibilities are intentionally limited.</div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">Editor</div>
                  <div className="mt-1 text-xs text-slate-600">Status: Not assigned yet</div>
                  <div className="mt-1 text-xs text-slate-600">Required before activation: real name + verified email</div>
                </div>
                <span className="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                  Planned Role
                </span>
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-700">
                {PLANNED_EDITOR_RESPONSIBILITIES.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-base font-semibold">Current Team</div>

        {loading ? (
          <div className="mt-3 text-slate-600">Loading…</div>
        ) : err ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            {err} Showing the protected founder account view below.
          </div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-600">
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[founderRow].map((u) => {
                  const id = userId(u);
                  return (
                    <tr key={id || `${u.email}-${u.name}`} className="border-t border-slate-200">
                      <td className="py-2 pr-3 font-medium text-slate-900">{u.name || FOUNDER_NAME}</td>
                      <td className="py-2 pr-3">{u.email || FOUNDER_EMAIL}</td>
                      <td className="py-2 pr-3">founder</td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                            Active
                          </span>
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                            Founder Protected
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled
                            className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400"
                          >
                            Active
                          </button>
                          <button
                            type="button"
                            disabled
                            className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400"
                          >
                            Suspend Disabled
                          </button>
                          <button
                            type="button"
                            disabled
                            className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400"
                          >
                            Force Reset Disabled
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isFounder && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            You can view staff, but only a founder can create/activate/suspend/reset users.
          </div>
        )}
      </div>
    </div>
  );
}

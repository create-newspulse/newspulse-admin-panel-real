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

  const roles = useMemo(() => ['founder', 'admin', 'editor', 'intern', 'employee'], []);

  const permissionPresets = useMemo(
    () => [
      { id: 'articles:read', label: 'Articles: Read' },
      { id: 'articles:write', label: 'Articles: Write' },
      { id: 'settings:draft', label: 'Settings: Draft' },
      { id: 'settings:publish', label: 'Settings: Publish (Founder)' },
      { id: 'team:manage', label: 'Team: Manage (Founder)' },
      { id: 'audit:read', label: 'Audit: Read' },
    ],
    []
  );

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFounder) {
      toast.error('Access denied (founder only).');
      return;
    }
    const email = String(createForm.email || '').trim();
    if (!email || !email.includes('@')) {
      toast.error('Enter a valid email.');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        email,
        name: createForm.name?.trim() || undefined,
        role: createForm.role,
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
            <div className="mt-1 text-sm text-slate-600">Manage staff roles and access.</div>
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
          <div className="text-base font-semibold">Create Staff</div>
          <div className="mt-1 text-sm text-slate-600">Create a staff user (founder only).</div>

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
                placeholder="Designation (e.g., Editor)"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-900">Permissions</div>
              <div className="mt-1 text-xs text-slate-600">Select presets or enter comma-separated values.</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {permissionPresets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      const current = new Set(
                        createForm.permissions
                          .split(',')
                          .map((x) => x.trim())
                          .filter(Boolean)
                      );
                      if (current.has(p.id)) current.delete(p.id);
                      else current.add(p.id);
                      setCreateForm((s) => ({ ...s, permissions: Array.from(current).join(', ') }));
                    }}
                    className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <input
                value={createForm.permissions}
                onChange={(e) => setCreateForm((s) => ({ ...s, permissions: e.target.value }))}
                placeholder="permissions (comma-separated)"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
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
                {creating ? 'Creating…' : 'Create'}
              </button>
              {!isFounder && <div className="text-xs text-slate-600">Founder-only</div>}
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-base font-semibold">Account Controls</div>
          <div className="mt-1 text-sm text-slate-600">Activate/suspend and force reset controls (founder-only).</div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              Use the per-user actions in the Staff list below.
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-base font-semibold">Staff</div>

        {loading ? (
          <div className="mt-3 text-slate-600">Loading…</div>
        ) : err ? (
          <div className="mt-3 text-red-700">{err}</div>
        ) : items.length === 0 ? (
          <div className="mt-3 text-slate-600">No users found.</div>
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
                {items.map((u) => {
                  const id = userId(u);
                  const active = isUserActive(u);
                  const busy = rowBusyId === id;
                  return (
                    <tr key={id || `${u.email}-${u.name}`} className="border-t border-slate-200">
                      <td className="py-2 pr-3">{u.name || '—'}</td>
                      <td className="py-2 pr-3">{u.email || '—'}</td>
                      <td className="py-2 pr-3">{u.role || '—'}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ' +
                            (active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-800')
                          }
                        >
                          {active ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={!isFounder || busy}
                            className={
                              'rounded-lg border px-3 py-1.5 text-xs font-semibold ' +
                              (isFounder ? 'border-slate-300 bg-white hover:bg-slate-100' : 'border-slate-200 bg-slate-100 text-slate-400')
                            }
                            onClick={() => runRowAction(id, () => activateUser(id), 'User activated')}
                          >
                            {busy ? 'Working…' : 'Activate'}
                          </button>
                          <button
                            type="button"
                            disabled={!isFounder || busy}
                            className={
                              'rounded-lg border px-3 py-1.5 text-xs font-semibold ' +
                              (isFounder ? 'border-slate-300 bg-white hover:bg-slate-100' : 'border-slate-200 bg-slate-100 text-slate-400')
                            }
                            onClick={() => runRowAction(id, () => suspendUser(id), 'User suspended')}
                          >
                            {busy ? 'Working…' : 'Suspend'}
                          </button>
                          <button
                            type="button"
                            disabled={!isFounder || busy}
                            className={
                              'rounded-lg border px-3 py-1.5 text-xs font-semibold ' +
                              (isFounder ? 'border-slate-300 bg-white hover:bg-slate-100' : 'border-slate-200 bg-slate-100 text-slate-400')
                            }
                            onClick={() => runRowAction(id, () => forceResetUser(id), 'Reset triggered')}
                          >
                            {busy ? 'Working…' : 'Force Reset'}
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

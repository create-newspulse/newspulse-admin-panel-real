import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '@lib/api';
import { useAuth } from '@context/AuthContext';

type AdminUser = {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
  designation?: string;
  permissions?: string[];
  isActive?: boolean;
};

export default function TeamManagement() {
  const { user } = useAuth();
  const role = String(user?.role || '').toLowerCase();
  const isFounder = role === 'founder';

  const STAFF_LIST_ENDPOINT = '/api/admin/staff';

  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    role: 'editor',
    designation: '',
    permissions: '',
  });

  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [staffEndpointMissing, setStaffEndpointMissing] = useState(false);

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
    setStaffEndpointMissing(false);
    try {
      // Contract: /api/admin/staff
      // Proxy mode:
      //   browser -> /admin-api/admin/staff  (Vite/Vercel) -> backend /api/admin/staff
      // We intentionally call the canonical backend path and let the adminApi interceptor
      // normalize it for proxy/direct mode.
      const res = await adminApi.get(STAFF_LIST_ENDPOINT);
      const data = (res as any)?.data ?? res;
      // Tolerate common shapes
      const list = Array.isArray(data?.staff)
        ? data.staff
        : (Array.isArray(data?.users) ? data.users : (Array.isArray(data) ? data : []));
      setItems(list);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 404) {
        setStaffEndpointMissing(true);
        setErr(null);
      } else if (status === 401) {
        // Session expired / missing credentials
        setErr('Not authenticated. Please log in again.');
      } else if (status === 403) {
        // Role/owner-key gate
        setErr('Access denied. Your account may require additional permissions.');
      } else if (!status) {
        // Network / proxy / CORS / backend not running
        setErr('Backend unreachable. Ensure the backend is running and the /admin-api proxy is configured.');
      } else {
        setErr(`Failed to load staff (HTTP ${status}). Please try again.`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function updateRole(userId: string, nextRole: string) {
    if (!isFounder || staffEndpointMissing) return;
    await adminApi.put(`/admin/update-role/${userId}`, { role: nextRole });
    await fetchStaff();
  }

  const backendMissingHint =
    'This action is UI-only until the production backend exposes a supported endpoint.';

  useEffect(() => {
    fetchStaff();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isFounder) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800">
        Founder-only: Team Management
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Team Management</div>
            <div className="mt-1 text-sm text-slate-600">Manage staff roles and access.</div>
          </div>
          <button
            type="button"
            onClick={fetchStaff}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-base font-semibold">Create Staff</div>
          <div className="mt-1 text-sm text-slate-600">Founder-only staff creation form (pending backend support).</div>

          <form
            className="mt-4 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
            }}
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
                disabled
                className="rounded-lg bg-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                title={backendMissingHint}
              >
                Create
              </button>
              <div className="text-xs text-slate-600">{backendMissingHint}</div>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-base font-semibold">Account Controls</div>
          <div className="mt-1 text-sm text-slate-600">Activate/suspend and force reset controls (founder-only).</div>

          <div className="mt-4 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              These actions are displayed to satisfy the admin UX spec, but will remain disabled until production backend endpoints are available.
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                title={backendMissingHint}
              >
                Activate
              </button>
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                title={backendMissingHint}
              >
                Suspend
              </button>
              <button
                type="button"
                disabled
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
                title={backendMissingHint}
              >
                Force Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-base font-semibold">Staff</div>

        {staffEndpointMissing && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <div className="text-sm font-semibold">Backend endpoint missing: {STAFF_LIST_ENDPOINT} (pending backend support)</div>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={fetchStaff}
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-amber-100"
              >
                Retry
              </button>
              <div className="text-xs text-amber-800">Create and actions are disabled until this endpoint exists.</div>
            </div>
          </div>
        )}

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
                  <th className="py-2 pr-3">Designation</th>
                  <th className="py-2 pr-3">Permissions</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((u) => (
                  <tr key={u._id} className="border-t border-slate-200">
                    <td className="py-2 pr-3">{u.name || '—'}</td>
                    <td className="py-2 pr-3">{u.email || '—'}</td>
                    <td className="py-2 pr-3">{u.role || '—'}</td>
                    <td className="py-2 pr-3">{u.designation || '—'}</td>
                    <td className="py-2 pr-3">
                      {Array.isArray(u.permissions) && u.permissions.length ? u.permissions.join(', ') : '—'}
                    </td>
                    <td className="py-2 pr-3">{typeof u.isActive === 'boolean' ? (u.isActive ? 'Active' : 'Suspended') : '—'}</td>
                    <td className="py-2 pr-3">
                      <select
                        value={String(u.role || '')}
                        onChange={(e) => updateRole(u._id, e.target.value)}
                        disabled={staffEndpointMissing}
                        className="rounded border border-slate-300 bg-white px-2 py-1"
                      >
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

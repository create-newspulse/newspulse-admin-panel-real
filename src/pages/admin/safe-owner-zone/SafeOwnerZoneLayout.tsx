import { NavLink, Outlet } from 'react-router-dom';

const MODULES = [
  { key: 'founder', label: 'Founder Command', to: '/admin/safe-owner-zone/founder' },
  { key: 'security-lockdown', label: 'Security & Lockdown', to: '/admin/safe-owner-zone/security-lockdown' },
  { key: 'compliance', label: 'Compliance', to: '/admin/safe-owner-zone/compliance' },
  { key: 'ai-control', label: 'AI Control', to: '/admin/safe-owner-zone/ai-control' },
  { key: 'vaults', label: 'Vaults', to: '/admin/safe-owner-zone/vaults' },
  { key: 'operations', label: 'Operations', to: '/admin/safe-owner-zone/operations' },
  { key: 'revenue', label: 'Revenue', to: '/admin/safe-owner-zone/revenue' },
  { key: 'admin-oversight', label: 'Admin Oversight', to: '/admin/safe-owner-zone/admin-oversight' },
] as const;

export default function SafeOwnerZoneLayout() {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px,1fr]">
      <aside className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <NavLink to="/admin/safe-owner-zone" className="block rounded-lg px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800">
          <div className="text-sm font-semibold">Safe Owner Zone</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Owner control hub</div>
        </NavLink>

        <div className="mt-3 space-y-1">
          {MODULES.map((m) => (
            <NavLink
              key={m.key}
              to={m.to}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm transition ${
                  isActive ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
                }`
              }
            >
              {m.label}
            </NavLink>
          ))}
        </div>
      </aside>

      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  );
}

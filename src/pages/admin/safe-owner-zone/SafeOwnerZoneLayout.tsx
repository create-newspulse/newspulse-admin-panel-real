import { useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

type ModuleLink = { key: string; label: string; to: string; icon: string };

const CONTROLS: ModuleLink[] = [
  { key: 'founder', label: 'Founder Command', to: '/admin/safe-owner-zone/founder', icon: '🎛️' },
  { key: 'security-lockdown', label: 'Security Center', to: '/admin/safe-owner-zone/security-lockdown', icon: '🛡️' },
  { key: 'compliance', label: 'Compliance', to: '/admin/safe-owner-zone/compliance', icon: '📜' },
  { key: 'ai-control', label: 'AI Control', to: '/admin/safe-owner-zone/ai-control', icon: '🤖' },
];

const SYSTEM: ModuleLink[] = [
  { key: 'vaults', label: 'Vaults', to: '/admin/safe-owner-zone/vaults', icon: '🔐' },
  { key: 'operations', label: 'Operations', to: '/admin/safe-owner-zone/operations', icon: '📈' },
  { key: 'revenue', label: 'Revenue', to: '/admin/safe-owner-zone/revenue', icon: '💰' },
  { key: 'admin-oversight', label: 'Admin Oversight', to: '/admin/safe-owner-zone/admin-oversight', icon: '🪪' },
];

function ModuleNav({ items, onNavigate }: { items: ModuleLink[]; onNavigate?: () => void }) {
  return (
    <div className="space-y-1">
      {items.map((m) => (
        <NavLink
          key={m.key}
          to={m.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `block rounded-lg px-3 py-2 text-sm transition ${
              isActive
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800'
            }`
          }
        >
          <span className="mr-2">{m.icon}</span>
          {m.label}
        </NavLink>
      ))}
    </div>
  );
}

export default function SafeOwnerZoneLayout() {
  const [openMobile, setOpenMobile] = useState(false);
  const closeOnNavigate = useMemo(() => {
    return () => setOpenMobile(false);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px,1fr]">
      {/* Mobile toggle */}
      <div className="md:hidden">
        <button
          type="button"
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-sm font-semibold text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          aria-expanded={openMobile}
          onClick={() => setOpenMobile((v) => !v)}
        >
          Owner Modules
          <span className="float-right opacity-70">{openMobile ? '▴' : '▾'}</span>
        </button>
      </div>

      <aside
        className={`${openMobile ? 'block' : 'hidden'} md:block rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900`}
      >
        <div className="mb-2 flex items-center justify-between md:hidden">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Owner Modules</div>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
            onClick={() => setOpenMobile(false)}
          >
            Close
          </button>
        </div>
        <div className="px-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Owner Modules</div>
        </div>

        <NavLink
          to="/admin/safe-owner-zone"
          onClick={closeOnNavigate}
          className={({ isActive }) =>
            `mt-2 block rounded-lg px-3 py-2 ${
              isActive
                ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'
                : 'hover:bg-slate-50 dark:hover:bg-slate-800'
            }`
          }
          end
        >
          <div className="text-sm font-semibold">Safe Owner Zone</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">Hub</div>
        </NavLink>

        <div className="mt-4">
          <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Controls</div>
          <ModuleNav items={CONTROLS} onNavigate={closeOnNavigate} />
        </div>

        <div className="mt-4">
          <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">System</div>
          <ModuleNav items={SYSTEM} onNavigate={closeOnNavigate} />
        </div>
      </aside>

      <section className="min-w-0">
        <Outlet />
      </section>
    </div>
  );
}

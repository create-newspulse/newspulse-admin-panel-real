import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { isOwnerRole } from '@/lib/adminFeatureVisibility';

const tabCls = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition ` +
  (isActive ? 'border-slate-900 bg-slate-900 text-white shadow-sm dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800');

export default function SettingsCenterLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const ownerRole = isOwnerRole(user?.role);
  const currentCrumb = location.pathname.includes('/admin/settings/admin-panel/staff-activity-attendance')
    ? 'Staff Activity & Attendance'
    : '';

  return (
    <div className="space-y-6 pb-28">
      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400">Home &gt; Settings Center{currentCrumb ? ` > ${currentCrumb}` : ''}</div>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950 dark:text-white">Settings Center</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Manage admin controls, public site settings, team access, security, and publishing configuration.
            </p>
          </div>

          <div className="flex flex-wrap gap-2" aria-label="Primary settings tabs">
            <NavLink to="admin-panel" className={tabCls} end>
              Admin Panel Settings
            </NavLink>
            {ownerRole ? (
              <NavLink to="public-site" className={tabCls} end>
                Public Site Settings
              </NavLink>
            ) : null}
          </div>
        </div>
      </header>

      <Outlet />
    </div>
  );
}

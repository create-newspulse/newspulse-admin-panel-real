import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@context/AuthContext';
import { isOwnerRole } from '@/lib/adminFeatureVisibility';

const tabCls = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-2 rounded-lg border text-sm font-semibold ` +
  (isActive ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-800');

export default function SettingsCenterLayout() {
  const { user } = useAuth();
  const ownerRole = isOwnerRole(user?.role);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <div className="text-sm text-slate-500">Settings</div>
          <h1 className="text-2xl font-semibold">Settings Center</h1>
        </div>

        <div className="flex flex-wrap gap-2">
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

      <Outlet />
    </div>
  );
}

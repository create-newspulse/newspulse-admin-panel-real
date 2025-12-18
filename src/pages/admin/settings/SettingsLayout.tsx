import { Outlet, Link, useLocation } from 'react-router-dom';

export default function SettingsLayout() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {/* Breadcrumb */}
      <div className="md:col-span-4">
        <nav className="text-sm text-slate-500">
          <Link to="/" className="hover:text-slate-700">Home</Link>
          <span className="mx-2">›</span>
          <span className="text-slate-700 font-medium">Settings</span>
        </nav>
        <h1 className="mt-2 text-2xl font-semibold">Admin Settings</h1>
      </div>

      {/* Sidebar */}
      <aside className="md:col-span-1 space-y-2">
        <Link
          to="/admin/settings"
          className={`block px-3 py-2 rounded border ${isActive('/admin/settings') ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
        >
          Overview
        </Link>
        <Link
          to="/admin/settings/frontend-ui"
          className={`block px-3 py-2 rounded border ${isActive('/admin/settings/frontend-ui') ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'}`}
        >
          Frontend UI
        </Link>
      </aside>

      {/* Content */}
      <section className="md:col-span-3">
        <Outlet />
      </section>
    </div>
  );
}
// removed duplicate alternative layout implementations to avoid multiple default exports

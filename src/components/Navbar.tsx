
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '../context/DarkModeContext';
import { useAuth } from '../context/AuthContext';
import LanguageDropdown from './LanguageDropdown';
import { leftNav, rightNav } from '@/config/nav';

export default function Navbar() {
  const { isDark, toggleDark } = useDarkMode();
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const role = (user?.role ?? 'viewer') as any;
  const isAuthPage = location.pathname === '/login' || location.pathname === '/admin/login';

  // remove unused handleLogout closure (we use inline handler)

  const left = leftNav(role);
  const right = rightNav(role);

  return (
    <header className="bg-slate-900 text-white px-6 py-4 shadow-md border-b border-slate-700">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

        {/* 🏠 Home Link */}
        <Link to="/" className="flex items-center text-blue-400 hover:text-white font-semibold text-lg">
          <span className="text-2xl">🏠</span>
          <span className="ml-2">Home</span>
        </Link>

        {isAuthenticated && !isAuthPage && (
          <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">

            {/* 🔗 Main Menu */}
            {left.map(({ path, icon, label, key }) => (
              <NavLink
                key={key}
                to={path}
                className={({ isActive }) => `flex items-center gap-1 px-2 py-1 rounded hover:text-blue-400 transition-colors ${
                  isActive || location.pathname.startsWith(path + '/') ? 'text-blue-400' : 'text-white'
                }`}
              >
                <span>{icon}</span>
                {label}
              </NavLink>
            ))}
            {/* Right-side utilities */}
            {right.map(({ key, path, icon, label }) => (
              path.startsWith('#') ? (
                key === 'dark' ? (
                  <button
                    key={key}
                    onClick={toggleDark}
                    aria-pressed={isDark}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
                    title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                  >
                    {isDark ? '🌞 Light' : '🌙 Dark'}
                  </button>
                ) : key === 'lang' ? (
                  <LanguageDropdown key={key} />
                ) : null
              ) : (
                key === 'logout' ? (
                  // ✅ Fix: use shared logout which redirects correctly per area
                  <button key={key} onClick={() => { logout(); }} className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white transition">
                    {icon} {label}
                  </button>
                ) : (
                  <NavLink
                    key={key}
                    to={path}
                    className={({ isActive }) => `flex items-center gap-1 px-2 py-1 rounded hover:text-blue-400 transition-colors ${
                      isActive || location.pathname.startsWith(path + '/') ? 'text-blue-400' : 'text-white'
                    }`}
                  >
                    <span>{icon}</span>{label}
                  </NavLink>
                )
              )
            ))}

          </nav>
        )}

        {/* Login link removed — keeping only the React (NewsPulse) login flow */}
      </div>
    </header>
  );
}



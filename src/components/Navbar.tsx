
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useDarkMode } from '../context/DarkModeContext';
import { useAuth } from '../context/AuthContext';
import LanguageDropdown from './LanguageDropdown';
import { leftNav, rightNav, SAFE_OWNER_ZONE_MODULE_ITEMS } from '@/config/nav';

export default function Navbar() {
  const { isDark, toggleDark } = useDarkMode();
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const role = (user?.role ?? 'viewer') as any;
  const isAuthPage = location.pathname === '/login' || location.pathname === '/admin/login';

  const [sozOpen, setSozOpen] = useState(false);
  const sozRef = useRef<HTMLDivElement | null>(null);
  const isSozActive = location.pathname.startsWith('/admin/safe-owner-zone');

  const sozModules = useMemo(() => SAFE_OWNER_ZONE_MODULE_ITEMS, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!sozOpen) return;
      const el = sozRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setSozOpen(false);
    }
    function onDocKeyDown(e: KeyboardEvent) {
      if (!sozOpen) return;
      if (e.key === 'Escape') setSozOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKeyDown);
    };
  }, [sozOpen]);

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
            {left.map(({ path, icon, label, key }) => {
              if (key !== 'soz') {
                return (
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
                );
              }

              return (
                <div key={key} ref={sozRef} className="relative">
                  <button
                    type="button"
                    className={`flex items-center gap-1 px-2 py-1 rounded hover:text-blue-400 transition-colors ${
                      isSozActive ? 'text-blue-400' : 'text-white'
                    }`}
                    aria-haspopup="menu"
                    aria-expanded={sozOpen}
                    onClick={() => {
                      // Spec: clicking opens dropdown; clicking title navigates to hub.
                      navigate(path);
                      setSozOpen((v) => !v);
                    }}
                  >
                    <span>{icon}</span>
                    {label}
                    <span className="ml-1 text-xs opacity-80">▾</span>
                  </button>

                  {sozOpen && (
                    <div
                      role="menu"
                      className="absolute left-0 top-full mt-2 w-64 rounded-lg border border-slate-700 bg-slate-900 shadow-lg z-50"
                    >
                      <NavLink
                        to="/admin/safe-owner-zone"
                        role="menuitem"
                        onClick={() => setSozOpen(false)}
                        className={({ isActive }) =>
                          `block px-3 py-2 text-sm rounded-t-lg transition-colors ${
                            isActive ? 'bg-slate-800 text-blue-300' : 'text-white hover:bg-slate-800'
                          }`
                        }
                        end
                      >
                        Hub
                      </NavLink>

                      <div className="my-1 border-t border-slate-700" />

                      {sozModules.map((m) => (
                        <NavLink
                          key={m.key}
                          to={m.path}
                          role="menuitem"
                          onClick={() => setSozOpen(false)}
                          className={() => {
                            const active = location.pathname === m.path || location.pathname.startsWith(m.path + '/');
                            return `block px-3 py-2 text-sm transition-colors ${
                              active ? 'bg-slate-800 text-blue-300' : 'text-white hover:bg-slate-800'
                            }`;
                          }}
                        >
                          <span className="mr-2">{m.icon}</span>
                          {m.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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



import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDarkMode } from '../context/DarkModeContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext'; // ✅ Auth context
import LanguageDropdown from './LanguageDropdown';

export default function Navbar() {
  const { isDark, toggleDark } = useDarkMode();
  const { isAuthenticated, isFounder } = useAuth(); // ✅ Auth state
  const navigate = useNavigate();
  const { t } = useTranslation();
  const location = useLocation();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const navItems = [
    { to: '/', icon: '📊', label: t('dashboard') },
    { to: '/add', icon: '📰', label: t('addNews') },
    { to: '/manage-news', icon: '🗂️', label: t('manage') },
    { to: '/push-history', icon: '📣', label: t('pushHistory') },
    { to: '/media/inspiration', icon: '🌟', label: t('inspirationHub') },
    { to: '/ai-test', icon: '�', label: t('aiPanel') },
      { to: '/admin/media-library', icon: '🖼️', label: 'Media Library' },
      { to: '/admin/ai-assistant', icon: '🤖', label: 'AI Assistant' },
      { to: '/admin/workflow', icon: '🧭', label: 'Workflow' },
      { to: '/admin/analytics', icon: '📈', label: 'Analytics' },
      { to: '/admin/web-stories', icon: '📱', label: 'Web Stories' },
      { to: '/admin/moderation', icon: '💬', label: 'Moderation' },
      { to: '/admin/seo', icon: '🔍', label: 'SEO Tools' },
      { to: '/safe-owner', icon: '🛡️', label: t('safeOwnerZone') },
  ];

  return (
    <header className="bg-slate-900 text-white px-6 py-4 shadow-md border-b border-slate-700">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

        {/* 🏠 Home Link */}
        <Link to="/" className="flex items-center text-blue-400 hover:text-white font-semibold text-lg">
          <span className="text-2xl">🏠</span>
          <span className="ml-2">{t('home')}</span>
        </Link>

        {isAuthenticated && (
          <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">

            {/* 🔗 Main Menu */}
            {navItems.map(({ to, icon, label }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-1 px-2 py-1 rounded hover:text-blue-400 transition-colors ${
                  location.pathname === to ? 'text-blue-400' : 'text-white'
                }`}
              >
                <span>{icon}</span>
                {label}
              </Link>
            ))}

            {/* 📘 Panel Guide – Visible to Founder only */}
            {isFounder && (
              <>
                <Link
                  to="/admin/security"
                  className={`flex items-center gap-1 px-2 py-1 rounded hover:text-blue-400 transition-colors ${
                    location.pathname === '/admin/security' ? 'text-blue-400' : 'text-white'
                  }`}
                >
                  <span>🛡️</span>
                  Security
                </Link>
                <Link
                  to="/admin/founder-control"
                  className={`flex items-center gap-1 px-2 py-1 rounded hover:text-blue-400 transition-colors ${
                    location.pathname === '/admin/founder-control' ? 'text-blue-400' : 'text-white'
                  }`}
                >
                  <span>🧰</span>
                  Founder Control
                </Link>
                <Link
                  to="/safe-owner/help"
                  className="text-xs text-blue-400 underline hover:text-white"
                >
                  📘 Panel Guide
                </Link>
                <Link
                  to="/safe-owner/settings"
                  className="text-xs text-blue-400 underline hover:text-white"
                >
                  🛠️ Settings
                </Link>
              </>
            )}

            {/* 🌐 Language Selector */}
            <LanguageDropdown />

            {/* 🌓 Theme Toggle */}
            <button
              onClick={toggleDark}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
              aria-label="Toggle theme"
            >
              {isDark ? `🌞 ${t('light')}` : `🌙 ${t('dark')}`}
            </button>

            {/* 🚪 Logout */}
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white transition"
            >
              🚪 {t('logout')}
            </button>
          </nav>
        )}
      </div>
    </header>
  );
}

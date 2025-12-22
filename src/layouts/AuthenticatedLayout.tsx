import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({ children, requiredRoles }) => {
  const { user, isAuthenticated, isLoading, isReady, isRestoring, restoreSession, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isReady || isRestoring || isLoading) return;

    if (!isAuthenticated) {
      const p = location.pathname || '';
      const dest = p.startsWith('/employee') ? '/employee/login' : '/admin/login';
      navigate(dest, { replace: true });
      return;
    }

    const role = String(user?.role || '').toLowerCase();
    const allowed = (requiredRoles || []).map((r) => String(r || '').toLowerCase());
    if (requiredRoles && role && !allowed.includes(role)) {
      navigate('/unauthorized', { replace: true });
    }
  }, [isLoading, isAuthenticated, user, requiredRoles, navigate, location.pathname]);

  // If authenticated but missing role, attempt restore (once per mount) so role-gated layouts don't misfire.
  useEffect(() => {
    if (!isReady || isRestoring || isLoading) return;
    if (isAuthenticated && user && !user.role) {
      try {
        restoreSession();
      } catch {}
    }
  }, [isReady, isRestoring, isLoading, isAuthenticated, user, restoreSession]);

  const toggleSidebar = useCallback(() => {
    setMobileSidebarOpen((prev) => !prev);
  }, []);

  if (!isReady || isRestoring || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-600 dark:text-gray-300 text-lg">Checking access and loading...</p>
      </div>
    );
  }

  const role = String(user?.role || '').toLowerCase();
  const allowed = (requiredRoles || []).map((r) => String(r || '').toLowerCase());
  if (!isAuthenticated || (requiredRoles && role && !allowed.includes(role))) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Mobile Sidebar Toggle Button */}
      <button
        className="md:hidden fixed top-4 left-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg transition-transform hover:scale-105"
        onClick={toggleSidebar}
        aria-label="Toggle Sidebar"
      >
        ☰
      </button>

      {/* Sidebar Overlay for Mobile */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full w-60 bg-white dark:bg-gray-800 shadow-lg p-4 z-40 transition-transform duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:block`}
      >
        <div className="flex justify-between items-center mb-6 md:hidden">
          <h2 className="text-xl font-bold text-blue-700">Menu</h2>
          <button
            onClick={toggleSidebar}
            className="text-red-500 hover:text-red-700 text-2xl"
          >
            ✖
          </button>
        </div>
        <nav className="space-y-4">
          <Link
            to="/admin-dashboard"
            className="block text-base p-2 rounded-md hover:bg-blue-100 dark:hover:bg-gray-700 transition"
          >
            🏠 Dashboard
          </Link>
          <Link
            to="/admin-ai-logs"
            className="block text-base p-2 rounded-md hover:bg-blue-100 dark:hover:bg-gray-700 transition"
          >
            📄 AI Logs
          </Link>
          <Link
            to="/admin-settings"
            className="block text-base p-2 rounded-md hover:bg-blue-100 dark:hover:bg-gray-700 transition"
          >
            ⚙️ Settings
          </Link>
          <button
            onClick={logout}
            className="w-full text-left text-base text-red-600 hover:bg-red-100 dark:hover:bg-red-800 p-2 rounded-md transition mt-6"
          >
            ➡️ Logout
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 md:ml-60 flex flex-col">
        <header className="bg-white dark:bg-gray-800 shadow px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">News Pulse Admin</h1>
          {user && (
            <div className="text-sm">
              Welcome, <span className="font-semibold">{user.email}</span>{' '}
              (<span className="capitalize">{user.role}</span>)
            </div>
          )}
        </header>

        <main className="flex-1 px-4 py-6 max-w-7xl mx-auto w-full">{children}</main>

        <footer className="text-center py-4 text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 mt-auto">
          © {new Date().getFullYear()} News Pulse. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default AuthenticatedLayout;

// 📂 components/Admin/AdminNavbar.tsx
import { NavLink } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";

export default function AdminNavbar() {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { logout } = useAuth();

  const handleLogout = () => {
    const confirm =
      confirmLogout || window.confirm("Are you sure you want to logout?");
    if (confirm) {
  // ✅ Fix: use shared logout which redirects correctly per area
  logout();
    } else {
      setConfirmLogout(true);
    }
  };

  const navLinkClass =
    "text-sm font-medium text-white hover:text-yellow-300 transition";

  const activeLinkClass =
    "underline underline-offset-4 text-yellow-400 font-semibold";

  return (
    <nav
      className="bg-gray-900 text-white px-6 py-3 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between"
      role="navigation"
      aria-label="Admin Panel Navigation"
    >
      <div className="text-xl font-bold mb-2 sm:mb-0">
        🛡️ News Pulse Admin
      </div>

      <div className="flex flex-wrap gap-4 items-center">
        <NavLink
          to="/admin/dashboard"
          className={({ isActive }) =>
            isActive ? `${navLinkClass} ${activeLinkClass}` : navLinkClass
          }
        >
          📊 Dashboard
        </NavLink>
        <NavLink
          to="/admin/add"
          className={({ isActive }) =>
            isActive ? `${navLinkClass} ${activeLinkClass}` : navLinkClass
          }
        >
          ➕ Add News
        </NavLink>
        <NavLink
          to="/admin/manage"
          className={({ isActive }) =>
            isActive ? `${navLinkClass} ${activeLinkClass}` : navLinkClass
          }
        >
          📁 Manage News
        </NavLink>

        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-md transition"
          aria-label="Logout from admin"
        >
          🔒 Logout
        </button>
      </div>
    </nav>
  );
}

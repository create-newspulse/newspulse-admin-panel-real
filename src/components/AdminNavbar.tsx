// 📂 components/Admin/AdminNavbar.tsx
import { NavLink } from "react-router-dom";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { leftNavWithAccess, type Role } from "@/config/nav";
import { useAdminFeatureVisibility } from "@/hooks/useAdminFeatureVisibility";
import { DEFAULT_ADMIN_FEATURE_VISIBILITY, isOwnerRole } from "@/lib/adminFeatureVisibility";

export default function AdminNavbar() {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { logout, user } = useAuth();
  const role = ((user?.role || "viewer").toLowerCase() as Role);
  const isFounder = String(user?.role || '').toLowerCase() === 'founder';
  const ownerRole = isOwnerRole(role);
  const { visibility } = useAdminFeatureVisibility({ enabled: !ownerRole });
  const effectiveVisibility = ownerRole ? DEFAULT_ADMIN_FEATURE_VISIBILITY : visibility;
  const left = leftNavWithAccess(user, effectiveVisibility).filter((item) => item.key !== 'community-hub');
  const accountPath = isFounder ? '/admin/founder/my-account' : '/admin/my-account';
  const accountLabel = isFounder ? 'Founder My Account' : 'My Account';

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
        {left.slice(0, 5).map(item => item.locked ? (
          <button
            key={item.key}
            type="button"
            aria-disabled="true"
            title="Access Denied. Founder permission is required."
            onClick={() => toast.error('Access Denied. Founder permission is required.')}
            className="cursor-not-allowed text-sm font-medium text-gray-400 transition hover:text-gray-300"
          >
            {item.icon} {item.label} <span className="text-xs">Locked</span>
          </button>
        ) : (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) =>
              isActive ? `${navLinkClass} ${activeLinkClass}` : navLinkClass
            }
          >
            {item.icon} {item.label}
          </NavLink>
        ))}

        <NavLink
          to={accountPath}
          className={({ isActive }) =>
            isActive ? `${navLinkClass} ${activeLinkClass}` : navLinkClass
          }
        >
          👤 {accountLabel}
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

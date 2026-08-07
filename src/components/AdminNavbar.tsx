// 📂 components/Admin/AdminNavbar.tsx
import { NavLink } from "react-router-dom";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { LockKeyhole } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { leftNavWithAccess, type Role } from "@/config/nav";
import { isOwnerRole } from "@/lib/adminFeatureVisibility";
import { useAdminEffectiveAccess } from "@/hooks/useAdminEffectiveAccess";

export default function AdminNavbar() {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const { logout, user } = useAuth();
  const role = ((user?.role || "viewer").toLowerCase() as Role);
  const isFounder = String(user?.role || '').toLowerCase() === 'founder';
  const hasUserProfile = !!user && !!String(user?.role || '').trim();
  const ownerRole = isOwnerRole(role);
  const { modulePolicy, backendAccess, isLoading: accessLoading } = useAdminEffectiveAccess({ user, enabled: hasUserProfile && !ownerRole });
  const navAccessReady = hasUserProfile && !accessLoading;
  const left = navAccessReady ? leftNavWithAccess(user, { modulePolicy, backendAccess }).filter((item) => item.key !== 'community-hub') : [];
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
            title={item.lockedReason || 'Access denied.'}
            onClick={() => toast.error(item.lockedReason || 'Access denied.')}
            className="inline-flex cursor-not-allowed items-center gap-1 text-sm font-medium text-gray-400 transition hover:text-gray-300"
          >
            <span>{item.icon}</span><span>{item.label}</span><LockKeyhole aria-label="Locked module" title={item.lockedReason || 'Access denied.'} className="ml-0.5 h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" />
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

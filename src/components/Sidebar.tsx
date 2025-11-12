import { NavLink, useNavigate } from "react-router-dom";
import { FaBars, FaSignOutAlt } from "react-icons/fa";

import { useSidebar } from "../context/SidebarContext";
import { useAuth } from "../context/AuthContext";
// ...existing code...

export default function Sidebar() {
  const { isOpen, toggleSidebar } = useSidebar();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || "guest";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const linkClass = (isActive: boolean): string =>
    `flex items-center gap-2 px-3 py-2 rounded transition-all duration-150 ${
      isActive ? "bg-blue-600 text-white" : "hover:bg-slate-700"
    }`;

  return (
    <aside
      className={`bg-slate-900 text-white fixed md:relative z-50 h-screen flex flex-col justify-between transition-all duration-300 ${
        isOpen ? "w-64" : "w-16"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
        <span className={`text-lg font-bold tracking-wide ${!isOpen ? "hidden" : ""}`}>
          🧠 News Pulse
        </span>
        <button onClick={toggleSidebar} className="text-white text-lg">
          <FaBars />
        </button>
      </div>

      {/* Navigation - Original Structure */}
      <nav className="mt-4 flex flex-col gap-2 px-3 text-sm font-medium">
        <NavLink to="/" className={({ isActive }) => linkClass(isActive)}>
          🏠 {isOpen && <span className="font-bold">Home</span>}
        </NavLink>
        <NavLink to="/admin/dashboard" className={({ isActive }) => linkClass(isActive)}>
          📊 {isOpen && <span className="font-bold">Admin Dashboard</span>}
        </NavLink>
        <NavLink to="/add" className={({ isActive }) => linkClass(isActive)}>
          📰 {isOpen && <span className="font-bold">Add News</span>}
        </NavLink>
        <NavLink to="/manage-news" className={({ isActive }) => linkClass(isActive)}>
          �️ {isOpen && <span className="font-bold">Manage News</span>}
        </NavLink>
        <NavLink to="/push-history" className={({ isActive }) => linkClass(isActive)}>
          � {isOpen && <span className="font-bold">Push History</span>}
        </NavLink>
        {/* Inspiration Hub removed */}
        <NavLink to="/admin/ai-engine" className={({ isActive }) => linkClass(isActive)}>
          🧠 {isOpen && <span className="font-bold">AI Engine</span>}
        </NavLink>
        <NavLink to="/admin/media-library" className={({ isActive }) => linkClass(isActive)}>
          �️ {isOpen && <span className="font-bold">Media Library</span>}
        </NavLink>
        <NavLink to="/admin/ai-assistant" className={({ isActive }) => linkClass(isActive)}>
          🤖 {isOpen && <span className="font-bold">AI Assistant</span>}
        </NavLink>
        <NavLink to="/admin/workflow" className={({ isActive }) => linkClass(isActive)}>
          🧭 {isOpen && <span className="font-bold">Workflow</span>}
        </NavLink>
        <NavLink to="/admin/analytics" className={({ isActive }) => linkClass(isActive)}>
          � {isOpen && <span className="font-bold">Analytics</span>}
        </NavLink>
        <NavLink to="/admin/web-stories" className={({ isActive }) => linkClass(isActive)}>
          � {isOpen && <span className="font-bold">Web Stories</span>}
        </NavLink>
        <NavLink to="/admin/moderation" className={({ isActive }) => linkClass(isActive)}>
          � {isOpen && <span className="font-bold">Moderation</span>}
        </NavLink>
        <NavLink to="/admin/seo" className={({ isActive }) => linkClass(isActive)}>
          🔍 {isOpen && <span className="font-bold">SEO Tools</span>}
        </NavLink>
        {/* Route consolidation: point to new v5 founder module */}
        <NavLink to="/safeownerzone/founder" className={({ isActive }) => linkClass(isActive)}>
          🧩 {isOpen && <span className="font-bold">Founder Command</span>}
        </NavLink>
      </nav>

      {/* Footer */}
      <div className="mt-auto px-4 py-4 text-xs text-gray-400 border-t border-slate-700">
        <div className="flex items-center justify-between">
          <span>👤 {user?.name || "Admin"} ({role})</span>
          <button
            onClick={handleLogout}
            className="text-red-500 hover:text-red-400"
            title="Logout"
          >
            <FaSignOutAlt />
          </button>
        </div>
        {/* Language and Theme toggles moved to Settings */}
      </div>
    </aside>
  );
}

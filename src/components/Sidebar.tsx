import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  FaBars, FaPlus, FaList, FaRobot, FaMoon, FaSun,
  FaChartPie, FaPoll, FaBell, FaLock, FaNewspaper, FaUsers,
  FaTools, FaSignOutAlt, FaUserCircle, FaChartLine, FaBookmark,
  FaVideo,
} from "react-icons/fa";

import { useSidebar } from "../context/SidebarContext";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import { API_BASE_PATH } from "../lib/api";

export default function Sidebar() {
  const { isOpen, toggleSidebar } = useSidebar();
  const [selectedLang, setSelectedLang] = useState("English");
  const [logCount, setLogCount] = useState<number>(0);

  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const role = user?.role || "guest";

  useEffect(() => {
    const savedLang = localStorage.getItem("preferredLanguage");
    if (savedLang) setSelectedLang(savedLang);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE_PATH}/ai/logs/count`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setLogCount(data.count || 0))
      .catch(() => setLogCount(0));
  }, []);

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

      {/* Navigation */}
      <nav className="mt-4 flex flex-col gap-2 px-3 text-sm font-medium">
        <NavLink to="/dashboard" className={({ isActive }) => linkClass(isActive)}>
          <FaList /> {isOpen && "Dashboard"}
        </NavLink>

        {["founder", "editor"].includes(role) && (
          <>
            <NavLink to="/add" className={({ isActive }) => linkClass(isActive)}>
              <FaPlus /> {isOpen && "Add News"}
            </NavLink>
            <NavLink to="/manage" className={({ isActive }) => linkClass(isActive)}>
              <FaNewspaper /> {isOpen && "Manage News"}
            </NavLink>
          </>
        )}

        <NavLink to="/saved-news" className={({ isActive }) => linkClass(isActive)}>
          <FaBookmark /> {isOpen && "Saved News"}
        </NavLink>

        {["editor", "founder"].includes(role) && (
          <>
            <NavLink to="/push-history" className={({ isActive }) => linkClass(isActive)}>
              <FaBell /> {isOpen && "Push Alerts"}
            </NavLink>
            <NavLink to="/poll-editor" className={({ isActive }) => linkClass(isActive)}>
              <FaPoll /> {isOpen && "Polls"}
            </NavLink>
            <NavLink to="/poll-results" className={({ isActive }) => linkClass(isActive)}>
              <FaChartLine /> {isOpen && "Poll Results"}
            </NavLink>
            <NavLink to="/admin/ai-engine" className={({ isActive }) => linkClass(isActive)}>
              <div className="flex items-center justify-between w-full">
                <span className="flex items-center gap-2">
                  <FaRobot /> {isOpen && "AI Engine"}
                </span>
                {isOpen && logCount > 0 && (
                  <span className="bg-red-600 text-xs font-bold px-2 py-0.5 rounded-full ml-2">
                    {logCount}
                  </span>
                )}
              </div>
            </NavLink>
            <NavLink to="/ai-stats" className={({ isActive }) => linkClass(isActive)}>
              <FaChartPie /> {isOpen && "AI Stats"}
            </NavLink>
          </>
        )}

        {role === "founder" && (
          <>
            <NavLink to="/ai-toggle" className={({ isActive }) => linkClass(isActive)}>
              <FaTools /> {isOpen && "AI Toggle Panel"}
            </NavLink>
            <NavLink to="/safe-owner" className={({ isActive }) => linkClass(isActive)}>
              <FaLock /> {isOpen && "Safe Owner"}
            </NavLink>
            <NavLink to="/team" className={({ isActive }) => linkClass(isActive)}>
              <FaUsers /> {isOpen && "Team Access"}
            </NavLink>
            <NavLink to="/admin/live-feed-manager" className={({ isActive }) => linkClass(isActive)}>
              <FaVideo /> {isOpen && "Live Feed Manager"}
            </NavLink>

            {/* 🛡️ Constitution Status Link */}
            <NavLink to="/admin/control-constitution" className={({ isActive }) => linkClass(isActive)}>
              <FaLock /> {isOpen && "Constitution Status"}
            </NavLink>
          </>
        )}

        <NavLink to="/profile" className={({ isActive }) => linkClass(isActive)}>
          <FaUserCircle /> {isOpen && "Profile"}
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

        {isOpen && (
          <div className="mt-3 flex items-center justify-between">
            <span>🌐 Language: {selectedLang}</span>
            <button
              onClick={toggleTheme}
              title="Toggle Theme"
              className="text-xl text-yellow-300 hover:text-yellow-400"
            >
              {theme === "dark" ? <FaSun /> : <FaMoon />}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

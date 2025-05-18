import { Link, useNavigate } from "react-router-dom";

export default function AdminNavbar() {
  const navigate = useNavigate();
  const handleLogout = () => {
    localStorage.removeItem("adminToken");
    navigate("/admin");
  };

  return (
    <nav className="bg-gray-900 text-white p-4 flex justify-between">
      <span className="font-bold text-xl">News Pulse Admin</span>
      <div className="space-x-4">
        <Link to="/admin/dashboard" className="hover:underline">Dashboard</Link>
        <Link to="/admin/add" className="hover:underline">Add News</Link>
        <Link to="/admin/manage" className="hover:underline">Manage News</Link>
        <button onClick={handleLogout} className="ml-4 bg-red-500 px-3 py-1 rounded">Logout</button>
      </div>
    </nav>
  );
}
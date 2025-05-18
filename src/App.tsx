import { Route, Routes, Navigate } from "react-router-dom";
import AdminNavbar from "./components/AdminNavbar";
import AdminLogin from "./pages/AdminLogin";
import Dashboard from "./pages/Dashboard";
import AddNews from "./pages/AddNews";
import ManageNews from "./pages/ManageNews";

const isAuthenticated = !!localStorage.getItem("adminToken");

export default function App() {
  return (
    <div>
      {isAuthenticated && <AdminNavbar />}
      <Routes>
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/admin" />} />
        <Route path="/admin/add" element={isAuthenticated ? <AddNews /> : <Navigate to="/admin" />} />
        <Route path="/admin/manage" element={isAuthenticated ? <ManageNews /> : <Navigate to="/admin" />} />
        <Route path="*" element={<Navigate to="/admin" />} />
      </Routes>
    </div>
  );
}
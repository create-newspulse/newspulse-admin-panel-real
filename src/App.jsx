import { Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import AddNews from './pages/AddNews';
import ManageNews from './pages/ManageNews';
import SafeOwnerZone from './pages/SafeOwnerZone';
import AdminNavbar from './components/AdminNavbar';

export default function App() {
  return (
    <>
      <AdminNavbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/add" element={<AddNews />} />
        <Route path="/manage" element={<ManageNews />} />
        <Route path="/owner" element={<SafeOwnerZone />} />
      </Routes>
    </>
  );
}

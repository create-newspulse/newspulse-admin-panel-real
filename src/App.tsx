import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import AddNews from './pages/AddNews';
import ManageNews from './pages/ManageNews';
import AdminNavbar from './components/AdminNavbar';

function App() {
  return (
    <Router>
      <AdminNavbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/add-news" element={<AddNews />} />
        <Route path="/manage-news" element={<ManageNews />} />
      </Routes>
    </Router>
  );
}
export default App;

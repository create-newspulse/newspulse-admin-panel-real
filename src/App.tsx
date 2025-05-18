import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import AddNews from './pages/AddNews';
import ManageNews from './pages/ManageNews';
import AdminNavbar from './components/AdminNavbar';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <AdminNavbar />
        <div className="p-4">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<AdminLogin />} />
            <Route path="/add-news" element={<AddNews />} />
            <Route path="/manage-news" element={<ManageNews />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;

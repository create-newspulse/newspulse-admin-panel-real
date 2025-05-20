import { Link } from 'react-router-dom';
export default function AdminNavbar() {
  return (
    <nav style={{ background: '#0f172a', color: 'white', padding: '10px 20px', display: 'flex', justifyContent: 'space-between' }}>
      <strong>News Pulse Admin</strong>
      <div style={{ display: 'flex', gap: '15px' }}>
        <Link to="/" style={{ color: 'white' }}>Dashboard</Link>
        <Link to="/add" style={{ color: 'white' }}>Add News</Link>
        <Link to="/manage" style={{ color: 'white' }}>Manage News</Link>
        <Link to="/owner" style={{ color: 'white' }}>Safe Zone</Link>
      </div>
    </nav>
  );
}

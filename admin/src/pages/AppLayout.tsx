import { Link, Outlet } from 'react-router-dom';

export default function AppLayout(){
  return (
    <div>
      <header className="bg-slate-900 text-white px-6 py-3 flex items-center justify-between">
        <div className="font-semibold">🛡️ NewsPulse Admin</div>
        <nav className="flex gap-4 text-sm">
          <Link to="/admin/manage-news" className="hover:underline">📁 Manage News</Link>
          <Link to="/admin/add-news" className="hover:underline">📝 Add News</Link>
        </nav>
      </header>
      <main className="max-w-5xl mx-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}

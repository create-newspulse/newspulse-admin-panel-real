// components/AdminNavbar.tsx
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
// Adjusted import path for TypeScript path mapping: '@/lib/*' maps to 'src/lib/*'
import { metaCounts } from '@/lib/api/articles';

const AdminNavbar = () => {
  const { data } = useQuery<{ published:number; drafts:number; flagged:number }>({ queryKey: ['articles','meta'], queryFn: metaCounts as any, staleTime: 30_000 });
  return (
    <nav className="flex justify-between items-center p-4 bg-blue-800 text-white">
      <h1 className="text-lg font-bold">News Pulse Admin</h1>
      <div className="flex items-center gap-4 text-sm">
        <Link to="/dashboard">Dashboard</Link>
        <Link to="/add-news">Add News</Link>
        {/* Link to canonical route; alias /admin/manage-news also available */}
        <Link to="/manage-news" className="relative">
          Manage News
          {data && (
            <span className="ml-2 inline-flex gap-1">
              <span className="px-1.5 py-0.5 rounded bg-green-600">P{String(data.published)}</span>
              <span className="px-1.5 py-0.5 rounded bg-gray-600">D{String(data.drafts)}</span>
              <span className="px-1.5 py-0.5 rounded bg-red-600">F{String(data.flagged)}</span>
            </span>
          )}
        </Link>
        <Link to="/admin/drafts">Draft Desk</Link>
        <Link to="/admin/community-reporter">Community Reporter</Link>
        <button className="bg-red-600 px-3 py-1 rounded hover:bg-red-700">Logout</button>
      </div>
    </nav>
  );
};

export default AdminNavbar;

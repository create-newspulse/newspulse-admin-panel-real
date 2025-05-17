import Link from "next/link";

export default function AdminNavbar() {
  return (
    <nav className="bg-gray-900 text-white p-4 flex justify-between">
      <span className="font-bold text-xl">News Pulse Admin</span>
      <div className="space-x-4">
        <Link href="/admin/dashboard" className="hover:underline">Dashboard</Link>
        <Link href="/admin/add" className="hover:underline">Add News</Link>
        <Link href="/admin/manage" className="hover:underline">Manage News</Link>
      </div>
    </nav>
  );
}

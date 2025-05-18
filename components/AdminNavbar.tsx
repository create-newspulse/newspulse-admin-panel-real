// components/AdminNavbar.tsx
import React from 'react';
import { Link } from 'react-router-dom';

const AdminNavbar = () => (
  <nav className="flex justify-between items-center p-4 bg-blue-800 text-white">
    <h1 className="text-lg font-bold">News Pulse Admin</h1>
    <div className="space-x-4">
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/add-news">Add News</Link>
      <Link to="/manage-news">Manage News</Link>
      <button className="bg-red-600 px-3 py-1 rounded hover:bg-red-700">Logout</button>
    </div>
  </nav>
);

export default AdminNavbar;

// src/components/LayoutDashboard.jsx
import React from 'react';

export default function LayoutDashboard({ children }) {
  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">

      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-800 shadow-lg p-4 hidden md:block">
        <h2 className="text-xl font-bold mb-6">📰 News Pulse</h2>
        <nav className="space-y-2">
          <a href="/admin/dashboard" className="block p-2 rounded hover:bg-blue-100 dark:hover:bg-slate-700">Dashboard</a>
          <a href="/admin/news" className="block p-2 rounded hover:bg-blue-100 dark:hover:bg-slate-700">Articles</a>
          <a href="/admin/users" className="block p-2 rounded hover:bg-blue-100 dark:hover:bg-slate-700">Users</a>
          <a href="/admin/settings" className="block p-2 rounded hover:bg-blue-100 dark:hover:bg-slate-700">Settings</a>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">

        {/* Top Navbar */}
        <header className="bg-white dark:bg-slate-800 shadow p-4 flex justify-between items-center">
          <span className="text-lg font-medium">Welcome back, Admin!</span>
          <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
            + New Post
          </button>
        </header>

        {/* Dynamic Page Content */}
        <main className="p-6 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

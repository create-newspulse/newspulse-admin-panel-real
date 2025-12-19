// src/components/LayoutDashboard.jsx
import React from 'react';
import { NavLink } from 'react-router-dom';

export default function LayoutDashboard({ children }) {
  return (
    <div className="min-h-screen flex bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">

      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-800 shadow-lg p-4 hidden md:block">
        <h2 className="text-xl font-bold mb-6">📰 News Pulse</h2>
        <nav className="space-y-2">
          <NavLink to="/admin/dashboard" className={({isActive}) => `block p-2 rounded hover:bg-blue-100 dark:hover:bg-slate-700 ${isActive ? 'bg-blue-100 dark:bg-slate-700' : ''}`}>Dashboard</NavLink>
          <NavLink to="/admin/news" className={({isActive}) => `block p-2 rounded hover:bg-blue-100 dark:hover:bg-slate-700 ${isActive ? 'bg-blue-100 dark:bg-slate-700' : ''}`}>Articles</NavLink>
          <NavLink to="/admin/users" className={({isActive}) => `block p-2 rounded hover:bg-blue-100 dark:hover:bg-slate-700 ${isActive ? 'bg-blue-100 dark:bg-slate-700' : ''}`}>Users</NavLink>
          <NavLink to="/admin/settings" className={({isActive}) => `block p-2 rounded hover:bg-blue-100 dark:hover:bg-slate-700 ${isActive ? 'bg-blue-100 dark:bg-slate-700' : ''}`}>Settings</NavLink>
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

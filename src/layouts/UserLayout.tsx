// 📁 src/layouts/UserLayout.tsx
import React from 'react';
import LanguageDropdown from '../components/LanguageDropdown';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-lg font-bold">🌍 News Pulse</h1>
        <LanguageDropdown />
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}

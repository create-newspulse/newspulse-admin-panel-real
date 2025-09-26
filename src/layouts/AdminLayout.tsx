import React from 'react';
import Sidebar from '../components/Sidebar';
import { useDarkMode } from '../context/DarkModeContext';

const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  const { isDark } = useDarkMode();

  return (
    <div className={`flex ${isDark ? 'bg-black text-white' : 'bg-gray-100 text-black'}`}>
      <Sidebar />
      <main className="flex-1 min-h-screen p-6">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function FounderLogin() {
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'NewsPulse#80121972') {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userRole', 'founder');
      alert('✅ Logged in as Founder');
      navigate('/safe-owner/language-settings');
    } else {
      alert('❌ Incorrect founder password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-slate-900">
      <form
        onSubmit={handleLogin}
        className="bg-white dark:bg-slate-800 shadow-lg rounded p-6 w-full max-w-sm"
      >
        <h2 className="text-xl font-bold mb-4 text-center">👑 Founder Login</h2>
        <input
          type="password"
          placeholder="Enter Founder Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 mb-4 border rounded dark:bg-slate-700"
        />
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-500"
        >
          Login as Founder
        </button>
      </form>
    </div>
  );
}

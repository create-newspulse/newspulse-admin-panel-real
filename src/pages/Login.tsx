// 📁 src/pages/Login.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@newspulse.ai');
  const [password, setPassword] = useState('Safe!2025@News');
  const [error, setError] = useState('');

  // 🌐 Auto-login in production for demo purposes
  const isProduction = window.location.hostname.includes('vercel.app');
  
  const handleAutoLogin = async () => {
    localStorage.setItem('isFounder', 'true');
    localStorage.setItem('currentUser', JSON.stringify({
      _id: 'founder-demo',
      name: 'Demo Founder',
      email: 'admin@newspulse.ai',
      role: 'founder',
      avatar: '',
      bio: 'Demo founder account'
    }));
    localStorage.setItem('isLoggedIn', 'true');
    navigate('/admin/dashboard');
  };

  useEffect(() => {
    if (isProduction) {
      // Auto-login with founder credentials in production
      handleAutoLogin();
    }
  }, [isProduction, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const success = await login(email, password);

    if (success) {
      // ✅ Optional: set founder access flag manually (if backend doesn't already)
      if (email === 'admin@newspulse.ai') {
        localStorage.setItem('isFounder', 'true');
      }

      toast.success('✅ Login successful');
      navigate('/dashboard');
    } else {
      setError('❌ Invalid credentials. Please try again.');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-8 rounded shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-900 dark:text-white">
          Admin Login
        </h2>

        {error && (
          <div className="flex items-center text-red-600 dark:text-red-400 mb-4">
            <span className="text-xl mr-2">❌</span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="admin@newspulse.ai"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-2 rounded border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <button
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition"
          >
            Login
          </button>
        </form>

        {/* 🌐 Demo Access Button for Production */}
        {isProduction && (
          <div className="mt-4 text-center">
            <button
              onClick={handleAutoLogin}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded transition"
            >
              🚀 Demo Access (Founder Mode)
            </button>
            <p className="text-sm text-gray-500 mt-2">
              Click above for instant demo access
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;

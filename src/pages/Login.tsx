// 📁 src/pages/Login.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@newspulse.ai');
  const [password, setPassword] = useState('Safe!2025@News');
  const [error, setError] = useState('');

  // 🛡️ SECURE: Only enable demo features when explicitly configured
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';
  const isVercelPreview = window.location.hostname.includes('vercel.app');
  const showDemoButton = isDemoMode && isVercelPreview;
  
  const handleDemoLogin = async () => {
    // Use the regular login flow with demo credentials
    const success = await login('demo@newspulse.ai', 'demo-password');
    if (success) {
      toast.success('✅ Demo login successful');
      navigate('/admin/dashboard');
    } else {
      // Fallback for demo mode
      localStorage.setItem('isFounder', 'true');
      localStorage.setItem('currentUser', JSON.stringify({
        _id: 'demo-founder',
        name: 'Demo User',
        email: 'demo@newspulse.ai',
        role: 'founder',
        avatar: '',
        bio: 'Demo account - Preview only'
      }));
      localStorage.setItem('isLoggedIn', 'true');
      toast.success('✅ Demo mode activated');
      navigate('/admin/dashboard');
    }
  };

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

        {/* 🛡️ Secure Demo Access - Only when explicitly enabled */}
        {showDemoButton && (
          <div className="mt-4 text-center">
            <button
              onClick={handleDemoLogin}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded transition"
            >
              🚀 Demo Access (Preview Mode)
            </button>
            <p className="text-sm text-gray-500 mt-2">
              For demonstration purposes only
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;

import React, { useState } from 'react';

// News Pulse Login (standalone page-level component)
// Tailwind-only styling, no external CSS
export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // This page is UI-only by design. Wire up to your auth later if needed.
      console.log('Login attempt', { email });
      // Example: window.location.href = '/admin/login';
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-100 to-blue-50 p-4">
      <div className="bg-white shadow-2xl rounded-2xl p-10 w-full max-w-md transition-all duration-300">
        {/* Logo */}
        <div className="text-center">
          <img src="/logo.svg" alt="News Pulse" className="h-12 mx-auto mb-6" />
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-2xl font-bold text-gray-800 text-center">News Pulse Login</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Founder • Admin • Employee</p>

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@newspulse.co.in"
              className="mt-1 border border-gray-300 rounded-lg px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 border border-gray-300 rounded-lg px-4 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition duration-200 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Login'}
          </button>

          <div className="text-center">
            <a href="#" className="text-blue-600 text-sm hover:underline">Forgot Password?</a>
          </div>
        </form>

        {/* Footer */}
        <p className="text-center text-gray-400 text-xs mt-6">© 2025 News Pulse</p>
      </div>
    </main>
  );
}

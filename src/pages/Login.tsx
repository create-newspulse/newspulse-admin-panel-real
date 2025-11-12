// 📁 src/pages/Login.tsx
// Primary login route with built-in credential form and a link to the advanced Next.js auth.

import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useEffect } from 'react';
import { useAuth as useRoleAuth } from '@/store/auth';

export default function Login(): JSX.Element {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ✅ Fix: clear any persistent force-logout flags when arriving at login page
  useEffect(() => {
    try {
      sessionStorage.removeItem('np_force_logout');
      // Legacy cleanup from older versions
      localStorage.removeItem('np_force_logout');
    } catch {}
  }, []);

  // Build advanced auth link. In dev, point to Next.js on :3000. In prod, use /auth (likely routed).
  const advancedHref = useMemo(() => {
    const host = window.location.hostname;
    const envOrigin = (import.meta.env as any).VITE_AUTH_ORIGIN as string | undefined;
    if (envOrigin) return `${envOrigin.replace(/\/$/, '')}/auth`;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3000/auth';
    return '/auth';
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const ok = await login(email.trim(), password);
    setLoading(false);
    if (ok) {
      try {
        // Clear any force-logout flags set during prior logout
        sessionStorage.removeItem('np_force_logout');
        localStorage.removeItem('np_force_logout');
      } catch {}
  // Revert: always go to admin dashboard after login
  // Also hydrate the lightweight UI store for panel routes
  try {
    const role = email.toLowerCase().includes('founder') || email.toLowerCase().includes('admin') ? (email.toLowerCase().includes('founder') ? 'founder' : 'admin') : 'employee';
    useRoleAuth.getState().setUser({ id: 'self', name: email.split('@')[0], email, role: role as any });
  } catch {}
  navigate('/panel', { replace: true });
    } else {
      setError('Invalid email or password.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-gray-600">Use founder/team credentials. If you intended the Next.js auth flow, use the advanced option.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 bg-white shadow rounded p-5">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@newspulse.ai"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="text-sm text-red-600" role="alert">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
          <div className="text-xs text-slate-500 pt-2 space-y-1">
            <button type="button" className="underline" onClick={() => useRoleAuth.getState().setUser({ id:'1', name:'Kiran Parmar', email:'founder@newspulse.co.in', role:'founder' })}>
              Temporary Founder login (UI only)
            </button>
            <div className="space-x-2">
              <button type="button" className="underline" onClick={() => useRoleAuth.getState().setUser({ id:'2', name:'Admin User', email:'admin@newspulse.co.in', role:'admin' })}>
                Admin login (UI only)
              </button>
              <button type="button" className="underline" onClick={() => useRoleAuth.getState().setUser({ id:'3', name:'Employee', email:'employee@newspulse.co.in', role:'employee' })}>
                Employee login (UI only)
              </button>
            </div>
          </div>
        </form>

        <div className="text-center">
          <a href={advancedHref} className="inline-block w-full bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded">
            Go to advanced auth
          </a>
          <p className="text-xs text-gray-500 mt-2">Advanced auth uses the Next.js flow (OTP/passkeys/MFA).</p>
        </div>
      </div>
    </div>
  );
}

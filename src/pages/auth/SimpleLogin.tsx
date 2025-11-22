import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { useAuth } from '@context/AuthContext';
import OtpModal from '@/components/auth/OtpModal';

export default function SimpleLogin() {
  const navigate = useNavigate();
  const { login, user } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpOpen, setOtpOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Trigger subtle entrance animations after mount
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (import.meta.env.DEV) {
      console.debug('🔐 SimpleLogin submit', { email });
    }
    try {
      const ok = await login(email, password);
      if (!ok) {
        if (import.meta.env.DEV) console.warn('⚠️ Login returned false (no success flag)');
        toast.error('Invalid email or password');
        return;
      }
      // Re-read user after login (context state updated)
      const role = (user?.role || 'admin') as any;
      toast.success(`Welcome ${user?.name || email}`);
      navigate('/admin/dashboard', { replace: true });
    } catch (err: any) {
      if (import.meta.env.DEV) console.error('❌ Login exception:', err);
      if (err?.response) {
        if (import.meta.env.DEV) console.error('Server responded (error):', err.response.status, err.response.data);
        toast.error(err.response.data?.message || 'Login failed');
      } else {
        // Fail-safe: only show toast for network errors if we truly cannot reach backend
        toast.error('Network error - could not reach login API');
      }
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-tr from-sky-400 via-cyan-500 to-sky-700 p-6">
      <div className="relative max-w-5xl w-full rounded-3xl overflow-hidden flex flex-col md:flex-row">
        {/* Subtle animated glow behind content (News Pulse) */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-r from-sky-300/30 to-emerald-300/30 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-r from-emerald-300/30 to-sky-300/30 blur-3xl animate-pulse" />
        {/* Illustration (left) */}
        <div className="hidden md:flex md:w-1/2 items-center justify-center p-10">
          <div className={`relative w-full max-w-md rounded-3xl p-8 shadow-2xl border border-white/20 bg-white/10 backdrop-blur-xl text-white transition-all duration-700 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
            {/* Branded background */}
            <div className="absolute inset-0 -z-10 rounded-3xl bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.25),transparent_50%),radial-gradient(circle_at_80%_60%,rgba(5,150,105,0.25),transparent_50%)]" />
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="News Pulse" className="h-10 w-10 rounded-xl shadow" />
              <div>
                <h3 className="text-xl font-semibold tracking-tight">News Pulse Admin</h3>
                <p className="text-xs/5 text-slate-200/80">Secure, intelligent dashboard for managing real-time news</p>
              </div>
            </div>
            <hr className="my-6 border-white/10" />
            <p className="text-sm text-slate-100/90 mb-4">Trusted News Management Platform</p>
            <p className="text-xs text-slate-100/90 whitespace-nowrap">
              ⚡Fast Access 🛠️ Reliable Tools 🔄 Smooth Workflow
            </p>
          </div>
        </div>

        {/* Right (form) */}
        <div className={`w-full md:w-1/2 p-8 md:p-10 lg:p-12 bg-white/60 backdrop-blur-2xl border border-white/20 shadow-2xl md:rounded-r-3xl transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <img src="/logo.svg" alt="News Pulse Admin" className="h-10 mb-6 motion-safe:animate-[bounce_1s_ease_1]" />

          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">News Pulse Login</h1>
          <p className="mt-1 text-sm text-slate-600">Founder • Admin • Employee</p>
          <p className="mt-4 text-xs text-slate-400">Sign in to access your News Pulse Admin Panel securely.</p>

          <form className="mt-8 space-y-6" onSubmit={onSubmit}>
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">Email</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">✉️</span>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-10 py-3 text-sm shadow-inner outline-none ring-0 transition hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="you@newspulse.co.in"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔒</span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-white px-10 py-3 pr-14 text-sm shadow-inner outline-none ring-0 transition hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 text-xs font-medium transition-transform duration-200 active:scale-95"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group w-full rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#22C55E] px-4 py-3 text-sm font-semibold tracking-wide text-white shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="drop-shadow-sm">{loading ? 'Signing in…' : 'Login'}</span>
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <button
                type="button"
                onClick={() => setOtpOpen(true)}
                className="hover:text-emerald-600 font-medium"
              >
                Forgot Password?
              </button>
              <span>© {new Date().getFullYear()} News Pulse</span>
            </div>

            <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-2">
              <span className="text-slate-400">🛡️</span>
              <span>Protected by News Pulse AI Secure Layer</span>
            </div>
          </form>
        </div>
      </div>

      <OtpModal open={otpOpen} onClose={() => setOtpOpen(false)} />
      <Toaster position="top-right" richColors />
    </div>
  );
}

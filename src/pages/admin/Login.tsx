import { useEffect, useState } from 'react';
import OtpModal from '@/components/auth/OtpModal';
import { useForm } from 'react-hook-form';

// News Pulse Admin Login — UI layer only.
// IMPORTANT: Keep your existing business logic (API calls / redirects).
// If you already have an onSubmit implementation, replace the placeholder inside `onSubmit` below with your existing code.

type FormValues = {
  email: string;
  password: string;
};

export default function AdminLogin(): JSX.Element {
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  // KEEP your real submit logic here. Do not change API URLs or redirection.
  const onSubmit = async (values: FormValues) => {
    // ===== PLACEHOLDER START =====
    // Replace the block below with your existing submit handler that calls the backend
    // and handles success/failure/toasts/redirects. Do not change API endpoints.
    console.log('submit', values);
    // Example: await auth.login(values.email, values.password);
    // ===== PLACEHOLDER END =====
  };

  const handleForgotPasswordClick = () => setOtpOpen(true);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-tr from-sky-400 via-cyan-500 to-sky-700 p-6">
      <div className="relative max-w-5xl w-full rounded-3xl overflow-hidden flex flex-col md:flex-row">
        {/* Ambient pulse glows */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-r from-sky-300/30 to-emerald-300/30 blur-3xl animate-pulse" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-r from-emerald-300/30 to-sky-300/30 blur-3xl animate-pulse" />

        {/* Illustration / Branding (left) */}
        <div className="hidden md:flex md:w-1/2 items-center justify-center p-10">
          <div className={`relative w-full max-w-md rounded-3xl p-8 shadow-2xl border border-white/20 bg-white/10 backdrop-blur-xl text-white transition-all duration-700 ${mounted ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}`}>
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

          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Email */}
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">✉️</span>
                <input
                  id="email"
                  type="email"
                  {...register('email', { required: 'Email is required' })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-10 py-3 text-sm shadow-inner outline-none ring-0 transition hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="you@newspulse.co.in"
                  autoComplete="username"
                />
              </div>
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">🔒</span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { required: 'Password is required' })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-10 py-3 pr-14 text-sm shadow-inner outline-none ring-0 transition hover:border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 text-xs font-medium transition-transform duration-200 active:scale-95"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>

            {/* Submit */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#22C55E] px-4 py-3 text-sm font-semibold tracking-wide text-white shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Signing in...' : 'Login'}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500">
              <button type="button" onClick={handleForgotPasswordClick} className="hover:text-emerald-600 font-medium">
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
    </div>
  );
}

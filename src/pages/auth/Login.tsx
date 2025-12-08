import AuthCard from '@/components/auth/AuthCard';
import LoginForm from '@/components/auth/LoginForm';
import { Toaster } from 'sonner';

export default function UnifiedLogin() {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4 dark:bg-slate-950">
      <div className="text-center mb-6">
  <img src="/logo.svg" alt="News Pulse" className="mx-auto h-10 mb-3" />
  <h1 className="text-2xl font-semibold">Sign in to News Pulse</h1>
        <p className="text-sm text-slate-500">Secure access for Founder, Admin, and Employees</p>
      </div>
      <AuthCard>
        <LoginForm />
        <p className="mt-6 text-center text-xs text-slate-500">Protected by PTI-compliant policies • Zero-Trust ready</p>
      </AuthCard>
  <footer className="mt-6 text-xs text-slate-400 text-center">© {new Date().getFullYear()} News Pulse</footer>
      <Toaster position="top-right" richColors />
    </main>
  );
}

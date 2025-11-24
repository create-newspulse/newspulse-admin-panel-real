import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { type LoginDTO } from '@/lib/api';
import { loginAdmin } from '@/lib/adminApi';
import { useAuth } from '@/store/auth';
import { toast } from 'sonner';
import OtpModal from './OtpModal';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
// import { useNavigate } from 'react-router-dom';

const Schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});
type FormData = z.infer<typeof Schema>;

export default function LoginForm() {
  const { register, handleSubmit, formState:{ errors } } = useForm<FormData>({ resolver: zodResolver(Schema) });
  const [isLoading, setIsLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const setAuth = useAuth(s => s.setAuth);
  // const navigate = useNavigate();

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      // Shared admin client: base already includes /admin
      // Try modern /login first; fallback to /auth/login automatically (handled in loginAdmin)
      const { token, user } = await loginAdmin(data as LoginDTO);
      if (token && user) {
        // Normalize token: remove any leading 'Bearer ' prefix if backend already included it
        const normalizedToken = String(token).replace(/^Bearer\s+/i, '');
        setAuth(user, normalizedToken);
        try { localStorage.setItem('np_admin_token', normalizedToken); } catch {}
        toast.success(`Welcome ${user.name} (${user.role})`);
        // Spec: route to admin dashboard
        window.location.href = '/admin/dashboard';
      } else {
        throw { response: { status: 500, data: { message: 'Malformed login response' } } };
      }
    } catch (e:any) {
      const status = e?.response?.status;
      if (status === 401) {
        toast.error('Invalid email or password');
      } else if (status === 405) {
        console.error('Login 405: Check HTTP method or URL mismatch', e?.response);
        toast.error('Login endpoint misconfigured (405 Method Not Allowed).');
      } else if (status === 404) {
        toast.error('Login endpoint not found even after fallback – verify backend routes');
      } else {
        toast.error(e?.response?.data?.message || 'Unexpected error. Please try again later.');
      }
    } finally { setIsLoading(false); }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Email</label>
          <input {...register('email')} className="mt-1 w-full rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="you@newspulse.co.in" />
          {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium">Password</label>
          <div className="mt-1 flex items-center rounded-lg border">
            <input type={showPw?'text':'password'} {...register('password')} className="w-full px-3 py-2 rounded-l-lg focus:outline-none" placeholder="••••••••" />
            <button type="button" onClick={()=>setShowPw(v=>!v)} className="px-3 text-slate-500">
              {showPw ? <EyeSlashIcon className="h-5 w-5"/> : <EyeIcon className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
        </div>

        <button type="submit" disabled={isLoading} className="w-full rounded-lg bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
          {isLoading ? 'Signing in…' : 'Sign in'}
        </button>

        <div className="flex items-center justify-between">
          <button type="button" onClick={()=>setOtpOpen(true)} className="text-sm text-blue-600 hover:underline">Forgot / Change password (Email OTP)</button>
          <span className="text-xs text-slate-500">Founder/Admin/Employee login from same page</span>
        </div>
      </form>

      <OtpModal open={otpOpen} onClose={()=>setOtpOpen(false)} />
    </>
  );
}

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { AuthAPI, type LoginDTO } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { toast } from 'sonner';
import OtpModal from './OtpModal';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const res = await AuthAPI.login(data as LoginDTO);
      setAuth(res.user, res.token);
      toast.success(`Welcome ${res.user.name} (${res.user.role})`);
      // Route by role
      navigate(
        res.user.role === 'founder' ? '/founder/command'
        : res.user.role === 'admin' ? '/admin/news'
        : '/employee/news/new',
        { replace: true }
      );
    } catch (e:any) {
      toast.error(e?.response?.data?.message || 'Login failed');
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

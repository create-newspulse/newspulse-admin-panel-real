import { useMemo, useState } from 'react';
import { requestPasswordResetOtp, verifyPasswordOtp, resetPasswordWithOtp, resetPasswordWithToken, type OtpRequestResult } from '@/lib/adminApi';
import { toast } from 'sonner';
import PasswordStrength from './PasswordStrength';

export default function OtpModal({ open, onClose }:{ open:boolean; onClose:()=>void }) {
  const [step, setStep] = useState<1|2|3>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const emailValid = useMemo(() => /.+@.+\..+/.test(email.trim()), [email]);

  if (!open) return null;

  const requestOtp = async () => {
    if (!emailValid || loading) return;
    console.log('[OTP][request] Sending OTP for', email);
    setLoading(true);
    try {
      const result: OtpRequestResult = await requestPasswordResetOtp(email);
      console.log('[OTP][request][result]', result);
      if (result.success) {
        toast.success(result.message || 'OTP sent to your email.');
        const devCode = result.data?.devCode;
        if (devCode) {
          setOtp(String(devCode));
          toast.message('Dev OTP (local only)', { description: String(devCode) });
        }
        setStep(2);
      } else {
        toast.error(result.message || 'Failed to send OTP email');
        // Do NOT advance step on failure
      }
    } catch (e: any) {
      console.error('[OTP][error][request][catch]', { error: e?.message, stack: e?.stack });
      toast.error(e?.message || 'Failed to send OTP email');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp || loading) return;
    console.log('[OTP][verify] email=', email, 'otp=', otp);
    setLoading(true);
    try {
      const data: any = await verifyPasswordOtp(email, otp);
      console.log('[OTP][verify][response]', data);
      if (data?.resetToken) setResetToken(String(data.resetToken));
      toast.success('OTP verified');
      setStep(3);
    } catch (e: any) {
      console.error('[OTP][error][verify]', e);
      toast.error(e?.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const resetPw = async () => {
    if (loading) return;
    console.log('[OTP][reset] email=', email, 'using', resetToken ? 'resetToken' : 'otp');
    setLoading(true);
    try {
      if (pw !== pw2) { toast.error('Passwords do not match'); return; }
      if (resetToken) {
        await resetPasswordWithToken(email, resetToken, pw);
      } else {
        await resetPasswordWithOtp(email, otp, pw);
      }
      toast.success('Password updated');
      onClose();
    } catch (e: any) {
      console.error('[OTP][error][reset]', e);
      toast.error(e?.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-slate-900 shadow-xl">
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Reset password via Email OTP</h3>
          <p className="text-sm text-slate-500">Secure 3-step reset</p>
        </div>

        {step===1 && (
          <div className="space-y-3">
            <input
              type="email"
              autoComplete="email"
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Your email"
              value={email}
              onChange={e=>setEmail(e.target.value)}
              onKeyDown={(e)=>{ if(e.key==='Enter' && emailValid && !loading){ e.preventDefault(); requestOtp(); } }}
            />
            {!emailValid && email.length>0 && (
              <p className="text-xs text-red-500">Enter a valid email address</p>
            )}
            <button
              onClick={requestOtp}
              disabled={loading || !emailValid}
              className="w-full rounded-lg bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-50"
            >{loading?'Sending…':'Send OTP'}</button>
          </div>
        )}

        {step===2 && (
          <div className="space-y-3">
            <input
              className="w-full rounded-lg border px-3 py-2 tracking-widest"
              placeholder="Enter OTP"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={e=>setOtp(e.target.value.replace(/\D/g,''))}
              onKeyDown={(e)=>{ if(e.key==='Enter' && otp.length>=4 && !loading){ e.preventDefault(); verifyOtp(); } }}
            />
            <button onClick={verifyOtp} disabled={loading || otp.length<4} className="w-full rounded-lg bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-50">{loading?'Verifying…':'Verify OTP'}</button>
          </div>
        )}

        {step===3 && (
          <div className="space-y-3">
            {resetToken && (
              <p className="text-xs text-green-600">Secure reset token issued ✓</p>
            )}
            <div className="relative">
              <input
                type={showPw? 'text':'password'}
                className="w-full rounded-lg border px-3 py-2 pr-14"
                placeholder="New password"
                value={pw}
                onChange={e=>setPw(e.target.value)}
              />
              <button
                type="button"
                onClick={()=>setShowPw(s=>!s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-600 hover:text-slate-900"
              >{showPw?'Hide':'Show'}</button>
            </div>
            <PasswordStrength value={pw} />
            <input
              type={showPw? 'text':'password'}
              className="w-full rounded-lg border px-3 py-2"
              placeholder="Confirm password"
              value={pw2}
              onChange={e=>setPw2(e.target.value)}
            />
            {pw2 && pw!==pw && (
              <p className="text-xs text-red-500">Passwords do not match</p>
            )}
            <button
              onClick={resetPw}
              disabled={loading || pw.length<8 || pw!==pw2}
              className="w-full rounded-lg bg-blue-600 text-white py-2 hover:bg-blue-700 disabled:opacity-50"
            >{loading?'Updating…':'Update Password'}</button>
          </div>
        )}

        <button className="mt-4 w-full rounded-lg border py-2 hover:bg-slate-50 dark:hover:bg-slate-800" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

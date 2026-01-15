import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { changePassword, toFriendlyErrorMessage } from '@/api/adminPanelSettingsApi';

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const hasJwt = typeof window !== 'undefined' && !!localStorage.getItem('admin_token');

  const validate = (): string | null => {
    if (!currentPassword || !newPassword || !confirmPassword) return 'All fields are required';
    if (newPassword !== confirmPassword) return 'New passwords do not match';
    if (newPassword.length < 8) return 'New password must be at least 8 characters';
    // simple complexity suggestion
    const hasNumber = /\d/.test(newPassword);
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    if (!(hasNumber && hasLetter)) return 'Use letters and numbers for better security';
    return null;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) { setError(v); return; }
    setError(null);
    setSubmitting(true);
    try {
      const res: any = await changePassword({ currentPassword, newPassword });
      if (res?.success || res?.ok) {
        toast.success('Password updated');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        // Optional: force fresh login for security
        // navigate('/login', { replace: true });
      } else {
        const msg = (res as any)?.message || 'Failed to change password';
        setError(msg);
        toast.error(msg);
      }
    } catch (err: any) {
      const msg = toFriendlyErrorMessage(err, 'Failed to change password');
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-2">Change password</h1>
      <p className="text-sm text-gray-600 mb-6">Update your password for the admin panel.</p>
      {!hasJwt && (
        <div className="mb-4 text-sm p-3 rounded border border-amber-300 bg-amber-50 text-amber-700">
          Note: This action requires a standard login token. If you signed in via Advanced Auth (Next.js), first sign in here with your email and current password on the Login page, or use the Advanced Auth flow to reset via Email OTP, then return to update.
        </div>
      )}
      <form onSubmit={onSubmit} className="space-y-4 bg-white dark:bg-slate-800 p-5 rounded shadow">
        <div>
          <label className="block text-sm font-medium mb-1">Current password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2"
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">New password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2"
            autoComplete="new-password"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Use at least 8 characters with letters and numbers.</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Confirm new password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2"
            autoComplete="new-password"
            required
          />
        </div>
        {error && <div className="text-sm text-red-600" role="alert">{error}</div>}
        <div className="flex gap-2">
          <button type="submit" disabled={submitting} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-60">
            {submitting ? 'Updating…' : 'Update password'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="px-4 py-2 rounded border border-gray-300 dark:border-slate-600">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

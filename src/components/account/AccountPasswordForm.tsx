import { useState, type FormEvent } from 'react';
import { toast } from 'react-hot-toast';
import { accountErrorMessage, changeOwnPassword } from '@/api/accountApi';

type AccountPasswordFormProps = {
  title?: string;
  description?: string;
  buttonLabel?: string;
  onChanged?: () => void;
};

const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 dark:border-slate-600 dark:bg-slate-900 dark:text-white';

export default function AccountPasswordForm({
  title = 'Change My Password',
  description = 'Change Password is for your own account only.',
  buttonLabel = 'Update Password',
  onChanged,
}: AccountPasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = (): string | null => {
    if (!currentPassword || !newPassword || !confirmPassword) return 'All fields are required';
    if (newPassword !== confirmPassword) return 'New passwords do not match';
    if (newPassword.length < 8) return 'New password must be at least 8 characters';
    const hasNumber = /\d/.test(newPassword);
    const hasLetter = /[a-zA-Z]/.test(newPassword);
    if (!(hasNumber && hasLetter)) return 'Use letters and numbers for better security';
    return null;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res: any = await changeOwnPassword({ currentPassword, newPassword });
      if (res?.success === false || res?.ok === false) {
        const message = res?.message || 'Failed to change password';
        setError(message);
        toast.error(message);
        return;
      }
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onChanged?.();
    } catch (err) {
      const message = accountErrorMessage(err, 'Failed to change password');
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form id="change-password" onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div>
        <div className="text-base font-semibold text-slate-950 dark:text-white">{title}</div>
        <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{description}</p>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <label className="space-y-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Current password
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" className={inputClass} required />
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
          New password
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" className={inputClass} required />
          <span className="block text-xs font-normal leading-5 text-slate-500 dark:text-slate-400">Use at least 8 characters with letters and numbers.</span>
        </label>
        <label className="space-y-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Confirm new password
          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" className={inputClass} required />
        </label>
      </div>
      {error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800" role="alert">{error}</div> : null}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button type="submit" disabled={submitting} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">
          {submitting ? 'Updating...' : buttonLabel}
        </button>
      </div>
    </form>
  );
}
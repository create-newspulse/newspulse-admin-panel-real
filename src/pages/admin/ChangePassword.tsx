import { useNavigate } from 'react-router-dom';
import AccountPasswordForm from '@/components/account/AccountPasswordForm';

export default function ChangePassword() {
  const navigate = useNavigate();
  const hasJwt = typeof window !== 'undefined' && !!localStorage.getItem('admin_token');

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold mb-2">Change password</h1>
      <p className="text-sm text-gray-600 mb-6">Update your password for the admin panel.</p>
      {!hasJwt && (
        <div className="mb-4 text-sm p-3 rounded border border-amber-300 bg-amber-50 text-amber-700">
          Note: This action requires a standard login token. If you signed in via Advanced Auth (Next.js), first sign in here with your email and current password on the Login page, or use the Advanced Auth flow to reset via Email OTP, then return to update.
        </div>
      )}
      <AccountPasswordForm title="Change password" description="Update your own admin password." buttonLabel="Update Password" />
      <button type="button" onClick={() => navigate(-1)} className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-600">
        Cancel
      </button>
    </div>
  );
}

import { Link } from 'react-router-dom';

export default function SignatureUnlock({ onSuccess }: { onSuccess: () => void }) {
  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow border border-gray-300 dark:border-gray-700 max-w-md mx-auto mt-20 text-center animate-fade-in">
      <h2 className="text-xl font-bold mb-3 text-red-600 dark:text-red-400">🔐 Lockdown Active</h2>
      <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">
        Owner Key required to continue.
      </p>

      <Link
        to="/admin/safe-owner-zone"
        className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
      >
        Manage Owner Key → Safe Owner Zone
      </Link>

      <p className="text-xs text-gray-400 dark:text-slate-400 mt-4">
        Unlock is managed in the Safe Owner Zone hub.
      </p>
    </div>
  );
}

// 📁 src/pages/LockedPage.tsx
import { FaLock } from 'react-icons/fa';

export default function LockedPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-8">
      <FaLock className="text-5xl text-red-500 mb-4" />
      <h1 className="text-2xl font-bold mb-2 text-red-600">🔒 Admin Lockdown Active</h1>
      <p className="text-gray-600 dark:text-gray-300 max-w-xl">
        This section of the Admin Panel is currently under lockdown. Only the founder can disable lockdown mode from the Founder Control Zone in the admin settings.
      </p>
    </div>
  );
}

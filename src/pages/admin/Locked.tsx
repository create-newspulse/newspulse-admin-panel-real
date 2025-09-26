// ✅ src/pages/admin/Locked.tsx
import { FaLock } from 'react-icons/fa';

export default function LockedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white px-4">
      <div className="bg-slate-800 border border-red-500 rounded-xl shadow-lg p-8 max-w-md text-center">
        <FaLock className="text-red-500 text-4xl mb-4 mx-auto" />
        <h1 className="text-2xl font-bold mb-2">🔒 Lockdown Mode Active</h1>
        <p className="text-sm mb-4">
          This tool is temporarily disabled by the Founder.
          Please check back later or contact the admin for more information.
        </p>
        <p className="text-xs text-slate-400">Powered by NewsPulse SafeZone</p>
      </div>
    </div>
  );
}

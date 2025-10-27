import { useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@lib/api';

export default function SignatureUnlock({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post('/founder/verify-pin', { pin });

      const data = (response as any)?.data ?? response;
      if (data.success) {
        toast.success('✅ Signature verified. Lockdown bypassed.');
        await apiClient.post('/unlock-log', {
          time: new Date().toISOString(),
          method: 'signature',
          status: 'verified',
        });
        onSuccess();
      } else {
        setError('Incorrect PIN. Please try again.');
        toast.error('❌ Invalid Signature.');
        await apiClient.post('/unlock-log', {
          time: new Date().toISOString(),
          method: 'signature',
          status: 'failed',
          attempt: pin,
        });
      }
    } catch {
      setError('⚠️ Unlock request failed.');
      toast.error('Server error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow border border-gray-300 dark:border-gray-700 max-w-md mx-auto mt-20 text-center animate-fade-in">
      <h2 className="text-xl font-bold mb-3 text-red-600 dark:text-red-400">🔐 Lockdown Active</h2>
      <p className="text-sm text-gray-500 dark:text-gray-300 mb-4">
        Founder Signature required to continue.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          placeholder="Enter Founder PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="w-full px-4 py-2 rounded border border-gray-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 text-black dark:text-white focus:outline-none focus:ring"
          disabled={loading}
        />
        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded transition disabled:opacity-50"
        >
          {loading ? '🔄 Verifying...' : '✅ Unlock Access'}
        </button>
      </form>

      <p className="text-xs text-gray-400 dark:text-slate-400 mt-4">
        Founder-only override. All attempts are securely logged.
      </p>
    </div>
  );
}

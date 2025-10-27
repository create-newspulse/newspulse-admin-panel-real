import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import apiClient from '@lib/api';
import SignatureUnlock from './SafeZone/SignatureUnlock';

export default function LockCheckWrapper({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [bypass, setBypass] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    apiClient.get('/settings/load')
      .then((res) => {
        const settings = (res as any)?.data ?? res ?? {};
        if (settings.lockdown) {
          setLocked(true);
          toast.error('🔒 Lockdown Mode is active. Signature required.');
        }
      })
      .catch(() => {
        toast.error('⚠️ Could not verify lockdown status.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleUnlockSuccess = async () => {
    try {
      await apiClient.post('/unlock-log', {
        time: new Date().toISOString(),
        method: 'signature',
        status: 'verified',
      });
    } catch (err) {
      console.warn('Unlock log failed:', err);
    } finally {
      setBypass(true);
    }
  };

  if (loading) {
    return <div className="text-center py-10 text-gray-500">⏳ Checking lockdown...</div>;
  }

  if (locked && !bypass) {
    return <SignatureUnlock onSuccess={handleUnlockSuccess} />;
  }

  return <>{children}</>;
}

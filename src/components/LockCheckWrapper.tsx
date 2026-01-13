import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import apiClient, { safeSettingsLoad } from '@lib/api';
import SignatureUnlock from './SafeZone/SignatureUnlock';

export default function LockCheckWrapper({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [bypass, setBypass] = useState(false);
  const [locked, setLocked] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const p = (location?.pathname || '').toLowerCase();
    const isLogin = p === '/login' || p.endsWith('/login') || p === '/admin/login';
    if (isLogin) {
      setLoading(false);
      return;
    }
    safeSettingsLoad({ skipProbe: true })
      .then((settings: any) => {
        if (settings?.lockdown) {
          setLocked(true);
          toast.error('🔒 Lockdown Mode is active. Signature required.');
        }
        if (settings?._stub) {
          console.warn('[LockCheckWrapper] settings stub in use (route missing).');
        }
      })
      .catch(() => {
        toast.error('⚠️ Could not verify lockdown status (stub assumed).');
      })
      .finally(() => setLoading(false));
  }, [location?.pathname]);

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

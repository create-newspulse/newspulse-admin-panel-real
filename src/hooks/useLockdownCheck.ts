// ✅ src/hooks/useLockdownCheck.ts
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export function useLockdownCheck(settings: any) {
  const navigate = useNavigate();
  useEffect(() => {
    if (settings.lockdown) {
      toast.error('🔒 Lockdown Mode is ON. Admin tools are restricted.');
      navigate('/admin/locked');
    }
  }, [settings.lockdown]);
}

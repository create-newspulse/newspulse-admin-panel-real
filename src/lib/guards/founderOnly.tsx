import React from 'react';
import { useAuth } from '@/context/AuthContext';

export default function FounderOnly({ children }: { children: React.ReactNode }) {
  const { user, isFounder, isLoading } = useAuth();
  if (isLoading) return <div className="p-6 text-center text-sm text-slate-500">Checking access…</div>;
  if (!user || !isFounder) {
    return <div className="p-6 text-center text-red-600 font-semibold">Access Denied – Founder only area.</div>;
  }
  return <>{children}</>;
}

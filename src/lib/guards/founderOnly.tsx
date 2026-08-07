import React from 'react';
import { useAuth } from '@/context/AuthContext';
import AdminBootstrapLoader from '@/components/AdminBootstrapLoader';

export default function FounderOnly({ children }: { children: React.ReactNode }) {
  const { user, isFounder, isLoading } = useAuth();
  if (isLoading) return <AdminBootstrapLoader />;
  if (!user || !isFounder) {
    return <div className="p-6 text-center text-red-600 font-semibold">Access Denied – Founder only area.</div>;
  }
  return <>{children}</>;
}

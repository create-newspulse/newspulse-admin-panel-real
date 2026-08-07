import type { ReactNode } from 'react';

export default function AdminBootstrapLoader() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6 py-16" role="status" aria-live="polite">
      <div className="text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" aria-hidden="true" />
        <div className="mt-4 text-base font-semibold text-slate-800 dark:text-slate-100">Loading News Pulse Admin</div>
        <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">Preparing your secure workspace...</div>
      </div>
    </div>
  );
}

export function AdminShellBootstrapGate({ pending, children }: { pending: boolean; children: ReactNode }) {
  if (pending) return <AdminBootstrapLoader />;
  return <>{children}</>;
}

import { PropsWithChildren } from 'react';
import clsx from 'clsx';

export default function AuthCard({ children }: PropsWithChildren) {
  return (
    <div className={clsx(
      'mx-auto w-full max-w-md rounded-2xl border border-slate-200/60',
      'bg-white/70 dark:bg-slate-900/70 backdrop-blur',
      'shadow-xl p-6 sm:p-8'
    )}>
      {children}
    </div>
  );
}

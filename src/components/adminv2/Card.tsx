import type { ReactNode } from 'react';

export default function Card({ title, subtitle, children, actions }: { title?: string; subtitle?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-start justify-between gap-4">
        <div>
          {title && <h3 className="text-lg font-semibold">{title}</h3>}
          {subtitle && <p className="text-sm text-slate-600 dark:text-slate-300">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

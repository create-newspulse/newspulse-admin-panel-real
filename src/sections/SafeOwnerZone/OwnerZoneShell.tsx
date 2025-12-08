import React, { ReactNode } from 'react';
import CommandPalette from './widgets/CommandPalette';

export interface OwnerZoneShellTab {
  id: string; label: string; render: () => ReactNode; icon?: ReactNode;
}

export default function OwnerZoneShell({
  title,
  subtitle,
  tabs,
  defaultTab = 'overview',
  toolbar,
  footer,
  status
}: {
  title: string; subtitle?: string;
  tabs: OwnerZoneShellTab[];
  defaultTab?: string; toolbar?: ReactNode; footer?: ReactNode;
  status?: { lockState?: 'LOCKED'|'UNLOCKED'; snapshotId?: string|null };
}) {
  const [active, setActive] = React.useState(defaultTab);
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {status?.lockState && (
            <span className={`text-xs px-2 py-1 rounded-full border ${status.lockState === 'LOCKED' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
              {status.lockState}
            </span>
          )}
          {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <CommandPalette />
          {toolbar}
        </div>
      </header>
      <div className="border-b border-slate-200 dark:border-slate-700 flex gap-2 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`px-3 py-2 text-sm rounded-t-md border-b-2 transition-colors whitespace-nowrap ${active === t.id ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`}
          >
            {t.icon && <span className="inline-block mr-1">{t.icon}</span>}
            {t.label}
          </button>
        ))}
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 p-4">
        {tabs.map(t => active === t.id && (
          <div key={t.id}>{t.render()}</div>
        ))}
      </div>
      {footer && <div>{footer}</div>}
    </div>
  );
}

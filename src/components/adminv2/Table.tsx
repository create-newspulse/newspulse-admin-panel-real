import React from 'react';

type Col<T> = { key: keyof T; header: string; render?: (row: T) => React.ReactNode };

export default function Table<T extends { id: string | number }>({ rows, columns }: { rows: T[]; columns: Col<T>[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
        <thead className="bg-slate-50 dark:bg-slate-800/60">
          <tr>
            {columns.map(col => (
              <th key={String(col.key)} className="px-4 py-2 text-left text-xs font-semibold text-slate-500 dark:text-slate-300 uppercase tracking-wide">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900/40">
          {rows.map(row => (
            <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
              {columns.map(col => (
                <td key={String(col.key)} className="px-4 py-2 text-sm">
                  {col.render ? col.render(row) : (row[col.key] as any)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

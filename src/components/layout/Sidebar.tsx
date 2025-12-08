import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { MENU } from '@/config/menu';
import { useAuthZ } from '@/store/auth';
import { useStats } from '@/store/stats';
import { motion } from 'framer-motion';

export default function Sidebar() {
  const { user } = useAuthZ();
  const { stats } = useStats();
  const role = user?.role;

  const sections: Record<string, { title: string; className: string }> = {
    founder: { title: 'Founder Controls', className: 'from-yellow-500 to-amber-600' },
    admin: { title: 'Admin Operations', className: 'from-blue-500 to-indigo-600' },
    employee: { title: 'Employee Tools', className: 'from-teal-500 to-cyan-600' },
  };

  const items = MENU.filter(i => !role || i.roles.includes(role));

  const grouped = items.reduce<Record<string, typeof items>>( (acc, it) => {
    const sec = it.section || 'general';
    (acc[sec] ||= []).push(it);
    return acc;
  }, {});

  return (
    <div className="h-full w-72 shrink-0 border-r bg-white dark:bg-slate-900 dark:border-slate-800 overflow-y-auto">
      <div className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">Role: <span className="font-medium">{role || 'guest'}</span></div>
      <nav className="px-2 pb-6">
        {Object.entries(grouped).map(([sec, list]) => (
          <div key={sec} className="mb-6">
            {sec !== 'general' && (
              <div className="px-2 mb-2">
                <span className={clsx('inline-flex items-center gap-2 text-xs font-semibold text-white px-2 py-1 rounded bg-gradient-to-r', sections[sec]?.className)}>
                  {sections[sec]?.title}
                </span>
              </div>
            )}
            <ul className="space-y-1">
              {list.map((it) => (
                <li key={it.key}>
                  <NavLink
                    to={it.path}
                    className={({ isActive }) => clsx(
                      'group flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-800',
                      isActive && 'bg-slate-100 dark:bg-slate-800'
                    )}
                  >
                    <motion.span whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.98 }} className="inline-flex">
                      <it.icon className="w-5 h-5 text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-white" />
                    </motion.span>
                    <span className="flex-1 text-sm">{it.label}</span>
                    {it.badgeKey && (
                      <span className="text-xs rounded px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700">
                        { (stats as any)[it.badgeKey] ?? 0 }
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}

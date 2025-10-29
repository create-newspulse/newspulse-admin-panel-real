import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

type Command = {
  label: string;
  hint?: string;
  path?: string;
  action?: () => void | Promise<void>;
};

export default function GlobalCommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery('');
    }
  }, [open]);

  const commands: Command[] = useMemo(
    () => [
      { label: 'Go: Dashboard', hint: 'Admin overview', path: '/admin/dashboard' },
      { label: 'Go: Safe Owner Zone', hint: 'Founder hub', path: '/safe-owner' },
      { label: 'Go: Add News', path: '/add' },
      { label: 'Go: Manage News', path: '/manage-news' },
      { label: 'Go: AI Engine', path: '/admin/ai-engine' },
      { label: 'Go: Analytics', path: '/admin/analytics' },
      { label: 'Go: Poll Editor', path: '/poll-editor' },
      { label: 'Go: Poll Results', path: '/poll-results' },
      { label: 'Go: Inspiration Hub', path: '/media/inspiration' },
      {
        label: 'Toggle Theme',
        hint: 'Light/Dark',
        action: () => {
          document.documentElement.classList.toggle('dark');
        },
      },
      {
        label: 'Reload',
        action: () => window.location.reload(),
      },
    ],
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || (c.hint || '').toLowerCase().includes(q));
  }, [query, commands]);

  const run = async (cmd: Command) => {
    if (cmd.action) await cmd.action();
    if (cmd.path && cmd.path !== location.pathname) navigate(cmd.path);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-start justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-xl rounded-xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3">
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search… (esc to close)"
            className="w-full bg-transparent outline-none text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>
        <ul className="max-h-80 overflow-auto bg-white dark:bg-slate-900">
          {filtered.map((c, idx) => (
            <li
              key={`${c.label}-${idx}`}
              className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between"
              onClick={() => run(c)}
            >
              <span className="text-slate-800 dark:text-slate-100">{c.label}</span>
              {c.hint && <span className="text-xs text-slate-500 dark:text-slate-400">{c.hint}</span>}
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-slate-500 dark:text-slate-400">No results</li>
          )}
        </ul>
      </div>
    </div>
  );
}

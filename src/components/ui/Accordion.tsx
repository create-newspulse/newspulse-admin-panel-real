import { useEffect, useId, useMemo, useState } from 'react';

export type AccordionItem = {
  id: string;
  title: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  forceOpenWhen?: boolean;
  children: React.ReactNode;
};

export default function Accordion({ items }: { items: AccordionItem[] }) {
  const baseId = useId();

  const initialOpen = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const it of items) map[it.id] = !!it.defaultOpen;
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [open, setOpen] = useState<Record<string, boolean>>(initialOpen);

  // Auto-open sections when a warning/error appears.
  useEffect(() => {
    setOpen((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const it of items) {
        if (it.forceOpenWhen && !next[it.id]) {
          next[it.id] = true;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [items]);

  return (
    <div className="space-y-2">
      {items.map((it) => {
        const isOpen = !!open[it.id];
        const buttonId = `${baseId}-${it.id}-btn`;
        const panelId = `${baseId}-${it.id}-panel`;

        return (
          <div key={it.id} className="rounded border border-slate-200 bg-white">
            <button
              id={buttonId}
              type="button"
              className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen((p) => ({ ...p, [it.id]: !p[it.id] }))}
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="text-sm font-semibold truncate">{it.title}</div>
                {it.badge ? <div className="shrink-0">{it.badge}</div> : null}
              </div>
              <div className="text-xs text-slate-500 shrink-0">{isOpen ? 'Hide' : 'Show'}</div>
            </button>

            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={isOpen ? 'px-3 pb-3' : 'hidden'}
            >
              {it.children}
            </div>
          </div>
        );
      })}
    </div>
  );
}

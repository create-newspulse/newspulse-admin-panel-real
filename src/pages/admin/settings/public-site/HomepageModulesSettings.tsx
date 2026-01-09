import { useMemo, useState } from 'react';
import Switch from '@/components/settings/Switch';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type ModuleKey =
  | 'explore'
  | 'categoryStrip'
  | 'trending'
  | 'liveUpdatesTicker'
  | 'breakingTicker'
  | 'quickTools'
  | 'appPromo'
  | 'footer';

const DEFAULT_ORDER: ModuleKey[] = ['explore', 'categoryStrip', 'trending', 'liveUpdatesTicker', 'breakingTicker', 'quickTools', 'appPromo', 'footer'];

function isTickerKey(key: ModuleKey): key is 'liveUpdatesTicker' | 'breakingTicker' {
  return key === 'liveUpdatesTicker' || key === 'breakingTicker';
}

function SortableRow({
  id,
  label,
  enabled,
  position,
  reorderMode,
  onToggle,
}: {
  id: ModuleKey;
  label: string;
  enabled: boolean;
  position: number;
  reorderMode: boolean;
  onToggle: (next: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !reorderMode });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        'flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 ' +
        (isDragging ? 'opacity-80' : '')
      }
    >
      <div className="flex items-center gap-3 min-w-0">
        {reorderMode ? (
          <button
            type="button"
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 hover:bg-slate-100"
            aria-label={`Reorder ${label}`}
            title="Drag to reorder (or use keyboard)"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
        ) : (
          <div className="shrink-0 w-8" />
        )}

        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{label}</div>
          <div className="text-xs text-slate-600">Order position: {position}</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={(v) => onToggle(v)} label={label} />
      </div>
    </div>
  );
}

export default function HomepageModulesSettings() {
  const { draft, patchDraft } = usePublicSiteSettingsDraft();
  const [reorderMode, setReorderMode] = useState(false);

  const order = useMemo(() => {
    const mods = (draft as any)?.homepage?.modules || {};
    const tickers = (draft as any)?.tickers || {};
    const withOrder = DEFAULT_ORDER.map((k, idx) => {
      const ord = isTickerKey(k)
        ? Number(k === 'liveUpdatesTicker' ? tickers?.live?.order : tickers?.breaking?.order)
        : Number(
            k === 'explore'
              ? ((mods as any)?.explore?.order ?? (mods as any)?.exploreCategories?.order)
              : k === 'trending'
                ? ((mods as any)?.trending?.order ?? (mods as any)?.trendingStrip?.order)
                : (mods as any)?.[k]?.order
          );
      return { k, ord: Number.isFinite(ord) && ord > 0 ? ord : (idx + 1) };
    });
    withOrder.sort((a, b) => a.ord - b.ord);
    return withOrder.map((x) => x.k);
  }, [draft]);

  const enabled = useMemo(() => {
    const mods = (draft as any)?.homepage?.modules || {};
    const tickers = (draft as any)?.tickers || {};
    return {
      explore: !!((mods as any)?.explore?.enabled ?? (mods as any)?.exploreCategories?.enabled),
      categoryStrip: !!(mods as any)?.categoryStrip?.enabled,
      trending: !!((mods as any)?.trending?.enabled ?? (mods as any)?.trendingStrip?.enabled),
      liveUpdatesTicker: !!tickers?.live?.enabled,
      breakingTicker: !!tickers?.breaking?.enabled,
      quickTools: !!(mods as any)?.quickTools?.enabled,
      appPromo: !!(mods as any)?.appPromo?.enabled,
      footer: !!(mods as any)?.footer?.enabled,
    } as Record<ModuleKey, boolean>;
  }, [draft]);

  function setEnabled(key: ModuleKey, next: boolean) {
    if (key === 'liveUpdatesTicker') {
      patchDraft({ tickers: { live: { enabled: next } } } as any);
      return;
    }
    if (key === 'breakingTicker') {
      patchDraft({ tickers: { breaking: { enabled: next } } } as any);
      return;
    }
    patchDraft({ homepage: { modules: { [key]: { enabled: next } } } } as any);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function onDragEnd(evt: DragEndEvent) {
    const { active, over } = evt;
    if (!over) return;
    const a = String(active.id) as ModuleKey;
    const b = String(over.id) as ModuleKey;
    if (a === b) return;
    const oldIndex = order.indexOf(a);
    const newIndex = order.indexOf(b);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(order, oldIndex, newIndex);
    const modulesPatch: any = {};
    const tickersPatch: any = {};
    next.forEach((k, idx) => {
      const pos = idx + 1;
      if (k === 'liveUpdatesTicker') tickersPatch.live = { order: pos };
      else if (k === 'breakingTicker') tickersPatch.breaking = { order: pos };
      else modulesPatch[k] = { order: pos };
    });
    patchDraft({
      ...(Object.keys(modulesPatch).length ? { homepage: { modules: modulesPatch } } : {}),
      ...(Object.keys(tickersPatch).length ? { tickers: tickersPatch } : {}),
    } as any);
  }

  const label: Record<ModuleKey, string> = {
    explore: 'Explore Categories',
    categoryStrip: 'Category Strip',
    trending: 'Trending Strip',
    liveUpdatesTicker: 'Live Updates Ticker',
    breakingTicker: 'Breaking Ticker',
    quickTools: 'Quick Tools',
    appPromo: 'App Promo',
    footer: 'Footer',
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="text-lg font-semibold">Homepage Modules</div>
        <div className="mt-1 text-sm text-slate-600">Toggle modules and control section ordering.</div>
      </div>

      <div id="categories" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-base font-semibold">Modules</div>
            {reorderMode ? (
              <div className="mt-1 text-sm text-slate-600">Drag the handle (⋮⋮) to reorder. Keyboard reorder is also supported.</div>
            ) : (
              <div className="mt-1 text-sm text-slate-600">Turn on Reorder to change section order.</div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReorderMode((v) => !v)}
              className={
                'rounded-lg border px-3 py-2 text-sm font-semibold ' +
                (reorderMode ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-300 bg-white hover:bg-slate-100')
              }
            >
              Reorder
            </button>
            <button
              type="button"
              onClick={() => {
                const modulesPatch: any = {};
                const tickersPatch: any = {};
                DEFAULT_ORDER.forEach((k, idx) => {
                  const pos = idx + 1;
                  if (k === 'liveUpdatesTicker') tickersPatch.live = { order: pos };
                  else if (k === 'breakingTicker') tickersPatch.breaking = { order: pos };
                  else modulesPatch[k] = { order: pos };
                });
                patchDraft({
                  ...(Object.keys(modulesPatch).length ? { homepage: { modules: modulesPatch } } : {}),
                  ...(Object.keys(tickersPatch).length ? { tickers: tickersPatch } : {}),
                } as any);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-100"
              title="Restore the default ordering"
            >
              Reset order
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              {order.map((k, idx) => (
                <SortableRow
                  key={k}
                  id={k}
                  label={label[k]}
                  enabled={enabled[k]}
                  position={idx + 1}
                  reorderMode={reorderMode}
                  onToggle={(v) => setEnabled(k, v)}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );
}

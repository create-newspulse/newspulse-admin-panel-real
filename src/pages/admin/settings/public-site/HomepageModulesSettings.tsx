import { useMemo, useState } from 'react';
import Switch from '@/components/settings/Switch';
import { useSettingsDraft } from '@/features/settings/SettingsDraftContext';
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
  const { draft, patchDraft } = useSettingsDraft();
  const [reorderMode, setReorderMode] = useState(false);

  const order = useMemo(() => {
    const raw = (draft as any)?.homepage?.modulesOrder as ModuleKey[] | undefined;
    const arr = Array.isArray(raw) ? raw.filter(Boolean) : [];
    const merged = [...arr];
    for (const k of DEFAULT_ORDER) {
      if (!merged.includes(k)) merged.push(k);
    }
    return merged;
  }, [draft]);

  const enabled = useMemo(() => {
    const ui = draft?.ui;
    return {
      explore: !!ui?.showExploreCategories,
      categoryStrip: !!ui?.showCategoryStrip,
      trending: !!ui?.showTrendingStrip,
      liveUpdatesTicker: !!ui?.showLiveUpdatesTicker,
      breakingTicker: !!ui?.showBreakingTicker,
      quickTools: !!ui?.showQuickTools,
      appPromo: !!ui?.showAppPromo,
      footer: !!ui?.showFooter,
    } as Record<ModuleKey, boolean>;
  }, [draft]);

  function setEnabled(key: ModuleKey, next: boolean) {
    const uiPatch: any = {};
    if (key === 'explore') uiPatch.showExploreCategories = next;
    if (key === 'categoryStrip') uiPatch.showCategoryStrip = next;
    if (key === 'trending') uiPatch.showTrendingStrip = next;
    if (key === 'liveUpdatesTicker') uiPatch.showLiveUpdatesTicker = next;
    if (key === 'breakingTicker') uiPatch.showBreakingTicker = next;
    if (key === 'quickTools') uiPatch.showQuickTools = next;
    if (key === 'appPromo') uiPatch.showAppPromo = next;
    if (key === 'footer') uiPatch.showFooter = next;
    patchDraft({ ui: uiPatch } as any);
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
    patchDraft({ homepage: { modulesOrder: next } } as any);
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

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
              onClick={() => patchDraft({ homepage: { modulesOrder: DEFAULT_ORDER } } as any)}
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

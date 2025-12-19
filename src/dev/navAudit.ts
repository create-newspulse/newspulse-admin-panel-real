import { NAV_ITEMS } from '@/config/nav';

type Item = { key: string; label: string; path: string };

function collect(): Item[] {
  // In future, extend to pull from other menus/sidebars.
  return NAV_ITEMS.filter(i => !i.hidden).map(i => ({ key: i.key, label: i.label, path: i.path }));
}

function findDupes<T extends Item>(items: T[]) {
  const by = (field: keyof Item) => {
    const map = new Map<string, T[]>();
    for (const it of items) {
      const v = String(it[field] ?? '');
      if (!v) continue;
      const arr = map.get(v) ?? [];
      arr.push(it);
      map.set(v, arr);
    }
    return Array.from(map.entries()).filter(([, arr]) => arr.length > 1);
  };
  return {
    path: by('path'),
    label: by('label'),
    key: by('key'),
  };
}

export function runNavAudit() {
  const items = collect();
  const dupes = findDupes(items);
  const hasDupes = Object.values(dupes).some(list => list.length > 0);
  if (hasDupes) {
    // Dev-only logging; avoid throwing in HMR
    console.error('[nav-audit] Duplicate navigation entries detected');
    const log = (name: keyof typeof dupes) => {
      const entries = dupes[name];
      if (!entries.length) return;
      console.error(` - by ${name}:`);
      for (const [value, arr] of entries) {
        console.error(`   • ${value}:`, arr.map(a => `{key:${a.key},label:${a.label},path:${a.path}}`).join(' | '));
      }
    };
    log('path');
    log('label');
    log('key');
  }
}

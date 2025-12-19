import { useEffect, useMemo, useState } from 'react';
import { adminSettingsApi } from '@/lib/adminSettingsApi';
import type { SiteSettings } from '@/types/siteSettings';

export function useSettingsSection<T extends object>(selector: (s: SiteSettings) => T, updater: (prev: SiteSettings, part: T) => SiteSettings) {
  const [base, setBase] = useState<SiteSettings | null>(null);
  const [local, setLocal] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = useMemo(() => JSON.stringify(local) !== JSON.stringify(base && selector(base)), [local, base, selector]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await adminSettingsApi.getSettings();
        if (!mounted) return;
        setBase(s);
        setLocal(selector(s));
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [selector]);

  const save = async () => {
    if (!base || !local) return;
    setSaving(true);
    try {
      const merged = updater(base, local);
      const next = await adminSettingsApi.putSettings(merged, { action: 'save-settings' });
      setBase(next);
      setLocal(selector(next));
    } finally { setSaving(false); }
  };

  const cancel = () => {
    if (!base) return;
    setLocal(selector(base));
  };

  return { loading, saving, dirty, error, state: local, setState: setLocal, save, cancel } as const;
}

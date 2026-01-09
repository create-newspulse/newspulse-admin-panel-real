import { useEffect, useMemo, useRef, useState } from 'react';
import { adminSettingsApi } from '@/lib/adminSettingsApi';
import type { SiteSettings } from '@/types/siteSettings';

export function useSettingsSection<T extends object>(selector: (s: SiteSettings) => T, updater: (prev: SiteSettings, part: T) => SiteSettings) {
  const [base, setBase] = useState<SiteSettings | null>(null);
  const [local, setLocal] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Callers often pass inline lambdas; avoid refetching settings on every render.
  const selectorRef = useRef(selector);
  const updaterRef = useRef(updater);
  useEffect(() => { selectorRef.current = selector; }, [selector]);
  useEffect(() => { updaterRef.current = updater; }, [updater]);

  const dirty = useMemo(() => {
    const basePart = base ? selectorRef.current(base) : null;
    return JSON.stringify(local) !== JSON.stringify(basePart);
  }, [local, base]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await adminSettingsApi.getSettings();
        if (!mounted) return;
        setBase(s);
        setLocal(selectorRef.current(s));
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const save = async () => {
    if (!base || !local) return;
    setSaving(true);
    try {
      const merged = updaterRef.current(base, local);
      const next = await adminSettingsApi.putSettings(merged, { action: 'save-settings' });
      setBase(next);
      setLocal(selectorRef.current(next));
    } finally { setSaving(false); }
  };

  const cancel = () => {
    if (!base) return;
    setLocal(selectorRef.current(base));
  };

  return { loading, saving, dirty, error, state: local, setState: setLocal, save, cancel } as const;
}

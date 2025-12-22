import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { SiteSettings } from '@/types/siteSettings';
import { DEFAULT_SETTINGS } from '@/types/siteSettings';
import settingsApi from '@/lib/settingsApi';
import { deepMerge } from '@/features/settings/deepMerge';

type Status = 'idle' | 'loading' | 'ready' | 'saving' | 'publishing' | 'error';

type Ctx = {
  status: Status;
  error: string | null;
  base: SiteSettings | null;
  draft: SiteSettings | null;
  dirty: boolean;
  patchDraft: (patch: Partial<SiteSettings>) => void;
  resetDraft: () => void;
  saveDraftLocal: () => void;
  publish: (auditAction?: string) => Promise<void>;
};

const SettingsDraftContext = createContext<Ctx | null>(null);

const DRAFT_KEY = 'np_settings_draft_v1';

function safeParseDraft(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function SettingsDraftProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [base, setBase] = useState<SiteSettings | null>(null);
  const [draft, setDraft] = useState<SiteSettings | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setStatus('loading');
      setError(null);
      try {
        const s = await settingsApi.getAdminSettings();
        if (!mounted) return;
        setBase(s);

        const local = safeParseDraft(localStorage.getItem(DRAFT_KEY));
        if (local && typeof local === 'object' && local.value) {
          setDraft(deepMerge(s, local.value as Partial<SiteSettings>));
        } else {
          setDraft(s);
        }
        setStatus('ready');
      } catch (e: any) {
        if (!mounted) return;
        setBase(DEFAULT_SETTINGS);
        setDraft(DEFAULT_SETTINGS);
        setStatus('error');
        setError(e?.message || 'Failed to load settings');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const dirty = useMemo(() => {
    if (!base || !draft) return false;
    return JSON.stringify(base) !== JSON.stringify(draft);
  }, [base, draft]);

  const patchDraft = (patch: Partial<SiteSettings>) => {
    setDraft((prev) => {
      const current = prev || base || DEFAULT_SETTINGS;
      return deepMerge(current, patch);
    });
  };

  const resetDraft = () => {
    if (base) setDraft(base);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  };

  const saveDraftLocal = () => {
    if (!draft) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ savedAt: new Date().toISOString(), value: draft }));
    } catch {
      // ignore
    }
  };

  const publish = async (auditAction = 'publish-settings') => {
    if (!draft) return;
    setStatus('publishing');
    setError(null);
    try {
      const next = await settingsApi.putAdminSettings(draft, { action: auditAction });
      setBase(next);
      setDraft(next);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setStatus('ready');
    } catch (e: any) {
      setStatus('error');
      setError(e?.message || 'Publish failed');
      throw e;
    }
  };

  const value = useMemo<Ctx>(() => {
    return {
      status,
      error,
      base,
      draft,
      dirty,
      patchDraft,
      resetDraft,
      saveDraftLocal,
      publish,
    };
  }, [status, error, base, draft, dirty]);

  return <SettingsDraftContext.Provider value={value}>{children}</SettingsDraftContext.Provider>;
}

export function useSettingsDraft() {
  const ctx = useContext(SettingsDraftContext);
  if (!ctx) throw new Error('useSettingsDraft must be used within SettingsDraftProvider');
  return ctx;
}

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { SiteSettings } from '@/types/siteSettings';
import { DEFAULT_SETTINGS } from '@/types/siteSettings';
import settingsApi from '@/lib/settingsApi';
import { deepMerge } from '@/features/settings/deepMerge';

type Status = 'idle' | 'loading' | 'ready' | 'saving' | 'publishing' | 'error';

export type SettingsDraftScope = 'admin-panel' | 'public-site';

type Ctx = {
  status: Status;
  error: string | null;
  base: SiteSettings | null;
  draft: SiteSettings | null;
  dirty: boolean;
  patchDraft: (patch: Partial<SiteSettings>) => void;
  resetDraft: () => void;
  saveDraftLocal: () => void;
  saveDraftRemote: (auditAction?: string) => Promise<void>;
  publish: (auditAction?: string) => Promise<void>;
};

const SettingsDraftContext = createContext<Ctx | null>(null);

function draftKey(scope: SettingsDraftScope): string {
  return scope === 'public-site' ? 'np_settings_draft_public_v1' : 'np_settings_draft_admin_v1';
}

function safeParseDraft(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const replacer = (_key: string, v: any) => {
    if (!v || typeof v !== 'object') return v;
    if (seen.has(v)) return '[Circular]';
    seen.add(v);

    if (Array.isArray(v)) return v;

    const out: Record<string, any> = {};
    for (const k of Object.keys(v).sort()) out[k] = v[k];
    return out;
  };
  return JSON.stringify(value, replacer);
}

export function SettingsDraftProvider({ children, scope = 'admin-panel' }: PropsWithChildren<{ scope?: SettingsDraftScope }>) {
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
        const s = scope === 'public-site'
          ? await settingsApi.getAdminPublicSiteSettings()
          : await settingsApi.getAdminSettings();
        if (!mounted) return;
        setBase(s);

        const local = safeParseDraft(localStorage.getItem(draftKey(scope)));
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
  }, [scope]);

  const dirty = useMemo(() => {
    if (!base || !draft) return false;
    return stableStringify(base) !== stableStringify(draft);
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
      localStorage.removeItem(draftKey(scope));
    } catch {
      // ignore
    }
  };

  const saveDraftLocal = () => {
    if (!draft) return;
    try {
      localStorage.setItem(draftKey(scope), JSON.stringify({ savedAt: new Date().toISOString(), value: draft }));
    } catch {
      // ignore
    }
  };

  const saveDraftRemote = async (auditAction = 'save-settings-draft') => {
    if (!draft) return;
    setStatus('saving');
    setError(null);
    try {
      const next = scope === 'public-site'
        ? await settingsApi.putAdminPublicSiteSettings(draft, auditAction ? { action: auditAction } : undefined)
        : await settingsApi.putAdminSettings(draft, auditAction ? { action: auditAction } : undefined);
      setBase(next);
      setDraft(next);
      try {
        localStorage.removeItem(draftKey(scope));
      } catch {}
      setStatus('ready');
    } catch (e: any) {
      setStatus('error');
      setError(e?.message || 'Save failed');
      throw e;
    }
  };

  const publish = async (auditAction = 'publish-settings') => {
    if (!draft) return;
    setStatus('publishing');
    setError(null);
    try {
      const next = scope === 'public-site'
        ? await settingsApi.publishAdminPublicSiteSettings(draft, auditAction ? { action: auditAction } : undefined)
        : await settingsApi.putAdminSettings(draft, auditAction ? { action: auditAction } : undefined);
      setBase(next);
      setDraft(next);
      try {
        localStorage.removeItem(draftKey(scope));
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
      saveDraftRemote,
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

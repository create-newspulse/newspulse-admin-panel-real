import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { PublicSiteSettings } from '@/types/publicSiteSettings';
import { DEFAULT_PUBLIC_SITE_SETTINGS } from '@/types/publicSiteSettings';
import { normalizePublicSiteSettings } from '@/types/publicSiteSettings';
import { publicSiteSettingsApi } from '@/lib/publicSiteSettingsApi';
import { deepMerge } from '@/features/settings/deepMerge';

type Status = 'idle' | 'loading' | 'ready' | 'saving' | 'publishing' | 'error';

type Ctx = {
  status: Status;
  error: string | null;
  basePublished: PublicSiteSettings | null;
  draft: PublicSiteSettings | null;
  dirty: boolean;
  patchDraft: (patch: Partial<PublicSiteSettings>) => void;
  resetDraftToPublished: () => void;
  saveDraftLocal: () => void;
  saveDraftRemote: (auditAction?: string) => Promise<void>;
  publish: (auditAction?: string) => Promise<void>;
};

const PublicSiteSettingsDraftContext = createContext<Ctx | null>(null);

const LOCAL_KEY = 'np_settings_draft_public_site_v2';

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

export function PublicSiteSettingsDraftProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [basePublished, setBasePublished] = useState<PublicSiteSettings | null>(null);
  const [draft, setDraft] = useState<PublicSiteSettings | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      setStatus('loading');
      setError(null);
      try {
        const bundle = await publicSiteSettingsApi.getAdminPublicSiteSettingsBundle();
        if (!mounted) return;

        setBasePublished(bundle.published);

        const local = safeParseDraft(localStorage.getItem(LOCAL_KEY));
        const remoteDraft = bundle.draft || bundle.published;
        if (local && typeof local === 'object' && local.value) {
          setDraft(deepMerge(remoteDraft, local.value as Partial<PublicSiteSettings>));
        } else {
          setDraft(remoteDraft);
        }

        setStatus('ready');
      } catch (e: any) {
        if (!mounted) return;
        setBasePublished(DEFAULT_PUBLIC_SITE_SETTINGS);
        setDraft(DEFAULT_PUBLIC_SITE_SETTINGS);
        setStatus('error');
        setError(e?.message || 'Failed to load public site settings');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const dirty = useMemo(() => {
    if (!basePublished || !draft) return false;
    return stableStringify(basePublished) !== stableStringify(draft);
  }, [basePublished, draft]);

  const patchDraft = (patch: Partial<PublicSiteSettings>) => {
    setDraft((prev) => {
      const current = prev || basePublished || DEFAULT_PUBLIC_SITE_SETTINGS;
      return deepMerge(current, patch);
    });
  };

  const resetDraftToPublished = () => {
    if (basePublished) setDraft(basePublished);
    try {
      localStorage.removeItem(LOCAL_KEY);
    } catch {
      // ignore
    }
  };

  const saveDraftLocal = () => {
    if (!draft) return;
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify({ savedAt: new Date().toISOString(), value: draft }));
    } catch {
      // ignore
    }
  };

  const saveDraftRemote = async (auditAction = 'save-public-site-settings') => {
    if (!draft) return;
    setStatus('saving');
    setError(null);
    try {
      const normalizedDraft = normalizePublicSiteSettings(draft);
      const nextDraft = await publicSiteSettingsApi.putAdminPublicSiteSettingsDraft(
        normalizedDraft,
        auditAction ? { action: auditAction } : undefined
      );
      setDraft(nextDraft);
      try {
        localStorage.removeItem(LOCAL_KEY);
      } catch {}
      setStatus('ready');
    } catch (e: any) {
      setStatus('error');
      setError(e?.message || 'Save failed');
      throw e;
    }
  };

  const publish = async (auditAction = 'publish-public-site-settings') => {
    if (!draft) return;
    setStatus('publishing');
    setError(null);
    try {
      const normalizedDraft = normalizePublicSiteSettings(draft);
      const published = await publicSiteSettingsApi.publishAdminPublicSiteSettings(
        normalizedDraft,
        auditAction ? { action: auditAction } : undefined
      );
      setBasePublished(published);
      setDraft(published);
      try {
        localStorage.removeItem(LOCAL_KEY);
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
      basePublished,
      draft,
      dirty,
      patchDraft,
      resetDraftToPublished,
      saveDraftLocal,
      saveDraftRemote,
      publish,
    };
  }, [status, error, basePublished, draft, dirty]);

  return <PublicSiteSettingsDraftContext.Provider value={value}>{children}</PublicSiteSettingsDraftContext.Provider>;
}

export function usePublicSiteSettingsDraft() {
  const ctx = useContext(PublicSiteSettingsDraftContext);
  if (!ctx) throw new Error('usePublicSiteSettingsDraft must be used within PublicSiteSettingsDraftProvider');
  return ctx;
}

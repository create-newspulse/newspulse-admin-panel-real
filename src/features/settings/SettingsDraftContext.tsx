import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { SiteSettings } from '@/types/siteSettings';
import { DEFAULT_SETTINGS, SiteSettingsSchema } from '@/types/siteSettings';
import settingsApi from '@/lib/settingsApi';
import { deepMerge } from '@/features/settings/deepMerge';
import { toast } from 'react-hot-toast';
import { AdminApiError } from '@/lib/http/adminFetch';

type Status = 'idle' | 'loading' | 'ready' | 'saving' | 'publishing' | 'error';

type Ctx = {
  status: Status;
  error: string | null;
  backendAvailable: boolean;
  base: SiteSettings | null;
  draft: SiteSettings | null;
  dirty: boolean;
  publishAvailable: boolean;
  patchDraft: (patch: Partial<SiteSettings>) => void;
  resetDraft: () => void;
  saveDraftLocal: () => void;
  saveDraft: (auditAction?: string) => Promise<void>;
  publish: (auditAction?: string) => Promise<void>;
};

const SAFE_CTX: Ctx = {
  status: 'loading',
  error: null,
  backendAvailable: true,
  base: DEFAULT_SETTINGS,
  draft: DEFAULT_SETTINGS,
  dirty: false,
  publishAvailable: true,
  patchDraft: () => {},
  resetDraft: () => {},
  saveDraftLocal: () => {},
  saveDraft: async () => {},
  publish: async () => {},
};

const SettingsDraftContext = createContext<Ctx>(SAFE_CTX);

const DRAFT_KEY = 'np_settings_draft_v1';

let warnedMissingPublishApi = false;
let warnedBackendUnavailable = false;

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
  const [backendAvailable, setBackendAvailable] = useState<boolean>(true);
  const [base, setBase] = useState<SiteSettings | null>(DEFAULT_SETTINGS);
  const [draft, setDraft] = useState<SiteSettings | null>(DEFAULT_SETTINGS);
  const [publishAvailable, setPublishAvailable] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setStatus('loading');
      setError(null);
      setBackendAvailable(true);

      const isBackendUnavailable = (status: number | null, message: string): boolean => {
        if (typeof status === 'number' && Number.isFinite(status)) {
          return status >= 500 || status === 502 || status === 503 || status === 504;
        }
        const m = (message || '').toLowerCase();
        return (
          m.includes('failed to fetch') ||
          m.includes('networkerror') ||
          m.includes('econnrefused') ||
          m.includes('etimedout') ||
          m.includes('timeout') ||
          m.includes('dev_proxy_error')
        );
      };
      try {
        // Load full admin settings (published) AND public-site settings (draft + published).
        // Provider must never crash rendering even if any endpoint is missing.
        const [adminRes, publicBundleRes, publicDraftRes] = await Promise.allSettled([
          settingsApi.getAdminSettings(),
          settingsApi.getPublicSiteBundle(),
          settingsApi.getPublicSiteDraft(),
        ]);

        if (!mounted) return;

        const adminBase = adminRes.status === 'fulfilled' ? adminRes.value : DEFAULT_SETTINGS;
        const publicBundle = publicBundleRes.status === 'fulfilled' ? publicBundleRes.value : { draft: null, published: null };

        const publicDraft = publicDraftRes.status === 'fulfilled' ? publicDraftRes.value : publicBundle.draft;
        const publicPublished = publicBundle.published;

        const mergedBase = deepMerge(adminBase, (publicPublished || {}) as Partial<SiteSettings>);
        let mergedDraft = deepMerge(mergedBase, (publicDraft || {}) as Partial<SiteSettings>);

        // If public endpoints fail entirely, fall back to local draft to avoid data loss.
        if (publicBundleRes.status === 'rejected' && publicDraftRes.status === 'rejected') {
          const local = safeParseDraft(localStorage.getItem(DRAFT_KEY));
          if (local && typeof local === 'object' && local.value) {
            mergedDraft = deepMerge(mergedBase, local.value as Partial<SiteSettings>);
          }
        }

        const parsedBase = SiteSettingsSchema.safeParse(mergedBase);
        const parsedDraft = SiteSettingsSchema.safeParse(mergedDraft);

        setBase(parsedBase.success ? parsedBase.data : DEFAULT_SETTINGS);
        setDraft(parsedDraft.success ? parsedDraft.data : (parsedBase.success ? parsedBase.data : DEFAULT_SETTINGS));
        setStatus('ready');

        // Surface missing APIs as toasts but do not crash.
        const errs: string[] = [];
        if (adminRes.status === 'rejected') errs.push(adminRes.reason?.message || 'Failed to load admin settings');
        if (publicBundleRes.status === 'rejected') errs.push(publicBundleRes.reason?.message || 'Failed to load public site settings');
        if (publicDraftRes.status === 'rejected') errs.push(publicDraftRes.reason?.message || 'Failed to load public site draft');

        const publicBundleReason: any = (
          publicDraftRes.status === 'rejected' ? (publicDraftRes as any).reason :
          publicBundleRes.status === 'rejected' ? (publicBundleRes as any).reason :
          null
        );
        const publicBundleStatus = (() => {
          if (!publicBundleReason) return null;
          const s = Number((publicBundleReason as AdminApiError)?.status);
          return Number.isFinite(s) && s > 0 ? s : null;
        })();
        const publicBundleMessage = publicBundleReason ? String(publicBundleReason?.message || '') : '';
        const backendDown = isBackendUnavailable(publicBundleStatus, publicBundleMessage);

        if (publicBundleStatus === 401) {
          // adminFetch will also dispatch logout for admin routes; keep UX non-crashing.
          toast.error('Session expired');
          setBackendAvailable(false);
          setPublishAvailable(false);
        } else if (publicBundleStatus === 404) {
          setBackendAvailable(false);
          setPublishAvailable(false);
          if (!warnedMissingPublishApi) {
            warnedMissingPublishApi = true;
            toast.error('Public settings API missing in backend');
          }
        } else if (backendDown) {
          setBackendAvailable(false);
          setPublishAvailable(false);
          if (!warnedBackendUnavailable && publicBundleMessage) {
            warnedBackendUnavailable = true;
            toast.error(publicBundleMessage);
          }
        } else {
          setBackendAvailable(true);
          setPublishAvailable(true);
        }

        // Only show one toast to avoid noise on refresh.
        if (errs.length && publicBundleStatus !== 401 && publicBundleStatus !== 404 && !backendDown) toast.error(errs[0]);
      } catch (e: any) {
        if (!mounted) return;
        setBase(DEFAULT_SETTINGS);
        setDraft(DEFAULT_SETTINGS);
        setStatus('error');
        setBackendAvailable(false);
        setError(e?.message || 'Failed to load settings');
        toast.error(e?.message || 'Failed to load settings');
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

  const saveDraft = async (auditAction = 'save-draft') => {
    if (!draft) return;
    setStatus('saving');
    setError(null);
    try {
      const audit = auditAction ? { action: auditAction } : undefined;
      const isPublicSite = auditAction.includes('public-site');

      if (isPublicSite) {
        try {
          await settingsApi.savePublicSiteDraft(draft, audit);
        } catch (e: any) {
          const status = Number((e as AdminApiError)?.status);
          const msg = String(e?.message || '');
          const msgLower = msg.toLowerCase();
          const offline = (!Number.isFinite(status) && !!msg)
            ? (
              msgLower.includes('failed to fetch')
              || msgLower.includes('networkerror')
              || msgLower.includes('econnrefused')
              || msgLower.includes('etimedout')
              || msgLower.includes('timeout')
              || msgLower.includes('dev_proxy_error')
            )
            : (Number.isFinite(status) ? status >= 500 || status === 502 || status === 503 || status === 504 : false);

          if (status === 404 || msgLower.includes('draft api missing') || offline) {
            // Backend not ready: keep UX usable by saving locally and disabling publish.
            // Treat this as a successful save (local fallback), and do NOT put the provider into an error state.
            setBackendAvailable(false);
            setPublishAvailable(false);
            setError(offline ? 'Backend unavailable' : 'Draft API missing in backend');
            saveDraftLocal();
            setStatus('ready');
            return;
          }
          if (status === 401 || msgLower.includes('session expired')) {
            setBackendAvailable(false);
            throw new Error('Session expired');
          }
          throw e;
        }
      }

      // Always keep the local draft as a fallback.
      saveDraftLocal();

      setStatus('ready');
    } catch (e: any) {
      setStatus('error');
      setError(e?.message || 'Save draft failed');
      throw e;
    }
  };

  const publish = async (auditAction = 'publish-settings') => {
    if (!draft) return;
    setStatus('publishing');
    setError(null);
    try {
      const audit = auditAction ? { action: auditAction } : undefined;

      // Public Site publish must hit the real backend publish endpoint:
      // POST /admin/settings/public/publish
      // (Draft is saved first, then publish, then refetch confirms version/updatedAt.)
      const isPublicSitePublish = auditAction.includes('public-site');

      if (isPublicSitePublish) {
        const bundle = await settingsApi.publishPublicSiteSettings(draft, audit);
        const adminLatestRes = await Promise.allSettled([settingsApi.getAdminSettings()]);
        const adminLatest = adminLatestRes[0].status === 'fulfilled' ? adminLatestRes[0].value : (base || DEFAULT_SETTINGS);

        const publishedSubset = (bundle.published || {}) as Partial<SiteSettings>;
        const draftSubset = (bundle.draft || bundle.published || {}) as Partial<SiteSettings>;

        const mergedBase = deepMerge(adminLatest, publishedSubset);
        const mergedDraft = deepMerge(mergedBase, draftSubset);

        const parsedBase = SiteSettingsSchema.safeParse(mergedBase);
        const parsedDraft = SiteSettingsSchema.safeParse(mergedDraft);
        const nextBase = parsedBase.success ? parsedBase.data : DEFAULT_SETTINGS;
        const nextDraft = parsedDraft.success ? parsedDraft.data : nextBase;

        setBase(nextBase);
        setDraft(nextDraft);

        // Only warn about a publish mismatch if the backend confirmed something different.
        // Compare just the public-site subset to avoid noise from unrelated admin fields.
        try {
          const localPublic = SiteSettingsSchema.safeParse(draft).success ? (draft as SiteSettings) : DEFAULT_SETTINGS;
          const publishedPublic = SiteSettingsSchema.safeParse(deepMerge(DEFAULT_SETTINGS, publishedSubset)).success
            ? (deepMerge(DEFAULT_SETTINGS, publishedSubset) as SiteSettings)
            : DEFAULT_SETTINGS;

          const a = JSON.stringify({
            ui: (localPublic as any).ui,
            navigation: (localPublic as any).navigation,
            voice: (localPublic as any).voice,
            homepage: (localPublic as any).homepage,
            tickers: (localPublic as any).tickers,
            liveTv: (localPublic as any).liveTv,
            footer: (localPublic as any).footer,
          });
          const b = JSON.stringify({
            ui: (publishedPublic as any).ui,
            navigation: (publishedPublic as any).navigation,
            voice: (publishedPublic as any).voice,
            homepage: (publishedPublic as any).homepage,
            tickers: (publishedPublic as any).tickers,
            liveTv: (publishedPublic as any).liveTv,
            footer: (publishedPublic as any).footer,
          });

          if (a !== b) toast.error('Published, but backend did not confirm the same settings');
        } catch {
          // ignore comparison errors
        }
      } else {
        const next = await settingsApi.putAdminSettings(draft, audit);
        setBase(next);
        setDraft(next);
      }
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      setStatus('ready');
    } catch (e: any) {
      const status = Number((e as AdminApiError)?.status);
      const msg = String(e?.message || '');
      const msgLower = msg.toLowerCase();
      const offline = (!Number.isFinite(status) && !!msg)
        ? (
          msgLower.includes('failed to fetch')
          || msgLower.includes('networkerror')
          || msgLower.includes('econnrefused')
          || msgLower.includes('etimedout')
          || msgLower.includes('timeout')
          || msgLower.includes('dev_proxy_error')
        )
        : (Number.isFinite(status) ? status >= 500 || status === 502 || status === 503 || status === 504 : false);

      // Expected graceful failures: keep UI usable, but still bubble an error so the caller can toast.
      if (status === 404 || msgLower.includes('publish api missing')) {
        setBackendAvailable(false);
        setPublishAvailable(false);
        setStatus('ready');
        setError('Publish API missing in backend');
        throw new Error('Publish API missing in backend');
      }
      if (status === 401 || msgLower.includes('session expired')) {
        setBackendAvailable(false);
        setPublishAvailable(false);
        setStatus('ready');
        setError('Session expired');
        throw new Error('Session expired');
      }

      if (offline) {
        setBackendAvailable(false);
        setPublishAvailable(false);
        setStatus('ready');
        setError('Backend unavailable');
        throw new Error('Backend unavailable');
      }

      setStatus('error');
      setError(msg || 'Publish failed');
      throw e;
    }
  };

  const value = useMemo<Ctx>(() => {
    return {
      status,
      error,
      backendAvailable,
      base,
      draft,
      dirty,
      publishAvailable,
      patchDraft,
      resetDraft,
      saveDraftLocal,
      saveDraft,
      publish,
    };
  }, [status, error, backendAvailable, base, draft, dirty, publishAvailable]);

  return <SettingsDraftContext.Provider value={value}>{children}</SettingsDraftContext.Provider>;
}

export function useSettingsDraft() {
  // Never crash the page for a missing provider.
  // If a route accidentally bypasses the provider, return safe defaults.
  return useContext(SettingsDraftContext) || SAFE_CTX;
}

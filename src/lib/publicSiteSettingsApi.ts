import { adminJson } from '@/lib/http/adminFetch';
import {
  DEFAULT_PUBLIC_SITE_SETTINGS,
  PublicSiteSettingsSchema,
  type PublicSiteSettings,
  normalizePublicSiteSettings,
  normalizePublicSiteSettingsPatch,
} from '@/types/publicSiteSettings';

function parseAdminPublicSiteSettingsResponse(
  input: unknown,
  opts: { prefer: 'draft' | 'published' } = { prefer: 'draft' }
): PublicSiteSettings {
  let raw: any = input as any;

  if (raw && typeof raw === 'object' && (raw as any).settings) raw = (raw as any).settings;

  if (raw && typeof raw === 'object') {
    const anyRaw: any = raw as any;
    const preferredValue =
      opts.prefer === 'published'
        ? (anyRaw.published ?? anyRaw.draft)
        : (anyRaw.draft ?? anyRaw.published);
    if (preferredValue && typeof preferredValue === 'object') {
      raw = preferredValue;
    } else if (anyRaw.status === 'published' && anyRaw.published && typeof anyRaw.published === 'object') {
      raw = anyRaw.published;
    } else if (anyRaw.status === 'draft' && anyRaw.draft && typeof anyRaw.draft === 'object') {
      raw = anyRaw.draft;
    }
  }

  const parsed = PublicSiteSettingsSchema.safeParse(raw ?? {});
  if (parsed.success) return mergeDefaults(normalizePublicSiteSettings(parsed.data));
  return DEFAULT_PUBLIC_SITE_SETTINGS;
}

function mergeDefaults(value: PublicSiteSettings): PublicSiteSettings {
  // Ensure we keep unknown keys (schema is passthrough), but also keep a stable baseline.
  // Section-wise merge: defaults first, then value.
  return {
    ...DEFAULT_PUBLIC_SITE_SETTINGS,
    ...value,
    homepage: {
      ...DEFAULT_PUBLIC_SITE_SETTINGS.homepage,
      ...(value.homepage || {}),
      modules: {
        ...DEFAULT_PUBLIC_SITE_SETTINGS.homepage.modules,
        ...(value.homepage?.modules || {}),
      },
    },
    tickers: {
      ...DEFAULT_PUBLIC_SITE_SETTINGS.tickers,
      ...(value.tickers || {}),
      breaking: {
        ...DEFAULT_PUBLIC_SITE_SETTINGS.tickers.breaking,
        ...(value.tickers?.breaking || {}),
      },
      live: {
        ...DEFAULT_PUBLIC_SITE_SETTINGS.tickers.live,
        ...(value.tickers?.live || {}),
      },
    },
    liveTv: {
      ...DEFAULT_PUBLIC_SITE_SETTINGS.liveTv,
      ...(value.liveTv || {}),
    },
    languageTheme: {
      ...DEFAULT_PUBLIC_SITE_SETTINGS.languageTheme,
      ...(value.languageTheme || {}),
    },
  };
}

let inFlightBundle: Promise<{
  draft: PublicSiteSettings;
  published: PublicSiteSettings;
  meta: { version?: number; updatedAt?: string; draftVersion?: number; draftUpdatedAt?: string };
}> | null = null;

async function getAdminPublicSiteSettingsBundle(): Promise<{
  draft: PublicSiteSettings;
  published: PublicSiteSettings;
  meta: { version?: number; updatedAt?: string; draftVersion?: number; draftUpdatedAt?: string };
}> {
  if (inFlightBundle) return inFlightBundle;

  inFlightBundle = (async () => {
    const raw = await adminJson<any>('/admin/settings/public', { cache: 'no-store' });
    const envelope = (raw && typeof raw === 'object' && (raw as any).settings) ? (raw as any).settings : raw;

    const draft = parseAdminPublicSiteSettingsResponse(envelope, { prefer: 'draft' });
    const published = parseAdminPublicSiteSettingsResponse(envelope, { prefer: 'published' });

    const meta = {
      version: typeof (envelope as any)?.version === 'number' ? (envelope as any).version : undefined,
      updatedAt: typeof (envelope as any)?.updatedAt === 'string' ? (envelope as any).updatedAt : undefined,
      draftVersion: typeof (envelope as any)?.draftVersion === 'number' ? (envelope as any).draftVersion : undefined,
      draftUpdatedAt: typeof (envelope as any)?.draftUpdatedAt === 'string' ? (envelope as any).draftUpdatedAt : undefined,
    };

    return { draft, published, meta };
  })().finally(() => {
    inFlightBundle = null;
  });

  return inFlightBundle;
}

async function putAdminPublicSiteSettingsDraft(
  patch: Partial<PublicSiteSettings>,
  audit?: { action?: string }
): Promise<PublicSiteSettings> {
  const raw = await adminJson<any>('/admin/settings/public', {
    method: 'PUT',
    headers: {
      ...(audit?.action ? { 'X-Admin-Action': audit.action } : {}),
    },
    json: normalizePublicSiteSettingsPatch(patch || {}),
  });

  return parseAdminPublicSiteSettingsResponse(raw, { prefer: 'draft' });
}

async function publishAdminPublicSiteSettings(
  settings?: Partial<PublicSiteSettings>,
  audit?: { action?: string }
): Promise<PublicSiteSettings> {
  const raw = await adminJson<any>('/admin/settings/public/publish', {
    method: 'POST',
    headers: {
      ...(audit?.action ? { 'X-Admin-Action': audit.action } : {}),
    },
    json: settings ? normalizePublicSiteSettingsPatch(settings) : undefined,
  });

  return parseAdminPublicSiteSettingsResponse(raw, { prefer: 'published' });
}

export const publicSiteSettingsApi = {
  getAdminPublicSiteSettingsBundle,
  putAdminPublicSiteSettingsDraft,
  publishAdminPublicSiteSettings,
};

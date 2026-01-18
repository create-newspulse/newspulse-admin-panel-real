import { adminJson } from '@/lib/http/adminFetch';

export type TranslationHealth = {
  googleKeyConfigured?: boolean;
  safeMode?: boolean;
  cacheEnabled?: boolean;
  raw?: unknown;
};

function toBool(input: unknown): boolean | undefined {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'number') return input !== 0;
  if (typeof input === 'string') {
    const v = input.trim().toLowerCase();
    if (!v) return undefined;
    if (['true', 'yes', 'y', 'on', 'enabled', 'ok', 'configured'].includes(v)) return true;
    if (['false', 'no', 'n', 'off', 'disabled', 'missing', 'unconfigured'].includes(v)) return false;
  }
  if (input && typeof input === 'object') {
    const anyInput: any = input as any;
    if (typeof anyInput.enabled === 'boolean') return anyInput.enabled;
    if (typeof anyInput.on === 'boolean') return anyInput.on;
    if (typeof anyInput.configured === 'boolean') return anyInput.configured;
    if (typeof anyInput.ok === 'boolean') return anyInput.ok;
    if (typeof anyInput.present === 'boolean') return anyInput.present;
    if (typeof anyInput.value === 'boolean') return anyInput.value;
    if (typeof anyInput.status === 'string') return toBool(anyInput.status);
  }
  return undefined;
}

function pickBool(obj: unknown, keys: string[]): boolean | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const anyObj: any = obj as any;
  for (const k of keys) {
    if (k in anyObj) {
      const v = toBool(anyObj[k]);
      if (typeof v === 'boolean') return v;
    }
  }
  return undefined;
}

export async function getTranslationHealth(): Promise<TranslationHealth> {
  const raw = await adminJson<any>('/admin-api/public/translation/health', { cache: 'no-store' });

  // Accept common wrappers like { ok, health: {...} } or { data: {...} }
  const root = (raw && typeof raw === 'object' && ((raw as any).health || (raw as any).data))
    ? ((raw as any).health ?? (raw as any).data)
    : raw;

  const googleKeyConfigured = pickBool(root, [
    'googleKeyConfigured',
    'google_key_configured',
    'googleConfigured',
    'google_configured',
    'hasGoogleKey',
    'has_google_key',
    'googleKeyPresent',
    'google_key_present',
  ]);

  const safeMode = pickBool(root, [
    'safeMode',
    'safe_mode',
    'safeModeEnabled',
    'safe_mode_enabled',
    'safeModeOn',
    'safe_mode_on',
  ]);

  // Cache can be a boolean or an object (e.g. { enabled:true })
  const cacheEnabled = (
    pickBool(root, ['cacheEnabled', 'cache_enabled', 'cacheOn', 'cache_on']) ??
    pickBool((root as any)?.cache, ['enabled', 'on', 'configured', 'ok', 'present', 'value', 'status'])
  );

  return {
    googleKeyConfigured,
    safeMode,
    cacheEnabled,
    raw,
  };
}

const translationHealthApi = {
  getTranslationHealth,
};

export default translationHealthApi;

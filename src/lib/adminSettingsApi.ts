import { SiteSettingsSchema, type SiteSettings, DEFAULT_SETTINGS } from "@/types/siteSettings";
import { adminJson, adminFetch } from "@/lib/adminApiClient";

function isProxyMode(): boolean {
  try {
    const raw = ((import.meta as any)?.env?.VITE_API_URL || '').toString().trim();
    return raw.startsWith('/');
  } catch {
    return false;
  }
}

async function json<T>(res: Response): Promise<T> {
  if (res.status === 204) return {} as any;

  if (!res.ok) {
    // Missing endpoint / unauthorized -> let UI fallback to defaults
    if (res.status === 404 || res.status === 401) return {} as any;
    throw new Error(`HTTP ${res.status}`);
  }

  const text = await res.text();
  if (!text) return {} as any;

  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as any;
  }
}

let LOGGED_RAW_ONCE = false;

export async function getSettings(): Promise<SiteSettings> {
  try {
    // Admin base is resolved by adminFetch; do not include '/api/admin' here.
    let raw = await adminJson<unknown>("/settings", { cache: "no-store" });
    if (!raw) {
      if (import.meta.env.DEV) console.warn("[adminSettingsApi] /api/admin/settings empty; falling back to api/admin/settings/load");
      raw = await adminJson<unknown>("/settings/load", { cache: "no-store" });
    }
    if (raw && typeof raw === 'object' && (raw as any).settings) {
      raw = (raw as any).settings;
    }
    if (!LOGGED_RAW_ONCE) {
      console.log("RAW SETTINGS", raw);
      LOGGED_RAW_ONCE = true;
    }

    const parsed = SiteSettingsSchema.safeParse(raw ?? {});
    return parsed.success ? parsed.data : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function putSettings(
  patch: Partial<SiteSettings>,
  audit?: { action?: string }
): Promise<SiteSettings> {
  let raw: unknown;
  try {
    raw = await adminJson<unknown>("/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        // Only attach audit header in proxy/same-origin mode.
        // In direct mode (browser -> Render), this header often fails CORS preflight unless backend allows it.
        ...(audit?.action && isProxyMode() ? { "X-Admin-Action": audit.action } : {}),
      },
      body: JSON.stringify(patch || {}),
    });
  } catch {
    // If PUT route missing, attempt to GET fallback so UI doesn't break entirely.
    if (import.meta.env.DEV) console.warn("[adminSettingsApi] PUT /api/admin/settings failed; refetching via api/admin/settings/load fallback");
    raw = await adminJson<unknown>("/settings/load", { cache: "no-store" });
  }
  if (raw && typeof raw === 'object' && (raw as any).settings) {
    raw = (raw as any).settings;
  }
  if (!LOGGED_RAW_ONCE) {
    console.log("RAW SETTINGS", raw);
    LOGGED_RAW_ONCE = true;
  }

  const parsed = SiteSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export function exportSettingsBlob(): Promise<Blob> {
  // Export settings; if export route missing, fall back to /settings/load and stringify
  return adminFetch("/settings/export").then(async (r) => {
    if (r.ok) return r.blob();
    if (r.status === 404) {
      const alt = await adminFetch("/settings/load");
      const text = await alt.text();
      return new Blob([text || "{}"], { type: "application/json" });
    }
    throw new Error(`HTTP ${r.status}`);
  });
}

export const adminSettingsApi = { getSettings, putSettings, exportSettingsBlob };

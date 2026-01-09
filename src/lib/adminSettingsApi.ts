import type { SiteSettings } from "@/types/siteSettings";
import settingsApi from "@/lib/settingsApi";
import { adminFetch } from "@/lib/adminApiClient";

export async function getSettings(): Promise<SiteSettings> {
  return settingsApi.getAdminSettings();
}

export async function putSettings(
  patch: Partial<SiteSettings>,
  audit?: { action?: string }
): Promise<SiteSettings> {
  return settingsApi.putAdminSettings(patch, audit);
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

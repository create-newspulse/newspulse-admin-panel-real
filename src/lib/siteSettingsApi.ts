type AdminSettingsPayload = {
  showExploreCategories: boolean;
  showCategoryStrip: boolean;
  showTrendingStrip: boolean;
  showLiveUpdatesTicker: boolean;
  showBreakingTicker: boolean;
  showQuickTools: boolean;
  showAppPromo: boolean;
  showFooter: boolean;
};

import { apiUrl } from './api';

const SETTINGS_PATH = '/api/site-settings/admin';

export async function getAdminSettings(): Promise<AdminSettingsPayload | null> {
  const res = await fetch(apiUrl(SETTINGS_PATH), { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load settings (${res.status})`);
  return res.json();
}

export async function saveAdminSettings(payload: AdminSettingsPayload): Promise<boolean> {
  const res = await fetch(apiUrl(SETTINGS_PATH), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to save settings (${res.status})`);
  return true;
}

export const siteSettingsApi = { getAdminSettings, saveAdminSettings };

export type { AdminSettingsPayload };

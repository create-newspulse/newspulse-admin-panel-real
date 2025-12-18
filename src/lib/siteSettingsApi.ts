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

const base = (import.meta as any).env?.VITE_API_URL as string | undefined;

function buildUrl(path: string) {
  if (!base) return null;
  const trimmed = base.replace(/\/$/, '');
  return `${trimmed}${path}`;
}

export async function getAdminSettings(): Promise<AdminSettingsPayload | null> {
  const url = buildUrl('/api/site-settings/admin');
  if (!url) return null;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(`Failed to load settings (${res.status})`);
  return res.json();
}

export async function saveAdminSettings(payload: AdminSettingsPayload): Promise<boolean> {
  const url = buildUrl('/api/site-settings/admin');
  if (!url) return false;
  const res = await fetch(url, {
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

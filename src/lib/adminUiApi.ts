import { mockAlerts, mockStats } from '@/lib/mock';

export async function getStats() {
  // Try real endpoint, fallback to mock
  try {
    const r = await fetch('/api/stats', { credentials: 'include' });
    if (r.ok) return r.json();
  } catch {}
  const s = mockStats();
  return { totals: { news: s.totalArticles, categories: 0, languages: 3, users: 4 }, aiLogs: 0, mock: true, s };
}

export async function getSystemAlerts() {
  try {
    const r = await fetch('/api/system/alerts', { credentials: 'include' });
    if (r.ok) return r.json();
  } catch {}
  return { success: true, alerts: mockAlerts(), mock: true };
}

export async function getAudit() {
  try {
    const r = await fetch('/api/audit', { credentials: 'include' });
    if (r.ok) return r.json();
  } catch {}
  return { success: true, entries: [] };
}

export async function founderToggle(_key: string, _value: boolean) {
  // Placeholder to be wired to real endpoints later
  return { success: true };
}

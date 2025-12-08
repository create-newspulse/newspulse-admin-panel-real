import { api } from './client';

export interface CommunityReporterSettings {
  myStoriesEnabled: boolean;
}

export async function getCommunityReporterSettings(): Promise<CommunityReporterSettings> {
  const { data } = await api.get('/api/admin/settings/community-reporter');
  const payload = data?.settings ?? data;
  return { myStoriesEnabled: !!payload?.myStoriesEnabled };
}

export async function updateCommunityReporterSettings(payload: CommunityReporterSettings): Promise<CommunityReporterSettings> {
  const { data } = await api.put('/api/admin/settings/community-reporter', payload);
  const next = data?.settings ?? data;
  return { myStoriesEnabled: !!next?.myStoriesEnabled };
}

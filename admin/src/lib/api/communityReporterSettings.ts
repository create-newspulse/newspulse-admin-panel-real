import { api } from './client';

export interface CommunityReporterSettings {
  myCommunityStoriesEnabled: boolean;
}

interface CommunityReporterResponse {
  success: boolean;
  settings: CommunityReporterSettings;
}

export async function getCommunityReporterSettings(): Promise<CommunityReporterSettings> {
  const res = await api.get('/api/admin/settings/community-reporter');
  const data = res.data as CommunityReporterResponse;
  return data.settings;
}

export async function updateCommunityReporterSettings(
  payload: CommunityReporterSettings,
): Promise<CommunityReporterSettings> {
  const res = await api.post('/api/admin/settings/community-reporter', payload);
  const data = res.data as CommunityReporterResponse;
  return data.settings;
}

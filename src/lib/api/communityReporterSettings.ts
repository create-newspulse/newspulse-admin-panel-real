import { adminApi } from '@/lib/adminApi';

export interface CommunityReporterSettings {
  myStoriesEnabled: boolean;
}

export async function getCommunityReporterSettings(): Promise<CommunityReporterSettings> {
  const res = await adminApi.get('/api/admin/settings/community-reporter');
  return res.data as CommunityReporterSettings;
}

export async function updateCommunityReporterSettings(
  payload: CommunityReporterSettings,
): Promise<CommunityReporterSettings> {
  const res = await adminApi.put('/api/admin/settings/community-reporter', payload);
  return res.data as CommunityReporterSettings;
}

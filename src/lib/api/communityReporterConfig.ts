import { adminApi } from '@/lib/adminApi';

export interface CommunityReporterConfig {
  communityMyStoriesEnabled: boolean;
  [key: string]: unknown;
}

export async function getCommunityReporterConfig(): Promise<CommunityReporterConfig> {
  const { data } = await adminApi.get<CommunityReporterConfig>('/api/admin/community-reporter/config');
  return data;
}

export async function updateCommunityReporterConfig(partial: Partial<CommunityReporterConfig>): Promise<CommunityReporterConfig> {
  const { data } = await adminApi.put<CommunityReporterConfig>('/api/admin/community-reporter/config', partial);
  return data;
}

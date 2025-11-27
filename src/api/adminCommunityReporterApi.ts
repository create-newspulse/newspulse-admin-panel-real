import { adminApi } from './adminApi';

export async function fetchCommunityReporterSubmissions() {
  const res = await adminApi.get('/admin/community-reporter/submissions');
  return res.data;
}

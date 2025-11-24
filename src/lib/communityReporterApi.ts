import { adminApi } from './adminApi';

export async function getCommunitySubmission(id: string) {
  return adminApi.get(`/api/admin/community/submissions/${id}`);
}

export async function decideCommunitySubmission(
  id: string,
  decision: 'APPROVED' | 'REJECTED'
) {
  return adminApi.post(`/api/admin/community/submissions/${id}/decision`, {
    decision,
  });
}

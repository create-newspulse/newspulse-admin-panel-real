import { adminApi } from '@/lib/adminApi';

function normalizeActionResult(data: any): { ok: boolean; message?: string } {
  if (!data || typeof data !== 'object') return { ok: true };
  const ok = data.ok === true || data.success === true || data.status === 'ok';
  if (data.ok === false || data.success === false) {
    return { ok: false, message: data.message || data.error || data.details };
  }
  // If the backend uses ok/success flags, honor them. Otherwise treat 2xx as success.
  return { ok: ok || (data.ok == null && data.success == null), message: data.message };
}

function readableActionError(err: any, fallback: string): string {
  const status = err?.response?.status;
  const data = err?.response?.data;
  const msg =
    (data && (data.message || data.error || data.details))
    || err?.message
    || fallback;

  if (status === 401) return 'Unauthorized. Please log in again.';
  if (status === 403) return 'Forbidden. You do not have permission to do that.';
  if (status === 404) return 'Not found. This record may have already been deleted.';
  if (typeof status === 'number' && status >= 500) return msg || 'Server error. Please try again.';
  return msg || fallback;
}

function requireId(id: string) {
  const clean = String(id || '').trim();
  if (!clean) throw new Error('Missing record id');
  return clean;
}

// Community Story Desk actions (record-level only)
// Canonical backend routes (single route per action; no guessing/fallback):
// - POST /api/admin/community-reporter/submissions/:id/decision { decision: 'reject' }
// - POST /api/admin/community-reporter/submissions/:id/restore
// - POST /api/admin/community-reporter/submissions/:id/hard-delete
//
// Note: `adminApi` automatically prefixes these under `/admin/*`.

export async function moveCommunityStoryRecordToDeleted(id: string) {
  const safeId = encodeURIComponent(requireId(id));
  try {
    const res = await adminApi.post(`/community-reporter/submissions/${safeId}/decision`, { decision: 'reject' });
    const normalized = normalizeActionResult(res?.data);
    if (!normalized.ok) throw new Error(normalized.message || 'Move to Deleted failed');
    return res?.data;
  } catch (e: any) {
    throw new Error(readableActionError(e, 'Failed to move record to Deleted'));
  }
}

export async function restoreCommunityStoryRecord(id: string) {
  const safeId = encodeURIComponent(requireId(id));
  try {
    const res = await adminApi.post(`/community-reporter/submissions/${safeId}/restore`);
    const normalized = normalizeActionResult(res?.data);
    if (!normalized.ok) throw new Error(normalized.message || 'Restore failed');
    return res?.data;
  } catch (e: any) {
    throw new Error(readableActionError(e, 'Failed to restore record'));
  }
}

export async function permanentlyDeleteCommunityStoryRecord(id: string) {
  const safeId = encodeURIComponent(requireId(id));
  try {
    const res = await adminApi.post(`/community-reporter/submissions/${safeId}/hard-delete`);
    const normalized = normalizeActionResult(res?.data);
    if (!normalized.ok) throw new Error(normalized.message || 'Permanent delete failed');
    return res?.data;
  } catch (e: any) {
    throw new Error(readableActionError(e, 'Failed to delete record permanently'));
  }
}

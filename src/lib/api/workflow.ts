import apiClient from '@/lib/api';

function isNotFoundError(e: any): boolean {
  const status = e?.response?.status ?? e?.status;
  return status === 404;
}

export type WorkflowStageKey =
  | 'Draft'
  | 'CopyEdit'
  | 'LegalReview'
  | 'EditorApproval'
  | 'FounderApproval'
  | 'Scheduled';

export interface WorkflowState {
  articleId: string;
  stage: WorkflowStageKey;
  stageUpdatedAt: string | null;
  locked: boolean;
}

export interface WorkflowActor {
  id?: string;
  email?: string;
  name?: string;
  role?: string;
}

export interface WorkflowEvent {
  id: string;
  articleId: string;
  action: string;
  fromStage?: WorkflowStageKey | null;
  toStage?: WorkflowStageKey | null;
  actor?: WorkflowActor | null;
  at: string;
}

export interface InternalComment {
  id: string;
  articleId: string;
  message: string;
  actor?: WorkflowActor | null;
  at: string;
}

export interface PushEvent {
  id: string;
  articleId: string;
  title?: string;
  channel: string;
  status: string;
  at: string;
  actor?: WorkflowActor | null;
}

function normalizeStage(stage: any): WorkflowStageKey {
  const s = String(stage || '').trim();
  const m: Record<string, WorkflowStageKey> = {
    draft: 'Draft',
    Draft: 'Draft',
    copyedit: 'CopyEdit',
    copy_edit: 'CopyEdit',
    'copy-edit': 'CopyEdit',
    CopyEdit: 'CopyEdit',
    legal: 'LegalReview',
    legal_review: 'LegalReview',
    'legal-review': 'LegalReview',
    LegalReview: 'LegalReview',
    editor: 'EditorApproval',
    editor_approval: 'EditorApproval',
    'editor-approval': 'EditorApproval',
    EditorApproval: 'EditorApproval',
    founder: 'FounderApproval',
    founder_approval: 'FounderApproval',
    'founder-approval': 'FounderApproval',
    FounderApproval: 'FounderApproval',
    scheduled: 'Scheduled',
    Scheduled: 'Scheduled',
  };
  return m[s] || 'Draft';
}

export function mapArticleToStage(input: { status?: string; workflowStage?: any; scheduledAt?: any }): WorkflowStageKey {
  const explicit = input.workflowStage;
  if (explicit) return normalizeStage(explicit);
  const status = String(input.status || '').toLowerCase();
  if (status === 'scheduled') return 'Scheduled';
  return 'Draft';
}

export async function getWorkflowState(articleId: string): Promise<WorkflowState> {
  const res = await apiClient.get(`/admin/workflow/articles/${encodeURIComponent(articleId)}`);
  const raw = (res as any)?.data ?? res;
  const data = raw?.data || raw?.state || raw;
  return {
    articleId: String(data?.articleId || articleId),
    stage: normalizeStage(data?.stage),
    stageUpdatedAt: data?.stageUpdatedAt ? String(data.stageUpdatedAt) : null,
    locked: !!data?.locked,
  };
}

export async function setWorkflowStage(articleId: string, stage: WorkflowStageKey): Promise<WorkflowState> {
  const res = await apiClient.patch(`/admin/workflow/articles/${encodeURIComponent(articleId)}/stage`, { stage });
  const raw = (res as any)?.data ?? res;
  const data = raw?.data || raw?.state || raw;
  return {
    articleId: String(data?.articleId || articleId),
    stage: normalizeStage(data?.stage || stage),
    stageUpdatedAt: data?.stageUpdatedAt ? String(data.stageUpdatedAt) : new Date().toISOString(),
    locked: !!data?.locked,
  };
}

export async function setWorkflowLocked(articleId: string, locked: boolean): Promise<WorkflowState> {
  const res = await apiClient.post(`/admin/workflow/articles/${encodeURIComponent(articleId)}/lock`, { locked });
  const raw = (res as any)?.data ?? res;
  const data = raw?.data || raw?.state || raw;
  return {
    articleId: String(data?.articleId || articleId),
    stage: normalizeStage(data?.stage),
    stageUpdatedAt: data?.stageUpdatedAt ? String(data.stageUpdatedAt) : null,
    locked: !!data?.locked,
  };
}

export async function listWorkflowEvents(articleId: string, limit = 100): Promise<WorkflowEvent[]> {
  const res = await apiClient.get(`/admin/workflow/articles/${encodeURIComponent(articleId)}/events`, { params: { limit } });
  const raw = (res as any)?.data ?? res;
  const items = raw?.data || raw?.items || raw?.events || [];
  return (Array.isArray(items) ? items : []).map((e: any) => ({
    id: String(e?.id || e?._id || ''),
    articleId: String(e?.articleId || articleId),
    action: String(e?.action || ''),
    fromStage: e?.fromStage ? normalizeStage(e.fromStage) : null,
    toStage: e?.toStage ? normalizeStage(e.toStage) : null,
    actor: e?.actor ? (e.actor as any) : null,
    at: String(e?.at || e?.createdAt || e?.timestamp || new Date().toISOString()),
  })).filter((e: WorkflowEvent) => e.id);
}

export async function listInternalComments(articleId: string, limit = 200): Promise<InternalComment[]> {
  const res = await apiClient.get(`/admin/workflow/articles/${encodeURIComponent(articleId)}/comments`, { params: { limit } });
  const raw = (res as any)?.data ?? res;
  const items = raw?.data || raw?.items || raw?.comments || [];
  return (Array.isArray(items) ? items : []).map((c: any) => ({
    id: String(c?.id || c?._id || ''),
    articleId: String(c?.articleId || articleId),
    message: String(c?.message || ''),
    actor: c?.actor ? (c.actor as any) : null,
    at: String(c?.at || c?.createdAt || c?.timestamp || new Date().toISOString()),
  })).filter((c: InternalComment) => c.id);
}

export async function addInternalComment(articleId: string, message: string): Promise<InternalComment> {
  const res = await apiClient.post(`/admin/workflow/articles/${encodeURIComponent(articleId)}/comments`, { message });
  const raw = (res as any)?.data ?? res;
  const c = raw?.data || raw?.comment || raw;
  return {
    id: String(c?.id || c?._id || ''),
    articleId: String(c?.articleId || articleId),
    message: String(c?.message || message),
    actor: c?.actor ? (c.actor as any) : null,
    at: String(c?.at || c?.createdAt || new Date().toISOString()),
  };
}

export async function publishFromWorkflow(articleId: string, channel: string): Promise<{ ok: boolean } & Record<string, any>> {
  const res = await apiClient.post(`/admin/workflow/articles/${encodeURIComponent(articleId)}/publish`, { channel });
  return (res as any)?.data ?? res;
}

export async function listPushHistory(params: {
  q?: string;
  channel?: string;
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{ rows: PushEvent[]; total: number; page: number; limit: number; _missing?: boolean }>{
  let res: any;
  try {
    // Prefer the non-admin endpoint (most backends expose /api/push-history).
    res = await apiClient.get('/push-history', { params });
  } catch (e: any) {
    if (!isNotFoundError(e)) throw e;
    // Fallback for older backends.
    try {
      res = await apiClient.get('/admin/push-history', { params });
    } catch (e2: any) {
      if (!isNotFoundError(e2)) throw e2;
      return { rows: [], total: 0, page: params.page ?? 1, limit: params.limit ?? 50, _missing: true };
    }
  }
  const raw = (res as any)?.data ?? res;
  const data = raw?.data || raw;
  const items0 = data?.items || data?.data || data?.rows || [];
  const total = typeof data?.total === 'number' ? data.total : (Array.isArray(items0) ? items0.length : 0);
  const page = typeof data?.page === 'number' ? data.page : (typeof params.page === 'number' ? params.page : 1);
  const limit = typeof data?.limit === 'number' ? data.limit : (typeof params.limit === 'number' ? params.limit : (Array.isArray(items0) ? items0.length : 50));
  const items: PushEvent[] = (Array.isArray(items0) ? items0 : []).map((p: any) => ({
    id: String(p?.id || p?._id || ''),
    articleId: String(p?.articleId || ''),
    title: p?.title ? String(p.title) : undefined,
    channel: String(p?.channel || ''),
    status: String(p?.status || ''),
    at: String(p?.at || p?.createdAt || p?.timestamp || new Date().toISOString()),
    actor: p?.actor ? (p.actor as any) : null,
  })).filter((p: PushEvent) => p.id);
  return { rows: items, total, page, limit };
}

export async function deleteAllPushHistory(): Promise<void> {
  try {
    await apiClient.delete('/push-history');
  } catch (e: any) {
    if (!isNotFoundError(e)) throw e;
    await apiClient.delete('/admin/push-history');
  }
}

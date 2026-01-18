import { adminJson } from '@/lib/http/adminFetch';

export type TranslationJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'READY'
  | 'REVIEW_REQUIRED'
  | 'BLOCKED'
  | 'APPROVED'
  | 'REJECTED'
  | string;

export type TranslationReason = {
  code?: string;
  message?: string;
  detail?: string;
  severity?: 'low' | 'medium' | 'high' | string;
};

export type TranslationJob = {
  id?: string;
  _id?: string;
  entityType?: string;
  entityId?: string;
  headline?: string;
  snippet?: string;
  sourceLang?: string;
  targetLang?: string;
  status?: TranslationJobStatus;
  qualityScore?: number;
  engineUsed?: string;
  reasons?: TranslationReason[];
  statusByLang?: Record<string, string>;
  sourceText?: string;
  generatedText?: string;
  createdAt?: string;
  updatedAt?: string;
};

function normalizeReason(raw: any): TranslationReason {
  return {
    code: raw?.code ? String(raw.code) : undefined,
    message: raw?.message ? String(raw.message) : (raw?.reason ? String(raw.reason) : undefined),
    detail: raw?.detail ? String(raw.detail) : undefined,
    severity: raw?.severity ? String(raw.severity) : undefined,
  };
}

function normalizeJob(raw: any): TranslationJob {
  const id = raw?.id ?? raw?._id;
  const _id = raw?._id ?? raw?.id;

  const reasonsRaw = Array.isArray(raw?.reasons)
    ? raw.reasons
    : (Array.isArray(raw?.checks) ? raw.checks : (Array.isArray(raw?.errors) ? raw.errors : []));

  const sourceText = typeof raw?.sourceText === 'string'
    ? raw.sourceText
    : (typeof raw?.source === 'string' ? raw.source : (typeof raw?.text === 'string' ? raw.text : undefined));

  const generatedText = typeof raw?.generatedText === 'string'
    ? raw.generatedText
    : (typeof raw?.translation === 'string' ? raw.translation : (typeof raw?.translatedText === 'string' ? raw.translatedText : undefined));

  return {
    ...raw,
    id: id ? String(id) : undefined,
    _id: _id ? String(_id) : undefined,
    entityType: raw?.entityType ? String(raw.entityType) : (raw?.type ? String(raw.type) : undefined),
    entityId: raw?.entityId ? String(raw.entityId) : (raw?.entityID ? String(raw.entityID) : (raw?.itemId ? String(raw.itemId) : undefined)),
    headline: typeof raw?.headline === 'string' ? raw.headline : (typeof raw?.title === 'string' ? raw.title : undefined),
    snippet: typeof raw?.snippet === 'string' ? raw.snippet : (typeof raw?.summary === 'string' ? raw.summary : undefined),
    sourceLang: raw?.sourceLang ? String(raw.sourceLang) : (raw?.fromLang ? String(raw.fromLang) : undefined),
    targetLang: raw?.targetLang ? String(raw.targetLang) : (raw?.toLang ? String(raw.toLang) : undefined),
    status: raw?.status ? String(raw.status) : undefined,
    qualityScore: typeof raw?.qualityScore === 'number' ? raw.qualityScore : (typeof raw?.score === 'number' ? raw.score : undefined),
    engineUsed: raw?.engineUsed ? String(raw.engineUsed) : (raw?.engine ? String(raw.engine) : undefined),
    reasons: (reasonsRaw || []).map(normalizeReason),
    sourceText,
    generatedText,
    createdAt: typeof raw?.createdAt === 'string' ? raw.createdAt : undefined,
    updatedAt: typeof raw?.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

function normalizeList(raw: any): TranslationJob[] {
  const arr = Array.isArray(raw)
    ? raw
    : (Array.isArray(raw?.items) ? raw.items
    : (Array.isArray(raw?.data) ? raw.data
    : (Array.isArray(raw?.data?.items) ? raw.data.items : [])));
  return (arr || []).map(normalizeJob);
}

function jobId(j: TranslationJob): string {
  const id = j.id ?? j._id;
  return String(id || '').trim();
}

export async function listTranslationJobs(opts?: {
  status?: TranslationJobStatus;
  lang?: string;
  entityType?: string;
  q?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<TranslationJob[]> {
  const qs = new URLSearchParams();
  const status = String(opts?.status || '').trim();
  const lang = String(opts?.lang || '').trim();
  const entityType = String(opts?.entityType || '').trim();
  const q = String(opts?.q || '').trim();
  const limit = typeof opts?.limit === 'number' ? opts?.limit : undefined;

  if (status) qs.set('status', status);
  if (lang) qs.set('lang', lang);
  if (entityType) qs.set('entityType', entityType);
  if (q) qs.set('q', q);
  if (limit && Number.isFinite(limit)) qs.set('limit', String(limit));

  const url = qs.toString()
    ? `/admin/translation/jobs?${qs.toString()}`
    : '/admin/translation/jobs';

  const raw = await adminJson<any>(url, { method: 'GET', signal: opts?.signal, cache: 'no-store' } as any);
  return normalizeList(raw);
}

export async function getTranslationJob(id: string, opts?: { signal?: AbortSignal }): Promise<TranslationJob> {
  const safe = encodeURIComponent(String(id || '').trim());
  const raw = await adminJson<any>(`/admin/translation/jobs/${safe}`, { method: 'GET', signal: opts?.signal, cache: 'no-store' } as any);
  return normalizeJob(raw?.item ?? raw?.data ?? raw);
}

export async function retryTranslationJob(id: string): Promise<any> {
  const safe = encodeURIComponent(String(id || '').trim());
  return adminJson<any>(`/admin/translation/jobs/${safe}/retry`, { method: 'POST' });
}

export async function approveTranslationJob(id: string, payload?: { notes?: string }): Promise<any> {
  const safe = encodeURIComponent(String(id || '').trim());
  return adminJson<any>(`/admin/translation/jobs/${safe}/approve`, { method: 'POST', json: payload || undefined });
}

export async function rejectTranslationJob(id: string, payload?: { notes?: string; reason?: string }): Promise<any> {
  const safe = encodeURIComponent(String(id || '').trim());
  return adminJson<any>(`/admin/translation/jobs/${safe}/reject`, { method: 'POST', json: payload || undefined });
}

export type TranslationOverridePayload = {
  jobId?: string;
  entityType?: string;
  entityId?: string;
  sourceLang?: string;
  targetLang: string;
  beforeText?: string;
  overrideText: string;
  notes?: string;
};

export async function approveTranslationOverride(payload: TranslationOverridePayload): Promise<any> {
  return adminJson<any>('/admin/translation/override', { method: 'POST', json: payload });
}

export function translationJobKey(j: TranslationJob): string {
  return jobId(j) || `${j.entityType || 'entity'}:${j.entityId || 'unknown'}:${j.targetLang || ''}`;
}

export function topReasonChips(j: TranslationJob, max = 3): string[] {
  const reasons = Array.isArray(j.reasons) ? j.reasons : [];
  const chips: string[] = [];
  for (const r of reasons) {
    const s = String(r.code || r.message || '').trim();
    if (!s) continue;
    chips.push(s);
    if (chips.length >= max) break;
  }
  return chips;
}

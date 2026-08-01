import { adminApiClient } from '@/lib/adminApiClient';

export type SeoAuditStatus = 'queued' | 'running' | 'completed' | 'failed' | 'unknown';
export type SeoIssueSeverity = 'critical' | 'warning' | 'passed' | 'info';
export type SeoAuditMode = 'quick' | 'full';

export type SeoPerformanceScore = {
  score: number | null;
  status: 'measured' | 'not_configured' | 'unavailable' | 'failed' | 'unknown';
  message?: string;
};

export type SeoAuditIssue = {
  id: string;
  severity: SeoIssueSeverity;
  category: string;
  pageUrl: string;
  title: string;
  explanation: string;
  currentValue: string;
  recommendedAction: string;
  checkCode: string;
};

export type SeoAudit = {
  id: string;
  status: SeoAuditStatus;
  score: number | null;
  pagesChecked: number | null;
  totalPages: number | null;
  criticalIssues: number | null;
  warnings: number | null;
  passedChecks: number | null;
  desktopPerformance: SeoPerformanceScore;
  mobilePerformance: SeoPerformanceScore;
  progress: number | null;
  progressPercent: number | null;
  currentStage: string;
  elapsedSeconds: number | null;
  mode: SeoAuditMode;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  startedBy: string;
  startedByName: string;
  startedByStaffId: string;
  safeErrorMessage: string;
  issues: SeoAuditIssue[];
  raw: unknown;
};

export type SeoRedirect = {
  id: string;
  sourcePath: string;
  destination: string;
  type: 301 | 302;
  active: boolean;
  status: string;
  reason: string;
  createdBy: string;
  updatedAt: string | null;
  createdAt: string | null;
  hits: number | null;
  raw: unknown;
};

export type SeoRedirectInput = {
  sourcePath: string;
  destination: string;
  type: 301 | 302;
  reason?: string;
  active: boolean;
};

export type SeoRedirectTestResult = {
  ok: boolean;
  status: number | null;
  finalUrl: string;
  message: string;
  raw: unknown;
};

export type SitemapCheckStatus = 'not_checked' | 'available' | 'warning' | 'unavailable' | 'failed' | 'loading';

export type SeoSitemapItem = {
  key: 'main' | 'news' | 'robots' | string;
  label: string;
  url: string;
  httpStatus: number | null;
  status: SitemapCheckStatus;
  lastChecked: string | null;
  urlCount: number | null;
  validUrls: number | null;
  invalidUrls: number | null;
  duplicateUrls: number | null;
  errorUrls: number | null;
  warnings: string[];
  issues: string[];
  raw: unknown;
};

export type SeoApiError = Error & {
  status?: number;
  code?: string;
  details?: unknown;
};

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function firstDefined<T>(...values: T[]): T | undefined {
  return values.find((value) => value !== undefined && value !== null && String(value).trim?.() !== '');
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toStringValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function toDateString(value: unknown): string | null {
  const text = toStringValue(value);
  return text || null;
}

function arrayFrom(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  return [];
}

function payloadArray(payload: unknown, keys: string[]): any[] {
  const root = asRecord(payload);
  for (const key of keys) {
    const direct = root[key];
    if (Array.isArray(direct)) return direct;
    const nested = asRecord(root.data)[key];
    if (Array.isArray(nested)) return nested;
  }
  if (Array.isArray(root.data)) return root.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function normalizeAuditStatus(value: unknown): SeoAuditStatus {
  const status = toStringValue(value).toLowerCase();
  if (['queued', 'pending', 'scheduled'].includes(status)) return 'queued';
  if (['running', 'in_progress', 'processing', 'started'].includes(status)) return 'running';
  if (['completed', 'complete', 'success', 'succeeded', 'done'].includes(status)) return 'completed';
  if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) return 'failed';
  return 'unknown';
}

function normalizeSeverity(value: unknown): SeoIssueSeverity {
  const severity = toStringValue(value).toLowerCase();
  if (['critical', 'error', 'high', 'blocker'].includes(severity)) return 'critical';
  if (['warning', 'warn', 'medium'].includes(severity)) return 'warning';
  if (['passed', 'pass', 'success', 'ok'].includes(severity)) return 'passed';
  return 'info';
}

function normalizePerformance(value: unknown): SeoPerformanceScore {
  const directScore = toNumberOrNull(value);
  if (directScore !== null) return { score: directScore, status: 'measured' };

  const record = asRecord(value);
  const score = toNumberOrNull(firstDefined(record.score, record.value, record.performanceScore));
  const rawStatus = toStringValue(firstDefined(record.status, record.state, record.reason)).toLowerCase();
  const message = toStringValue(firstDefined(record.message, record.error, record.reason));
  if (score !== null) return { score, status: 'measured', message };
  if (['not_configured', 'not configured', 'disabled', 'missing_key', 'missing api key'].includes(rawStatus)) {
    return { score: null, status: 'not_configured', message };
  }
  if (['failed', 'error'].includes(rawStatus)) return { score: null, status: 'failed', message };
  if (['unavailable', 'timeout', 'temporarily_unavailable'].includes(rawStatus)) return { score: null, status: 'unavailable', message };
  if (value === undefined || value === null || value === '') return { score: null, status: 'not_configured' };
  return { score: null, status: 'unknown', message };
}

function normalizeIssue(issue: unknown, index: number): SeoAuditIssue {
  const raw = asRecord(issue);
  const pageUrl = toStringValue(firstDefined(raw.pageUrl, raw.url, raw.path, raw.page, raw.publicUrl));
  const title = toStringValue(firstDefined(raw.title, raw.name, raw.message, raw.issue, raw.check));
  return {
    id: toStringValue(firstDefined(raw.id, raw._id, raw.code, `${pageUrl || 'issue'}-${index}`)),
    severity: normalizeSeverity(firstDefined(raw.severity, raw.level, raw.type, raw.status)),
    category: toStringValue(firstDefined(raw.category, raw.group, raw.section, 'General')) || 'General',
    pageUrl,
    title: title || 'SEO check',
    explanation: toStringValue(firstDefined(raw.explanation, raw.description, raw.details, raw.message)),
    currentValue: toStringValue(firstDefined(raw.currentValue, raw.current, raw.value, raw.actual)),
    recommendedAction: toStringValue(firstDefined(raw.recommendedAction, raw.recommendation, raw.fix, raw.action)),
    checkCode: toStringValue(firstDefined(raw.checkCode, raw.code, raw.rule, raw.key)),
  };
}

function looksLikeDatabaseId(value: string): boolean {
  return /^[a-f0-9]{24}$/i.test(value.trim());
}

function normalizeStaffIdentity(raw: Record<string, any>): { display: string; name: string; staffId: string } {
  const candidates = [raw.startedBy, raw.initiatedBy, raw.createdBy, raw.requestedBy, raw.user, raw.staff, raw.initiator]
    .map(asRecord)
    .filter((item) => Object.keys(item).length > 0);
  const staff = candidates[0] || {};
  const name = toStringValue(firstDefined(staff.name, staff.fullName, staff.displayName, raw.startedByName, raw.staffName, raw.userName));
  const staffId = toStringValue(firstDefined(staff.staffId, staff.staffCode, staff.employeeId, staff.employeeCode, raw.startedByStaffId, raw.staffId));
  if (name && staffId) return { display: `${name} · ${staffId}`, name, staffId };
  if (name) return { display: name, name, staffId: '' };

  const direct = toStringValue(firstDefined(raw.startedBy, raw.initiatedBy, raw.createdBy));
  if (direct && !looksLikeDatabaseId(direct)) return { display: direct, name: direct, staffId: '' };
  return { display: 'Staff account unavailable', name: '', staffId: '' };
}

function normalizeAuditScore(raw: Record<string, any>, counts: Record<string, any>): number | null {
  const nested = asRecord(firstDefined(raw.seo, raw.metrics, raw.result, raw.results, raw.summary));
  const preferred = toNumberOrNull(firstDefined(raw.seoScore, raw.overallScore, raw.finalScore, nested.seoScore, nested.overallScore, nested.score, counts.seoScore, counts.overallScore));
  if (preferred !== null) return preferred;
  return toNumberOrNull(firstDefined(raw.score, counts.score));
}

function normalizeAuditMode(value: unknown): SeoAuditMode {
  const mode = toStringValue(value).toLowerCase();
  return ['full', 'deep', 'deep_scan', 'deep scan'].includes(mode) ? 'full' : 'quick';
}

function normalizeElapsedSeconds(raw: Record<string, any>): number | null {
  const seconds = toNumberOrNull(firstDefined(raw.elapsedSeconds, raw.elapsedSec, raw.elapsed));
  if (seconds !== null) return seconds;
  const durationMs = toNumberOrNull(firstDefined(raw.durationMs, raw.elapsedMs));
  return durationMs === null ? null : Math.max(0, Math.round(durationMs / 1000));
}

export function normalizeSeoAudit(value: unknown): SeoAudit {
  const raw = asRecord(value);
  const counts = asRecord(firstDefined(raw.counts, raw.summary, raw.totals));
  const staffIdentity = normalizeStaffIdentity(raw);
  const pageSpeed = asRecord(firstDefined(raw.pageSpeed, raw.performance, raw.coreWebVitals, raw.scores));
  const issues = payloadArray(firstDefined(raw.issues, raw.checks, raw.findings, raw.results), ['issues'])
    .map((issue, index) => normalizeIssue(issue, index));
  const status = normalizeAuditStatus(firstDefined(raw.status, raw.state));
  return {
    id: toStringValue(firstDefined(raw.id, raw._id, raw.auditId, raw.runId)) || 'latest',
    status,
    score: normalizeAuditScore(raw, counts),
    pagesChecked: toNumberOrNull(firstDefined(raw.pagesChecked, raw.checkedPages, raw.scannedPages, raw.currentPage, counts.pagesChecked, counts.checkedPages, counts.scannedPages)),
    totalPages: toNumberOrNull(firstDefined(raw.totalPages, raw.pagesTotal, raw.pageTotal, counts.totalPages, counts.pagesTotal, counts.total)),
    criticalIssues: toNumberOrNull(firstDefined(raw.criticalIssues, raw.criticalCount, counts.critical, counts.criticalIssues)) ?? issues.filter((item) => item.severity === 'critical').length,
    warnings: toNumberOrNull(firstDefined(raw.warnings, raw.warningCount, counts.warnings, counts.warningIssues)) ?? issues.filter((item) => item.severity === 'warning').length,
    passedChecks: toNumberOrNull(firstDefined(raw.passedChecks, raw.passed, counts.passed, counts.passedChecks)) ?? issues.filter((item) => item.severity === 'passed').length,
    desktopPerformance: normalizePerformance(firstDefined(raw.desktopPerformance, raw.desktopScore, pageSpeed.desktop, pageSpeed.desktopPerformance)),
    mobilePerformance: normalizePerformance(firstDefined(raw.mobilePerformance, raw.mobileScore, pageSpeed.mobile, pageSpeed.mobilePerformance)),
    progress: toNumberOrNull(firstDefined(raw.progressPercent, raw.progress, raw.percentComplete, raw.percentage)),
    progressPercent: toNumberOrNull(firstDefined(raw.progressPercent, raw.progress, raw.percentComplete, raw.percentage)),
    currentStage: toStringValue(firstDefined(raw.currentStage, raw.stage, raw.phase, raw.statusMessage)),
    elapsedSeconds: normalizeElapsedSeconds(raw),
    mode: normalizeAuditMode(firstDefined(raw.mode, raw.auditMode, raw.scanMode, raw.deep === true ? 'full' : 'quick')),
    startedAt: toDateString(firstDefined(raw.startedAt, raw.createdAt, raw.queuedAt)),
    completedAt: toDateString(firstDefined(raw.completedAt, raw.finishedAt, raw.updatedAt)),
    durationMs: toNumberOrNull(firstDefined(raw.durationMs, raw.duration, raw.elapsedMs)),
    startedBy: staffIdentity.display,
    startedByName: staffIdentity.name,
    startedByStaffId: staffIdentity.staffId,
    safeErrorMessage: toStringValue(firstDefined(raw.safeErrorMessage, raw.errorMessage, raw.error, raw.message)),
    issues,
    raw: value,
  };
}

export function normalizeSeoRedirect(value: unknown): SeoRedirect {
  const raw = asRecord(value);
  const active = raw.active ?? raw.enabled ?? raw.isActive;
  return {
    id: toStringValue(firstDefined(raw.id, raw._id, raw.redirectId, raw.sourcePath, raw.from)) || toStringValue(raw.source),
    sourcePath: toStringValue(firstDefined(raw.sourcePath, raw.source, raw.from, raw.path)),
    destination: toStringValue(firstDefined(raw.destination, raw.destinationUrl, raw.to, raw.target)),
    type: toStringValue(firstDefined(raw.type, raw.statusCode, raw.code)) === '302' ? 302 : 301,
    active: active === undefined ? toStringValue(raw.status).toLowerCase() !== 'disabled' : active !== false,
    status: toStringValue(firstDefined(raw.status, active === false ? 'disabled' : 'active')) || 'active',
    reason: toStringValue(raw.reason),
    createdBy: toStringValue(firstDefined(raw.createdBy, raw.user?.email, raw.user?.name)),
    updatedAt: toDateString(firstDefined(raw.updatedAt, raw.modifiedAt)),
    createdAt: toDateString(raw.createdAt),
    hits: toNumberOrNull(firstDefined(raw.hits, raw.hitCount, raw.uses)),
    raw: value,
  };
}

function normalizeSitemapStatus(value: unknown): SitemapCheckStatus {
  const status = toStringValue(value).toLowerCase();
  if (['available', 'ok', 'success', 'valid'].includes(status)) return 'available';
  if (['warning', 'warn', 'partial'].includes(status)) return 'warning';
  if (['unavailable', 'missing', 'not_found'].includes(status)) return 'unavailable';
  if (['failed', 'error'].includes(status)) return 'failed';
  if (['loading', 'checking'].includes(status)) return 'loading';
  return 'not_checked';
}

export function normalizeSitemapItem(value: unknown, fallbackKey = 'main'): SeoSitemapItem {
  const raw = asRecord(value);
  const key = toStringValue(firstDefined(raw.key, raw.type, raw.name, fallbackKey)).toLowerCase();
  const normalizedKey = key.includes('robot') ? 'robots' : (key.includes('news') ? 'news' : (key || fallbackKey));
  const warnings = arrayFrom(firstDefined(raw.warnings, raw.warningMessages)).map(toStringValue).filter(Boolean);
  const issues = arrayFrom(firstDefined(raw.issues, raw.errors, raw.invalidReasons)).map(toStringValue).filter(Boolean);
  const httpStatus = toNumberOrNull(firstDefined(raw.httpStatus, raw.statusCode, raw.code));
  return {
    key: normalizedKey,
    label: toStringValue(firstDefined(raw.label, raw.title)) || (normalizedKey === 'robots' ? 'robots.txt' : normalizedKey === 'news' ? 'News Sitemap' : 'Main Sitemap'),
    url: toStringValue(firstDefined(raw.url, raw.href, raw.location)),
    httpStatus,
    status: normalizeSitemapStatus(firstDefined(raw.status, raw.state, httpStatus && httpStatus >= 200 && httpStatus < 400 ? 'available' : undefined)),
    lastChecked: toDateString(firstDefined(raw.lastChecked, raw.checkedAt, raw.updatedAt, raw.lastGenerated)),
    urlCount: toNumberOrNull(firstDefined(raw.urlCount, raw.totalUrls, raw.count)),
    validUrls: toNumberOrNull(firstDefined(raw.validUrls, raw.validCount)),
    invalidUrls: toNumberOrNull(firstDefined(raw.invalidUrls, raw.invalidCount)),
    duplicateUrls: toNumberOrNull(firstDefined(raw.duplicateUrls, raw.duplicateCount)),
    errorUrls: toNumberOrNull(firstDefined(raw.errorUrls, raw.errorCount, raw.urls4xx5xx)),
    warnings,
    issues,
    raw: value,
  };
}

export function normalizeSitemapItems(payload: unknown): SeoSitemapItem[] {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const explicit = payloadArray(payload, ['items', 'checks', 'sitemaps', 'results']);
  if (explicit.length) return explicit.map((item, index) => normalizeSitemapItem(item, `item-${index}`));
  const keyed = [
    root.main || data.main || root.sitemap || data.sitemap || root.config || data.config,
    root.news || data.news || root.newsSitemap || data.newsSitemap,
    root.robots || data.robots || root.robotsTxt || data.robotsTxt,
  ].filter(Boolean);
  return keyed.map((item, index) => normalizeSitemapItem(item, index === 1 ? 'news' : index === 2 ? 'robots' : 'main'));
}

export function toSeoApiError(error: any, fallback = 'SEO request failed'): SeoApiError {
  const status = error?.response?.status ?? error?.status;
  const body = error?.response?.data ?? error?.body;
  const record = asRecord(body);
  const message = toStringValue(firstDefined(record.message, record.error, record.details, error?.message)) || fallback;
  const normalized = new Error(message) as SeoApiError;
  normalized.status = typeof status === 'number' ? status : undefined;
  normalized.code = toStringValue(firstDefined(record.code, error?.code));
  normalized.details = body;
  return normalized;
}

export async function listSeoAuditHistory(params: { limit?: number; page?: number } = {}): Promise<SeoAudit[]> {
  try {
    const res = await adminApiClient.get('seo/audit/history', { params: { limit: params.limit ?? 10, page: params.page ?? 1 } });
    return payloadArray(res.data, ['audits', 'history', 'items', 'rows']).map(normalizeSeoAudit);
  } catch (error) {
    throw toSeoApiError(error, 'Failed to load SEO audit history');
  }
}

export async function getLatestSeoAudit(): Promise<SeoAudit | null> {
  try {
    const res = await adminApiClient.get('seo/audit/latest');
    const root = asRecord(res.data);
    const data = asRecord(root.data);
    const audit = firstDefined(root.audit, data.audit, root.latest, data.latest);
    return audit ? normalizeSeoAudit(audit) : null;
  } catch (error) {
    throw toSeoApiError(error, 'Failed to load latest SEO audit');
  }
}

export async function startSeoAudit(input: { mode?: SeoAuditMode } = {}): Promise<SeoAudit> {
  try {
    const mode = input.mode ?? 'quick';
    const res = await adminApiClient.post('seo/audit', { mode, deep: mode === 'full' });
    return normalizeSeoAudit(firstDefined(asRecord(res.data).audit, asRecord(res.data).data, res.data));
  } catch (error) {
    throw toSeoApiError(error, 'Failed to start SEO audit');
  }
}

export async function getSeoAuditStatus(auditId?: string): Promise<SeoAudit> {
  try {
    const res = await adminApiClient.get(auditId ? `seo/audit/${encodeURIComponent(auditId)}/status` : 'seo/audit/status');
    return normalizeSeoAudit(firstDefined(asRecord(res.data).audit, asRecord(res.data).data, res.data));
  } catch (error: any) {
    const normalized = toSeoApiError(error, 'Failed to load SEO audit status');
    if (normalized.status !== 404) throw normalized;
    const history = await listSeoAuditHistory({ limit: 1 });
    if (history[0]) return history[0];
    throw normalized;
  }
}

export async function listSeoRedirects(): Promise<SeoRedirect[]> {
  try {
    const res = await adminApiClient.get('seo/redirects');
    return payloadArray(res.data, ['redirects', 'items', 'rows', 'data']).map(normalizeSeoRedirect);
  } catch (error) {
    throw toSeoApiError(error, 'Failed to load redirects');
  }
}

export async function createSeoRedirect(input: SeoRedirectInput): Promise<SeoRedirect> {
  try {
    const res = await adminApiClient.post('seo/redirects', input);
    return normalizeSeoRedirect(firstDefined(asRecord(res.data).redirect, asRecord(res.data).data, res.data));
  } catch (error) {
    throw toSeoApiError(error, 'Failed to save redirect');
  }
}

export async function updateSeoRedirect(id: string, input: SeoRedirectInput): Promise<SeoRedirect> {
  try {
    const res = await adminApiClient.patch(`seo/redirects/${encodeURIComponent(id)}`, input);
    return normalizeSeoRedirect(firstDefined(asRecord(res.data).redirect, asRecord(res.data).data, res.data));
  } catch (error) {
    throw toSeoApiError(error, 'Failed to save redirect');
  }
}

export async function setSeoRedirectActive(id: string, active: boolean): Promise<SeoRedirect> {
  try {
    const res = await adminApiClient.patch(`seo/redirects/${encodeURIComponent(id)}`, { active });
    return normalizeSeoRedirect(firstDefined(asRecord(res.data).redirect, asRecord(res.data).data, res.data));
  } catch (error) {
    throw toSeoApiError(error, active ? 'Failed to enable redirect' : 'Failed to disable redirect');
  }
}

export async function deleteSeoRedirect(id: string): Promise<void> {
  try {
    await adminApiClient.delete(`seo/redirects/${encodeURIComponent(id)}`);
  } catch (error) {
    throw toSeoApiError(error, 'Failed to delete redirect');
  }
}

export async function testSeoRedirect(sourcePath: string): Promise<SeoRedirectTestResult> {
  try {
    const res = await adminApiClient.get('seo/redirects/resolve', { params: { path: sourcePath } });
    const data = asRecord(res.data);
    const redirect = asRecord(firstDefined(data.redirect, data.data?.redirect, data));
    const matched = redirect.matched === true || data.matched === true;
    return {
      ok: matched,
      status: toNumberOrNull(firstDefined(redirect.statusCode, data.statusCode, data.status, data.httpStatus)),
      finalUrl: toStringValue(firstDefined(redirect.destination, data.destination, data.finalUrl, data.location, data.to)),
      message: toStringValue(firstDefined(data.message, data.result)) || (matched ? 'Redirect matched' : 'No redirect matched'),
      raw: res.data,
    };
  } catch (error) {
    throw toSeoApiError(error, 'Failed to test redirect');
  }
}

export async function getSeoSitemapStatus(): Promise<SeoSitemapItem[]> {
  try {
    const res = await adminApiClient.get('seo/sitemap');
    return normalizeSitemapItems(res.data);
  } catch (error) {
    throw toSeoApiError(error, 'Failed to load sitemap status');
  }
}

export async function checkSeoSitemaps(): Promise<SeoSitemapItem[]> {
  try {
    const res = await adminApiClient.post('seo/sitemap/check', {});
    return normalizeSitemapItems(res.data);
  } catch (error) {
    throw toSeoApiError(error, 'Failed to check sitemaps');
  }
}
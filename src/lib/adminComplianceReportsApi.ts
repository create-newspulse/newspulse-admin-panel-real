import { adminDelete, adminJson, adminPost, adminPut } from '@/lib/http/adminFetch';

export type ComplianceReportStatus = 'draft' | 'published';

export type ComplianceReportRecord = {
  id: string;
  _id?: string;
  month: string;
  year: number;
  label: string;
  publishedDate: string | null;
  complaintsReceived: number;
  complaintsResolved: number;
  averageResponseTime: string;
  complaintsPending: number;
  actionTakenOnOrdersDirections: string;
  note: string;
  status: ComplianceReportStatus;
  updatedAt: string | null;
  createdAt: string | null;
};

export type ComplianceReportInput = {
  month: string;
  year: number;
  label: string;
  publishedDate?: string | null;
  complaintsReceived: number;
  complaintsResolved: number;
  averageResponseTime: string;
  complaintsPending: number;
  actionTakenOnOrdersDirections: string;
  note: string;
  status: ComplianceReportStatus;
};

const BASE_PATH = '/compliance-reports';

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function normalizeDate(value: unknown): string | null {
  const raw = cleanText(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function monthIndex(month: string): number {
  const months = [
    'january',
    'february',
    'march',
    'april',
    'may',
    'june',
    'july',
    'august',
    'september',
    'october',
    'november',
    'december',
  ];
  return months.indexOf(cleanText(month).toLowerCase());
}

function toTitleCase(value: string): string {
  const raw = cleanText(value);
  if (!raw) return '';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function normalizeRecord(input: unknown): ComplianceReportRecord {
  const source = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const rawId = cleanText(source.id);
  const rawMongoId = cleanText(source._id);
  const id = rawId || rawMongoId || cleanText(source.slug);
  const month = toTitleCase(cleanText(source.month));
  const year = normalizeNumber(source.year);
  const publishedDate = normalizeDate(source.publishedDate ?? source.published_at ?? source.publishDate);
  const updatedAt = normalizeDate(source.updatedAt ?? source.updated_at);
  const createdAt = normalizeDate(source.createdAt ?? source.created_at);
  const status = cleanText(source.status).toLowerCase() === 'published' ? 'published' : 'draft';

  return {
    id,
    _id: rawMongoId || undefined,
    month,
    year,
    label: cleanText(source.label) || [month, year].filter(Boolean).join(' '),
    publishedDate,
    complaintsReceived: normalizeNumber(source.complaintsReceived ?? source.received),
    complaintsResolved: normalizeNumber(source.complaintsResolved ?? source.resolved),
    averageResponseTime: cleanText(source.averageResponseTime ?? source.avgResponseTime),
    complaintsPending: normalizeNumber(source.complaintsPending ?? source.pending),
    actionTakenOnOrdersDirections: cleanText(
      source.actionTakenOnOrdersDirections ?? source.actionTaken ?? source.ordersDirectionsAction,
    ),
    note: cleanText(source.note),
    status,
    updatedAt,
    createdAt,
  };
}

function extractRecords(payload: unknown): ComplianceReportRecord[] {
  const root = payload as
    | ComplianceReportRecord[]
    | {
        reports?: unknown[];
        complianceReports?: unknown[];
        items?: unknown[];
        data?: unknown[];
      }
    | null
    | undefined;

  const list = Array.isArray(root)
    ? root
    : Array.isArray(root?.reports)
      ? root.reports
      : Array.isArray(root?.complianceReports)
        ? root.complianceReports
        : Array.isArray(root?.items)
          ? root.items
          : Array.isArray(root?.data)
            ? root.data
            : [];

  return list
    .map(normalizeRecord)
    .filter((item) => item.id || (item.month && item.year))
    .sort((left, right) => {
      if (left.year !== right.year) return right.year - left.year;
      const monthDiff = monthIndex(right.month) - monthIndex(left.month);
      if (monthDiff !== 0) return monthDiff;
      const rightUpdated = right.updatedAt ? Date.parse(right.updatedAt) : 0;
      const leftUpdated = left.updatedAt ? Date.parse(left.updatedAt) : 0;
      return rightUpdated - leftUpdated;
    });
}

function normalizeMutationResponse(payload: unknown, fallback: ComplianceReportInput & { id?: string }): ComplianceReportRecord {
  const source = payload && typeof payload === 'object'
    ? ((payload as Record<string, unknown>).report ?? (payload as Record<string, unknown>).data ?? payload)
    : payload;

  const normalized = normalizeRecord(source);
  if (normalized.id || normalized.month || normalized.year) return normalized;

  return normalizeRecord({
    id: fallback.id,
    _id: fallback.id,
    ...fallback,
    updatedAt: new Date().toISOString(),
  });
}

export async function listComplianceReports(): Promise<ComplianceReportRecord[]> {
  const payload = await adminJson<unknown>(BASE_PATH);
  return extractRecords(payload);
}

export async function createComplianceReport(input: ComplianceReportInput): Promise<ComplianceReportRecord> {
  const payload = await adminPost<unknown>(BASE_PATH, input);
  return normalizeMutationResponse(payload, input);
}

export async function updateComplianceReport(id: string, input: ComplianceReportInput): Promise<ComplianceReportRecord> {
  const safeId = encodeURIComponent(cleanText(id));
  const payload = await adminPut<unknown>(`${BASE_PATH}/${safeId}`, input);
  return normalizeMutationResponse(payload, { ...input, id: safeId });
}

export async function deleteComplianceReport(id: string): Promise<void> {
  const safeId = encodeURIComponent(cleanText(id));
  await adminDelete(`${BASE_PATH}/${safeId}`);
}
import { adminJson, adminPut } from '@/lib/http/adminFetch';

export type SrbRegistration = {
  organization: string;
  publisher: string;
  status: string;
  registrationNumber: string;
  issueDate: string;
  validUntil: string;
  archivedAt?: string;
};

export type ComplianceSettingsRenewalInput = ComplianceSettings & {
  srbRegistrationAction: 'renew';
};

export type ComplianceSettings = {
  founderName: string;
  founderDesignation: string;
  grievanceEmail: string;
  grievanceOfficerName: string;
  grievanceOfficerDesignation: string;
  grievanceOfficerLocation: string;
  publisherEntity: string;
  showPublisherEntity: boolean;
  showFounderPublisher: boolean;
  showChiefEditor: boolean;
  websiteUrl: string;
  chiefEditorName: string;
  chiefEditorDesignation: string;
  editorialEmail: string;
  srbRegistration: SrbRegistration;
  srbRegistrationHistory: SrbRegistration[];
};

const BASE_PATH = '/compliance-settings';

export const DEFAULT_COMPLIANCE_SETTINGS: ComplianceSettings = {
  founderName: 'Kiran Parmar',
  founderDesignation: 'Founder, News Pulse',
  grievanceEmail: 'grievance@newspulse.co.in',
  grievanceOfficerName: '',
  grievanceOfficerDesignation: '',
  grievanceOfficerLocation: 'India',
  publisherEntity: 'News Pulse Media',
  showPublisherEntity: true,
  showFounderPublisher: false,
  showChiefEditor: true,
  websiteUrl: 'https://www.newspulse.co.in',
  chiefEditorName: '',
  chiefEditorDesignation: 'Chief Editor',
  editorialEmail: '',
  srbRegistration: {
    organization: 'Working Journalist Media Council (WJMC)',
    publisher: 'News Pulse (Digital)',
    status: 'Registered',
    registrationNumber: 'WJMC/7489/462-26',
    issueDate: '2026-09-14',
    validUntil: '2027-09-14',
  },
  srbRegistrationHistory: [],
};

function cleanText(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function cleanBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
}

function normalizeSrbRegistration(payload: unknown, fallback: SrbRegistration): SrbRegistration {
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const registration = {
    organization: cleanText(source.organization ?? source.srbOrganization, fallback.organization),
    publisher: cleanText(source.publisher ?? source.srbPublisher, fallback.publisher),
    status: cleanText(source.status ?? source.srbStatus, fallback.status),
    registrationNumber: cleanText(source.registrationNumber ?? source.registrationNo ?? source.srbRegistrationNo, fallback.registrationNumber),
    issueDate: cleanText(source.issueDate ?? source.srbIssueDate, fallback.issueDate),
    validUntil: cleanText(source.validUntil ?? source.srbValidUntil, fallback.validUntil),
  };
  const archivedAt = cleanText(source.archivedAt, fallback.archivedAt);
  return archivedAt ? { ...registration, archivedAt } : registration;
}

function normalizeSrbHistory(payload: unknown, fallback: SrbRegistration[]): SrbRegistration[] {
  if (!Array.isArray(payload)) return fallback;
  return payload
    .filter((item) => item && typeof item === 'object')
    .map((item) => normalizeSrbRegistration(item, DEFAULT_COMPLIANCE_SETTINGS.srbRegistration));
}

function normalizeSettings(payload: unknown, fallback: ComplianceSettings = DEFAULT_COMPLIANCE_SETTINGS): ComplianceSettings {
  const source = (payload && typeof payload === 'object'
    ? ((
      (payload as Record<string, unknown>).item
      ?? ((payload as Record<string, unknown>).data && typeof (payload as Record<string, unknown>).data === 'object'
        ? ((payload as Record<string, unknown>).data as Record<string, unknown>).item
        : undefined)
      ?? (payload as Record<string, unknown>).settings
      ?? (payload as Record<string, unknown>).data
      ?? payload
    ) as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  return {
    founderName: cleanText(source.founderName ?? source.publisherName, fallback.founderName),
    founderDesignation: cleanText(source.founderDesignation ?? source.publisherDesignation, fallback.founderDesignation),
    grievanceEmail: cleanText(source.grievanceEmail ?? source.email, fallback.grievanceEmail),
    grievanceOfficerName: cleanText(source.grievanceOfficerName ?? source.officerName ?? source.name, fallback.grievanceOfficerName),
    grievanceOfficerDesignation: cleanText(source.grievanceOfficerDesignation ?? source.designation, fallback.grievanceOfficerDesignation),
    grievanceOfficerLocation: cleanText(source.grievanceOfficerLocation ?? source.location, fallback.grievanceOfficerLocation),
    publisherEntity: cleanText(source.publisherEntity ?? source.publisher ?? source.entity, fallback.publisherEntity),
    showPublisherEntity: cleanBoolean(source.showPublisherEntity, fallback.showPublisherEntity),
    showFounderPublisher: cleanBoolean(source.showFounderPublisher, fallback.showFounderPublisher),
    showChiefEditor: cleanBoolean(source.showChiefEditor, fallback.showChiefEditor),
    websiteUrl: cleanText(source.websiteUrl ?? source.website, fallback.websiteUrl),
    chiefEditorName: cleanText(source.chiefEditorName ?? source.editorialLeadName ?? source.editorName, fallback.chiefEditorName),
    chiefEditorDesignation: cleanText(source.chiefEditorDesignation ?? source.editorialLeadDesignation ?? source.editorDesignation, fallback.chiefEditorDesignation),
    editorialEmail: cleanText(source.editorialEmail ?? source.chiefEditorEmail ?? source.editorEmail, fallback.editorialEmail),
    srbRegistration: normalizeSrbRegistration(source.srbRegistration ?? source.srb, fallback.srbRegistration),
    srbRegistrationHistory: normalizeSrbHistory(source.srbRegistrationHistory ?? source.srbHistory, fallback.srbRegistrationHistory),
  };
}

export async function getComplianceSettings(): Promise<ComplianceSettings> {
  const payload = await adminJson<unknown>(BASE_PATH);
  return normalizeSettings(payload);
}

export async function updateComplianceSettings(input: ComplianceSettings): Promise<ComplianceSettings> {
  const payload = await adminPut<unknown>(BASE_PATH, input);
  return normalizeSettings(payload, input);
}

export async function renewSrbRegistration(input: ComplianceSettings): Promise<ComplianceSettings> {
  const renewalInput: ComplianceSettingsRenewalInput = {
    ...input,
    srbRegistrationAction: 'renew',
  };
  const payload = await adminPut<unknown>(BASE_PATH, renewalInput);
  return normalizeSettings(payload, input);
}
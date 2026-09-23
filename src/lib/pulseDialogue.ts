export const PULSE_DIALOGUE_CATEGORY = 'pulse-dialogue';

export const CONTRIBUTOR_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
] as const;

export const CONTRIBUTOR_TYPE_OPTIONS = [
  { value: 'columnist', label: 'Columnist' },
  { value: 'guest_columnist', label: 'Guest Columnist' },
  { value: 'guest_contributor', label: 'Guest Contributor' },
  { value: 'author', label: 'Author' },
  { value: 'scholar_academic', label: 'Scholar / Academic' },
  { value: 'researcher', label: 'Researcher' },
  { value: 'subject_expert', label: 'Subject Expert' },
  { value: 'journalist', label: 'Journalist' },
  { value: 'writer', label: 'Writer' },
  { value: 'poet_literary_writer', label: 'Poet / Literary Writer' },
  { value: 'public_intellectual', label: 'Public Intellectual' },
  { value: 'industry_expert', label: 'Industry Expert' },
] as const;

export const DIALOGUE_FORMAT_OPTIONS = [
  { value: 'column', label: 'Column' },
  { value: 'guest_column', label: 'Guest Column' },
  { value: 'essay', label: 'Essay' },
  { value: 'viewpoint', label: 'Viewpoint' },
  { value: 'conversation', label: 'Conversation' },
  { value: 'interview', label: 'Interview' },
  { value: 'literary_essay', label: 'Literary Essay' },
  { value: 'culture_ideas', label: 'Culture & Ideas' },
  { value: 'expert_perspective', label: 'Expert Perspective' },
  { value: 'open_letter', label: 'Open Letter' },
] as const;

export type ContributorStatus = typeof CONTRIBUTOR_STATUS_OPTIONS[number]['value'];
export type ContributorType = typeof CONTRIBUTOR_TYPE_OPTIONS[number]['value'];
export type DialogueFormat = typeof DIALOGUE_FORMAT_OPTIONS[number]['value'];

export type PulseDialoguePhoto = {
  url?: string | null;
  publicId?: string | null;
  alt?: string | null;
};

export type PulseDialogueRightsConsent = {
  publicationRightsConfirmed?: boolean;
  profileConsentConfirmed?: boolean;
  photoUsagePermissionConfirmed?: boolean;
  disclosureReviewed?: boolean;
  notes?: string | null;
};

export type PulseDialoguePublicContributor = {
  id?: string | null;
  name?: string | null;
  canonicalName?: string | null;
  photo?: PulseDialoguePhoto | null;
  publicDesignation?: string | null;
  affiliation?: string | null;
  shortBio?: string | null;
  slug?: string | null;
  website?: string | null;
  socialLinks?: Record<string, string> | null;
};

export type PulseDialogueContributor = {
  id?: string | null;
  _id?: string | null;
  canonicalName?: string | null;
  displayNameHi?: string | null;
  displayNameGu?: string | null;
  photo?: PulseDialoguePhoto | null;
  publicDesignation?: string | null;
  contributorType?: ContributorType | string | null;
  affiliation?: string | null;
  shortBio?: string | null;
  location?: string | null;
  slug?: string | null;
  website?: string | null;
  socialLinks?: Record<string, string> | null;
  status?: ContributorStatus | string | null;
  internalEmail?: string | null;
  internalNotes?: string | null;
  rightsConsent?: PulseDialogueRightsConsent | null;
  publicContributor?: PulseDialoguePublicContributor | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type PulseDialogueBylineSnapshot = {
  name?: string | null;
  designation?: string | null;
  affiliation?: string | null;
  photo?: PulseDialoguePhoto | null;
};

export type PulseDialogueFormValue = {
  contributorId: string;
  dialogueFormat: DialogueFormat | '';
  series: string;
  bylineDesignationOverride: string;
  contributorDisclosure: string;
  editorNote: string;
  contributorDisclaimer: string;
  showAboutContributor: boolean;
};

export type PulseDialogueArticleMetadata = Partial<PulseDialogueFormValue> & {
  contributorId?: string | null;
  dialogueFormat?: DialogueFormat | string | null;
  bylineSnapshot?: PulseDialogueBylineSnapshot | null;
  contributor?: PulseDialoguePublicContributor | PulseDialogueContributor | null;
};

export const EMPTY_PULSE_DIALOGUE_VALUE: PulseDialogueFormValue = {
  contributorId: '',
  dialogueFormat: '',
  series: '',
  bylineDesignationOverride: '',
  contributorDisclosure: '',
  editorNote: '',
  contributorDisclaimer: '',
  showAboutContributor: false,
};

export function getContributorId(contributor: PulseDialogueContributor | PulseDialoguePublicContributor | null | undefined): string {
  return String((contributor as any)?._id || contributor?.id || '').trim();
}

export function dialogueFormatLabel(value: unknown): string {
  const key = String(value || '').trim();
  return DIALOGUE_FORMAT_OPTIONS.find((item) => item.value === key)?.label || key;
}

export function contributorTypeLabel(value: unknown): string {
  const key = String(value || '').trim();
  return CONTRIBUTOR_TYPE_OPTIONS.find((item) => item.value === key)?.label || key;
}

export function normalizePulseDialogueFormValue(input: unknown): PulseDialogueFormValue {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, any> : {};
  const dialogueFormat = String(src.dialogueFormat || '').trim();
  return {
    contributorId: String(src.contributorId || src.contributor?.id || src.contributor?._id || '').trim(),
    dialogueFormat: DIALOGUE_FORMAT_OPTIONS.some((item) => item.value === dialogueFormat) ? dialogueFormat as DialogueFormat : '',
    series: String(src.series || '').trim(),
    bylineDesignationOverride: String(src.bylineDesignationOverride || '').trim(),
    contributorDisclosure: String(src.contributorDisclosure || '').trim(),
    editorNote: String(src.editorNote || '').trim(),
    contributorDisclaimer: String(src.contributorDisclaimer || '').trim(),
    showAboutContributor: src.showAboutContributor === true,
  };
}

export function buildPulseDialoguePayload(value: PulseDialogueFormValue): PulseDialogueArticleMetadata {
  const out: PulseDialogueArticleMetadata = {};
  const contributorId = value.contributorId.trim();
  if (contributorId) out.contributorId = contributorId;
  if (value.dialogueFormat) out.dialogueFormat = value.dialogueFormat;
  for (const key of ['series', 'bylineDesignationOverride', 'contributorDisclosure', 'editorNote', 'contributorDisclaimer'] as const) {
    const text = String(value[key] || '').trim();
    if (text) out[key] = text;
  }
  out.showAboutContributor = Boolean(value.showAboutContributor);
  return out;
}
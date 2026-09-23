import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  CONTRIBUTOR_STATUS_OPTIONS,
  DIALOGUE_FORMAT_OPTIONS,
  getContributorId,
  type ContributorStatus,
  type ContributorType,
  type PulseDialogueContributor,
  type PulseDialogueFormValue,
  type PulseDialoguePhoto,
  type PulseDialogueRightsConsent,
} from '@/lib/pulseDialogue';
import {
  createPulseDialogueContributor,
  getPulseDialogueContributor,
  listPulseDialogueContributors,
  updatePulseDialogueContributor,
} from '@/lib/api/pulseDialogue';
import { uploadCoverImage } from '@/lib/api/media';
import { normalizeError } from '@/lib/error';

type Props = {
  value: PulseDialogueFormValue;
  onChange: (value: PulseDialogueFormValue) => void;
  selectedContributor: PulseDialogueContributor | null;
  onSelectedContributorChange: (contributor: PulseDialogueContributor | null) => void;
  canManageContributors: boolean;
};

type ContributorFormState = {
  id: string;
  canonicalName: string;
  displayNameHi: string;
  displayNameGu: string;
  photo: PulseDialoguePhoto | null;
  publicDesignation: string;
  contributorType: ContributorType;
  affiliation: string;
  shortBio: string;
  location: string;
  website: string;
  socialLinks: Record<string, string>;
  status: ContributorStatus;
  internalEmail: string;
  rightsConsent: PulseDialogueRightsConsent;
  internalNotes: string;
};

const EMPTY_CONTRIBUTOR_FORM: ContributorFormState = {
  id: '',
  canonicalName: '',
  displayNameHi: '',
  displayNameGu: '',
  photo: null,
  publicDesignation: '',
  contributorType: 'guest_contributor',
  affiliation: '',
  shortBio: '',
  location: '',
  website: '',
  socialLinks: {},
  status: 'active',
  internalEmail: '',
  rightsConsent: {},
  internalNotes: '',
};

function cleanText(value: unknown): string {
  return String(value || '').trim();
}

function contributorName(contributor: PulseDialogueContributor | null): string {
  return cleanText(contributor?.canonicalName || contributor?.publicContributor?.name || contributor?.publicContributor?.canonicalName || '');
}

function formFromContributor(contributor: PulseDialogueContributor | null): ContributorFormState {
  if (!contributor) return { ...EMPTY_CONTRIBUTOR_FORM, socialLinks: {}, rightsConsent: {} };
  const contributorType = contributor.contributorType ? contributor.contributorType as ContributorType : 'guest_contributor';
  const status = CONTRIBUTOR_STATUS_OPTIONS.some((item) => item.value === contributor.status)
    ? contributor.status as ContributorStatus
    : 'active';
  return {
    id: getContributorId(contributor),
    canonicalName: cleanText(contributor.canonicalName),
    displayNameHi: cleanText(contributor.displayNameHi),
    displayNameGu: cleanText(contributor.displayNameGu),
    photo: contributor.photo || null,
    publicDesignation: cleanText(contributor.publicDesignation),
    contributorType,
    affiliation: cleanText(contributor.affiliation),
    shortBio: cleanText(contributor.shortBio),
    location: cleanText(contributor.location),
    website: cleanText(contributor.website),
    socialLinks: contributor.socialLinks || {},
    status,
    internalEmail: cleanText(contributor.internalEmail),
    rightsConsent: contributor.rightsConsent || {},
    internalNotes: cleanText(contributor.internalNotes),
  };
}

function buildContributorPayload(form: ContributorFormState): Partial<PulseDialogueContributor> {
  const socialLinks = Object.fromEntries(
    Object.entries(form.socialLinks || {})
      .map(([key, value]) => [key, cleanText(value)])
      .filter(([, value]) => Boolean(value))
  );
  return {
    canonicalName: cleanText(form.canonicalName),
    displayNameHi: cleanText(form.displayNameHi) || null,
    displayNameGu: cleanText(form.displayNameGu) || null,
    photo: form.photo,
    publicDesignation: cleanText(form.publicDesignation) || null,
    contributorType: form.contributorType,
    affiliation: cleanText(form.affiliation) || null,
    shortBio: cleanText(form.shortBio) || null,
    location: cleanText(form.location) || null,
    website: cleanText(form.website) || null,
    socialLinks,
    status: form.status,
    internalEmail: cleanText(form.internalEmail) || null,
    rightsConsent: {
      publicationRightsConfirmed: Boolean(form.rightsConsent.publicationRightsConfirmed),
      profileConsentConfirmed: Boolean(form.rightsConsent.profileConsentConfirmed),
      photoUsagePermissionConfirmed: Boolean(form.rightsConsent.photoUsagePermissionConfirmed),
      disclosureReviewed: Boolean(form.rightsConsent.disclosureReviewed),
      notes: cleanText(form.rightsConsent.notes) || null,
    },
    internalNotes: cleanText(form.internalNotes) || null,
  };
}

export default function PulseDialogueDetailsSection({
  value,
  onChange,
  selectedContributor,
  onSelectedContributorChange,
  canManageContributors,
}: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<ContributorFormState>(() => formFromContributor(null));
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const selectedContributorId = value.contributorId.trim();

  const listQuery = useQuery({
    queryKey: ['pulse-dialogue', 'contributors', search],
    queryFn: () => listPulseDialogueContributors({ q: search, limit: 20 }),
    staleTime: 60 * 1000,
  });

  const selectedQuery = useQuery({
    queryKey: ['pulse-dialogue', 'contributors', selectedContributorId],
    queryFn: () => getPulseDialogueContributor(selectedContributorId),
    enabled: Boolean(selectedContributorId && (!selectedContributor || getContributorId(selectedContributor) !== selectedContributorId)),
    staleTime: 60 * 1000,
  });

  useEffect(() => {
    if (selectedQuery.data) onSelectedContributorChange(selectedQuery.data);
  }, [selectedQuery.data, onSelectedContributorChange]);

  const contributors = listQuery.data?.items || [];

  const contributorMutation = useMutation({
    mutationFn: async () => {
      const payload = buildContributorPayload(form);
      if (!payload.canonicalName) throw new Error('Canonical Name is required');
      return form.id ? updatePulseDialogueContributor(form.id, payload) : createPulseDialogueContributor(payload);
    },
    onSuccess: (contributor) => {
      queryClient.invalidateQueries({ queryKey: ['pulse-dialogue', 'contributors'] });
      onSelectedContributorChange(contributor);
      onChange({ ...value, contributorId: getContributorId(contributor) });
      setModalMode(null);
      toast.success(form.id ? 'Contributor updated' : 'Contributor created');
    },
    onError: (error: any) => {
      toast.error(normalizeError(error, 'Contributor save failed').message);
    },
  });

  function patchValue(patch: Partial<PulseDialogueFormValue>) {
    onChange({ ...value, ...patch });
  }

  function selectContributor(contributor: PulseDialogueContributor) {
    onSelectedContributorChange(contributor);
    patchValue({ contributorId: getContributorId(contributor) });
  }

  async function uploadContributorPhoto(file: File | null) {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const uploaded = await uploadCoverImage(file);
      setForm((current) => ({
        ...current,
        photo: {
          url: uploaded.url,
          publicId: uploaded.publicId || null,
          alt: current.canonicalName || contributorName(selectedContributor) || file.name || null,
        },
      }));
      toast.success('Contributor photo uploaded');
    } catch (error: any) {
      toast.error(normalizeError(error, 'Contributor photo upload failed').message);
    } finally {
      setUploadingPhoto(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-3" data-testid="pulse-dialogue-details">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">Pulse Dialogue Details</div>
        <div className="mt-1 text-[11px] text-slate-500">Contributor identity is separate from the article cover image.</div>
      </div>

      <div>
        <label className="block text-xs font-medium">Dialogue Format</label>
        <select
          value={value.dialogueFormat}
          onChange={(event) => patchValue({ dialogueFormat: event.target.value as PulseDialogueFormValue['dialogueFormat'] })}
          className="w-full border px-2 py-2 rounded bg-white"
        >
          <option value="">Select dialogue format...</option>
          {DIALOGUE_FORMAT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium">Contributor</label>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full border px-2 py-2 rounded bg-white text-sm"
          placeholder="Search contributors..."
          aria-label="Search contributors"
        />
        <div className="max-h-44 overflow-auto rounded border border-slate-200 bg-white">
          {listQuery.isLoading ? (
            <div className="px-3 py-3 text-xs text-slate-500">Loading contributors...</div>
          ) : contributors.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-500">No contributors found.</div>
          ) : contributors.map((contributor, index) => {
            const id = getContributorId(contributor);
            const isSelected = id && id === selectedContributorId;
            return (
              <button
                key={id || contributor.slug || contributor.canonicalName || `contributor-${index}`}
                type="button"
                onClick={() => selectContributor(contributor)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 ${isSelected ? 'bg-slate-100' : ''}`}
              >
                {contributor.photo?.url ? (
                  <img src={contributor.photo.url} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                    {contributorName(contributor).slice(0, 1).toUpperCase() || '?'}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{contributorName(contributor) || 'Unnamed contributor'}</span>
                  <span className="block truncate text-xs text-slate-500">{cleanText(contributor.publicDesignation) || cleanText(contributor.affiliation)}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          {canManageContributors && (
            <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={() => { setForm(formFromContributor(null)); setModalMode('create'); }}>Create Contributor</button>
          )}
          {canManageContributors && selectedContributor && (
            <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={() => { setForm(formFromContributor(selectedContributor)); setModalMode('edit'); }}>Edit Contributor</button>
          )}
          {selectedContributor && (
            <button
              type="button"
              className="btn-secondary text-xs px-2 py-1"
              onClick={() => {
                onSelectedContributorChange(null);
                patchValue({ contributorId: '' });
              }}
            >
              Change Selection
            </button>
          )}
        </div>
      </div>

      {selectedContributor ? (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-start gap-3">
            {selectedContributor.photo?.url ? <img src={selectedContributor.photo.url} alt="" className="h-12 w-12 rounded-full object-cover" /> : null}
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold text-slate-900">{contributorName(selectedContributor)}</div>
              {selectedContributor.publicDesignation ? <div className="text-slate-600">{selectedContributor.publicDesignation}</div> : null}
              {selectedContributor.affiliation ? <div className="text-slate-500">{selectedContributor.affiliation}</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium">Series / Column</label>
          <input value={value.series} onChange={(event) => patchValue({ series: event.target.value })} className="w-full border px-2 py-2 rounded bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium">Byline Designation Override</label>
          <input value={value.bylineDesignationOverride} onChange={(event) => patchValue({ bylineDesignationOverride: event.target.value })} className="w-full border px-2 py-2 rounded bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium">Contributor Disclosure</label>
          <textarea value={value.contributorDisclosure} onChange={(event) => patchValue({ contributorDisclosure: event.target.value })} rows={2} className="w-full border px-2 py-2 rounded bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium">Editor's Note</label>
          <textarea value={value.editorNote} onChange={(event) => patchValue({ editorNote: event.target.value })} rows={2} className="w-full border px-2 py-2 rounded bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium">Contributor Disclaimer</label>
          <textarea
            value={value.contributorDisclaimer}
            onChange={(event) => patchValue({ contributorDisclaimer: event.target.value })}
            rows={2}
            className="w-full border px-2 py-2 rounded bg-white"
            placeholder="The views expressed in this contribution are those of the author and do not necessarily represent the editorial position of News Pulse."
          />
        </div>
        <label className="flex items-center gap-2 text-xs font-medium">
          <input type="checkbox" checked={value.showAboutContributor} onChange={(event) => patchValue({ showAboutContributor: event.target.checked })} />
          Show About the Contributor
        </label>
      </div>

      {modalMode ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label={modalMode === 'edit' ? 'Edit Contributor' : 'Create Contributor'}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="text-lg font-semibold">{modalMode === 'edit' ? 'Edit Contributor' : 'Create Contributor'}</div>
              <button type="button" className="btn-secondary text-sm px-2 py-1" onClick={() => setModalMode(null)}>Close</button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Contributor Name" value={form.canonicalName} onChange={(canonicalName) => setForm((current) => ({ ...current, canonicalName }))} required />
              <Field label="Public Designation" value={form.publicDesignation} onChange={(publicDesignation) => setForm((current) => ({ ...current, publicDesignation }))} />
              <Field label="Affiliation" value={form.affiliation} onChange={(affiliation) => setForm((current) => ({ ...current, affiliation }))} />
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[auto_1fr] sm:items-start">
              <div>
                <div className="mb-1 text-xs font-medium">Photo Preview</div>
                {form.photo?.url ? <img src={form.photo.url} alt="Photo Preview" className="h-20 w-20 rounded-full object-cover" /> : <div className="h-20 w-20 rounded-full bg-slate-100" aria-label="Photo Preview" />}
              </div>
              <div>
                <label className="block text-xs font-medium">Contributor Photo</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  <label className="btn-secondary cursor-pointer text-xs px-2 py-1">
                    {form.photo ? 'Replace Photo' : 'Upload Photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      aria-label={form.photo ? 'Replace Photo' : 'Upload Photo'}
                      disabled={uploadingPhoto}
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        event.currentTarget.value = '';
                        void uploadContributorPhoto(file);
                      }}
                    />
                  </label>
                  {form.photo ? <button type="button" className="btn-secondary text-xs px-2 py-1" onClick={() => setForm((current) => ({ ...current, photo: null }))}>Remove Photo</button> : null}
                </div>
                {uploadingPhoto ? <div className="mt-1 text-xs text-slate-500">Uploading photo...</div> : null}
              </div>
            </div>

            <div className="mt-3 space-y-3">
              <TextArea label="Short Bio" value={form.shortBio} onChange={(shortBio) => setForm((current) => ({ ...current, shortBio }))} />
              <details className="rounded-lg border border-slate-200 p-3">
                <summary className="cursor-pointer text-xs font-medium text-slate-800">Additional / Internal Details</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Location" value={form.location} onChange={(location) => setForm((current) => ({ ...current, location }))} />
                  <Field label="Website" value={form.website} onChange={(website) => setForm((current) => ({ ...current, website }))} />
                  <Field label="Internal Contact Email" value={form.internalEmail} onChange={(internalEmail) => setForm((current) => ({ ...current, internalEmail }))} />
                  <Field label="X / Twitter" value={form.socialLinks.x || ''} onChange={(x) => setForm((current) => ({ ...current, socialLinks: { ...current.socialLinks, x } }))} />
                  <Field label="LinkedIn" value={form.socialLinks.linkedin || ''} onChange={(linkedin) => setForm((current) => ({ ...current, socialLinks: { ...current.socialLinks, linkedin } }))} />
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 p-3">
                  <div className="mb-2 text-xs font-medium">Rights / Consent</div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Checkbox label="Publication rights confirmed" checked={Boolean(form.rightsConsent.publicationRightsConfirmed)} onChange={(publicationRightsConfirmed) => setForm((current) => ({ ...current, rightsConsent: { ...current.rightsConsent, publicationRightsConfirmed } }))} />
                    <Checkbox label="Profile consent confirmed" checked={Boolean(form.rightsConsent.profileConsentConfirmed)} onChange={(profileConsentConfirmed) => setForm((current) => ({ ...current, rightsConsent: { ...current.rightsConsent, profileConsentConfirmed } }))} />
                    <Checkbox label="Photo usage permission confirmed" checked={Boolean(form.rightsConsent.photoUsagePermissionConfirmed)} onChange={(photoUsagePermissionConfirmed) => setForm((current) => ({ ...current, rightsConsent: { ...current.rightsConsent, photoUsagePermissionConfirmed } }))} />
                    <Checkbox label="Disclosure reviewed" checked={Boolean(form.rightsConsent.disclosureReviewed)} onChange={(disclosureReviewed) => setForm((current) => ({ ...current, rightsConsent: { ...current.rightsConsent, disclosureReviewed } }))} />
                  </div>
                  <TextArea label="Rights Notes" value={cleanText(form.rightsConsent.notes)} onChange={(notes) => setForm((current) => ({ ...current, rightsConsent: { ...current.rightsConsent, notes } }))} />
                </div>
                <div className="mt-3">
                  <TextArea label="Internal Notes" value={form.internalNotes} onChange={(internalNotes) => setForm((current) => ({ ...current, internalNotes }))} />
                </div>
              </details>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="btn-secondary px-3 py-1 text-sm" onClick={() => setModalMode(null)}>Cancel</button>
              <button type="button" className="btn-primary px-3 py-1 text-sm" disabled={contributorMutation.isPending} onClick={() => contributorMutation.mutate()}>
                {contributorMutation.isPending ? 'Saving...' : 'Save Contributor'}
              </button>
            </div>
          </div>

        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value, onChange, required }: { label: string; value: string; onChange: (value: string) => void; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-medium">{label}{required ? ' *' : ''}</label>
      <input aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="w-full border px-2 py-2 rounded" />
    </div>
  );
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium">{label}</label>
      <textarea aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} rows={3} className="w-full border px-2 py-2 rounded" />
    </div>
  );
}

function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
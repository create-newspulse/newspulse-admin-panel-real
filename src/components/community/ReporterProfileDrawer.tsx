import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import adminApi from '@/api/adminApi';
import { adminUrl } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { updateReporterStatus } from '@/lib/api/communityAdmin';
import {
  listReporterStoriesForContact,
  updateReporterContactNotes,
  type ReporterContact,
  type ReporterStory,
} from '@/lib/api/reporterDirectory';

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

type ProfileTab = 'overview' | 'contact' | 'coverage' | 'stories' | 'notes' | 'tasks' | 'activity';
type Tone = 'slate' | 'green' | 'amber' | 'rose' | 'blue';

type DrawerProps = {
  open: boolean;
  reporter: ReporterContact | null;
  initialTab?: ProfileTab;
  onClose: () => void;
  onOpenStories?: (reporterKey: string) => void;
  onOpenQueue?: (reporterKey: string) => void;
  onRefresh?: () => void | Promise<void>;
};

type MissingFieldItem = {
  label: string;
  detail: string;
};

type DrawerTaskItem = {
  id: string;
  title: string;
  detail: string;
};

type TimelineEvent = {
  id: string;
  title: string;
  detail: string;
  at?: string | null;
  kind: 'profile' | 'story' | 'auth';
};

type StorySummary = {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  latestAt: string | null;
};

type NormalizedReporterContact = {
  email: string;
  phone: string;
  whatsapp: string;
  portalAuthLabel: string;
  authProvider: string;
  lastLoginAt: string | null;
};

type NormalizedReporterProfile = {
  reporterId: string;
  reporterKey: string;
  contactId: string;
  contributorId: string;
  rawProfile: unknown;
  fullName: string;
  displayName: string;
  contact: NormalizedReporterContact;
  email: string;
  phone: string;
  whatsapp: string;
  status: ReporterContact['status'];
  statusLabel: string;
  verificationLevel: ReporterContact['verificationLevel'];
  verificationLabel: string;
  reporterType: ReporterContact['reporterType'];
  reporterTypeLabel: string;
  emailVerified: boolean | null;
  authStatus: string;
  authProvider: string;
  portalAuthEnabled: boolean;
  portalAuthLabel: string;
  identitySource: string;
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastSubmissionAt: string | null;
  lastStoryAt: string | null;
  locationSummary: string;
  city: string;
  district: string;
  state: string;
  country: string;
  area: string;
  areaType: string;
  coverageScope: string;
  coverageLanguage: string[];
  beats: string[];
  specialization: string;
  organization: string;
  position: string;
  website: string;
  social: string;
  notes: string;
  totalStories: number;
  approvedStories: number;
  pendingStories: number;
  rejectedStories: number;
  publishedStories: number;
  linkedStoryCount: number | null;
  completeness: number;
  missingFields: MissingFieldItem[];
};

const tabs: Array<{ key: ProfileTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'contact', label: 'Contact' },
  { key: 'coverage', label: 'Coverage' },
  { key: 'stories', label: 'Stories' },
  { key: 'notes', label: 'Notes' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'activity', label: 'Activity' },
];

export default function ReporterProfileDrawer({
  open,
  reporter,
  initialTab = 'overview',
  onClose,
  onOpenStories,
  onOpenQueue,
  onRefresh,
}: DrawerProps) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const [notesDraft, setNotesDraft] = useState('');

  const role = String(user?.role || '').trim().toLowerCase();
  const canManage = role === 'founder' || role === 'admin';
  const detailQuery = useQuery({
    queryKey: ['reporter-contact-detail', reporter?.id, reporter?.contactId, reporter?.reporterKey],
    queryFn: async () => loadReporterContactDetail(reporter),
    enabled: open && canManage && !!reporter,
    staleTime: 30_000,
    retry: false,
  });

  const resolvedReporter = useMemo(() => {
    if (!reporter) return null;
    const detailRaw = detailQuery.data;
    if (!detailRaw) return reporter;
    return {
      ...reporter,
      debugRawContact: detailRaw,
    } satisfies ReporterContact;
  }, [detailQuery.data, reporter]);

  const profile = useMemo(() => (resolvedReporter ? normalizeReporterProfile(resolvedReporter) : null), [resolvedReporter]);
  const contactId = profile?.contactId || '';

  const storiesQuery = useQuery({
    queryKey: ['reporter-contact-stories', contactId],
    queryFn: async () => listReporterStoriesForContact(contactId),
    enabled: open && !!contactId,
    staleTime: 30_000,
  });

  const storyRows = useMemo(() => {
    const payload = storiesQuery.data as { items?: ReporterStory[] } | undefined;
    return Array.isArray(payload?.items) ? payload.items : [];
  }, [storiesQuery.data]);

  const storySummary = useMemo(() => buildStorySummary(profile, storyRows), [profile, storyRows]);
  const taskItems = useMemo(() => (profile ? buildTaskItems(profile, storySummary) : []), [profile, storySummary]);
  const activityEvents = useMemo(() => (profile ? buildTimelineEvents(profile, storyRows) : []), [profile, storyRows]);

  const overviewMetrics = useMemo(() => {
    if (!profile) return [];
    return [
      { label: 'Stories', value: String(storySummary.total) },
      { label: 'Approved', value: String(storySummary.approved) },
      { label: 'Pending', value: String(storySummary.pending) },
      { label: 'Profile complete', value: `${profile.completeness}%` },
    ];
  }, [profile, storySummary]);

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
    }
  }, [initialTab, open]);

  useEffect(() => {
    setNotesDraft(profile?.notes || '');
  }, [profile?.reporterId, profile?.notes]);

  useEffect(() => {
  }, [reporter?.id, reporter?.contactId, reporter?.reporterKey]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!open || !profile || !isLocalhostRuntime()) return;
    console.info('[reporter-drawer]', {
      reporterId: profile.reporterId,
      rawProfile: profile.rawProfile,
      normalizedProfile: profile,
      resolvedHeader: {
        displayName: profile.displayName,
        status: profile.statusLabel,
        reporterType: profile.reporterTypeLabel,
        verification: profile.verificationLabel,
        email: profile.email || '—',
        phone: profile.phone || '—',
        location: profile.locationSummary,
      },
      resolvedContact: {
        email: profile.contact.email || '—',
        phone: profile.contact.phone || '—',
        whatsapp: profile.contact.whatsapp || '—',
        portalAuth: profile.contact.portalAuthLabel,
        authProvider: profile.contact.authProvider || '—',
        lastLoginAt: profile.contact.lastLoginAt || '—',
      },
      resolvedCoverage: {
        beats: profile.beats,
        area: profile.area || '—',
        areaType: profile.areaType || '—',
        city: profile.city || '—',
        district: profile.district || '—',
        state: profile.state || '—',
        country: profile.country || '—',
        coverageScope: profile.coverageScope || '—',
        coverageLanguage: profile.coverageLanguage,
        specialization: profile.specialization || '—',
      },
      storiesCount: storyRows.length,
      notesCount: hasValue(profile.notes) ? 1 : 0,
      tasksCount: taskItems.length,
      activityCount: activityEvents.length,
    });
  }, [activityEvents.length, open, profile, storyRows.length, taskItems.length]);

  useEffect(() => {
    if (!open || !profile || !reporter || !isLocalhostRuntime()) return;
    const raw = asRecord(profile.rawProfile);
    const phoneCandidates = buildPrivateAdminPhoneCandidates(reporter, raw);
    console.info('[reporter-contact-ui-phone]', {
      reporterId: profile.reporterId,
      email: profile.contact.email || profile.email || null,
      listRow: reporter,
      profilePayload: profile.rawProfile,
      candidatePhoneFields: phoneCandidates,
      phone: raw.phone ?? reporter.phone ?? null,
      rawPhone: raw.rawPhone ?? raw.phoneRaw ?? reporter.phoneRaw ?? null,
      phoneE164: raw.phoneE164 ?? raw.phone?.e164 ?? null,
      phoneValue: raw.phone?.value ?? raw.phone?.raw ?? null,
      phoneNumber: raw.phoneNumber ?? raw.contactPhoneNumber ?? raw.phone?.number ?? null,
      phoneFull: raw.phoneFull ?? raw.contactPhoneFull ?? raw.unmaskedPhone ?? raw.originalPhone ?? raw.phone?.full ?? null,
      phoneCountryCode: raw.phoneCountryCode ?? raw.countryCode ?? raw.phone?.countryCode ?? null,
      mobile: raw.mobile ?? raw.mobileNumber ?? raw.reporterMobile ?? raw.contact?.mobile ?? raw.profile?.mobile ?? null,
      contactNumber: raw.contactNumber ?? raw.contact?.phoneNumber ?? null,
      maskedPhone: raw.maskedPhone ?? raw.phoneMasked ?? raw.safePhone ?? raw.displayPhone ?? null,
      phonePreview: raw.phonePreview ?? raw.summaryPhone ?? raw.previewPhone ?? raw.contact?.phonePreview ?? raw.profile?.phonePreview ?? null,
      resolvedPhone: profile.contact.phone || 'Not provided',
    });
  }, [open, profile, reporter]);

  const saveNotesMutation = useMutation({
    mutationFn: async (nextNotes: string) => {
      const noteKey = String(profile?.reporterKey || profile?.reporterId || '').trim();
      if (!noteKey) throw new Error('Missing reporter id');
      return updateReporterContactNotes(noteKey, nextNotes);
    },
    onSuccess: async () => {
      toast.success('Notes saved');
      await invalidateReporterQueries(queryClient, onRefresh);
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to save notes');
    },
  });

  const statusMutation = useMutation({
    mutationFn: async (payload: { status?: any; verificationLevel?: any; addStrike?: boolean }) => {
      if (!reporter?.id) throw new Error('Missing reporter id');
      return updateReporterStatus(reporter.id, payload);
    },
    onSuccess: async () => {
      toast.success('Reporter updated');
      await invalidateReporterQueries(queryClient, onRefresh);
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update reporter');
    },
  });

  if (!open || !reporter || !profile) return null;

  const isRemovedFromDirectory = String(reporter?.directoryStatus || '').trim().toLowerCase() === 'removed'
    || normalizeDirectoryStatus(profile.status) === 'archived';
  const contactRecordId = resolveDrawerContactRecordId(reporter);

  const canShowCoverage = [
    profile.beats.length,
    profile.area,
    profile.areaType,
    profile.city,
    profile.district,
    profile.state,
    profile.country,
    profile.coverageScope,
    profile.coverageLanguage.length,
    profile.specialization,
    profile.organization,
    profile.position,
  ].some((value) => (typeof value === 'number' ? value > 0 : hasValue(value)));

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35">
      <button type="button" aria-label="Close profile drawer" onClick={onClose} className="flex-1 cursor-default" />
      <aside className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold text-slate-900">{profile.displayName}</h2>
              <Pill tone={statusTone(profile.status)}>{profile.statusLabel}</Pill>
              {profile.reporterType ? <Pill tone="blue">{profile.reporterTypeLabel}</Pill> : null}
              {profile.verificationLevel ? <Pill tone={verificationTone(profile.verificationLevel)}>{profile.verificationLabel}</Pill> : null}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
              <span>{profile.email || '—'}</span>
              <span>{profile.phone || '—'}</span>
              <span>{profile.locationSummary}</span>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-slate-200 px-4">
          <div className="flex gap-1 overflow-x-auto py-3">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={[
                  'rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors',
                  activeTab === tab.key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {activeTab === 'overview' ? (
            <div className="space-y-5">
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {overviewMetrics.map((item) => (
                  <MetricCard key={item.label} label={item.label} value={item.value} />
                ))}
              </section>

              <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <Panel title="Profile summary" subtitle="Operational snapshot for assignment, follow-up, and verification.">
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DataRow label="Reporter key" value={profile.reporterKey || profile.reporterId} />
                    <DataRow label="Type" value={profile.reporterTypeLabel} />
                    <DataRow label="Primary location" value={profile.locationSummary} />
                    <DataRow label="Coverage language" value={joinList(profile.coverageLanguage)} />
                    <DataRow label="Organization" value={profile.organization} />
                    <DataRow label="Position" value={profile.position} />
                  </dl>
                </Panel>

                <Panel title="Missing profile details" subtitle="Only flags fields that are actually absent in the current reporter record.">
                  {profile.missingFields.length ? (
                    <ul className="space-y-2 text-sm text-slate-700">
                      {profile.missingFields.map((item) => (
                        <li key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <div className="font-medium text-slate-900">{item.label}</div>
                          <div className="mt-1 text-slate-600">{item.detail}</div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState>Core profile details are present for this reporter.</EmptyState>
                  )}
                </Panel>
              </section>

              <Panel title="Quick actions" subtitle="Jump directly to the related newsroom workflow.">
                <div className="flex flex-wrap gap-2">
                  {profile.email ? <a href={`mailto:${profile.email}`} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Email reporter</a> : null}
                  {profile.phone ? <a href={`tel:${profile.phone}`} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Call reporter</a> : null}
                  {profile.whatsapp ? <a href={buildWhatsAppHref(profile.whatsapp)} target="_blank" rel="noreferrer" className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Open WhatsApp</a> : null}
                  {profile.reporterKey ? <button type="button" onClick={() => onOpenStories?.(profile.reporterKey)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Open stories</button> : null}
                  {profile.reporterKey ? <button type="button" onClick={() => onOpenQueue?.(profile.reporterKey)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Open queue</button> : null}
                </div>
              </Panel>
            </div>
          ) : null}

          {activeTab === 'contact' ? (
            <div className="space-y-4">
              <Panel title="Reporter contact profile" subtitle="Founder/admin private contact details resolved from directory records and live portal submissions.">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DataRow label="Full name" value={profile.fullName} missingValue="Not provided" />
                  <DataRow label="Email" value={profile.contact.email} missingValue="Not provided" />
                  <DataRow label="Phone" value={profile.contact.phone} missingValue="Not provided" />
                  <DataRow label="WhatsApp" value={profile.contact.whatsapp} missingValue="Not provided" />
                  <DataRow label="City" value={profile.city} missingValue="Not provided" />
                  <DataRow label="District" value={profile.district} missingValue="Not provided" />
                  <DataRow label="State" value={profile.state} missingValue="Not provided" />
                  <DataRow label="Country" value={profile.country} missingValue="Not provided" />
                  <DataRow label="Portal auth" value={buildPortalAuthDisplay(profile)} missingValue="Not provided" />
                  <DataRow label="Last portal login" value={formatDateTime(profile.contact.lastLoginAt, 'Not provided')} missingValue="Not provided" />
                </dl>
              </Panel>

              <Panel title="Additional routing details" subtitle="Operational location fields that help routing and assignment decisions.">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DataRow label="Area" value={profile.area} missingValue="Not provided" />
                  <DataRow label="Area type" value={profile.areaType} missingValue="Not provided" />
                  <DataRow label="Coverage scope" value={profile.coverageScope} missingValue="Not provided" />
                  <DataRow label="Auth provider" value={profile.contact.authProvider} missingValue="Not provided" />
                </dl>
              </Panel>
            </div>
          ) : null}

          {activeTab === 'coverage' ? (
            <div className="space-y-4">
              {canShowCoverage ? (
                <>
                  <Panel title="Coverage footprint" subtitle="Assignment geography and topical coverage derived from the normalized reporter profile.">
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <DataRow label="Beat" value={joinList(profile.beats)} />
                      <DataRow label="Area" value={profile.area} />
                      <DataRow label="Area type" value={profile.areaType} />
                      <DataRow label="City" value={profile.city} />
                      <DataRow label="District" value={profile.district} />
                      <DataRow label="State" value={profile.state} />
                      <DataRow label="Country" value={profile.country} />
                      <DataRow label="Coverage scope" value={profile.coverageScope} />
                      <DataRow label="Coverage language" value={joinList(profile.coverageLanguage)} />
                      <DataRow label="Assigned specialization" value={profile.specialization} />
                    </dl>
                  </Panel>

                  <Panel title="Professional context" subtitle="Publication and professional details that help desk-side assignment decisions.">
                    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <DataRow label="Organization" value={profile.organization} />
                      <DataRow label="Position" value={profile.position} />
                      <DataRow label="Website" value={profile.website} />
                      <DataRow label="Social" value={profile.social} />
                    </dl>
                  </Panel>
                </>
              ) : (
                <Panel title="Coverage profile" subtitle="Coverage data is only shown when the reporter record actually has it.">
                  <EmptyState>No coverage footprint has been stored for this reporter yet.</EmptyState>
                </Panel>
              )}
            </div>
          ) : null}

          {activeTab === 'stories' ? (
            <div className="space-y-4">
              <Panel title="Story activity" subtitle="Linked community stories and submission history for this reporter contact.">
                <div className="mb-4 flex flex-wrap gap-2">
                  {profile.reporterKey ? <button type="button" onClick={() => onOpenStories?.(profile.reporterKey)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Open story list</button> : null}
                  {profile.reporterKey ? <button type="button" onClick={() => onOpenQueue?.(profile.reporterKey)} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Open reporter queue</button> : null}
                  {contactId ? <button type="button" onClick={() => storiesQuery.refetch()} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Refresh stories</button> : null}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetricCard label="Total" value={String(storySummary.total)} />
                  <MetricCard label="Approved" value={String(storySummary.approved)} />
                  <MetricCard label="Pending" value={String(storySummary.pending)} />
                  <MetricCard label="Rejected" value={String(storySummary.rejected)} />
                </div>

                <div className="mt-4 divide-y rounded-xl border border-slate-200">
                  {contactId && storiesQuery.isLoading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="px-4 py-3">
                        <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                        <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                      </div>
                    ))
                  ) : storiesQuery.isError ? (
                    <div className="px-4 py-6">
                      <EmptyState>
                        {String((storiesQuery.error as any)?.message || 'Failed to load linked stories.')} Use Refresh stories to try again.
                      </EmptyState>
                    </div>
                  ) : storyRows.length ? storyRows.map((story) => (
                    <div key={story.id} className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{story.title}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                        <span>{formatDateTime(story.publishedAt || story.updatedAt || story.createdAt)}</span>
                        <span>{formatStoryState(story)}</span>
                        <span>{stringValue(story.language)}</span>
                      </div>
                    </div>
                  )) : (
                    <EmptyState>No linked stories were returned for this reporter.</EmptyState>
                  )}
                </div>
              </Panel>
            </div>
          ) : null}

          {activeTab === 'notes' ? (
            <div className="space-y-4">
              <Panel title="Internal notes" subtitle="Private newsroom notes for outreach, sourcing, and follow-up.">
                {hasValue(profile.notes) ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap">{profile.notes}</div>
                ) : (
                  <EmptyState>No private notes have been saved for this reporter yet.</EmptyState>
                )}

                <textarea
                  value={notesDraft}
                  onChange={(event) => setNotesDraft(event.target.value)}
                  rows={8}
                  placeholder="Add private notes, source guidance, or follow-up context..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
                />

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs text-slate-500">Notes stay inside the admin newsroom workflow for this selected reporter.</div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setNotesDraft('')}
                      disabled={saveNotesMutation.isPending || !notesDraft}
                      className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700 disabled:opacity-50"
                    >
                      Clear draft
                    </button>
                    <button
                      type="button"
                      onClick={() => saveNotesMutation.mutate(notesDraft)}
                      disabled={saveNotesMutation.isPending || notesDraft === profile.notes}
                      className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                    >
                      {saveNotesMutation.isPending ? 'Saving...' : 'Save notes'}
                    </button>
                  </div>
                </div>
              </Panel>
            </div>
          ) : null}

          {activeTab === 'tasks' ? (
            <div className="space-y-4">
              <Panel title="Follow-up tasks" subtitle="Derived from the selected reporter profile and linked story history. No stored backend task feed is available in this environment.">
                {taskItems.length ? (
                  <div className="space-y-3">
                    {taskItems.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="text-sm font-medium text-slate-900">{item.title}</div>
                        <div className="mt-1 text-sm text-slate-600">{item.detail}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState>No follow-up tasks are currently surfaced from this reporter record.</EmptyState>
                )}
              </Panel>
            </div>
          ) : null}

          {activeTab === 'activity' ? (
            <div className="space-y-4">
              <Panel title="Status and verification" subtitle="Use these controls to keep the reporter directory usable and accurate.">
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={!canManage || statusMutation.isPending} onClick={() => statusMutation.mutate({ verificationLevel: 'verified' })} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Mark verified</button>
                  <button type="button" disabled={!canManage || statusMutation.isPending} onClick={() => statusMutation.mutate({ verificationLevel: 'pending' })} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50">Mark pending</button>
                  <button type="button" disabled={!canManage || statusMutation.isPending} onClick={() => statusMutation.mutate({ addStrike: true })} className="rounded-md border border-rose-300 px-3 py-2 text-sm text-rose-700 hover:bg-rose-50 disabled:opacity-50">Add ethics strike</button>
                </div>
              </Panel>

              <Panel title="Activity timeline" subtitle="Sorted using available profile timestamps and linked story events.">
                {activityEvents.length ? (
                  <div className="space-y-3">
                    {activityEvents.map((event) => (
                      <TimelineRow key={event.id} event={event} />
                    ))}
                  </div>
                ) : (
                  <EmptyState>No activity timestamps are available for this reporter yet.</EmptyState>
                )}
              </Panel>

              <Panel title="Reporter record" subtitle="Current admin-facing identity and linkage metadata.">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DataRow label="Reporter id" value={profile.reporterId} />
                  <DataRow label="Contact id" value={profile.contactId} />
                  <DataRow label="Contributor id" value={profile.contributorId} />
                  <DataRow label="Identity source" value={profile.identitySource} />
                  <DataRow label="Created" value={formatDateTime(profile.createdAt)} />
                  <DataRow label="Updated" value={formatDateTime(profile.updatedAt)} />
                </dl>
              </Panel>
            </div>
          ) : null}

          {canManage ? (
            <div className="mt-5">
              <Panel title="Directory status" subtitle="Current visibility of this contact inside the Reporter Contact Directory.">
                <div className="space-y-4">
                  <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <DataRow label="Directory Status" value={isRemovedFromDirectory ? 'Removed' : 'Active'} />
                    <DataRow label="Contact record id" value={contactRecordId || '—'} />
                  </dl>
                  {isRemovedFromDirectory ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      This contact is currently removed from the visible Reporter Contact Directory.
                    </div>
                  ) : (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      This contact is currently visible in the active Reporter Contact Directory.
                    </div>
                  )}
                </div>
              </Panel>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

function DataRow({ label, value, missingValue = '—' }: { label: string; value: string; missingValue?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{value || missingValue}</dd>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500">{children}</div>;
}

function Pill({ children, tone }: { children: ReactNode; tone: Tone }) {
  const toneClass = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    rose: 'border-rose-200 bg-rose-50 text-rose-700',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
  }[tone];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs ${toneClass}`}>{children}</span>;
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const dotTone = {
    profile: 'bg-slate-400',
    story: 'bg-blue-500',
    auth: 'bg-emerald-500',
  }[event.kind];

  return (
    <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dotTone}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-medium text-slate-900">{event.title}</div>
          <div className="text-xs text-slate-500">{formatDateTime(event.at)}</div>
        </div>
        <div className="mt-1 text-sm text-slate-600">{event.detail}</div>
      </div>
    </div>
  );
}

async function invalidateReporterQueries(queryClient: ReturnType<typeof useQueryClient>, onRefresh?: () => void | Promise<void>) {
  await queryClient.invalidateQueries({ queryKey: ['reporter-contacts'] });
  await queryClient.invalidateQueries({ queryKey: ['reporter-contact-stories'] });
  if (onRefresh) await onRefresh();
}

function normalizeReporterProfile(reporter: ReporterContact): NormalizedReporterProfile {
  const raw = asRecord((reporter as any)?.debugRawContact);
  const coverageLanguage = uniqueStrings(
    reporter.coverageLanguage,
    reporter.languages,
    raw.coverageLanguage,
    raw.coverageLanguages,
    raw.languages,
    raw.languagesProfessional,
  );
  const beats = uniqueStrings(reporter.beatsProfessional, raw.beatsProfessional, raw.beats, raw.coverage?.beats);
  const phone = resolvePrivateAdminPhone(reporter, raw);
  const whatsapp = resolvePrivateAdminWhatsapp(buildPrivateAdminWhatsappCandidates(reporter, raw));
  const city = pickString(reporter.city, raw.city, raw.cityTownVillage, raw.cityName, raw.contact?.city, raw.profile?.city, raw.identity?.city, raw.reporter?.city, raw.location?.city, raw.locationDetail?.city, raw.location?.town, raw.location?.cityTownVillage);
  const district = pickString(reporter.district, raw.district, raw.districtName, raw.contact?.district, raw.profile?.district, raw.identity?.district, raw.reporter?.district, raw.location?.district, raw.locationDetail?.district, raw.talukaName);
  const state = pickString(reporter.state, raw.state, raw.stateName, raw.stateCode, raw.contact?.state, raw.profile?.state, raw.identity?.state, raw.reporter?.state, raw.location?.state, raw.locationDetail?.state, raw.location?.region);
  const country = pickString(reporter.country, raw.country, raw.countryName, raw.contact?.country, raw.profile?.country, raw.identity?.country, raw.reporter?.country, raw.location?.country, raw.locationDetail?.country, raw.location?.nation);
  const area = pickString(reporter.area, raw.area, raw.coverageArea, raw.contact?.area, raw.profile?.area, raw.identity?.area, raw.reporter?.area, raw.location?.area, raw.location?.locality, raw.locality, raw.subLocality);
  const areaType = formatEnumLabel(pickString(reporter.areaType, raw.areaType, raw.contact?.areaType, raw.profile?.areaType, raw.identity?.areaType, raw.reporter?.areaType, raw.location?.areaType, raw.locationDetail?.areaType));
  const coverageScope = formatEnumLabel(pickString(reporter.coverageScope, raw.coverageScope, raw.contact?.coverageScope, raw.profile?.coverageScope, raw.identity?.coverageScope, raw.reporter?.coverageScope, raw.coverage?.scope, raw.scope));
  const specialization = pickString(reporter.assignedSpecialization, raw.assignedSpecialization, raw.specialization, raw.specialisation, raw.coverage?.specialization);
  const organization = pickString(reporter.organisationName, raw.organisationName, raw.organizationName, raw.organization, raw.publication);
  const position = pickString(reporter.positionTitle, raw.positionTitle, raw.position, raw.designation);
  const website = pickString(reporter.websiteOrPortfolio, raw.websiteOrPortfolio, raw.website, raw.websiteUrl);
  const social = formatSocialLinks((reporter.socialLinks as any) ?? raw.socialLinks ?? raw.social);
  const fullName = pickString(reporter.name, raw.fullName, raw.name, raw.displayName, raw.userName, raw.contactName, raw.contact?.name, raw.profile?.name, raw.identity?.name, raw.reporter?.name, raw.reporter?.fullName, raw.user?.name);
  const email = pickString(reporter.email, raw.email, raw.contactEmail, raw.contact?.email, raw.profile?.email, raw.identity?.email, raw.reporter?.email, raw.user?.email);
  const displayName = fullName || pickString(email, reporter.reporterKey, reporter.id) || 'Reporter profile';
  const authStatus = pickString(reporter.authStatus, raw.authStatus, raw.portalAuthStatus, raw.reporterAuthStatus, raw.auth?.status, raw.identity?.authStatus, raw.reporter?.authStatus);
  const authProvider = pickString(reporter.authProvider, raw.authProvider, raw.portalAuthProvider, raw.reporterAuthProvider, raw.auth?.provider, raw.identity?.authProvider, raw.reporter?.authProvider);
  const emailVerified = typeof reporter.emailVerified === 'boolean'
    ? reporter.emailVerified
    : readOptionalBoolean(raw.emailVerified ?? raw.verifiedEmail ?? raw.identity?.emailVerified ?? raw.reporter?.emailVerified);
  const explicitPortalAuthEnabled = typeof reporter.portalAuthEnabled === 'boolean'
    ? reporter.portalAuthEnabled
    : readOptionalBoolean(raw.portalAuthEnabled ?? raw.auth?.enabled ?? raw.identity?.portalAuthEnabled ?? raw.identity?.authEnabled ?? raw.reporter?.portalAuthEnabled ?? raw.reporter?.authEnabled);
  const portalAuthEnabled = explicitPortalAuthEnabled ?? looksEnabledAuthStatus(authStatus);
  const contact: NormalizedReporterContact = {
    email,
    phone,
    whatsapp,
    portalAuthLabel: buildPortalAuthLabel(authStatus, authProvider, emailVerified, portalAuthEnabled),
    authProvider,
    lastLoginAt: pickString(reporter.lastLoginAt, raw.lastLoginAt, raw.portalLastLoginAt, raw.reporterLastLoginAt, raw.auth?.lastLoginAt, raw.identity?.lastLoginAt, raw.reporter?.lastLoginAt) || null,
  };
  const locationSummary = buildLocationSummary([area, city, district, state, country]) || 'Missing location';
  const missingFields = buildMissingFieldItems({
    reporterKey: reporter.reporterKey,
    email,
    phone,
    locationSummary,
    beats,
    coverageLanguage,
    organization,
    position,
    whatsapp,
  });

  const requiredFieldCount = 8;
  const missingCount = Math.min(requiredFieldCount, missingFields.length);
  const completeness = Math.max(0, Math.min(100, Math.round(((requiredFieldCount - missingCount) / requiredFieldCount) * 100)));

  return {
    reporterId: String(reporter.id || '').trim(),
    reporterKey: String(reporter.reporterKey || reporter.id || '').trim(),
    contactId: String(reporter.contactId || '').trim(),
    contributorId: String(reporter.contributorId || '').trim(),
    rawProfile: (reporter as any)?.debugRawContact ?? reporter,
    fullName,
    displayName,
    contact,
    email,
    phone,
    whatsapp,
    status: reporter.status,
    statusLabel: formatStatus(reporter.status),
    verificationLevel: reporter.verificationLevel,
    verificationLabel: formatVerification(reporter.verificationLevel),
    reporterType: reporter.reporterType,
    reporterTypeLabel: formatReporterType(reporter.reporterType),
    emailVerified,
    authStatus,
    authProvider,
    portalAuthEnabled,
    portalAuthLabel: contact.portalAuthLabel,
    identitySource: formatIdentitySource(reporter.identitySource ?? raw.identitySource ?? raw.identity?.source),
    lastLoginAt: contact.lastLoginAt,
    createdAt: pickString(reporter.createdAt, raw.createdAt, raw.contact?.createdAt, raw.profile?.createdAt) || null,
    updatedAt: pickString(reporter.updatedAt, raw.updatedAt, raw.contact?.updatedAt, raw.profile?.updatedAt) || null,
    lastSubmissionAt: pickString(reporter.lastSubmissionAt, raw.lastSubmissionAt, raw.lastSubmittedAt, raw.activity?.lastSubmissionAt) || null,
    lastStoryAt: pickString(reporter.lastStoryAt, raw.lastStoryAt, raw.lastStoryDate, raw.activity?.lastStoryAt) || null,
    locationSummary,
    city,
    district,
    state,
    country,
    area,
    areaType,
    coverageScope,
    coverageLanguage,
    beats,
    specialization,
    organization,
    position,
    website,
    social,
    notes: pickString(reporter.notes) || '',
    totalStories: Number(reporter.totalStories || 0),
    approvedStories: Number(reporter.approvedStories || 0),
    pendingStories: Number(reporter.pendingStories || 0),
    rejectedStories: Number(reporter.rejectedStories || 0),
    publishedStories: Number(reporter.publishedStories || 0),
    linkedStoryCount: typeof reporter.linkedStoryCount === 'number' ? reporter.linkedStoryCount : null,
    completeness,
    missingFields,
  };
}

function buildStorySummary(profile: NormalizedReporterProfile | null, stories: ReporterStory[]): StorySummary {
  if (stories.length) {
    return {
      total: stories.length,
      approved: stories.filter((story) => isApprovedStory(story)).length,
      pending: stories.filter((story) => isPendingStory(story)).length,
      rejected: stories.filter((story) => isRejectedStory(story)).length,
      latestAt: stories
        .map((story) => story.publishedAt || story.updatedAt || story.createdAt || null)
        .filter(Boolean)
        .sort(compareIsoDesc)[0] || null,
    };
  }

  return {
    total: Number(profile?.totalStories || 0),
    approved: Number(profile?.approvedStories || 0),
    pending: Number(profile?.pendingStories || 0),
    rejected: Number(profile?.rejectedStories || 0),
    latestAt: profile?.lastSubmissionAt || profile?.lastStoryAt || null,
  };
}

function buildTaskItems(profile: NormalizedReporterProfile, storySummary: StorySummary): DrawerTaskItem[] {
  const items: DrawerTaskItem[] = [];

  if (!hasValue(profile.phone)) {
    items.push({ id: 'phone', title: 'Capture a direct phone number', detail: 'This founder/admin profile does not yet have a usable direct phone number.' });
  }
  if (!hasValue(profile.whatsapp)) {
    items.push({ id: 'whatsapp', title: 'Add WhatsApp contact', detail: 'WhatsApp is missing, which limits fast assignment and follow-up.' });
  }
  if (!profile.beats.length) {
    items.push({ id: 'beats', title: 'Assign coverage beats', detail: 'No beat or topical specialization is mapped for this reporter.' });
  }
  if (profile.locationSummary === 'Missing location') {
    items.push({ id: 'location', title: 'Complete coverage location', detail: 'Area, city, district, state, or country is still missing from the profile.' });
  }
  if (!profile.portalAuthEnabled && hasValue(profile.email)) {
    items.push({ id: 'portal', title: 'Review portal access', detail: 'The reporter has an email address but portal auth is not currently active.' });
  }
  if (storySummary.total === 0) {
    items.push({ id: 'stories', title: 'Confirm story linkage', detail: 'No linked stories are visible for this reporter contact yet.' });
  }
  if (daysSince(profile.lastSubmissionAt || profile.lastStoryAt || profile.lastLoginAt) > 45) {
    items.push({ id: 'recency', title: 'Review recent activity', detail: 'This reporter has no recent submission or login signal in the last 45 days.' });
  }

  return items;
}

function buildTimelineEvents(profile: NormalizedReporterProfile, stories: ReporterStory[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (profile.updatedAt) {
    events.push({ id: 'profile-updated', title: 'Reporter profile updated', detail: 'The contact/profile record shows a recent update timestamp.', at: profile.updatedAt, kind: 'profile' });
  }
  if (profile.createdAt) {
    events.push({ id: 'profile-created', title: 'Reporter profile created', detail: 'The reporter contact record was created.', at: profile.createdAt, kind: 'profile' });
  }
  if (profile.lastLoginAt) {
    events.push({ id: 'portal-login', title: 'Portal login', detail: buildPortalAuthLabel(profile.authStatus, profile.authProvider, profile.emailVerified, profile.portalAuthEnabled), at: profile.lastLoginAt, kind: 'auth' });
  }
  if (profile.lastSubmissionAt || profile.lastStoryAt) {
    events.push({ id: 'last-submission', title: 'Recent reporter submission', detail: 'This is the latest submission or story timestamp currently linked to the reporter.', at: profile.lastSubmissionAt || profile.lastStoryAt, kind: 'story' });
  }

  stories.slice(0, 8).forEach((story) => {
    events.push({
      id: `story-${story.id}`,
      title: story.title,
      detail: formatStoryState(story),
      at: story.publishedAt || story.updatedAt || story.createdAt || null,
      kind: 'story',
    });
  });

  return events.sort((left, right) => compareIsoDesc(left.at, right.at));
}

function buildMissingFieldItems(input: {
  reporterKey?: string | null;
  email: string;
  phone: string;
  locationSummary: string;
  beats: string[];
  coverageLanguage: string[];
  organization: string;
  position: string;
  whatsapp: string;
}): MissingFieldItem[] {
  const items: MissingFieldItem[] = [];

  if (!hasValue(input.reporterKey)) {
    items.push({ label: 'Reporter key missing', detail: 'The directory record does not have a stable reporter key for downstream workflows.' });
  }
  if (!hasValue(input.email)) {
    items.push({ label: 'Email missing', detail: 'Add a reachable email address for assignments, verification, and follow-up.' });
  }
  if (!hasValue(input.phone)) {
    items.push({ label: 'Phone missing', detail: 'A full phone number is not currently available in the private reporter payload.' });
  }
  if (!hasValue(input.whatsapp)) {
    items.push({ label: 'WhatsApp missing', detail: 'No WhatsApp number is stored for this reporter.' });
  }
  if (input.locationSummary === 'Missing location') {
    items.push({ label: 'Location incomplete', detail: 'City, district, state, or country is still missing from the profile.' });
  }
  if (!input.beats.length) {
    items.push({ label: 'Coverage beat missing', detail: 'No beat or specialization has been assigned to this reporter.' });
  }
  if (!input.coverageLanguage.length) {
    items.push({ label: 'Coverage language missing', detail: 'No coverage language is mapped for this reporter profile.' });
  }
  if (!hasValue(input.organization)) {
    items.push({ label: 'Organization missing', detail: 'The reporter is not linked to an organization or publication yet.' });
  }
  if (!hasValue(input.position)) {
    items.push({ label: 'Position missing', detail: 'The reporter role or position has not been captured yet.' });
  }

  return items;
}

function buildPrivateAdminPhoneCandidates(reporter: ReporterContact, raw: Record<string, any> = {}) {
  const directPhoneCandidates = PHONE_DIRECT_PRIORITY_GROUPS.flatMap((paths) => collectCandidateStrings(reporter, raw, [...paths]));
  const previewPhoneCandidates = collectCandidateStrings(reporter, raw, [
    'maskedPhone',
    'phoneMasked',
    'safePhone',
    'displayPhone',
    'phonePreview',
    'summaryPhone',
    'previewPhone',
    'contact.phonePreview',
    'profile.phonePreview',
  ]);
  return [...directPhoneCandidates, ...previewPhoneCandidates.filter((value) => !directPhoneCandidates.includes(value))];
}

function buildPrivateAdminWhatsappCandidates(reporter: ReporterContact, raw: Record<string, any> = {}) {
  return collectCandidateStrings(reporter, raw, [
    'whatsapp',
    'whatsappNumber',
    'whatsApp',
    'contact.whatsappNumber',
    'contact.whatsapp',
    'contact.whatsApp',
    'profile.whatsappNumber',
    'profile.whatsapp',
    'profile.whatsApp',
    'identity.whatsappNumber',
    'identity.whatsapp',
    'identity.whatsApp',
    'reporter.whatsapp',
    'reporter.whatsappNumber',
    'reporter.whatsApp',
  ]);
}

function resolvePrivateAdminPhone(reporter: ReporterContact, raw: Record<string, any> = {}) {
  for (const paths of PHONE_DIRECT_PRIORITY_GROUPS) {
    const directCandidate = pickPreferredPhoneCandidate(collectCandidateStrings(reporter, raw, [...paths]), false);
    if (directCandidate) return directCandidate;
  }

  const maskedCandidate = pickPreferredPhoneCandidate(collectCandidateStrings(reporter, raw, [...PHONE_PREVIEW_PRIORITY_PATHS]), true);
  return maskedCandidate || '';
}
const PHONE_DIRECT_PRIORITY_GROUPS = [
  ['phone', 'contact.phone', 'profile.phone', 'identity.phone', 'reporter.phone', 'phone.value'],
  ['rawPhone', 'phoneRaw', 'contact.phoneRaw', 'contact.rawPhone', 'profile.phoneRaw', 'profile.rawPhone', 'identity.phoneRaw', 'identity.rawPhone', 'reporter.phoneRaw', 'reporter.rawPhone', 'phone.raw', 'phoneFull', 'contactPhoneFull', 'contact.phoneFull', 'unmaskedPhone', 'originalPhone', 'phone.full', 'phoneE164', 'contact.phoneE164', 'profile.phoneE164', 'identity.phoneE164', 'reporter.phoneE164', 'phone.e164'],
  ['mobile', 'contact.mobile', 'profile.mobile', 'reporter.mobile', 'identity.mobile'],
  ['mobileNumber', 'contact.mobileNumber', 'reporter.mobileNumber'],
  ['contactNumber', 'contact.contactNumber', 'profile.contactNumber', 'identity.contactNumber', 'reporter.contactNumber', 'contact.phoneNumber', 'identity.phoneNumber', 'reporter.phoneNumber', 'phoneNumber', 'contactPhoneNumber', 'phone.number'],
  ['reporterPhone', 'contactPhone'],
  ['reporterMobile'],
] as const;

function buildPortalAuthDisplay(profile: NormalizedReporterProfile) {
  if (hasValue(profile.authStatus) || hasValue(profile.authProvider) || typeof profile.emailVerified === 'boolean' || profile.portalAuthEnabled) {
    return profile.contact.portalAuthLabel;
  }
  return '';
}

const PHONE_PREVIEW_PRIORITY_PATHS = [
  'maskedPhone',
  'phoneMasked',
  'safePhone',
  'displayPhone',
  'phonePreview',
  'summaryPhone',
  'previewPhone',
  'contact.phonePreview',
  'profile.phonePreview',
] as const;

function pickPreferredPhoneCandidate(candidates: string[], allowMasked: boolean) {
  if (allowMasked) return candidates[0] || '';
  return candidates.find((value) => !looksMaskedPhone(value)) || '';
}

function readOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return null;
  if (['true', '1', 'yes', 'enabled', 'active', 'verified'].includes(raw)) return true;
  if (['false', '0', 'no', 'disabled', 'inactive', 'unverified'].includes(raw)) return false;
  return null;
}


function resolvePrivateAdminWhatsapp(candidates: string[]) {
  return candidates.find((value) => !looksMaskedPhone(value)) || candidates[0] || '';
}

function formatStoryState(story: ReporterStory) {
  const primary = pickString(story.approvalState, story.status);
  return primary || 'Unknown status';
}

function isApprovedStory(story: ReporterStory) {
  const status = `${story.status || ''} ${story.approvalState || ''}`.toLowerCase();
  return ['approved', 'accepted', 'published', 'live'].some((token) => status.includes(token));
}

function isPendingStory(story: ReporterStory) {
  const status = `${story.status || ''} ${story.approvalState || ''}`.toLowerCase();
  return ['pending', 'review', 'under_review', 'submitted'].some((token) => status.includes(token));
}

function isRejectedStory(story: ReporterStory) {
  const status = `${story.status || ''} ${story.approvalState || ''}`.toLowerCase();
  return ['rejected', 'declined', 'withdrawn'].some((token) => status.includes(token));
}

function compareIsoDesc(left?: string | null, right?: string | null) {
  const leftTs = toTimestamp(left);
  const rightTs = toTimestamp(right);
  return rightTs - leftTs;
}

function toTimestamp(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? (value as Record<string, any>) : {};
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function readPath(source: unknown, path: string) {
  const segments = path.split('.');
  let current: any = source;
  for (const segment of segments) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[segment];
  }
  return current;
}

function collectCandidateStrings(reporter: ReporterContact, raw: Record<string, any>, paths: string[]) {
  const values = new Set<string>();
  paths.forEach((path) => {
    [readPath(reporter, path), readPath(raw, path)].forEach((value) => {
      const text = String(value || '').trim();
      if (text) values.add(text);
    });
  });
  return Array.from(values);
}

function uniqueStrings(...values: unknown[]) {
  const items = new Set<string>();

  values.forEach((value) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => {
        const text = String(entry || '').trim();
        if (text) items.add(text);
      });
      return;
    }

    const text = String(value || '').trim();
    if (!text) return;

    if (text.includes(',')) {
      text.split(',').map((entry) => entry.trim()).filter(Boolean).forEach((entry) => items.add(entry));
      return;
    }

    items.add(text);
  });

  return Array.from(items);
}

function buildLocationSummary(parts: Array<string | null | undefined>) {
  return parts.map((value) => String(value || '').trim()).filter(Boolean).join(', ');
}

function buildPortalAuthLabel(status: string, provider: string, emailVerified: boolean | null, enabled: boolean) {
  const state = enabled ? 'Enabled' : status ? formatEnumLabel(status) : 'Unavailable';
  const suffix = [provider ? formatEnumLabel(provider) : '', emailVerified === true ? 'Email verified' : emailVerified === false ? 'Email unverified' : '']
    .filter(Boolean)
    .join(' · ');
  return suffix ? `${state} · ${suffix}` : state;
}

function buildWhatsAppHref(value: string) {
  const digits = String(value || '').replace(/\D+/g, '');
  return digits ? `https://wa.me/${digits}` : '#';
}

function formatSocialLinks(value: any) {
  if (!value || typeof value !== 'object') return '';
  return Object.values(value)
    .map((entry) => String(entry || '').trim())
    .filter(Boolean)
    .join(' · ');
}

function looksEnabledAuthStatus(value: unknown) {
  const raw = String(value || '').trim().toLowerCase();
  return ['active', 'enabled', 'verified', 'authenticated'].includes(raw);
}

function stringValue(value: unknown) {
  const text = String(value || '').trim();
  return text || '—';
}

function hasValue(value: unknown) {
  return String(value || '').trim().length > 0;
}

function joinList(value: unknown) {
  if (Array.isArray(value)) {
    const items = value.map((item) => String(item || '').trim()).filter(Boolean);
    return items.length ? items.join(', ') : '—';
  }
  const text = String(value || '').trim();
  return text || '—';
}

function looksMaskedPhone(value: string) {
  const text = String(value || '').trim();
  if (!text) return false;
  if (/[xX*•]/.test(text)) return true;
  const digits = text.replace(/\D+/g, '');
  return digits.length >= 4 && digits.length <= 6;
}

async function loadReporterContactDetail(reporter: ReporterContact | null) {
  if (!reporter) return null;

  const id = String(reporter.id || '').trim();
  if (!id) return null;

  const path = `/community-reporter/contacts/${encodeURIComponent(id)}`;
  try {
    const res = await adminApi.get<any>(path);
    const payload = unwrapReporterContactDetail(res?.data);
    if (import.meta.env.DEV) {
      try {
        console.info('[reporter-contacts-ui-api]', {
          action: 'detail',
          url: adminUrl(path),
          method: 'GET',
          id,
          status: res?.status ?? null,
          count: payload ? 1 : 0,
        });
      } catch {
        // ignore logging failures
      }
    }
    return payload && typeof payload === 'object' ? payload : null;
  } catch (lastError: any) {
    if (import.meta.env.DEV) {
      try {
        console.info('[reporter-contacts-ui-api]', {
          action: 'detail',
          url: adminUrl(path),
          method: 'GET',
          id,
          status: lastError?.response?.status ?? null,
          count: null,
        });
      } catch {
        // ignore logging failures
      }
    }

    return null;
  }
}

function unwrapReporterContactDetail(payload: any) {
  if (!payload) return null;
  if (payload?.ok === false) return null;
  if (Array.isArray(payload)) return payload[0] ?? null;
  if (payload?.item && typeof payload.item === 'object') return payload.item;
  if (payload?.row && typeof payload.row === 'object') return payload.row;
  if (payload?.contact && typeof payload.contact === 'object') return payload.contact;
  if (payload?.contributor && typeof payload.contributor === 'object') return payload.contributor;
  if (payload?.reporter && typeof payload.reporter === 'object') return payload.reporter;
  if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data.item ?? payload.data.row ?? payload.data.contact ?? payload.data.contributor ?? payload.data.reporter ?? payload.data;
  }
  return typeof payload === 'object' ? payload : null;
}

function isLocalhostRuntime() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  return LOCALHOST_HOSTS.has(window.location.hostname);
}

function formatEnumLabel(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatReporterType(value: ReporterContact['reporterType']) {
  return value === 'journalist' ? 'Journalist' : value === 'community' ? 'Community Reporter' : 'Unknown';
}

function formatVerification(value: ReporterContact['verificationLevel']) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'Unverified';
  if (raw === 'community_default') return 'Community Default';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatStatus(value: ReporterContact['status']) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'Active';
  if (raw === 'archived') return 'Archived';
  if (raw === 'active') return 'Active';
  return formatEnumLabel(raw);
}

function verificationTone(value: ReporterContact['verificationLevel']): Tone {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'verified') return 'green';
  if (raw === 'pending' || raw === 'limited') return 'amber';
  if (raw === 'revoked') return 'rose';
  return 'slate';
}

function statusTone(value: ReporterContact['status']): Tone {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'active') return 'green';
  if (raw === 'archived') return 'slate';
  if (raw === 'pending') return 'amber';
  return 'rose';
}

function formatDateTime(value?: string | null, missingValue = '—') {
  const raw = String(value || '').trim();
  if (!raw) return missingValue;
  const timestamp = new Date(raw).getTime();
  return Number.isFinite(timestamp) && timestamp > 0 ? new Date(timestamp).toLocaleString() : missingValue;
}

function formatIdentitySource(value: unknown) {
  const raw = String(value || '').trim();
  return raw ? formatEnumLabel(raw) : '—';
}

function daysSince(value?: string | null) {
  const raw = String(value || '').trim();
  if (!raw) return Infinity;
  const timestamp = new Date(raw).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return Infinity;
  return (Date.now() - timestamp) / (1000 * 60 * 60 * 24);
}

function normalizeDirectoryStatus(value: ReporterContact['status']) {
  return String(value || '').trim().toLowerCase();
}

function resolveDrawerContactRecordId(reporter: ReporterContact | null | undefined) {
  if (!reporter) return '';
  const raw = asRecord((reporter as any)?.debugRawContact);
  return pickString(
    reporter.contactId,
    (reporter as any)?.contactRecordId,
    raw.contactId,
    raw.contactID,
    raw.contactRecordId,
    raw.contactRecordID,
    raw.contact?._id,
    raw.contact?.id,
    raw._id,
  );
}
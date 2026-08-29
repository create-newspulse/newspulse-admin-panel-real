import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FOUNDER_MODULE_POLICY_VERSION_ERROR, isModulePolicyVersionConflict, modulePolicyErrorMessage } from '@/api/ownerZone';
import { useFounderModulePolicy } from '@/hooks/useFounderModulePolicy';
import { ADMIN_MODULES, type AdminModuleKey } from '@/lib/adminAccessControl';
import {
  ADMIN_MODULE_POLICY_EVENT,
  ADMIN_POLICY_MODULE_KEYS,
  DEFAULT_ADMIN_MODULE_POLICY,
  createFounderOnlyModulePolicy,
  type AdminModulePolicyMap,
  type AdminModulePolicyState,
  type SerializedModulePolicyPayload,
} from '@/lib/adminModulePolicy';

type ModuleGroup = { title: string; modules: { key: AdminModuleKey; description: string }[] };

const POLICY_LABELS: Record<AdminModulePolicyState, string> = {
  founder_only: 'Founder Only',
  available: 'Available to Staff',
  staff_locked: 'Locked for Staff',
  hidden: 'Hidden from Staff',
};

const POLICY_EXPLANATIONS: Record<AdminModulePolicyState, string> = {
  available: 'Staff can use this module when their individual access includes it.',
  staff_locked: 'The module stays visible to staff but route access is denied for all staff.',
  hidden: 'The module is removed from staff navigation and remains unavailable by direct route.',
  founder_only: 'Only the Founder can access this module.',
};

const MODULE_GROUPS: ModuleGroup[] = [
  {
    title: 'Editorial & Newsroom',
    modules: [
      { key: 'add_news', description: 'Create new newsroom articles and story entries.' },
      { key: 'manage_news', description: 'Review, edit, publish, and maintain article records.' },
      { key: 'draft_desk', description: 'Coordinate drafts and desk review work.' },
      { key: 'community_reporter_queue', description: 'Review community reporter submissions and queues.' },
      { key: 'reporter_portal_admin', description: 'Manage reporter portal administration workflows.' },
      { key: 'editorial', description: 'Open editorial workspaces and review tools.' },
      { key: 'seo', description: 'Manage SEO checks, metadata, and newsroom optimization.' },
      { key: 'marketing', description: 'Grow the audience, manage advertiser leads, and coordinate marketing campaigns.' },
    ],
  },
  {
    title: 'Media & Broadcast',
    modules: [
      { key: 'broadcast_center', description: 'Operate broadcast planning and control workflows.' },
      { key: 'media', description: 'Access media library uploads and newsroom assets.' },
      { key: 'viral_videos', description: 'Manage viral video entries and related media.' },
      { key: 'aira', description: 'Access AIRA assistant controls.' },
      { key: 'live_tv', description: 'Prepare and manage Live TV controls.' },
    ],
  },
  {
    title: 'Business & Performance',
    modules: [
      { key: 'ads_manager', description: 'Manage ad inventory, campaigns, and sponsor workflows.' },
      { key: 'finance_desk', description: 'Access finance records, invoices, revenue, and expenses.' },
      { key: 'analytics', description: 'View performance dashboards and newsroom analytics.' },
    ],
  },
  {
    title: 'Compliance & Administration',
    modules: [
      { key: 'compliance_reports', description: 'Prepare and review compliance reporting records.' },
      { key: 'dpdp_privacy_requests', description: 'Manage DPDP privacy request workflows.' },
      { key: 'ai_engine', description: 'Control News Pulse Engine configuration and operations.' },
      { key: 'settings', description: 'Open Admin Panel settings and operational configuration.' },
    ],
  },
];

const FIXED_CONTROLS = [
  { name: 'Dashboard', status: 'Always available' },
  { name: 'My Account', status: 'Always available' },
  { name: 'Dark Mode', status: 'Always available' },
  { name: 'Logout', status: 'Always available' },
  { name: 'Safe Zone', status: 'Founder only' },
];

const BULK_CONFIRMATION_TEXT = 'SET ALL MODULES FOUNDER ONLY';
const BULK_RESTRICTION_WARNING = 'This will immediately prevent every non-Founder account from opening all configurable Admin Panel modules. Individual Staff Access settings will remain stored but will not be effective until a module is changed back to Available to Staff.';
const MODULE_POLICY_CONFLICT_MESSAGE = 'Founder Access Control changed since this page was loaded. Refresh the latest policy.';

function moduleLabel(moduleKey: AdminModuleKey) {
  return ADMIN_MODULES.find((item) => item.key === moduleKey)?.label || moduleKey;
}

function policyCounts(policy: AdminModulePolicyMap) {
  return ADMIN_POLICY_MODULE_KEYS.reduce(
    (acc, moduleKey) => {
      const state = policy[moduleKey]?.state || DEFAULT_ADMIN_MODULE_POLICY[moduleKey]?.state || 'founder_only';
      acc[state] += 1;
      return acc;
    },
    { available: 0, staff_locked: 0, hidden: 0, founder_only: 0 } as Record<AdminModulePolicyState, number>,
  );
}

function changedModules(saved: AdminModulePolicyMap, draft: AdminModulePolicyMap) {
  return ADMIN_POLICY_MODULE_KEYS.filter((moduleKey) => (saved[moduleKey]?.state || DEFAULT_ADMIN_MODULE_POLICY[moduleKey]?.state || 'founder_only') !== (draft[moduleKey]?.state || DEFAULT_ADMIN_MODULE_POLICY[moduleKey]?.state || 'founder_only'));
}

export default function FounderAccessControl() {
  const {
    savedPolicy: saved,
    draftPolicy: draft,
    loadedVersion,
    isLoading,
    isSaving,
    error: loadError,
    hasChanges,
    versionIsValid,
    refresh,
    setDraftPolicy,
    resetChanges: resetDraftChanges,
    previewPolicy,
    savePolicy: saveDraftPolicy,
  } = useFounderModulePolicy();
  const [auditReason, setAuditReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [conflictWarning, setConflictWarning] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewedPayload, setReviewedPayload] = useState<SerializedModulePolicyPayload | null>(null);
  const [reviewedSignature, setReviewedSignature] = useState('');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [bulkStep, setBulkStep] = useState<'idle' | 'confirm' | 'apply'>('idle');
  const [bulkAuditReason, setBulkAuditReason] = useState('');
  const [bulkTypedConfirmation, setBulkTypedConfirmation] = useState('');
  const [bulkAttemptedApply, setBulkAttemptedApply] = useState(false);
  const changes = useMemo(() => changedModules(saved, draft), [saved, draft]);
  const counts = useMemo(() => policyCounts(draft), [draft]);
  const trimmedReason = auditReason.trim();
  const draftSignature = useMemo(() => ADMIN_POLICY_MODULE_KEYS.map((moduleKey) => `${moduleKey}:${draft[moduleKey]?.state || DEFAULT_ADMIN_MODULE_POLICY[moduleKey]?.state || 'founder_only'}`).join('|'), [draft]);
  const currentReviewSignature = `${draftSignature}::${trimmedReason}`;
  const reviewApprovedForCurrentDraft = Boolean(reviewOpen && reviewedPayload && reviewedSignature === currentReviewSignature);
  const canSave = hasChanges && !isSaving && versionIsValid && reviewApprovedForCurrentDraft;
  const bulkReason = bulkAuditReason.trim();
  const bulkConfirmationMatches = bulkTypedConfirmation.trim() === BULK_CONFIRMATION_TEXT;

  const versionError = !isLoading && !loadError && !versionIsValid ? FOUNDER_MODULE_POLICY_VERSION_ERROR : null;
  const displayError = conflictWarning ? versionError || loadError?.message || null : error || versionError || loadError?.message || null;

  const setModuleState = (moduleKey: AdminModuleKey, state: AdminModulePolicyState) => {
    setDraftPolicy({ ...draft, [moduleKey]: { ...(draft[moduleKey] || { moduleKey }), moduleKey, state } });
    setReviewOpen(false);
    setReviewedPayload(null);
    setReviewedSignature('');
  };

  const resetChanges = () => {
    resetDraftChanges();
    setAuditReason('');
    setReviewOpen(false);
    setReviewedPayload(null);
    setReviewedSignature('');
    setAttemptedSave(false);
  };

  const handleVersionConflict = () => {
    setConflictWarning(true);
    setError(MODULE_POLICY_CONFLICT_MESSAGE);
    toast.error(MODULE_POLICY_CONFLICT_MESSAGE);
  };

  const refreshLatestPolicy = async () => {
    if (hasChanges && !window.confirm('Refresh latest Founder policy and discard your unsaved changes?')) return;
    setConflictWarning(false);
    setError(null);
    try {
      await refresh({ force: true });
      setAuditReason('');
      setReviewOpen(false);
      setReviewedPayload(null);
      setReviewedSignature('');
      setAttemptedSave(false);
      toast.success('Latest Founder policy loaded');
    } catch (err: any) {
      const message = modulePolicyErrorMessage(err) || 'Failed to load Founder access policy.';
      setError(message);
      toast.error(message);
    }
  };

  const reviewChanges = async () => {
    setAttemptedSave(true);
    if (!changes.length || !versionIsValid) return;
    if (!trimmedReason) return;
    setIsPreviewing(true);
    try {
      const preview = await previewPolicy(trimmedReason);
      setReviewedPayload(preview.payload);
      setReviewedSignature(currentReviewSignature);
      setReviewOpen(true);
      setError(null);
    } catch (err: any) {
      setReviewOpen(false);
      setReviewedPayload(null);
      setReviewedSignature('');
      const message = modulePolicyErrorMessage(err) || 'Failed to preview Founder access policy.';
      setError(message);
      toast.error(message);
    } finally {
      setIsPreviewing(false);
    }
  };

  const closeBulkRestriction = () => {
    setBulkStep('idle');
    setBulkAuditReason('');
    setBulkTypedConfirmation('');
    setBulkAttemptedApply(false);
  };

  const savePolicy = async () => {
    setAttemptedSave(true);
    if (!reviewApprovedForCurrentDraft || !reviewedPayload) return;
    if (!trimmedReason) return;
    if (!changes.length) return;
    try {
      const next = await saveDraftPolicy(reviewedPayload);
      setAuditReason('');
      setReviewOpen(false);
      setReviewedPayload(null);
      setReviewedSignature('');
      setAttemptedSave(false);
      setError(null);
      setConflictWarning(false);
      window.dispatchEvent(new CustomEvent(ADMIN_MODULE_POLICY_EVENT, { detail: next.policy }));
      toast.success('Founder access policy saved');
    } catch (err: any) {
      if (isModulePolicyVersionConflict(err)) {
        handleVersionConflict();
        return;
      }
      const message = modulePolicyErrorMessage(err) || 'Failed to save Founder access policy.';
      setError(message);
      toast.error(message);
    }
  };

  const applyBulkFounderOnly = async () => {
    setBulkAttemptedApply(true);
    if (!bulkReason || !bulkConfirmationMatches) return;
    const nextDraft = createFounderOnlyModulePolicy(draft);
    setDraftPolicy(nextDraft);
    try {
      const preview = await previewPolicy(bulkReason, nextDraft);
      const next = await saveDraftPolicy(preview.payload);
      setAuditReason('');
      setReviewOpen(false);
      setReviewedPayload(null);
      setReviewedSignature('');
      setAttemptedSave(false);
      closeBulkRestriction();
      setError(null);
      setConflictWarning(false);
      window.dispatchEvent(new CustomEvent(ADMIN_MODULE_POLICY_EVENT, { detail: next.policy }));
      toast.success('All configurable modules set to Founder Only');
    } catch (err: any) {
      if (isModulePolicyVersionConflict(err)) {
        handleVersionConflict();
        return;
      }
      const message = modulePolicyErrorMessage(err) || 'Failed to save Founder access policy.';
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Founder Access Control</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Globally control whether Admin Panel modules are available to staff, locked for all staff, hidden from staff, or restricted to the Founder.
            </p>
            <p className="mt-3 max-w-3xl rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium leading-6 text-blue-900">
              To grant a staff member access, first change the module to Available to Staff here, then enable that module for the selected staff member under Staff Access &amp; Special Rights.
            </p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            Founder-only policy page
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Available to Staff" value={counts.available} />
          <SummaryCard label="Locked for Staff" value={counts.staff_locked} />
          <SummaryCard label="Hidden from Staff" value={counts.hidden} />
          <SummaryCard label="Founder Only" value={counts.founder_only} />
          <SummaryCard label="Unsaved Changes" value={changes.length} tone={changes.length ? 'amber' : 'slate'} />
        </div>
      </div>

      {displayError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{displayError}</div>
      ) : null}

      {conflictWarning ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-950">
          <div>{MODULE_POLICY_CONFLICT_MESSAGE}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setReviewOpen(true)} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100">Review My Unsaved Changes</button>
            <button type="button" onClick={refreshLatestPolicy} className="rounded-lg bg-amber-700 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600">Refresh Latest Policy</button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-900">Loading saved Founder access policy. Controls remain available with the safe default Founder-only policy until the saved policy is loaded.</div>
      ) : null}

          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-red-950">Emergency Access Restriction</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-red-800">{BULK_RESTRICTION_WARNING}</p>
              </div>
              <button
                type="button"
                onClick={() => setBulkStep('confirm')}
                disabled={!versionIsValid || isSaving}
                className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Set All Modules to Founder Only
              </button>
            </div>
          </section>

          {MODULE_GROUPS.map((group) => (
            <section key={group.title} className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-950">{group.title}</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.modules.map((item) => {
                  const policy = draft[item.key] || DEFAULT_ADMIN_MODULE_POLICY[item.key];
                  const state = policy?.state || 'founder_only';
                  return (
                    <div key={item.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-slate-950">{moduleLabel(item.key)}</h3>
                          <p className="mt-1 text-sm leading-6 text-slate-600">{item.description}</p>
                        </div>
                        <select
                          className="min-w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                          value={state}
                          disabled={!versionIsValid || isSaving}
                          onChange={(event) => setModuleState(item.key, event.target.value as AdminModulePolicyState)}
                          aria-label={`${moduleLabel(item.key)} global state`}
                        >
                          {Object.entries(POLICY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 sm:grid-cols-2">
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Individual staff access</div>
                          <div className="mt-1 font-medium text-slate-900">{typeof policy?.staffWithIndividualAccess === 'number' ? policy.staffWithIndividualAccess : 'Not reported'}</div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected state</div>
                          <div className="mt-1 font-medium text-slate-900">{POLICY_LABELS[state]}</div>
                        </div>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{POLICY_EXPLANATIONS[state]}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">Fixed Controls</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {FIXED_CONTROLS.map((item) => (
                <div key={item.name} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-sm font-semibold text-slate-950">{item.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.status}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">Policy version: {versionIsValid ? loadedVersion : 'Unavailable'}</div>
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
              <label className="block">
                <span className="text-sm font-semibold text-slate-950">Audit Reason</span>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  value={auditReason}
                  onChange={(event) => setAuditReason(event.target.value)}
                  placeholder="Describe why this global policy change is needed."
                />
                {attemptedSave && !trimmedReason ? <span className="mt-2 block text-sm text-red-600">Audit Reason is required.</span> : null}
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={resetChanges} disabled={!changes.length && !auditReason} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">Reset Changes</button>
                <button type="button" onClick={reviewChanges} disabled={!changes.length || !versionIsValid || isPreviewing} className="rounded-lg border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50">{isPreviewing ? 'Previewing...' : 'Review Changes'}</button>
                <button type="button" onClick={savePolicy} disabled={!canSave} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? 'Saving...' : 'Save Founder Policy'}</button>
              </div>
            </div>
            {attemptedSave && trimmedReason && !reviewApprovedForCurrentDraft ? <div className="mt-3 text-sm text-red-600">Review Changes is required before saving.</div> : null}

            {reviewOpen ? (
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Before / After</h3>
                <div className="mt-3 space-y-2">
                  {changes.map((moduleKey) => (
                    <div key={moduleKey} className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                      <span className="font-semibold text-slate-950">{moduleLabel(moduleKey)}:</span>{' '}
                      {POLICY_LABELS[saved[moduleKey]?.state || DEFAULT_ADMIN_MODULE_POLICY[moduleKey]?.state || 'founder_only']} <span aria-hidden="true">-&gt;</span> {POLICY_LABELS[draft[moduleKey]?.state || DEFAULT_ADMIN_MODULE_POLICY[moduleKey]?.state || 'founder_only']}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {bulkStep !== 'idle' ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
              <div role="dialog" aria-modal="true" aria-labelledby="bulk-founder-only-title" className="w-full max-w-2xl rounded-2xl border border-red-200 bg-white p-5 shadow-2xl">
                <h2 id="bulk-founder-only-title" className="text-xl font-semibold text-red-950">Emergency Access Restriction</h2>
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium leading-6 text-red-900">{BULK_RESTRICTION_WARNING}</p>

                {bulkStep === 'confirm' ? (
                  <div className="mt-5 space-y-4">
                    <p className="text-sm leading-6 text-slate-700">This is the first confirmation step. Continue only if the Founder intends to restrict every configurable Admin Panel module for all non-Founder accounts.</p>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={closeBulkRestriction} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                      <button type="button" onClick={() => setBulkStep('apply')} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600">Continue to Typed Confirmation</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-950">Audit Reason</span>
                      <textarea
                        className="mt-2 min-h-24 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                        value={bulkAuditReason}
                        onChange={(event) => setBulkAuditReason(event.target.value)}
                        placeholder="Explain why emergency Founder-only restriction is required."
                      />
                      {bulkAttemptedApply && !bulkReason ? <span className="mt-2 block text-sm text-red-600">Audit Reason is required.</span> : null}
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-950">Type {BULK_CONFIRMATION_TEXT}</span>
                      <input
                        className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-100"
                        value={bulkTypedConfirmation}
                        onChange={(event) => setBulkTypedConfirmation(event.target.value)}
                      />
                      {bulkAttemptedApply && !bulkConfirmationMatches ? <span className="mt-2 block text-sm text-red-600">Typed confirmation must match exactly.</span> : null}
                    </label>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button type="button" onClick={closeBulkRestriction} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancel</button>
                      <button type="button" onClick={applyBulkFounderOnly} disabled={isSaving || !versionIsValid} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? 'Applying...' : 'Apply'}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
    </div>
  );
}

function SummaryCard({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'amber' }) {
  const toneClass = tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-900';
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-wide opacity-75">{label}</div>
    </div>
  );
}
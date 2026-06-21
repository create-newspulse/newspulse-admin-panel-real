import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '@context/AuthContext';
import AccountPasswordForm from '@/components/account/AccountPasswordForm';
import {
  accountErrorMessage,
  changeFounderEmail,
  getAccountSessions,
  getFounderMyAccount,
  getStaffMyAccount,
  logoutAllMyDevices,
  type AccountProfile,
  type AccountSession,
} from '@/api/accountApi';

const FOUNDER_STAFF_ID = 'NP-FND-0001';
const FOUNDER_NAME = 'Kiran Parmar';

type BadgeTone = 'emerald' | 'rose' | 'blue' | 'slate' | 'amber' | 'violet';

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase();
}

function displayText(value: unknown, fallback = '-'): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ') || fallback;
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  const text = String(value || '').trim();
  return text || fallback;
}

function displayDateTime(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '-';
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleString();
}

function displayDate(value: unknown): string {
  const text = String(value || '').trim();
  if (!text) return '-';
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? text : date.toLocaleDateString();
}

function titleCase(value: unknown, fallback = '-'): string {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return text.split(/[\s_-]+/).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`).join(' ');
}

function profileName(profile: AccountProfile | null, authUser: any): string {
  return displayText(profile?.name || profile?.fullName || authUser?.name, 'Staff');
}

function profileEmail(profile: AccountProfile | null, authUser: any): string {
  return displayText(profile?.email || authUser?.email);
}

function profileRecoveryEmail(profile: AccountProfile | null, authUser: any): string {
  return displayText(profile?.recoveryEmail || profile?.recovery_email || profile?.backupEmail || profile?.recovery || profile?.founderRecoveryEmail || authUser?.recoveryEmail || authUser?.recovery_email || authUser?.backupEmail || authUser?.recovery || authUser?.founderRecoveryEmail);
}

function profileRole(profile: AccountProfile | null, authUser: any): string {
  return titleCase(profile?.role || authUser?.role, 'Staff');
}

function hasMustChangePassword(profile: AccountProfile | null, authUser: any): boolean {
  return profile?.mustChangePassword === true || profile?.passwordChangeRequired === true || profile?.forcePasswordChange === true || authUser?.mustChangePassword === true || authUser?.passwordChangeRequired === true || authUser?.forcePasswordChange === true;
}

function founderEmailChangeAvailable(profile: AccountProfile | null): boolean {
  return profile?.founderEmailChangeApiAvailable === true || profile?.canChangeFounderEmail === true || profile?.protectedEmailChangeEnabled === true;
}

function emailLooksValid(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function founderEmailChangeErrorMessage(error: unknown): string {
  const status = Number((error as any)?.status ?? (error as any)?.response?.status ?? 0);
  if (status === 401) return 'Session expired. Please login again.';
  if (status === 403) return 'Access Denied. Founder permission required.';
  if (status === 404) return 'Backend API missing.';
  if (status === 409) return 'Email already exists.';
  return accountErrorMessage(error, 'Failed to update Founder email.');
}

function sessionStatus(profile: AccountProfile | null, sessions: AccountSession[]): string {
  const raw = profile?.sessionStatus || profile?.authSessionStatus || sessions.find((session) => session.current || session.isCurrent)?.sessionStatus || sessions.find((session) => session.current || session.isCurrent)?.status;
  if (raw) return titleCase(raw, 'Active Session');
  return 'Active Session';
}

function currentSession(sessions: AccountSession[]): AccountSession | null {
  return sessions.find((session) => session.current || session.isCurrent) || sessions[0] || null;
}

function Badge({ children, tone = 'slate' }: { children: string; tone?: BadgeTone }) {
  const map: Record<BadgeTone, string> = {
    emerald: 'border-emerald-200 bg-emerald-100 text-emerald-800',
    rose: 'border-rose-200 bg-rose-100 text-rose-800',
    blue: 'border-blue-200 bg-blue-100 text-blue-800',
    slate: 'border-slate-200 bg-slate-100 text-slate-700',
    amber: 'border-amber-200 bg-amber-100 text-amber-800',
    violet: 'border-violet-200 bg-violet-100 text-violet-800',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${map[tone]}`}>{children}</span>;
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-base font-semibold text-slate-950">{title}</div>
          {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-600">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
      <div className="mt-1 font-medium text-slate-900">{value}</div>
    </div>
  );
}

function FounderAccessDenied() {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-950 shadow-sm">
      <h1 className="text-2xl font-semibold">Access Denied</h1>
      <p className="mt-3 text-sm leading-6">Founder My Account is protected. You do not have permission to access this page.</p>
    </div>
  );
}

function useAccountData(loadProfile: () => Promise<AccountProfile>) {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [sessions, setSessions] = useState<AccountSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextProfile, nextSessions] = await Promise.all([
        loadProfile(),
        getAccountSessions().catch(() => [] as AccountSession[]),
      ]);
      setProfile(nextProfile || {});
      setSessions(nextSessions);
    } catch (err) {
      setProfile(null);
      setError(accountErrorMessage(err, 'Failed to load account details.'));
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    void load();
  }, [load]);

  return { profile, sessions, loading, error, reload: load };
}

function SessionsCard({ profile, sessions }: { profile: AccountProfile | null; sessions: AccountSession[] }) {
  const [loggingOut, setLoggingOut] = useState(false);
  const session = currentSession(sessions);
  const device = displayText([session?.device || profile?.device, session?.browser || profile?.browser].filter(Boolean).join(' / '));

  const runLogoutAll = async () => {
    setLoggingOut(true);
    try {
      await logoutAllMyDevices();
      toast.success('All your devices were logged out');
    } catch (err) {
      toast.error(accountErrorMessage(err, 'Logout all my devices failed'));
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <Card title="My Sessions">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ReadOnlyField label="Current session" value={sessionStatus(profile, sessions)} />
        <ReadOnlyField label="Last login" value={displayDateTime(session?.lastLogin || session?.lastLoginAt || session?.loginAt || profile?.lastLogin || profile?.lastLoginAt || profile?.loginAt)} />
        <ReadOnlyField label="Last logout" value={displayDateTime(session?.lastLogout || session?.lastLogoutAt || session?.logoutAt || profile?.lastLogout || profile?.lastLogoutAt || profile?.logoutAt)} />
        <ReadOnlyField label="Device" value={device} />
      </div>
      <button type="button" onClick={runLogoutAll} disabled={loggingOut} className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50">
        {loggingOut ? 'Logging out...' : 'Logout all my devices'}
      </button>
    </Card>
  );
}

function FounderEmailChangeCard({ profile, onChanged }: { profile: AccountProfile | null; onChanged: () => void }) {
  const [newEmail, setNewEmail] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiMissing, setApiMissing] = useState(false);
  const currentEmail = profileEmail(profile, null);
  const currentRecoveryEmail = profileRecoveryEmail(profile, null);
  const canUseEmailChange = founderEmailChangeAvailable(profile) && !apiMissing;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedEmail = newEmail.trim().toLowerCase();
    const trimmedRecoveryEmail = recoveryEmail.trim().toLowerCase();
    const trimmedReason = reason.trim();
    if (!emailLooksValid(trimmedEmail)) {
      setError('Enter a valid new Founder email.');
      return;
    }
    if (trimmedRecoveryEmail && !emailLooksValid(trimmedRecoveryEmail)) {
      setError('Enter a valid recovery email.');
      return;
    }
    if (!trimmedReason) {
      setError('Reason for Change is required.');
      return;
    }
    if (!confirmed) {
      setError('Confirm that you understand this changes the protected Founder login email.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await changeFounderEmail({ newEmail: trimmedEmail, recoveryEmail: trimmedRecoveryEmail || undefined, reason: trimmedReason });
      toast.success('Founder email updated');
      setNewEmail('');
      setRecoveryEmail('');
      setReason('');
      setConfirmed(false);
      onChanged();
    } catch (err) {
      const message = founderEmailChangeErrorMessage(err);
      if (Number((err as any)?.status ?? 0) === 404) setApiMissing(true);
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canUseEmailChange) {
    return (
      <Card title="Change Founder Email/Login ID">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-900">Founder email change requires backend protected API. Use backend repair script first.</div>
      </Card>
    );
  }

  return (
    <Card title="Change Founder Email/Login ID" subtitle="This changes the protected Founder login email only. Staff ID and Founder role remain locked.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1.5 text-sm font-semibold text-slate-800">Current Email/Login ID<input value={currentEmail} readOnly aria-readonly="true" className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900" /></label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-800">New Email/Login ID<input type="email" value={newEmail} onChange={(event) => setNewEmail(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" required /></label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-800">Recovery Email<input type="email" value={recoveryEmail} onChange={(event) => setRecoveryEmail(event.target.value)} placeholder={currentRecoveryEmail === '-' ? 'recovery@example.com' : currentRecoveryEmail} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" /></label>
          <label className="space-y-1.5 text-sm font-semibold text-slate-800 md:col-span-2">Reason for Change<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900" required /></label>
        </div>
        <label className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm font-semibold leading-6 text-rose-900">
          <input type="checkbox" className="mt-1" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} required />
          I understand this changes the protected Founder login email.
        </label>
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</div> : null}
        <button type="submit" disabled={submitting || !confirmed} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-700">{submitting ? 'Updating...' : 'Update Founder Email'}</button>
      </form>
    </Card>
  );
}

export function FounderMyAccount() {
  const { user } = useAuth();
  const role = normalize(user?.role);
  const loadFounderProfile = useCallback(() => getFounderMyAccount(), []);
  const { profile, sessions, loading, error, reload } = useAccountData(loadFounderProfile);
  const mustChangePassword = hasMustChangePassword(profile, user);

  if (role && role !== 'founder') return <FounderAccessDenied />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">Founder My Account</h1>
        <p className="mt-1 text-sm leading-6 text-slate-600">Protected Founder account, password, security, and owner profile.</p>
        {mustChangePassword ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">You must change your temporary password before continuing.</div> : null}
      </div>

      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading account...</div> : null}
      {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{error}</div> : null}

      <Card title="Founder Profile">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ReadOnlyField label="Full Name" value={FOUNDER_NAME} />
          <ReadOnlyField label="Email/Login ID" value={profileEmail(profile, user)} />
          <ReadOnlyField label="Recovery Email" value={profileRecoveryEmail(profile, user)} />
          <ReadOnlyField label="Staff ID" value={FOUNDER_STAFF_ID} />
          <ReadOnlyField label="Role" value="Founder" />
          <ReadOnlyField label="Account Status" value={titleCase(profile?.accountStatus || profile?.status, 'Active')} />
          <ReadOnlyField label="Last Login" value={displayDateTime(profile?.lastLogin || profile?.lastLoginAt || profile?.loginAt || currentSession(sessions)?.lastLogin || currentSession(sessions)?.lastLoginAt || currentSession(sessions)?.loginAt)} />
          <ReadOnlyField label="Last Password Changed" value={displayDateTime(profile?.lastPasswordChanged || profile?.lastPasswordChangedAt || profile?.passwordChangedAt)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5"><Badge tone="rose">Founder</Badge><Badge tone="emerald">Full Access</Badge><Badge tone="rose">Protected</Badge></div>
      </Card>

      <Card title="Founder Protection Notice">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-900">Founder account is permanently protected. It cannot be deleted, suspended, demoted, or restricted by staff/admin actions.</div>
      </Card>

      <AccountPasswordForm title="Change Founder Password" description="Founder changes the Founder account password here. Team staff resets remain in Team Management." currentPasswordHelper="Current password is the temporary password used to login, until Founder changes it." buttonLabel="Update Password" onChanged={reload} />

      <FounderEmailChangeCard profile={profile} onChanged={reload} />

      <SessionsCard profile={profile} sessions={sessions} />

      <Card title="Future Security Placeholder">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">Two-Step Authentication planned later.</div>
      </Card>
    </div>
  );
}

export function StaffMyAccount() {
  const { user } = useAuth();
  const role = normalize(user?.role);
  const loadStaffProfile = useCallback(() => getStaffMyAccount(), []);
  const { profile, sessions, loading, error, reload } = useAccountData(loadStaffProfile);
  const mustChangePassword = hasMustChangePassword(profile, user);
  const coverageArea = profile?.coverageArea || profile?.coverageAreas;
  const workItems = useMemo(() => [
    { label: 'Attendance', value: profile?.attendance },
    { label: 'Schedule', value: profile?.schedule },
    { label: 'Leave status', value: profile?.leaveStatus },
  ].filter((item) => item.value !== undefined && item.value !== null && displayText(item.value) !== '-'), [profile]);

  if (role === 'founder') return <Navigate to="/admin/founder/my-account" replace />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">My Account</h1>
        <p className="mt-1 text-sm leading-6 text-slate-600">View your account details and change your own password.</p>
        {mustChangePassword ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">You must change your temporary password before continuing.</div> : null}
      </div>

      {loading ? <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading account...</div> : null}
      {error ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{error}</div> : null}

      <Card title="Staff Profile">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ReadOnlyField label="Name" value={profileName(profile, user)} />
          <ReadOnlyField label="Email/Login ID" value={profileEmail(profile, user)} />
          <ReadOnlyField label="Staff ID" value={displayText(profile?.staffId || user?.staffId, 'Pending ID')} />
          <ReadOnlyField label="Role" value={profileRole(profile, user)} />
          <ReadOnlyField label="Department" value={displayText(profile?.department)} />
          <ReadOnlyField label="Assigned Sections" value={displayText(profile?.assignedSections)} />
          <ReadOnlyField label="Coverage Area" value={displayText(coverageArea)} />
          <ReadOnlyField label="Designation" value={displayText(profile?.designation)} />
          <ReadOnlyField label="Account Status" value={titleCase(profile?.accountStatus || profile?.status, 'Active')} />
          <ReadOnlyField label="Access Expiry Date" value={displayDate(profile?.accessExpiryDate || profile?.accessExpiresAt || profile?.expiresAt)} />
          <ReadOnlyField label="Session Status" value={sessionStatus(profile, sessions)} />
        </div>
      </Card>

      <AccountPasswordForm title="Change My Password" description="Change Password is for your own password only." buttonLabel="Update Password" onChanged={reload} />

      <SessionsCard profile={profile} sessions={sessions} />

      {workItems.length ? (
        <Card title="My Work Info">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {workItems.map((item) => <ReadOnlyField key={item.label} label={item.label} value={displayText(item.value)} />)}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

export function ChangePasswordSettingsRedirect() {
  const { user } = useAuth();
  const target = normalize(user?.role) === 'founder' ? '/admin/founder/my-account#change-password' : '/admin/my-account#change-password';
  return <Navigate to={target} replace />;
}
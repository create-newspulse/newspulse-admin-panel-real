import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearFounderModulePolicyCache,
  createFounderModulePolicyPayload,
  FOUNDER_MODULE_POLICY_VERSION_ERROR,
  FOUNDER_MODULE_POLICY_API,
  getFounderModulePolicySnapshot,
  getFounderModulePolicy,
  getFounderModulePolicyAudit,
  previewFounderModulePolicy,
  putFounderModulePolicy,
} from '@/api/ownerZone';
import { DEFAULT_ADMIN_MODULE_POLICY, serializeModulePolicyPayload } from '@/lib/adminModulePolicy';

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: { error: mocks.toastError },
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fetchCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map(([url, init]) => ({ url: String(url), init: init as RequestInit | undefined }));
}

function requestMethods(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchCalls(fetchMock).map((call) => call.init?.method || 'GET');
}

function requestJson(call: { init: RequestInit | undefined }) {
  return JSON.parse(String(call.init?.body || '{}'));
}

beforeEach(() => {
  clearFounderModulePolicyCache();
});

afterEach(() => {
  clearFounderModulePolicyCache();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Founder module policy API client', () => {
  it('uses the existing safe-owner-zone module-policy routes and methods', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ policy: { modulePolicies: { addNews: 'staff_locked' } }, version: 7 }));
    vi.stubGlobal('fetch', fetchMock);

    await getFounderModulePolicy();
    await previewFounderModulePolicy(createFounderModulePolicyPayload(DEFAULT_ADMIN_MODULE_POLICY, 'Preview policy', 7));
    await putFounderModulePolicy(createFounderModulePolicyPayload(DEFAULT_ADMIN_MODULE_POLICY, 'Save policy', 7));
    await getFounderModulePolicyAudit(25);

    expect(FOUNDER_MODULE_POLICY_API).toEqual({
      load: '/admin/safe-owner-zone/module-policy',
      preview: '/admin/safe-owner-zone/module-policy/preview',
      save: '/admin/safe-owner-zone/module-policy',
      audit: '/admin/safe-owner-zone/module-policy/audit',
    });
    expect(fetchCalls(fetchMock).map((call) => call.url)).toEqual([
      '/admin-api/admin/safe-owner-zone/module-policy',
      '/admin-api/admin/safe-owner-zone/module-policy/preview',
      '/admin-api/admin/safe-owner-zone/module-policy',
      '/admin-api/admin/safe-owner-zone/module-policy/audit?limit=25',
    ]);
    expect(requestMethods(fetchMock)).toEqual(['GET', 'POST', 'PUT', 'GET']);
    expect(fetchCalls(fetchMock).every((call) => !call.url.includes('/admin-api/admin/module-policy'))).toBe(true);
  });

  it('coalesces concurrent policy loads into one request', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ policy: { modulePolicies: { manageNews: 'available' } }, version: 3 }));
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([getFounderModulePolicy(), getFounderModulePolicy()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchCalls(fetchMock)[0].url).toBe('/admin-api/admin/safe-owner-zone/module-policy');
  });

  it('does not retry a confirmed missing module-policy route', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ message: 'Route not found' }, 404));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getFounderModulePolicy()).rejects.toMatchObject({ status: 404 });
    await expect(getFounderModulePolicy()).rejects.toMatchObject({ status: 404 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchCalls(fetchMock)[0].url).toBe('/admin-api/admin/safe-owner-zone/module-policy');
    expect(fetchCalls(fetchMock).every((call) => !call.url.includes('/admin-api/admin/module-policy'))).toBe(true);
  });

  it('GET stores the exact backend policy version with no fake fallback', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ policy: { modulePolicies: { addNews: 'available' } }, version: 13 }));
    vi.stubGlobal('fetch', fetchMock);

    const snapshot = await getFounderModulePolicySnapshot();

    expect(snapshot.version).toBe(13);
    expect(snapshot.policy.add_news.state).toBe('available');
  });

  it('rejects missing or invalid backend versions instead of inventing one', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ policy: { modulePolicies: { addNews: 'available' } } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getFounderModulePolicySnapshot()).rejects.toThrow(FOUNDER_MODULE_POLICY_VERSION_ERROR);
  });

  it('save and preview always send expectedVersion', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ policy: { modulePolicies: { addNews: 'available' } }, version: 14 }));
    vi.stubGlobal('fetch', fetchMock);

    await previewFounderModulePolicy(createFounderModulePolicyPayload(DEFAULT_ADMIN_MODULE_POLICY, 'Preview policy', 13));
    await putFounderModulePolicy(createFounderModulePolicyPayload(DEFAULT_ADMIN_MODULE_POLICY, 'Save policy', 13));

    const calls = fetchCalls(fetchMock);
    expect(requestJson(calls[0]).expectedVersion).toBe(13);
    expect(requestJson(calls[1]).expectedVersion).toBe(13);
  });

  it('serializes UI policy keys and labels to the backend modulePolicies contract', () => {
    const payload = serializeModulePolicyPayload({
      ...DEFAULT_ADMIN_MODULE_POLICY,
      dashboard: { moduleKey: 'dashboard', state: 'available' },
      add_news: { moduleKey: 'add_news', state: 'Available to Staff' as any },
      manage_news: { moduleKey: 'manage_news', state: 'Locked for Staff' as any },
      dpdp_privacy_requests: { moduleKey: 'dpdp_privacy_requests', state: 'Hidden from Staff' as any },
      safe_zone: { moduleKey: 'safe_zone', state: 'founder_only' },
    }, 'Contract validation', 21);

    expect(payload).toEqual(expect.objectContaining({ expectedVersion: 21, auditReason: 'Contract validation' }));
    expect(payload.modulePolicies).toEqual(expect.objectContaining({ addNews: 'available', manageNews: 'staff_locked', dpdpCompliance: 'hidden' }));
    expect(payload.modulePolicies).not.toHaveProperty('Add News');
    expect(payload.modulePolicies).not.toHaveProperty('add_news');
    expect(payload.modulePolicies).not.toHaveProperty('dashboard');
    expect(payload.modulePolicies).not.toHaveProperty('safeZone');
  });

  it('does not permit undefined expectedVersion for save or preview', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ policy: { modulePolicies: { addNews: 'available' } }, version: 14 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(previewFounderModulePolicy({ ...createFounderModulePolicyPayload(DEFAULT_ADMIN_MODULE_POLICY, 'Preview policy', 1), expectedVersion: undefined as any })).rejects.toThrow(FOUNDER_MODULE_POLICY_VERSION_ERROR);
    await expect(putFounderModulePolicy({ ...createFounderModulePolicyPayload(DEFAULT_ADMIN_MODULE_POLICY, 'Save policy', 1), expectedVersion: undefined as any })).rejects.toThrow(FOUNDER_MODULE_POLICY_VERSION_ERROR);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, postMock, putMock, patchMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  putMock: vi.fn(),
  patchMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('@/lib/adminApiClient', () => ({
  adminApiClient: {
    get: getMock,
    post: postMock,
    put: putMock,
    patch: patchMock,
    delete: deleteMock,
  },
}));

import {
  checkSeoSitemaps,
  createSeoRedirect,
  deleteSeoRedirect,
  getLatestSeoAudit,
  getSeoAuditStatus,
  getSeoSitemapStatus,
  listSeoAuditHistory,
  listSeoRedirects,
  normalizeSeoAudit,
  setSeoRedirectActive,
  startSeoAudit,
  testSeoRedirect,
  updateSeoRedirect,
} from '@/lib/api/seo';

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockResolvedValue({ data: {} });
  postMock.mockResolvedValue({ data: {} });
  putMock.mockResolvedValue({ data: {} });
  patchMock.mockResolvedValue({ data: {} });
  deleteMock.mockResolvedValue({ data: {} });
});

describe('SEO API client endpoints', () => {
  it('loads audit history with the expected limit query', async () => {
    getMock.mockResolvedValueOnce({ data: { audits: [] } });

    await listSeoAuditHistory({ limit: 1 });

    expect(getMock).toHaveBeenCalledWith('seo/audit/history', { params: { limit: 1, page: 1 } });
  });

  it('loads the latest SEO audit from the dedicated latest endpoint', async () => {
    getMock.mockResolvedValueOnce({ data: { audit: { id: 'latest-audit', status: 'completed', score: 82 } } });

    const latest = await getLatestSeoAudit();

    expect(getMock).toHaveBeenCalledWith('seo/audit/latest');
    expect(latest?.id).toBe('latest-audit');
    expect(latest?.score).toBe(82);
  });

  it('starts a new audit at the real SEO audit endpoint', async () => {
    postMock.mockResolvedValueOnce({ data: { audit: { id: 'a1', status: 'queued' } } });

    await startSeoAudit();

    expect(postMock).toHaveBeenCalledWith('seo/audit', { mode: 'quick', deep: false });
  });

  it('starts a full audit as a deep scan when explicitly requested', async () => {
    postMock.mockResolvedValueOnce({ data: { audit: { id: 'a1', status: 'queued' } } });

    await startSeoAudit({ mode: 'full' });

    expect(postMock).toHaveBeenCalledWith('seo/audit', { mode: 'full', deep: true });
  });

  it('loads live audit status from the status endpoint', async () => {
    getMock.mockResolvedValueOnce({ data: { audit: { id: 'a1', status: 'running', progressPercent: 39 } } });

    const status = await getSeoAuditStatus('a1');

    expect(getMock).toHaveBeenCalledWith('seo/audit/a1/status');
    expect(status.status).toBe('running');
    expect(status.progressPercent).toBe(39);
  });

  it('loads active audit status from the fixed status endpoint', async () => {
    getMock.mockResolvedValueOnce({ data: { audit: { id: 'latest', status: 'completed' } } });

    await getSeoAuditStatus();

    expect(getMock).toHaveBeenCalledWith('seo/audit/status');
  });

  it('uses the redirects endpoints for list, create, update, toggle, delete, and test', async () => {
    const payload = { sourcePath: '/old', destination: '/new', type: 302 as const, reason: 'temporary campaign', active: true };

    await listSeoRedirects();
    await createSeoRedirect(payload);
    await updateSeoRedirect('r1', payload);
    await setSeoRedirectActive('r1', false);
    await deleteSeoRedirect('r1');
    await testSeoRedirect('/old');

    expect(getMock).toHaveBeenCalledWith('seo/redirects');
    expect(postMock).toHaveBeenCalledWith('seo/redirects', payload);
    expect(patchMock).toHaveBeenCalledWith('seo/redirects/r1', payload);
    expect(patchMock).toHaveBeenCalledWith('seo/redirects/r1', { active: false });
    expect(deleteMock).toHaveBeenCalledWith('seo/redirects/r1');
    expect(getMock).toHaveBeenCalledWith('seo/redirects/resolve', { params: { path: '/old' } });
  });

  it('uses the sitemap status and check endpoints', async () => {
    await getSeoSitemapStatus();
    await checkSeoSitemaps();

    expect(getMock).toHaveBeenCalledWith('seo/sitemap');
    expect(postMock).toHaveBeenCalledWith('seo/sitemap/check', {});
  });

  it('prefers real nested SEO scores over stale legacy score fields', () => {
    const normalized = normalizeSeoAudit({ score: 0, summary: { seoScore: 78, pagesChecked: 90, passedChecks: 950 } });

    expect(normalized.score).toBe(78);
    expect(normalized.pagesChecked).toBe(90);
    expect(normalized.passedChecks).toBe(950);
  });

  it('normalizes real audit progress fields separately from total pages', () => {
    const normalized = normalizeSeoAudit({ status: 'running', pagesChecked: 35, totalPages: 90, progressPercent: 39, currentStage: 'Scanning pages', elapsedSeconds: 18 });

    expect(normalized.pagesChecked).toBe(35);
    expect(normalized.totalPages).toBe(90);
    expect(normalized.progressPercent).toBe(39);
    expect(normalized.currentStage).toBe('Scanning pages');
    expect(normalized.elapsedSeconds).toBe(18);
  });

  it('normalizes staff identity without showing raw database ids', () => {
    const withStaff = normalizeSeoAudit({ startedBy: { name: 'Kiran Patel', staffId: 'NP-001' } });
    const withDatabaseId = normalizeSeoAudit({ startedBy: '66c2f6e2a5f6c3d41a0c2222' });

    expect(withStaff.startedBy).toBe('Kiran Patel · NP-001');
    expect(withStaff.startedByName).toBe('Kiran Patel');
    expect(withStaff.startedByStaffId).toBe('NP-001');
    expect(withDatabaseId.startedBy).toBe('Staff account unavailable');
  });
});
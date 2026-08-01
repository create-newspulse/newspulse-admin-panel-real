import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SEOToolsDashboard from '@/components/advanced/SEOToolsDashboard';

const ACCESS_DENIED_MESSAGE = 'Access Denied. Founder permission is required.';

const mocks = vi.hoisted(() => ({
  user: { role: 'founder', permissions: ['seo.run_audit', 'seo.manage_redirects', 'seo.delete_redirects', 'seo.check_sitemaps'] } as any,
  getLatestSeoAudit: vi.fn(),
  listSeoAuditHistory: vi.fn(),
  startSeoAudit: vi.fn(),
  getSeoAuditStatus: vi.fn(),
  listSeoRedirects: vi.fn(),
  createSeoRedirect: vi.fn(),
  updateSeoRedirect: vi.fn(),
  setSeoRedirectActive: vi.fn(),
  deleteSeoRedirect: vi.fn(),
  testSeoRedirect: vi.fn(),
  getSeoSitemapStatus: vi.fn(),
  checkSeoSitemaps: vi.fn(),
  listArticles: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user }),
}));

vi.mock('@/lib/api/seo', () => ({
  getLatestSeoAudit: mocks.getLatestSeoAudit,
  listSeoAuditHistory: mocks.listSeoAuditHistory,
  startSeoAudit: mocks.startSeoAudit,
  getSeoAuditStatus: mocks.getSeoAuditStatus,
  listSeoRedirects: mocks.listSeoRedirects,
  createSeoRedirect: mocks.createSeoRedirect,
  updateSeoRedirect: mocks.updateSeoRedirect,
  setSeoRedirectActive: mocks.setSeoRedirectActive,
  deleteSeoRedirect: mocks.deleteSeoRedirect,
  testSeoRedirect: mocks.testSeoRedirect,
  getSeoSitemapStatus: mocks.getSeoSitemapStatus,
  checkSeoSitemaps: mocks.checkSeoSitemaps,
}));

vi.mock('@/lib/api/articles', () => ({
  listArticles: mocks.listArticles,
}));

vi.mock('react-hot-toast', () => ({
  default: { success: mocks.toastSuccess, error: vi.fn() },
}));

function audit(overrides: Record<string, any> = {}) {
  return {
    id: 'audit-1',
    status: 'completed',
    score: 78,
    pagesChecked: 42,
    totalPages: 42,
    criticalIssues: 1,
    warnings: 2,
    passedChecks: 20,
    desktopPerformance: { score: 82, status: 'measured' },
    mobilePerformance: { score: null, status: 'not_configured' },
    progress: null,
    progressPercent: null,
    currentStage: '',
    elapsedSeconds: null,
    mode: 'quick',
    startedAt: '2026-08-01T10:00:00.000Z',
    completedAt: '2026-08-01T10:04:00.000Z',
    durationMs: 240000,
    startedBy: 'founder@newspulse.co.in',
    safeErrorMessage: '',
    issues: [
      {
        id: 'canonical-1',
        severity: 'critical',
        category: 'canonical',
        pageUrl: '/news/example-story',
        title: 'Missing canonical URL',
        explanation: 'Canonical URL is missing.',
        currentValue: 'empty',
        recommendedAction: 'Add the public article canonical URL.',
        checkCode: 'canonical.missing',
      },
      {
        id: 'meta-1',
        severity: 'warning',
        category: 'meta',
        pageUrl: '/news/second-story',
        title: 'Meta description too short',
        explanation: 'Description is short.',
        currentValue: '42 chars',
        recommendedAction: 'Write a fuller summary.',
        checkCode: 'meta.description.short',
      },
    ],
    raw: {},
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user = { role: 'founder', permissions: ['seo.run_audit', 'seo.manage_redirects', 'seo.delete_redirects', 'seo.check_sitemaps'] };
  mocks.getLatestSeoAudit.mockResolvedValue(audit());
  mocks.listSeoAuditHistory.mockResolvedValue([audit()]);
  mocks.startSeoAudit.mockResolvedValue(audit({ id: 'audit-2', status: 'queued', score: null }));
  mocks.getSeoAuditStatus.mockResolvedValue(audit());
  mocks.listSeoRedirects.mockResolvedValue([]);
  mocks.createSeoRedirect.mockResolvedValue({});
  mocks.updateSeoRedirect.mockResolvedValue({});
  mocks.setSeoRedirectActive.mockResolvedValue({});
  mocks.deleteSeoRedirect.mockResolvedValue(undefined);
  mocks.testSeoRedirect.mockResolvedValue({ ok: true, status: 301, finalUrl: '/new', message: 'Redirect works', raw: {} });
  mocks.getSeoSitemapStatus.mockResolvedValue([]);
  mocks.checkSeoSitemaps.mockResolvedValue([]);
  mocks.listArticles.mockResolvedValue({ rows: [], page: 1, pages: 1, total: 0 });
  localStorage.clear();
});

describe('SEOToolsDashboard SEO audit', () => {
  it('loads the latest audit on initial render and renders completed scores safely', async () => {
    render(<SEOToolsDashboard />);

    expect((await screen.findAllByText('78/100')).length).toBeGreaterThan(0);
    expect(screen.getByText('82/100')).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
    expect(screen.getByText('Missing canonical URL')).toBeInTheDocument();
  });

  it('shows the no-audit state with a run button', async () => {
    mocks.getLatestSeoAudit.mockResolvedValueOnce(null);
    mocks.listSeoAuditHistory.mockResolvedValueOnce([]);

    render(<SEOToolsDashboard />);

    expect(await screen.findByText('No SEO audit has been run yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /run new audit/i })[0]).toBeInTheDocument();
  });

  it('starts an audit and prevents duplicate clicks while queued', async () => {
    const queued = audit({ status: 'queued', score: null });
    mocks.getLatestSeoAudit.mockResolvedValueOnce(queued);
    mocks.listSeoAuditHistory.mockResolvedValueOnce([queued]);

    render(<SEOToolsDashboard />);

    expect(await screen.findByText('Audit queued')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /run new audit/i }));

    expect(mocks.startSeoAudit).not.toHaveBeenCalled();
  });

  it('starts Quick Audit by default', async () => {
    mocks.getLatestSeoAudit.mockResolvedValueOnce(null);
    mocks.listSeoAuditHistory.mockResolvedValueOnce([]);
    mocks.startSeoAudit.mockResolvedValueOnce(audit({ id: 'quick-run', status: 'queued', score: null }));

    render(<SEOToolsDashboard />);

    expect(await screen.findByText('No SEO audit has been run yet')).toBeInTheDocument();
    expect(screen.getByLabelText(/audit mode/i)).toHaveDisplayValue('Quick Audit — Recommended');
    expect(screen.getByText(/Essential SEO checks for daily use/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /run new audit/i })[0]);

    await waitFor(() => expect(mocks.startSeoAudit).toHaveBeenCalledWith({ mode: 'quick' }));
  });

  it('polls running audits, renders real page counts, and loads the completed result automatically', async () => {
    const running = audit({ id: 'audit-live', status: 'running', score: null, pagesChecked: 35, totalPages: 90, progress: 39, progressPercent: 39, currentStage: 'Scanning pages', elapsedSeconds: 18 });
    const completed = audit({ id: 'audit-live', status: 'completed', score: 88, pagesChecked: 90, totalPages: 90, progress: 100, progressPercent: 100, currentStage: 'Completed', elapsedSeconds: 52, durationMs: 52000 });
    mocks.getLatestSeoAudit.mockResolvedValueOnce(null).mockResolvedValueOnce(completed);
    mocks.listSeoAuditHistory.mockResolvedValueOnce([]).mockResolvedValueOnce([completed]);
    mocks.startSeoAudit.mockResolvedValueOnce(running);
    mocks.getSeoAuditStatus.mockResolvedValueOnce(running).mockResolvedValueOnce(completed);

    render(<SEOToolsDashboard />);

    expect(await screen.findByText('No SEO audit has been run yet')).toBeInTheDocument();
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getAllByRole('button', { name: /run new audit/i })[0]);
      await act(async () => { await Promise.resolve(); });

      expect(screen.getByText('Scanning pages: 35 / 90')).toBeInTheDocument();
      expect(screen.getByText('Progress: 39%')).toBeInTheDocument();
      expect(screen.getByText('Stage: Scanning pages')).toBeInTheDocument();
      expect(screen.getByText('Elapsed: 18 seconds')).toBeInTheDocument();

      await act(async () => { vi.advanceTimersByTime(3000); await Promise.resolve(); });
      expect(mocks.getSeoAuditStatus).toHaveBeenCalledTimes(1);

      await act(async () => { vi.advanceTimersByTime(3000); await Promise.resolve(); await Promise.resolve(); });
      expect(mocks.getSeoAuditStatus).toHaveBeenCalledTimes(2);
      expect(screen.getAllByText('88/100').length).toBeGreaterThan(0);
      expect(screen.getByText('52s')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /run new audit/i })).not.toBeDisabled();

      await act(async () => { vi.advanceTimersByTime(9000); await Promise.resolve(); });
      expect(mocks.getSeoAuditStatus).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops polling after failed status and keeps retry available', async () => {
    const running = audit({ id: 'audit-fail', status: 'running', score: null, pagesChecked: 8, totalPages: null, progress: 20, progressPercent: 20, currentStage: 'Scanning pages', elapsedSeconds: 11 });
    const failed = audit({ id: 'audit-fail', status: 'failed', score: null, safeErrorMessage: 'Crawler timed out.' });
    mocks.getLatestSeoAudit.mockResolvedValueOnce(null);
    mocks.listSeoAuditHistory.mockResolvedValueOnce([]);
    mocks.startSeoAudit.mockResolvedValueOnce(running);
    mocks.getSeoAuditStatus.mockResolvedValueOnce(failed);

    render(<SEOToolsDashboard />);

    expect(await screen.findByText('No SEO audit has been run yet')).toBeInTheDocument();
    vi.useFakeTimers();
    try {
      fireEvent.click(screen.getAllByRole('button', { name: /run new audit/i })[0]);
      await act(async () => { await Promise.resolve(); });

      expect(screen.getByText('Stage: Scanning pages')).toBeInTheDocument();
      await act(async () => { vi.advanceTimersByTime(3000); await Promise.resolve(); });

      expect(screen.getByText('SEO audit failed')).toBeInTheDocument();
      expect(screen.getByText('Crawler timed out.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).not.toBeDisabled();

      await act(async () => { vi.advanceTimersByTime(9000); await Promise.resolve(); });
      expect(mocks.getSeoAuditStatus).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders running and failed audit states', async () => {
    const running = audit({ status: 'running', score: null, progress: 45, progressPercent: 45, pagesChecked: 12, totalPages: 30 });
    mocks.getLatestSeoAudit.mockResolvedValueOnce(running);
    mocks.listSeoAuditHistory.mockResolvedValueOnce([running]);
    const { rerender } = render(<SEOToolsDashboard />);

    expect(await screen.findByText('Audit running')).toBeInTheDocument();
    expect(screen.getByText('Progress: 45%')).toBeInTheDocument();

    const failed = audit({ status: 'failed', score: null, safeErrorMessage: 'Crawler timed out.' });
    mocks.getLatestSeoAudit.mockResolvedValueOnce(failed);
    mocks.listSeoAuditHistory.mockResolvedValueOnce([failed]);
    rerender(<SEOToolsDashboard />);
    fireEvent.click(screen.getByRole('button', { name: /refresh status/i }));

    expect(await screen.findByText('SEO audit failed')).toBeInTheDocument();
    expect(screen.getByText('Crawler timed out.')).toBeInTheDocument();
  });

  it('renders null score and null performance without false zeroes', async () => {
    const nullScoreAudit = audit({ score: null, desktopPerformance: { score: null, status: 'failed' }, mobilePerformance: { score: null, status: 'not_configured' } });
    mocks.getLatestSeoAudit.mockResolvedValueOnce(nullScoreAudit);
    mocks.listSeoAuditHistory.mockResolvedValueOnce([nullScoreAudit]);

    render(<SEOToolsDashboard />);

    expect((await screen.findAllByText('Not available')).length).toBeGreaterThan(0);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.queryByText('0')).not.toBeInTheDocument();
    expect(screen.queryByText('/100')).not.toBeInTheDocument();
  });

  it('filters issues by severity and keeps audit history viewable after refresh', async () => {
    render(<SEOToolsDashboard />);

    expect(await screen.findByText('Missing canonical URL')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'canonical (1)' })).toHaveValue('canonical');
    expect(screen.getByRole('option', { name: 'meta (1)' })).toHaveValue('meta');
    fireEvent.click(screen.getByRole('button', { name: /warnings/i }));

    expect(screen.queryByText('Missing canonical URL')).not.toBeInTheDocument();
    expect(screen.getByText('Meta description too short')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view audit/i })).toBeInTheDocument();
  });

  it('shows a failed audit-history load without replacing it with a false empty state', async () => {
    mocks.listSeoAuditHistory.mockRejectedValueOnce(Object.assign(new Error('SEO endpoint unavailable.'), { status: 404 }));

    render(<SEOToolsDashboard />);

    expect((await screen.findAllByText('SEO endpoint unavailable.')).length).toBeGreaterThan(0);
    expect(screen.getByText('Audit history could not be loaded.')).toBeInTheDocument();
    expect(screen.getByText('Missing canonical URL')).toBeInTheDocument();
    expect(screen.queryByText('No audit history returned by the backend.')).not.toBeInTheDocument();
  });

  it('shows 403 permission errors without calling them session expiry', async () => {
    mocks.getLatestSeoAudit.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }));
    mocks.listSeoAuditHistory.mockRejectedValueOnce(Object.assign(new Error('Forbidden'), { status: 403 }));

    render(<SEOToolsDashboard />);

    expect(await screen.findAllByText(ACCESS_DENIED_MESSAGE)).toHaveLength(2);
    expect(screen.queryByText('Session expired. Please sign in again.')).not.toBeInTheDocument();
  });
});

describe('SEOToolsDashboard redirects, sitemap, meta, and permissions', () => {
  it('loads redirects and validates the redirect form before saving', async () => {
    mocks.listSeoRedirects.mockResolvedValueOnce([
      { id: 'r1', sourcePath: '/old', destination: '/new', type: '301', active: true, status: 'active', reason: 'slug change', createdBy: 'founder', updatedAt: '2026-08-01T11:00:00.000Z', createdAt: null, hits: 2, raw: {} },
    ]);

    render(<SEOToolsDashboard />);
    fireEvent.click(screen.getByRole('tab', { name: /redirects/i }));

    expect(await screen.findByText('/old')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /add redirect/i }));
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(screen.getByText('Source path must begin with /.')).toBeInTheDocument();
    expect(mocks.createSeoRedirect).not.toHaveBeenCalled();
  });

  it('displays redirect backend errors', async () => {
    mocks.createSeoRedirect.mockRejectedValueOnce(Object.assign(new Error('Duplicate source path'), { status: 409 }));

    render(<SEOToolsDashboard />);
    fireEvent.click(screen.getByRole('tab', { name: /redirects/i }));
    fireEvent.click(await screen.findByRole('button', { name: /add redirect/i }));
    fireEvent.change(screen.getByPlaceholderText('/old-path'), { target: { value: '/old' } });
    fireEvent.change(screen.getByPlaceholderText('/new-path'), { target: { value: '/new' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByText('Duplicate source path')).toBeInTheDocument();
  });

  it('saves temporary 302 redirects only after the backend confirms', async () => {
    const savedRedirect = { id: 'r302', sourcePath: '/temporary', destination: '/campaign', type: 302, active: true, status: 'active', reason: 'campaign', createdBy: 'founder', updatedAt: '2026-08-01T11:00:00.000Z', createdAt: null, hits: 0, raw: {} };
    mocks.createSeoRedirect.mockResolvedValueOnce(savedRedirect);
    mocks.listSeoRedirects.mockResolvedValueOnce([]).mockResolvedValueOnce([savedRedirect]);

    render(<SEOToolsDashboard />);
    fireEvent.click(screen.getByRole('tab', { name: /redirects/i }));
    fireEvent.click(await screen.findByRole('button', { name: /add redirect/i }));
    expect(screen.getByRole('option', { name: '302 Temporary' })).toHaveValue('302');
    fireEvent.change(screen.getByPlaceholderText('/old-path'), { target: { value: '/temporary' } });
    fireEvent.change(screen.getByPlaceholderText('/new-path'), { target: { value: '/campaign' } });
    fireEvent.change(screen.getByLabelText(/redirect type/i), { target: { value: '302' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(mocks.createSeoRedirect).toHaveBeenCalledWith(expect.objectContaining({ type: 302 })));
    expect(await screen.findByText('/temporary')).toBeInTheDocument();
    expect(screen.getByText('302')).toBeInTheDocument();
  });

  it('never renders a blank sitemap tab and renders backend results', async () => {
    render(<SEOToolsDashboard />);
    fireEvent.click(screen.getByRole('tab', { name: /sitemap/i }));

    expect(await screen.findByText('No sitemap check has been run yet.')).toBeInTheDocument();
    expect(screen.getByText('Main Sitemap')).toBeInTheDocument();

    mocks.getSeoSitemapStatus.mockResolvedValueOnce([{ key: 'main', label: 'Main Sitemap', url: '/sitemap.xml', httpStatus: 200, status: 'available', lastChecked: '2026-08-01T12:00:00.000Z', urlCount: 100, validUrls: 99, invalidUrls: 1, duplicateUrls: 0, errorUrls: 0, warnings: ['One invalid URL'], issues: [], raw: {} }]);
    fireEvent.click(screen.getByRole('button', { name: /^refresh$/i }));

    expect(await screen.findByText('/sitemap.xml')).toBeInTheDocument();
    expect(screen.getByText('One invalid URL')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /check now/i })).not.toBeInTheDocument();
  });

  it('shows sitemap backend failures instead of stale success states', async () => {
    mocks.getSeoSitemapStatus.mockRejectedValueOnce(Object.assign(new Error('Route not found'), { status: 404 }));

    render(<SEOToolsDashboard />);
    fireEvent.click(screen.getByRole('tab', { name: /sitemap/i }));

    expect(await screen.findByText('SEO endpoint unavailable.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /check sitemaps/i })).toBeInTheDocument();
  });

  it('loads real articles for meta analysis and removes coming soon text', async () => {
    mocks.listArticles.mockResolvedValueOnce({
      rows: [{ _id: 'a1', title: 'Real News Pulse Story', slug: 'real-story', language: 'en', status: 'published', seo: { score: 91, issues: [{ title: 'Missing OG image' }] } }],
      page: 1,
      pages: 1,
      total: 1,
    });

    render(<SEOToolsDashboard />);
    fireEvent.click(screen.getByRole('tab', { name: /meta tags/i }));

    expect((await screen.findAllByText('Real News Pulse Story')).length).toBeGreaterThan(0);
    expect(screen.queryByText(/coming soon/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyze\/view details/i })).toBeInTheDocument();
  });

  it('renders Meta Tags filter options with a visible SEO status default', async () => {
    render(<SEOToolsDashboard />);
    fireEvent.click(screen.getByRole('tab', { name: /meta tags/i }));

    expect(await screen.findByRole('combobox', { name: /language filter/i })).toHaveDisplayValue('All languages');
    expect(screen.getByRole('option', { name: 'English' })).toHaveValue('en');
    expect(screen.getByRole('option', { name: 'Hindi' })).toHaveValue('hi');
    expect(screen.getByRole('option', { name: 'Gujarati' })).toHaveValue('gu');
    expect(screen.getByRole('combobox', { name: /publication status filter/i })).toHaveDisplayValue('All publication statuses');
    expect(screen.getByRole('option', { name: 'Published' })).toHaveValue('published');
    expect(screen.getByRole('option', { name: 'Draft' })).toHaveValue('draft');
    expect(screen.getByRole('option', { name: 'Scheduled' })).toHaveValue('scheduled');
    expect(screen.getByRole('option', { name: 'Archived' })).toHaveValue('archived');
    expect(screen.getByRole('combobox', { name: /seo status filter/i })).toHaveDisplayValue('All SEO statuses');
    expect(screen.getByRole('option', { name: 'Good' })).toHaveValue('good');
    expect(screen.getByRole('option', { name: 'Warning' })).toHaveValue('warning');
    expect(screen.getByRole('option', { name: 'Critical' })).toHaveValue('critical');
    expect(screen.getByRole('option', { name: 'Not analyzed' })).toHaveValue('unknown');
  });

  it('filters Meta Tags articles by language and sends backend language values', async () => {
    mocks.listArticles.mockResolvedValue({
      rows: [
        { _id: 'en1', title: 'English SEO Story', slug: 'english-seo-story', language: 'en', status: 'published', seo: { score: 91 } },
        { _id: 'hi1', title: 'Hindi SEO Story', slug: 'hindi-seo-story', language: 'hi', status: 'published', seo: { status: 'warning', issues: [{ severity: 'warning', title: 'Short title' }] } },
        { _id: 'gu1', title: 'ગુજરાતી સમાચાર', slug: 'gujarati-samachar', language: 'gu', status: 'published', seo: { status: 'critical', issues: [{ severity: 'critical', title: 'Missing canonical' }] } },
      ],
      page: 1,
      pages: 1,
      total: 3,
    });

    render(<SEOToolsDashboard />);
    fireEvent.click(screen.getByRole('tab', { name: /meta tags/i }));

    expect((await screen.findAllByText('ગુજરાતી સમાચાર')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole('combobox', { name: /language filter/i }), { target: { value: 'gu' } });

    await waitFor(() => expect(mocks.listArticles).toHaveBeenLastCalledWith(expect.objectContaining({ language: 'gu' })));
    expect(screen.getAllByText('ગુજરાતી સમાચાર').length).toBeGreaterThan(0);
    expect(screen.queryByText('English SEO Story')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: /language filter/i }), { target: { value: 'hi' } });
    await waitFor(() => expect(mocks.listArticles).toHaveBeenLastCalledWith(expect.objectContaining({ language: 'hi' })));
    expect(screen.getAllByText('Hindi SEO Story').length).toBeGreaterThan(0);
    expect(screen.queryByText('ગુજરાતી સમાચાર')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: /language filter/i }), { target: { value: 'en' } });
    await waitFor(() => expect(mocks.listArticles).toHaveBeenLastCalledWith(expect.objectContaining({ language: 'en' })));
    expect(screen.getAllByText('English SEO Story').length).toBeGreaterThan(0);
    expect(screen.queryByText('Hindi SEO Story')).not.toBeInTheDocument();
  });

  it('combines publication status, SEO status, and slug search filters', async () => {
    mocks.listArticles.mockResolvedValue({
      rows: [
        { _id: 'a1', title: 'Published Good Story', slug: 'published-good', language: 'en', status: 'published', seo: { score: 92 } },
        { _id: 'a2', title: 'Draft Warning Story', slug: 'draft-warning', language: 'en', status: 'draft', seo: { status: 'warning', issues: [{ severity: 'warning', title: 'Short description' }] } },
        { _id: 'a3', title: 'Gujarati Critical Story', slug: 'gujarati-critical', language: 'gu', status: 'published', seo: { status: 'critical', issues: [{ severity: 'critical', title: 'Missing canonical' }] } },
      ],
      page: 1,
      pages: 1,
      total: 3,
    });

    render(<SEOToolsDashboard />);
    fireEvent.click(screen.getByRole('tab', { name: /meta tags/i }));
    expect((await screen.findAllByText('Published Good Story')).length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole('combobox', { name: /publication status filter/i }), { target: { value: 'published' } });
    await waitFor(() => expect(mocks.listArticles).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'published' })));
    expect(screen.queryByText('Draft Warning Story')).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: /seo status filter/i }), { target: { value: 'critical' } });
    await waitFor(() => expect(screen.getAllByText('Gujarati Critical Story').length).toBeGreaterThan(0));
    expect(screen.queryByText('Published Good Story')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Search title or slug'), { target: { value: 'published-good' } });
    await waitFor(() => expect(mocks.listArticles).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'published-good' })));
    expect(screen.getByText('No matching articles found')).toBeInTheDocument();
  });

  it('renders article SEO details with article identity and Missing fallbacks', async () => {
    mocks.listArticles.mockResolvedValueOnce({
      rows: [{ _id: 'a1', title: 'Details Story', slug: 'details-story', language: 'en', status: 'published', publicUrl: 'https://newspulse.co.in/news/details-story', seo: { score: null, robots: 'index,follow' } }],
      page: 1,
      pages: 1,
      total: 1,
    });

    render(<SEOToolsDashboard />);
    fireEvent.click(screen.getByRole('tab', { name: /meta tags/i }));
    fireEvent.click(await screen.findByRole('button', { name: /analyze\/view details/i }));

    expect(screen.getByText('Article title')).toBeInTheDocument();
    expect(screen.getAllByText('Details Story').length).toBeGreaterThan(0);
    expect(screen.getByText('Slug')).toBeInTheDocument();
    expect(screen.getByText('details-story')).toBeInTheDocument();
    expect(screen.getByText('Publication status')).toBeInTheDocument();
    expect(screen.getByText('published')).toBeInTheDocument();
    expect(screen.getByText('Public URL')).toBeInTheDocument();
    expect(screen.getAllByText('https://newspulse.co.in/news/details-story').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Missing').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /open public url/i })).toBeInTheDocument();
  });

  it('shows permission restrictions for restricted SEO actions', async () => {
    mocks.user = { role: 'staff', permissions: [] };

    render(<SEOToolsDashboard />);

    expect(await screen.findByText(ACCESS_DENIED_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run new audit/i })).toBeDisabled();
  });
});
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AIEngine from '@/pages/admin/AIEngine';
import { DEFAULT_ADMIN_MODULE_POLICY } from '@/lib/adminModulePolicy';

const mocks = vi.hoisted(() => ({
  adminJson: vi.fn(),
}));

vi.mock('@/lib/http/adminFetch', () => ({
  AdminApiError: class AdminApiError extends Error {
    status: number;
    url: string;

    constructor(message: string, opts: { status: number; url: string }) {
      super(message);
      this.name = 'AdminApiError';
      this.status = opts.status;
      this.url = opts.url;
    }
  },
  adminJson: mocks.adminJson,
}));

const checkedAt = '2026-08-30T05:15:00.000Z';
const contentCheckedAt = '2026-08-30T06:30:00.000Z';

function healthResponse(overrides: Record<string, any> = {}) {
  return {
    ok: true,
    checkedAt,
    overallStatus: 'healthy',
    summary: { healthy: 2, attention: 0, critical: 0 },
    checks: [
      {
        id: 'backend-api',
        area: 'Backend API',
        status: 'healthy',
        message: 'Backend API is reachable.',
        checkedAt,
        latencyMs: 42,
      },
      {
        id: 'analytics',
        area: 'Analytics',
        status: 'attention',
        message: 'No authoritative analytics-provider integration is configured.',
        recommendation: 'Connect an authoritative analytics provider before treating analytics as healthy.',
        checkedAt,
      },
      {
        id: 'admin-panel',
        area: 'Admin Panel',
        status: 'unknown',
        message: 'Admin Panel external availability is not configured for backend diagnostics.',
        technicalDetail: null,
        recommendation: null,
        checkedAt,
      },
    ],
    ...overrides,
  };
}

function contentCheckResponse(overrides: Record<string, any> = {}) {
  return {
    ok: true,
    checkedAt: contentCheckedAt,
    overallStatus: 'review',
    summary: { passed: 4, review: 2, highRisk: 1 },
    checks: [
      {
        id: 'quote-verification',
        label: 'Quote Verification',
        status: 'review',
        message: 'Quotation requires source verification.',
        recommendation: 'Verify the quotation source.',
        evidence: [{ excerpt: 'The official said the figure would double by Friday.' }],
      },
      {
        id: 'language-support',
        label: 'Language Support',
        status: 'pass',
        message: 'Language is supported for current editorial checks.',
      },
    ],
    ...overrides,
  };
}

function mockEngineApi(checkResult: any = contentCheckResponse()) {
  mocks.adminJson.mockImplementation((path: string) => {
    if (path === '/news-pulse-engine/content-check') return Promise.resolve(checkResult);
    return Promise.resolve(healthResponse());
  });
}

function contentCheckCalls() {
  return mocks.adminJson.mock.calls.filter(([path]) => path === '/news-pulse-engine/content-check');
}

async function openContentChecker() {
  render(<AIEngine />);
  fireEvent.click(screen.getByRole('tab', { name: 'Content Checker' }));
  return screen.findByRole('heading', { name: 'News Pulse Content Checker' });
}

async function runContentCheck(content = 'A draft with reporting details for review.') {
  fireEvent.change(screen.getByLabelText(/Article Content/i), { target: { value: content } });
  fireEvent.click(screen.getByRole('button', { name: 'Check Content' }));
  await waitFor(() => expect(contentCheckCalls()).toHaveLength(1));
  return contentCheckCalls()[0];
}

beforeEach(() => {
  mocks.adminJson.mockResolvedValue(healthResponse());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('AIEngine health dashboard', () => {
  it('renders News Pulse Engine without old visible branding', async () => {
    render(<AIEngine />);

    expect(await screen.findByRole('heading', { name: /news pulse engine/i })).toBeInTheDocument();
    expect(screen.getByText('Monitor the health of News Pulse, identify problems affecting the live website and newsroom systems, and see what needs attention.')).toBeInTheDocument();
    expect(screen.queryByText(/News Pulse AI Engine/i)).not.toBeInTheDocument();
  });

  it('requests Founder health through the existing authenticated admin JSON helper', async () => {
    render(<AIEngine />);

    await waitFor(() => expect(mocks.adminJson).toHaveBeenCalledWith('/news-pulse-engine/health', {
      method: 'GET',
      cache: 'no-store',
    }));
  });

  it.each([
    ['healthy', 'News Pulse is operating normally.'],
    ['attention', 'Some areas need attention.'],
    ['critical', 'A core News Pulse service needs immediate attention.'],
  ])('renders %s overall state correctly', async (overallStatus, message) => {
    mocks.adminJson.mockResolvedValue(healthResponse({ overallStatus }));

    render(<AIEngine />);

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('renders backend summary counts and dynamic system checks', async () => {
    mocks.adminJson.mockResolvedValue(healthResponse({
      summary: { healthy: 7, attention: 1, critical: 2 },
      checks: [
        { id: 'publishing', area: 'Publishing', status: 'healthy', message: 'Publishing queue is clear.', latencyMs: 15 },
        { id: 'push', area: 'Push Notifications', status: 'attention', message: 'Push provider needs review.', recommendation: 'Check push provider credentials.' },
      ],
    }));

    render(<AIEngine />);

    expect(await screen.findByLabelText('Healthy: 7')).toBeInTheDocument();
    expect(screen.getByLabelText('Needs Attention: 1')).toBeInTheDocument();
    expect(screen.getByLabelText('Critical: 2')).toBeInTheDocument();
    expect(screen.getByText('Publishing')).toBeInTheDocument();
    expect(screen.getByText('Publishing queue is clear.')).toBeInTheDocument();
    expect(screen.getAllByText('Push Notifications').length).toBeGreaterThan(0);
    expect(screen.getByText('Latency: 15ms')).toBeInTheDocument();
  });

  it('prioritizes critical and attention items in Founder Attention without listing healthy checks', async () => {
    mocks.adminJson.mockResolvedValue(healthResponse({
      overallStatus: 'critical',
      summary: { healthy: 1, attention: 1, critical: 1 },
      checks: [
        { id: 'backend-api', area: 'Backend API', status: 'healthy', message: 'Backend API is reachable.' },
        { id: 'database', area: 'Database', status: 'critical', message: 'Database connection failed.', recommendation: 'Check database connectivity.' },
        { id: 'analytics', area: 'Analytics', status: 'attention', message: 'No authoritative analytics-provider integration is configured.' },
      ],
    }));

    render(<AIEngine />);

    const attentionSection = (await screen.findByRole('heading', { name: 'Founder Attention' })).closest('section') as HTMLElement;
    expect(within(attentionSection).getByText('Database')).toBeInTheDocument();
    expect(within(attentionSection).getByText('Analytics')).toBeInTheDocument();
    expect(within(attentionSection).queryByText('Backend API')).not.toBeInTheDocument();
    expect(within(attentionSection).getByText('Recommended:')).toBeInTheDocument();
    expect(within(attentionSection).getByText('Check database connectivity.')).toBeInTheDocument();
  });

  it('shows a calm Founder Attention empty state when there are no issues', async () => {
    mocks.adminJson.mockResolvedValue(healthResponse({
      checks: [{ id: 'backend-api', area: 'Backend API', status: 'healthy', message: 'Backend API is reachable.' }],
    }));

    render(<AIEngine />);

    expect(await screen.findByText('No current issues require Founder attention.')).toBeInTheDocument();
  });

  it('renders unknown as informational and keeps Analytics attention honest', async () => {
    render(<AIEngine />);

    expect(await screen.findByText('Admin Panel')).toBeInTheDocument();
    expect(screen.getByText('Admin Panel external availability is not configured for backend diagnostics.')).toBeInTheDocument();
    expect(screen.getByText('Not Configured / Unknown')).toBeInTheDocument();
    expect(screen.getAllByText('Analytics').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Needs Attention').length).toBeGreaterThan(0);
    expect(screen.getAllByText('No authoritative analytics-provider integration is configured.').length).toBeGreaterThan(0);
  });

  it('handles missing recommendation and technical detail without crashing', async () => {
    mocks.adminJson.mockResolvedValue(healthResponse({
      checks: [{ id: 'seo', area: 'SEO', status: 'healthy', message: 'SEO diagnostics completed.' }],
    }));

    render(<AIEngine />);

    expect(await screen.findByText('SEO diagnostics completed.')).toBeInTheDocument();
    expect(screen.queryByText('Technical detail')).not.toBeInTheDocument();
  });

  it('shows recommendation and technical detail when provided', async () => {
    mocks.adminJson.mockResolvedValue(healthResponse({
      checks: [{ id: 'public-site', area: 'Public Website', status: 'critical', message: 'Public website returned HTTP 500.', recommendation: 'Check the frontend deployment and domain availability.', technicalDetail: 'httpStatus=500' }],
    }));

    render(<AIEngine />);

    expect((await screen.findAllByText('Public website returned HTTP 500.')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Recommended:').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Check the frontend deployment and domain availability.').length).toBeGreaterThan(0);
    expect(screen.getByText('Technical detail')).toBeInTheDocument();
    expect(screen.getByText('httpStatus=500')).toBeInTheDocument();
  });

  it('uses backend checkedAt for Last checked', async () => {
    render(<AIEngine />);

    await screen.findByText('Backend API');
    expect(screen.getAllByText(`Last checked: ${new Date(checkedAt).toLocaleString()}`).length).toBeGreaterThan(0);
  });

  it('runs the health check again on refresh without creating repair actions', async () => {
    mocks.adminJson
      .mockResolvedValueOnce(healthResponse({ summary: { healthy: 1, attention: 0, critical: 0 } }))
      .mockResolvedValueOnce(healthResponse({ summary: { healthy: 2, attention: 1, critical: 0 } }));

    render(<AIEngine />);
    fireEvent.click(await screen.findByRole('button', { name: 'Run Check Again' }));

    await waitFor(() => expect(mocks.adminJson).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('button', { name: /fix|repair|restart|deploy|reconnect|clean database/i })).not.toBeInTheDocument();
  });

  it('renders loading state while the endpoint is pending', () => {
    mocks.adminJson.mockReturnValue(new Promise(() => {}));

    render(<AIEngine />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading current system status...');
  });

  it('renders API error state without fake healthy data', async () => {
    mocks.adminJson.mockRejectedValue(new Error('stack trace should not appear'));

    render(<AIEngine />);

    expect((await screen.findAllByText('News Pulse Engine could not load the current system status.')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText('News Pulse is operating normally.')).not.toBeInTheDocument();
    expect(screen.queryByText('stack trace should not appear')).not.toBeInTheDocument();
  });

  it('does not introduce background polling', () => {
    mocks.adminJson.mockReturnValue(new Promise(() => {}));
    const intervalSpy = vi.spyOn(globalThis, 'setInterval');

    render(<AIEngine />);

    expect(intervalSpy).not.toHaveBeenCalled();
  });

  it('keeps the existing route protected by the ai_engine admin module gate', () => {
    const appSource = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8');

    expect(appSource).toContain('path="/admin/ai-engine"');
    expect(appSource).toContain('<AdminModuleRoute moduleKey="ai_engine"><AIEngine /></AdminModuleRoute>');
    expect(DEFAULT_ADMIN_MODULE_POLICY.ai_engine.state).toBe('founder_only');
  });

  it('shows News Pulse Content Checker inside News Pulse Engine while keeping System Health present', async () => {
    render(<AIEngine />);

    expect(await screen.findByRole('heading', { name: /news pulse engine/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'System Health' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Content Checker' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Check Again' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Overall System Status')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Content Checker' }));

    expect(await screen.findByRole('heading', { name: 'News Pulse Content Checker' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run Check Again' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check Content' })).toBeInTheDocument();
    expect(screen.getByText('Review a news draft for editorial issues that may require verification before publication.')).toBeInTheDocument();
    expect(screen.getByText('This checker provides editorial indicators only. It does not determine whether a claim is true or false.')).toBeInTheDocument();
    expect(screen.queryByText('AI Content Checker')).not.toBeInTheDocument();
    expect(screen.queryByText(/AI probability|Human probability|ChatGPT detector|machine-generated/i)).not.toBeInTheDocument();
  });

  it('requires article content before calling the checker endpoint', async () => {
    await openContentChecker();

    fireEvent.click(screen.getByRole('button', { name: 'Check Content' }));

    expect(await screen.findByText('Enter article content before running the check.')).toBeInTheDocument();
    expect(contentCheckCalls()).toHaveLength(0);
  });

  it.each([
    ['English', 'en'],
    ['Hindi', 'hi'],
    ['Gujarati', 'gu'],
  ])('submits %s as %s through the authenticated admin JSON helper', async (_label, value) => {
    mockEngineApi();
    await openContentChecker();

    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: '  City water update  ' } });
    fireEvent.change(screen.getByLabelText(/Summary/i), { target: { value: '  Municipal update  ' } });
    fireEvent.change(screen.getByLabelText(/Language/i), { target: { value } });
    fireEvent.change(screen.getByLabelText(/Article Content/i), { target: { value: '  Reported content for review.  ' } });
    fireEvent.change(screen.getByLabelText(/Sources \/ References/i), { target: { value: '  municipal release  \n\n  field reporter note  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Content' }));

    await waitFor(() => expect(contentCheckCalls()).toHaveLength(1));
    expect(contentCheckCalls()[0]).toEqual([
      '/news-pulse-engine/content-check',
      {
        method: 'POST',
        json: {
          title: 'City water update',
          summary: 'Municipal update',
          content: 'Reported content for review.',
          language: value,
          sources: ['municipal release', 'field reporter note'],
        },
      },
    ]);
  });

  it.each([
    ['clear', 'Clear', 'No major editorial indicators were found by the current checks.'],
    ['review', 'Needs Review', 'Some items should be reviewed before publication.'],
    ['high-risk', 'High Priority Review', 'One or more issues should be resolved or verified before publication.'],
  ])('renders %s overall result with backend summary counts', async (overallStatus, label, description) => {
    mockEngineApi(contentCheckResponse({ overallStatus, summary: { passed: 8, review: 3, highRisk: 2 } }));
    await openContentChecker();

    await runContentCheck();

    expect(await screen.findByRole('heading', { name: label })).toBeInTheDocument();
    expect(screen.getByText(description)).toBeInTheDocument();
    expect(screen.getByLabelText('Passed: 8')).toBeInTheDocument();
    expect(screen.getByLabelText('Needs Review: 3')).toBeInTheDocument();
    expect(screen.getByLabelText('High Priority: 2')).toBeInTheDocument();
  });

  it('renders dynamic checks, recommendation, evidence excerpt, checkedAt, and neutral wording', async () => {
    mockEngineApi();
    await openContentChecker();

    await runContentCheck('Unicode Gujarati ગુજરાતી and Hindi हिंदी content remains intact.');

    expect(await screen.findByText('Quote Verification')).toBeInTheDocument();
    expect(screen.getByText('Quotation requires source verification.')).toBeInTheDocument();
    expect(screen.getByText('Recommended review:')).toBeInTheDocument();
    expect(screen.getByText('Verify the quotation source.')).toBeInTheDocument();
    expect(screen.getByText('Review excerpt')).toBeInTheDocument();
    expect(screen.getByText('The official said the figure would double by Friday.')).toBeInTheDocument();
    expect(screen.getByText('Language Support')).toBeInTheDocument();
    expect(screen.getByText('Language is supported for current editorial checks.')).toBeInTheDocument();
    expect(screen.getByText(`Checked: ${new Date(contentCheckedAt).toLocaleString()}`)).toBeInTheDocument();
    expect(screen.queryByText(/fake quotation|fake news|false claim|plagiarism detected|misinformation/i)).not.toBeInTheDocument();
  });

  it('does not crash when recommendation and evidence are missing', async () => {
    mockEngineApi(contentCheckResponse({
      checks: [{ id: 'completeness', label: 'Article Completeness', status: 'pass', message: 'Required draft sections are present.' }],
    }));
    await openContentChecker();

    await runContentCheck();

    expect(await screen.findByText('Article Completeness')).toBeInTheDocument();
    expect(screen.getByText('Required draft sections are present.')).toBeInTheDocument();
    expect(screen.queryByText('Recommended review:')).not.toBeInTheDocument();
    expect(screen.queryByText('Review excerpt')).not.toBeInTheDocument();
  });

  it('shows loading state and prevents duplicate content-check submissions', async () => {
    let resolveCheck: (value: any) => void = () => {};
    const pendingCheck = new Promise((resolve) => {
      resolveCheck = resolve;
    });
    mocks.adminJson.mockImplementation((path: string) => {
      if (path === '/news-pulse-engine/content-check') return pendingCheck;
      return Promise.resolve(healthResponse());
    });
    await openContentChecker();

    fireEvent.change(screen.getByLabelText(/Article Content/i), { target: { value: 'Draft for duplicate-submit guard.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check Content' }));
    fireEvent.click(screen.getByRole('button', { name: 'Checking content...' }));

    expect(screen.getByRole('status')).toHaveTextContent('Checking content...');
    expect(screen.getByRole('button', { name: 'Checking content...' })).toBeDisabled();
    expect(contentCheckCalls()).toHaveLength(1);

    resolveCheck(contentCheckResponse({ overallStatus: 'clear' }));
    expect(await screen.findByRole('heading', { name: 'Clear' })).toBeInTheDocument();
  });

  it('renders safe API error state and allows retry', async () => {
    mocks.adminJson.mockImplementation((path: string) => {
      if (path === '/news-pulse-engine/content-check') {
        return Promise.reject(new Error('stack trace should not appear'));
      }
      return Promise.resolve(healthResponse());
    });
    await openContentChecker();

    await runContentCheck();

    expect(await screen.findByText('Content check could not be completed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check Content' })).toBeEnabled();
    expect(screen.queryByText('stack trace should not appear')).not.toBeInTheDocument();
  });

  it('does not call article-writing or assistant endpoints and does not persist results', async () => {
    mockEngineApi();
    await openContentChecker();

    await runContentCheck();

    const calledPaths = mocks.adminJson.mock.calls.map(([path]) => String(path));
    expect(calledPaths).not.toContain('/assist/suggest');
    expect(calledPaths.some((path) => path.includes('/articles'))).toBe(false);

    const source = readFileSync(join(process.cwd(), 'src', 'pages', 'admin', 'AIEngine.tsx'), 'utf8');
    expect(source).not.toMatch(/localStorage|sessionStorage/);
    expect(screen.queryByRole('button', { name: /save draft|publish|unpublish|rewrite/i })).not.toBeInTheDocument();
  });

  it('keeps System Health refresh on the original health endpoint only', async () => {
    mocks.adminJson
      .mockResolvedValueOnce(healthResponse({ summary: { healthy: 1, attention: 0, critical: 0 } }))
      .mockResolvedValueOnce(healthResponse({ summary: { healthy: 2, attention: 0, critical: 0 } }));

    render(<AIEngine />);
    fireEvent.click(await screen.findByRole('button', { name: 'Run Check Again' }));

    await waitFor(() => expect(mocks.adminJson).toHaveBeenCalledTimes(2));
    expect(mocks.adminJson).toHaveBeenNthCalledWith(1, '/news-pulse-engine/health', {
      method: 'GET',
      cache: 'no-store',
    });
    expect(mocks.adminJson).toHaveBeenNthCalledWith(2, '/news-pulse-engine/health', {
      method: 'GET',
      cache: 'no-store',
    });
    expect(contentCheckCalls()).toHaveLength(0);
  });
});

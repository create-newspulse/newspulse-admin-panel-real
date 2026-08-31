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

  it('shows only the System Health dashboard without Content Checker controls', async () => {
    render(<AIEngine />);

    expect(await screen.findByRole('heading', { name: /news pulse engine/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run Check Again' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Overall System Status')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'News Pulse Content Checker' })).not.toBeInTheDocument();
    expect(screen.queryByText('Content Checker')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Title/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Language$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Summary/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Article Content/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Sources \/ References/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check Content|Clear/i })).not.toBeInTheDocument();
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
    expect(mocks.adminJson.mock.calls.map(([path]) => path)).not.toContain('/news-pulse-engine/content-check');
  });
});

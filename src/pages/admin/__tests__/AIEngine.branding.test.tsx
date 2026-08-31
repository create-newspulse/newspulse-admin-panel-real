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
const automaticCheckedAt = '2026-08-31T11:15:00.000Z';
const incidentStartedAt = '2026-08-31T10:00:00.000Z';
const incidentLastSeenAt = '2026-08-31T10:03:00.000Z';
const incidentResolvedAt = '2026-08-31T10:08:00.000Z';
const criticalAlertCreatedAt = '2026-08-31T11:20:00.000Z';
const recoveryAlertCreatedAt = '2026-08-31T11:10:00.000Z';

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

function monitoringStatusResponse(overrides: Record<string, any> = {}) {
  return {
    ok: true,
    enabled: true,
    checkIntervalMs: 5 * 60 * 1000,
    lastAutomaticCheckAt: automaticCheckedAt,
    lastRunStatus: 'healthy',
    ...overrides,
  };
}

function incidentsResponse(overrides: Record<string, any> = {}) {
  return {
    ok: true,
    incidents: [
      {
        id: 'analytics-attention',
        area: 'Analytics',
        status: 'attention',
        state: 'open',
        message: 'Analytics provider configuration needs review.',
        startedAt: '2026-08-31T10:05:00.000Z',
        lastSeenAt: '2026-08-31T10:06:00.000Z',
        resolvedAt: null,
        durationMs: null,
        recommendation: 'Connect an analytics provider.',
      },
      {
        id: 'public-website-critical',
        area: 'Public Website',
        status: 'critical',
        state: 'open',
        message: 'Public website returned HTTP 500.',
        startedAt: incidentStartedAt,
        lastSeenAt: incidentLastSeenAt,
        resolvedAt: null,
        durationMs: 45_000,
        recommendation: 'Check frontend deployment.',
      },
      {
        id: 'backend-recovered',
        area: 'Backend API',
        status: 'critical',
        state: 'resolved',
        message: 'Backend API recovered after timeout.',
        startedAt: incidentStartedAt,
        lastSeenAt: incidentLastSeenAt,
        resolvedAt: incidentResolvedAt,
        durationMs: 8 * 60 * 1000,
      },
    ],
    ...overrides,
  };
}

function alertsResponse(overrides: Record<string, any> = {}) {
  return {
    ok: true,
    alerts: [
      {
        id: 'critical-alert-public-website',
        incidentId: 'public-website-critical',
        type: 'critical',
        area: 'Public Website',
        message: 'Public Website has entered a critical state.',
        createdAt: criticalAlertCreatedAt,
        deliveryStatus: 'sent',
      },
      {
        id: 'recovery-alert-public-website',
        incidentId: 'public-website-critical',
        type: 'recovery',
        area: 'Public Website',
        message: 'Public Website has recovered.',
        createdAt: recoveryAlertCreatedAt,
        deliveryStatus: 'recorded',
      },
    ],
    ...overrides,
  };
}

function mockEngineEndpoints(options: { health?: any; monitoring?: any; incidents?: any; alerts?: any; monitoringError?: Error; incidentsError?: Error; alertsError?: Error } = {}) {
  mocks.adminJson.mockImplementation((path: string) => {
    if (path === '/news-pulse-engine/monitoring/status') {
      if (options.monitoringError) return Promise.reject(options.monitoringError);
      return Promise.resolve(options.monitoring ?? monitoringStatusResponse());
    }
    if (path === '/news-pulse-engine/incidents') {
      if (options.incidentsError) return Promise.reject(options.incidentsError);
      return Promise.resolve(options.incidents ?? incidentsResponse());
    }
    if (path === '/news-pulse-engine/alerts') {
      if (options.alertsError) return Promise.reject(options.alertsError);
      return Promise.resolve(options.alerts ?? alertsResponse());
    }
    return Promise.resolve(options.health ?? healthResponse());
  });
}

function callsFor(path: string) {
  return mocks.adminJson.mock.calls.filter(([calledPath]) => calledPath === path);
}

beforeEach(() => {
  mockEngineEndpoints();
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
    mockEngineEndpoints({ health: healthResponse({ overallStatus }) });

    render(<AIEngine />);

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('renders backend summary counts and dynamic system checks', async () => {
    mockEngineEndpoints({ health: healthResponse({
      summary: { healthy: 7, attention: 1, critical: 2 },
      checks: [
        { id: 'publishing', area: 'Publishing', status: 'healthy', message: 'Publishing queue is clear.', latencyMs: 15 },
        { id: 'push', area: 'Push Notifications', status: 'attention', message: 'Push provider needs review.', recommendation: 'Check push provider credentials.' },
      ],
    }) });

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
    mockEngineEndpoints({ health: healthResponse({
      overallStatus: 'critical',
      summary: { healthy: 1, attention: 1, critical: 1 },
      checks: [
        { id: 'backend-api', area: 'Backend API', status: 'healthy', message: 'Backend API is reachable.' },
        { id: 'database', area: 'Database', status: 'critical', message: 'Database connection failed.', recommendation: 'Check database connectivity.' },
        { id: 'analytics', area: 'Analytics', status: 'attention', message: 'No authoritative analytics-provider integration is configured.' },
      ],
    }) });

    render(<AIEngine />);

    const attentionSection = (await screen.findByRole('heading', { name: 'Founder Attention' })).closest('section') as HTMLElement;
    expect(within(attentionSection).getByText('Database')).toBeInTheDocument();
    expect(within(attentionSection).getByText('Analytics')).toBeInTheDocument();
    expect(within(attentionSection).queryByText('Backend API')).not.toBeInTheDocument();
    expect(within(attentionSection).getByText('Recommended:')).toBeInTheDocument();
    expect(within(attentionSection).getByText('Check database connectivity.')).toBeInTheDocument();
  });

  it('shows a calm Founder Attention empty state when there are no issues', async () => {
    mockEngineEndpoints({ health: healthResponse({
      checks: [{ id: 'backend-api', area: 'Backend API', status: 'healthy', message: 'Backend API is reachable.' }],
    }) });

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
    mockEngineEndpoints({ health: healthResponse({
      checks: [{ id: 'seo', area: 'SEO', status: 'healthy', message: 'SEO diagnostics completed.' }],
    }) });

    render(<AIEngine />);

    expect(await screen.findByText('SEO diagnostics completed.')).toBeInTheDocument();
    expect(screen.queryByText('Technical detail')).not.toBeInTheDocument();
  });

  it('shows recommendation and technical detail when provided', async () => {
    mockEngineEndpoints({ health: healthResponse({
      checks: [{ id: 'public-site', area: 'Public Website', status: 'critical', message: 'Public website returned HTTP 500.', recommendation: 'Check the frontend deployment and domain availability.', technicalDetail: 'httpStatus=500' }],
    }) });

    render(<AIEngine />);

    expect((await screen.findAllByText('Public website returned HTTP 500.')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Recommended:').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Check the frontend deployment and domain availability.').length).toBeGreaterThan(0);
    expect(screen.getByText('Technical detail')).toBeInTheDocument();
    expect(screen.getByText('httpStatus=500')).toBeInTheDocument();
  });

  it('uses backend checkedAt for Last checked', async () => {
    render(<AIEngine />);

    expect((await screen.findAllByText('Backend API')).length).toBeGreaterThan(0);
    expect(screen.getAllByText(`Last checked: ${new Date(checkedAt).toLocaleString()}`).length).toBeGreaterThan(0);
  });

  it('requests monitoring status and incident history through the authenticated admin JSON helper', async () => {
    render(<AIEngine />);

    await waitFor(() => expect(callsFor('/news-pulse-engine/monitoring/status')).toHaveLength(1));
    expect(callsFor('/news-pulse-engine/monitoring/status')[0]).toEqual(['/news-pulse-engine/monitoring/status', {
      method: 'GET',
      cache: 'no-store',
    }]);
    expect(callsFor('/news-pulse-engine/incidents')[0]).toEqual(['/news-pulse-engine/incidents', {
      method: 'GET',
      cache: 'no-store',
    }]);
  });

  it('requests Founder alerts through the authenticated admin JSON helper', async () => {
    render(<AIEngine />);

    await waitFor(() => expect(callsFor('/news-pulse-engine/alerts')).toHaveLength(1));
    expect(callsFor('/news-pulse-engine/alerts')[0]).toEqual(['/news-pulse-engine/alerts', {
      method: 'GET',
      cache: 'no-store',
    }]);
  });

  it('renders active automatic monitoring with backend interval, timestamp, and last run status', async () => {
    render(<AIEngine />);

    const monitoring = await screen.findByLabelText('Automatic Monitoring');
    expect(within(monitoring).getByText('Automatic Monitoring')).toBeInTheDocument();
    expect(within(monitoring).getAllByText('Active').length).toBeGreaterThan(0);
    expect(within(monitoring).getByText('Every 5 minutes')).toBeInTheDocument();
    expect(within(monitoring).getByText(new Date(automaticCheckedAt).toLocaleString())).toBeInTheDocument();
    expect(within(monitoring).getByText('Healthy')).toBeInTheDocument();
    expect(within(monitoring).getByText('News Pulse automatically checks system health every 5 minutes.')).toBeInTheDocument();
  });

  it('renders disabled automatic monitoring without pretending it is healthy', async () => {
    mockEngineEndpoints({ monitoring: monitoringStatusResponse({ enabled: false, lastRunStatus: 'attention' }) });

    render(<AIEngine />);

    const monitoring = await screen.findByLabelText('Automatic Monitoring');
    expect(within(monitoring).getAllByText('Disabled').length).toBeGreaterThan(0);
    expect(within(monitoring).getByText('Automatic monitoring is currently disabled.')).toBeInTheDocument();
    expect(within(monitoring).queryByText('Active')).not.toBeInTheDocument();
  });

  it('renders open and resolved incident history with open critical issues first', async () => {
    render(<AIEngine />);

    const openIssues = await screen.findByLabelText('Open Issues');
    const openCards = within(openIssues).getAllByRole('article');
    expect(openCards[0]).toHaveTextContent('Public Website');
    expect(openCards[0]).toHaveTextContent('Critical');
    expect(openCards[0]).toHaveTextContent('Open');
    expect(openCards[0]).toHaveTextContent('Public website returned HTTP 500.');
    expect(openCards[0]).toHaveTextContent(new Date(incidentStartedAt).toLocaleString());
    expect(openCards[0]).toHaveTextContent(new Date(incidentLastSeenAt).toLocaleString());
    expect(openCards[0]).toHaveTextContent('Still open');
    expect(openCards[0]).toHaveTextContent('45 seconds');
    expect(openCards[0]).toHaveTextContent('Check frontend deployment.');
    expect(openCards[1]).toHaveTextContent('Analytics');
    expect(openCards[1]).toHaveTextContent('Needs Attention');

    const resolved = screen.getByLabelText('Recently Resolved');
    expect(within(resolved).getByText('Backend API')).toBeInTheDocument();
    expect(within(resolved).getAllByText('Resolved').length).toBeGreaterThan(0);
    expect(within(resolved).getByText(new Date(incidentResolvedAt).toLocaleString())).toBeInTheDocument();
    expect(within(resolved).getByText('8 minutes')).toBeInTheDocument();
  });

  it('renders empty states when there are no open or resolved incidents', async () => {
    mockEngineEndpoints({ incidents: incidentsResponse({ incidents: [] }) });

    render(<AIEngine />);

    expect(await screen.findByText('No open monitoring issues.')).toBeInTheDocument();
    expect(screen.getByText('No recently resolved issues.')).toBeInTheDocument();
  });

  it('renders Founder Alerts with critical and recovery alerts newest first', async () => {
    mockEngineEndpoints({ alerts: alertsResponse({ alerts: [
      {
        id: 'older-recovery',
        type: 'recovery',
        area: 'Public Website',
        message: 'Public Website has recovered.',
        createdAt: recoveryAlertCreatedAt,
        deliveryStatus: 'recorded',
      },
      {
        id: 'newer-critical',
        type: 'critical',
        area: 'Public Website',
        message: 'Public Website has entered a critical state.',
        createdAt: criticalAlertCreatedAt,
        deliveryStatus: 'sent',
      },
    ] }) });

    render(<AIEngine />);

    const alerts = await screen.findByLabelText('Founder Alerts');
    expect(within(alerts).getByRole('heading', { name: 'Founder Alerts' })).toBeInTheDocument();
    const alertCards = within(alerts).getAllByRole('article');
    expect(alertCards[0]).toHaveTextContent('Critical Alert');
    expect(alertCards[0]).toHaveTextContent('Public Website');
    expect(alertCards[0]).toHaveTextContent('Public Website has entered a critical state.');
    expect(alertCards[0]).toHaveTextContent('Email Sent');
    expect(alertCards[0]).toHaveTextContent(new Date(criticalAlertCreatedAt).toLocaleString());
    expect(alertCards[1]).toHaveTextContent('Recovered');
    expect(alertCards[1]).toHaveTextContent('Public Website has recovered.');
    expect(alertCards[1]).toHaveTextContent('Stored Internally');
    expect(alertCards[1]).toHaveTextContent('External email delivery was not configured.');
  });

  it('renders failed alert delivery with a safe backend error code', async () => {
    mockEngineEndpoints({ alerts: alertsResponse({ alerts: [
      {
        id: 'failed-alert',
        type: 'critical',
        area: 'Backend API',
        message: 'Backend API has entered a critical state.',
        createdAt: criticalAlertCreatedAt,
        deliveryStatus: 'failed',
        deliveryErrorCode: 'SMTP_UNAVAILABLE',
        providerError: 'password=secret stack trace should not render',
      },
    ] }) });

    render(<AIEngine />);

    const alerts = await screen.findByLabelText('Founder Alerts');
    expect(within(alerts).getAllByText('Delivery Failed').length).toBeGreaterThan(0);
    expect(within(alerts).getByText('Code: SMTP_UNAVAILABLE')).toBeInTheDocument();
    expect(within(alerts).queryByText(/password=secret|stack trace should not render/i)).not.toBeInTheDocument();
  });

  it('handles missing optional alert fields without crashing', async () => {
    mockEngineEndpoints({ alerts: alertsResponse({ alerts: [{}] }) });

    render(<AIEngine />);

    const alerts = await screen.findByLabelText('Founder Alerts');
    expect(within(alerts).getByText('Founder Alert')).toBeInTheDocument();
  expect(within(alerts).getAllByText('Status Unknown').length).toBeGreaterThan(0);
    expect(within(alerts).getByText('News Pulse Engine')).toBeInTheDocument();
    expect(within(alerts).getByText('Founder Alert recorded.')).toBeInTheDocument();
    expect(within(alerts).getByText('Time unavailable')).toBeInTheDocument();
  });

  it('renders a normal empty state when there are no Founder alerts', async () => {
    mockEngineEndpoints({ alerts: alertsResponse({ alerts: [] }) });

    render(<AIEngine />);

    expect(await screen.findByText('No Founder alerts recorded yet.')).toBeInTheDocument();
  });

  it('isolates incident-history failures from the current health dashboard', async () => {
    mockEngineEndpoints({ incidentsError: new Error('incident stack should not appear') });

    render(<AIEngine />);

    expect(await screen.findByLabelText('Overall System Status')).toBeInTheDocument();
    expect(screen.getByText('Issue history could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('incident stack should not appear')).not.toBeInTheDocument();
  });

  it('isolates Founder alert failures from the current health dashboard', async () => {
    mockEngineEndpoints({ alertsError: new Error('smtp provider secret should not appear') });

    render(<AIEngine />);

    expect(await screen.findByLabelText('Overall System Status')).toBeInTheDocument();
    expect(screen.getByText('Founder alerts could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('smtp provider secret should not appear')).not.toBeInTheDocument();
  });

  it('isolates monitoring-status failures from the current health dashboard', async () => {
    mockEngineEndpoints({ monitoringError: new Error('monitoring stack should not appear') });

    render(<AIEngine />);

    expect(await screen.findByLabelText('Overall System Status')).toBeInTheDocument();
    expect(screen.getByText('Status unavailable')).toBeInTheDocument();
    expect(screen.getByText('Monitoring status could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('monitoring stack should not appear')).not.toBeInTheDocument();
  });

  it('runs the health check again on refresh without creating repair actions', async () => {
    let healthCalls = 0;
    mocks.adminJson.mockImplementation((path: string) => {
      if (path === '/news-pulse-engine/monitoring/status') return Promise.resolve(monitoringStatusResponse());
      if (path === '/news-pulse-engine/incidents') return Promise.resolve(incidentsResponse());
      if (path === '/news-pulse-engine/alerts') return Promise.resolve(alertsResponse());
      healthCalls += 1;
      return Promise.resolve(healthCalls === 1
        ? healthResponse({ summary: { healthy: 1, attention: 0, critical: 0 } })
        : healthResponse({ summary: { healthy: 2, attention: 1, critical: 0 } }));
    });

    render(<AIEngine />);
    fireEvent.click(await screen.findByRole('button', { name: 'Run Check Again' }));

    await waitFor(() => expect(callsFor('/news-pulse-engine/health')).toHaveLength(2));
    expect(screen.queryByRole('button', { name: /fix|repair|restart|deploy|reconnect|clean database/i })).not.toBeInTheDocument();
  });

  it('refreshes Founder alerts after a successful manual health refresh', async () => {
    let healthCalls = 0;
    let alertCalls = 0;
    mocks.adminJson.mockImplementation((path: string) => {
      if (path === '/news-pulse-engine/monitoring/status') return Promise.resolve(monitoringStatusResponse());
      if (path === '/news-pulse-engine/incidents') return Promise.resolve(incidentsResponse());
      if (path === '/news-pulse-engine/alerts') {
        alertCalls += 1;
        return Promise.resolve(alertsResponse({ alerts: [{
          id: `alert-${alertCalls}`,
          type: alertCalls === 1 ? 'critical' : 'recovery',
          area: 'Public Website',
          message: alertCalls === 1 ? 'Public Website has entered a critical state.' : 'Public Website has recovered.',
          createdAt: alertCalls === 1 ? recoveryAlertCreatedAt : criticalAlertCreatedAt,
          deliveryStatus: 'sent',
        }] }));
      }
      healthCalls += 1;
      return Promise.resolve(healthCalls === 1
        ? healthResponse({ summary: { healthy: 1, attention: 0, critical: 0 } })
        : healthResponse({ summary: { healthy: 2, attention: 0, critical: 0 } }));
    });

    render(<AIEngine />);
    expect(await screen.findByText('Public Website has entered a critical state.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Run Check Again' }));

    await waitFor(() => expect(callsFor('/news-pulse-engine/alerts')).toHaveLength(2));
    expect(await screen.findByText('Public Website has recovered.')).toBeInTheDocument();
  });

  it('renders loading state while the endpoint is pending', () => {
    mocks.adminJson.mockReturnValue(new Promise(() => {}));

    render(<AIEngine />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading current system status...');
  });

  it('renders API error state without fake healthy data', async () => {
    mocks.adminJson.mockImplementation((path: string) => {
      if (path === '/news-pulse-engine/health') return Promise.reject(new Error('stack trace should not appear'));
      return Promise.resolve(path === '/news-pulse-engine/incidents' ? incidentsResponse() : monitoringStatusResponse());
    });

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
    expect(screen.queryByText('News Pulse Article Assistant')).not.toBeInTheDocument();
    expect(screen.queryByText('Content Checker')).not.toBeInTheDocument();
    expect(screen.queryByText('PTI Compliance')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Title/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Language$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Summary/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Article Content/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Sources \/ References/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Check Content|Clear/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /fix|repair|restart|deploy|reconnect|resolve manually|delete incident/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /email|push|sms|whatsapp|notification|alert/i })).not.toBeInTheDocument();
  });

  it('does not add Founder alert resend, delete, dismiss, resolve, or repair actions', async () => {
    render(<AIEngine />);

    const alerts = await screen.findByLabelText('Founder Alerts');
    expect(within(alerts).queryByRole('button', { name: /resend|delete|retry|mark read|dismiss|resolve|fix|repair/i })).not.toBeInTheDocument();
  });

  it('keeps System Health refresh on the original health endpoint only', async () => {
    let healthCalls = 0;
    mocks.adminJson.mockImplementation((path: string) => {
      if (path === '/news-pulse-engine/monitoring/status') return Promise.resolve(monitoringStatusResponse());
      if (path === '/news-pulse-engine/incidents') return Promise.resolve(incidentsResponse());
      if (path === '/news-pulse-engine/alerts') return Promise.resolve(alertsResponse());
      healthCalls += 1;
      return Promise.resolve(healthCalls === 1
        ? healthResponse({ summary: { healthy: 1, attention: 0, critical: 0 } })
        : healthResponse({ summary: { healthy: 2, attention: 0, critical: 0 } }));
    });

    render(<AIEngine />);
    fireEvent.click(await screen.findByRole('button', { name: 'Run Check Again' }));

    await waitFor(() => expect(callsFor('/news-pulse-engine/health')).toHaveLength(2));
    expect(callsFor('/news-pulse-engine/health')[0]).toEqual(['/news-pulse-engine/health', {
      method: 'GET',
      cache: 'no-store',
    }]);
    expect(callsFor('/news-pulse-engine/health')[1]).toEqual(['/news-pulse-engine/health', {
      method: 'GET',
      cache: 'no-store',
    }]);
    expect(mocks.adminJson.mock.calls.map(([path]) => path)).not.toContain('/news-pulse-engine/content-check');
  });
});

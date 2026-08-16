import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PushNotificationsSettings from '../PushNotificationsSettings';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';
import { adminJson } from '@/lib/http/adminFetch';
import { formatPushIstTimestamp } from '@/lib/pushHistory';

vi.mock('@/features/settings/PublicSiteSettingsDraftContext', () => ({
  usePublicSiteSettingsDraft: vi.fn(),
}));

vi.mock('@/lib/http/adminFetch', () => ({
  adminJson: vi.fn(),
}));

const renderSettings = () => render(<PushNotificationsSettings />, { wrapper: MemoryRouter });

function mockPushStatus(statusResponse: Record<string, unknown>) {
  vi.mocked(adminJson).mockImplementation((path: string) => {
    if (path === '/admin/push/history?limit=5') return Promise.resolve({ items: [] });
    return Promise.resolve({ status: 'configured', messagingAvailable: true, ...statusResponse });
  });
}

function disabledDevicesCard() {
  const label = screen.getByText('Disabled Devices');
  const card = label.parentElement;
  if (!card) throw new Error('Disabled Devices card not found');
  return card;
}

describe('PushNotificationsSettings', () => {
  const patchDraft = vi.fn();

  it('formats push timestamps in IST and returns None for missing values', () => {
    expect(formatPushIstTimestamp('2026-08-13T18:46:23.528Z')).toBe('14-08-2026 00:16:23.528 IST');
    expect(formatPushIstTimestamp('2026-08-13T07:50:40.637Z')).toBe('13-08-2026 13:20:40.637 IST');
    expect(formatPushIstTimestamp(null)).toBe('None');
    expect(formatPushIstTimestamp(undefined)).toBe('None');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminJson).mockImplementation((path: string) => {
      if (path === '/admin/push/history?limit=5') {
        return Promise.resolve({
          items: [
            {
              id: 'push-1',
              type: 'breaking',
              title: 'Clicked push',
              sentAt: '2026-08-13T18:46:23.528Z',
              targetedCount: 1,
              successCount: 1,
              failureCount: 0,
              browserReceivedCount: 1,
              notificationShownCount: 1,
              clickedCount: 1,
              clickedInSeconds: 4.5,
              token: 'secret-token',
              fid: 'secret-fid',
              registrationId: 'secret-registration',
            },
            {
              id: 'push-2',
              type: 'article',
              title: 'Received push',
              sentAt: '2026-08-13T08:00:01.002Z',
              targetedCount: 2,
              successCount: 2,
              failureCount: 0,
              browserReceivedCount: 1,
              notificationShownCount: 0,
              clickedCount: 0,
              browserReceivedInSeconds: 3.8,
            },
            {
              id: 'push-3',
              type: 'breaking',
              title: 'Shown push',
              sentAt: '2026-08-13T07:55:40.637Z',
              targetedCount: 3,
              successCount: 3,
              failureCount: 0,
              browserReceivedCount: 3,
              notificationShownCount: 2,
              clickedCount: 0,
              notificationShownInSeconds: 5.2,
            },
            {
              id: 'push-4',
              type: 'breaking',
              title: 'Sent push',
              sentAt: '2026-08-13T07:50:40.637Z',
              targetedCount: 3,
              successCount: 3,
              failureCount: 0,
              browserReceivedCount: 0,
              notificationShownCount: 0,
              clickedCount: 0,
              fcmAcceptedMs: 1200,
            },
            {
              id: 'push-5',
              type: 'article',
              title: 'Failed push',
              sentAt: '2026-08-13T06:00:00.000Z',
              targetedCount: 1,
              successCount: 0,
              failureCount: 1,
              browserReceivedCount: 0,
              notificationShownCount: 0,
              clickedCount: 0,
              failureCode: 'messaging/registration-token-not-registered',
              failureMessage: 'Registration expired token=secret-token fid=secret-fid registrationId=secret-registration',
            },
            {
              id: 'push-6',
              type: 'breaking',
              title: 'No recipients push',
              sentAt: '2026-08-13T01:10:00.000Z',
              targetedCount: 0,
              successCount: 0,
              failureCount: 0,
              browserReceivedCount: 0,
              notificationShownCount: 0,
              clickedCount: 0,
            },
            { id: 'push-7', type: 'article', title: 'Hidden seventh push', sentAt: '2026-08-13T00:30:00.000Z', targetedCount: 1, successCount: 1, failureCount: 0 },
          ],
        });
      }
      return Promise.resolve({
        status: 'configured',
        messagingAvailable: true,
        totalRegistrations: 18,
        enabledFcmTokenRegistrations: 12,
        enabledFidOnlyRegistrations: 3,
        breakingNewsSubscribers: 9,
        articleAlertSubscribers: 7,
        disabledRegistrations: 3,
        lastRegistrationAt: '2026-08-13T18:46:23.528Z',
        lastSuccessfulSendAt: '2026-08-12T11:00:00.456Z',
        lastFailureAt: '2026-08-13T07:50:40.637Z',
        lastFailureCode: 'messaging/invalid-argument',
      });
    });
    vi.mocked(usePublicSiteSettingsDraft).mockReturnValue({
      draft: {
        pushNotifications: {
          enabled: true,
          types: {
            breakingNewsAlerts: true,
            topStories: true,
            newArticleAlerts: true,
            categoryAlerts: true,
            allArticles: false,
          },
        },
      },
      patchDraft,
    } as any);
  });

  it('renders the master toggle, five notification type controls, and safe push diagnostics', async () => {
    renderSettings();

    expect(screen.getByText('Push Notifications')).toBeInTheDocument();
    expect(screen.getByText(/Control whether News Pulse offers push notifications/i)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Enable Push Notifications on Website' })).toBeChecked();

    expect(screen.getByRole('switch', { name: 'Breaking News Alerts' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Top Stories' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'New Article Alerts' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Category Alerts' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'All Articles' })).not.toBeChecked();
    expect(screen.queryByRole('button', { name: 'Send Test Notification' })).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('Configured')).toBeInTheDocument());
    expect(screen.getByText('Push System Health')).toBeInTheDocument();
    expect(screen.getByText('Deliverable Push Devices are browsers/devices with valid FCM tokens. FID-only records are old or non-deliverable and cannot receive push.')).toBeInTheDocument();
    [
      'Firebase Cloud Messaging',
      'Messaging Available',
      'Backend Reachable',
      'Total Registrations',
      'Deliverable Push Devices',
      'FID-only / Non-deliverable Records',
      'Breaking News Subscribers',
      'Article Alert Subscribers',
      'Disabled Devices',
      'Last Registration',
      'Last Successful Send',
      'Last Failed Attempt',
    ].forEach((label) => expect(screen.getByText(label)).toBeInTheDocument());
    expect(screen.getAllByText('Yes')).toHaveLength(2);
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThan(1);
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getAllByText('14-08-2026 00:16:23.528 IST').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12-08-2026 16:30:00.456 IST').length).toBeGreaterThan(0);
    expect(screen.getAllByText('13-08-2026 13:20:40.637 IST').length).toBeGreaterThan(0);
    expect(screen.getByText(/Code: messaging\/invalid-argument/i)).toBeInTheDocument();
    expect(screen.queryByText('MongoDB Registrations')).not.toBeInTheDocument();
    expect(screen.queryByText('Enabled Devices')).not.toBeInTheDocument();
    expect(adminJson).toHaveBeenCalledWith('/admin/push/status', { cache: 'no-store' });
    expect(adminJson).toHaveBeenCalledWith('/admin/push/history?limit=5', { cache: 'no-store' });
    expect(screen.getByText('Recent Push History')).toBeInTheDocument();
    expect(screen.getByText('Latest 5 push notification delivery records.')).toBeInTheDocument();
    expect(screen.getByLabelText('Latest 5 push history')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View All History' })).toHaveAttribute('href', '/history');
    expect(screen.getByText('Audience')).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.getAllByText('Breaking').length).toBeGreaterThan(0);
    expect(screen.getByText('Clicked push')).toBeInTheDocument();
    expect(screen.getByTitle('Clicked push')).toHaveClass('line-clamp-2');
    expect(screen.getAllByText('14-08-2026 00:16:23.528 IST').length).toBeGreaterThan(0);
    expect(screen.getAllByText('13-08-2026 13:30:01.002 IST').length).toBeGreaterThan(0);
    expect(screen.getAllByText('13-08-2026 13:20:40.637 IST').length).toBeGreaterThan(0);
    expect(screen.queryByText('No recipients')).not.toBeInTheDocument();
    expect(screen.getByText('FCM Accepted')).toBeInTheDocument();
    expect(screen.getByText('Browser Received')).toBeInTheDocument();
    expect(screen.getByText('Notification Shown')).toBeInTheDocument();
    expect(screen.queryByText('Shown')).not.toBeInTheDocument();
    expect(screen.getByText('Clicked')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getAllByText('1 targeted')).toHaveLength(2);
    expect(screen.getByText('2 targeted')).toBeInTheDocument();
    expect(screen.getAllByText('3 targeted')).toHaveLength(2);
    expect(screen.queryByText('0 targeted')).not.toBeInTheDocument();
    expect(screen.getByText('FCM 1 • Browser 1 • Shown 1 • Clicked 1')).toBeInTheDocument();
    expect(screen.getByText('FCM 2 • Browser 1 • Shown 0 • Clicked 0')).toBeInTheDocument();
    expect(screen.getByText('FCM 3 • Browser 3 • Shown 2 • Clicked 0')).toBeInTheDocument();
    expect(screen.getByText('FCM 3 • Browser 0 • Shown 0 • Clicked 0')).toBeInTheDocument();
    expect(screen.getByText('FCM 0 • Browser 0 • Shown 0 • Clicked 0')).toBeInTheDocument();
    expect(screen.queryByText('FCM accepted in 1.2s')).not.toBeInTheDocument();
    expect(screen.queryByText('messaging/registration-token-not-registered')).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'View Details' })).toHaveLength(5);
    expect(screen.queryByText('No recipients push')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden seventh push')).not.toBeInTheDocument();
    expect(screen.queryByText('2026-08-13T18:46:23.528Z')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Type' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Targeted' })).not.toBeInTheDocument();
    expect(screen.queryByText(/secret-token|secret-fid|secret-registration|registrationId/i)).not.toBeInTheDocument();
  });

  it('displays disabledRegistrations when it is 0', async () => {
    mockPushStatus({ disabledRegistrations: 0 });

    renderSettings();

    await waitFor(() => expect(within(disabledDevicesCard()).getByText('0')).toBeInTheDocument());
  });

  it('displays nested registrationStats disabledRegistrations when it is 1', async () => {
    mockPushStatus({ registrationStats: { disabledRegistrations: 1 } });

    renderSettings();

    await waitFor(() => expect(within(disabledDevicesCard()).getByText('1')).toBeInTheDocument());
  });

  it('displays 0 for Disabled Devices when the backend omits the value', async () => {
    mockPushStatus({});

    renderSettings();

    await waitFor(() => expect(within(disabledDevicesCard()).getByText('0')).toBeInTheDocument());
  });

  it('shows a safe empty message when push history is empty', async () => {
    vi.mocked(adminJson).mockImplementation((path: string) => {
      if (path === '/admin/push/history?limit=5') return Promise.resolve({ items: [] });
      return Promise.resolve({ status: 'configured', messagingAvailable: true });
    });

    renderSettings();

    await waitFor(() => expect(screen.getByText('No push notifications sent yet.')).toBeInTheDocument());
  });

  it('patches only the push notification settings branch', () => {
    vi.mocked(adminJson).mockReturnValueOnce(new Promise(() => {}) as any);

    renderSettings();

    fireEvent.click(screen.getByRole('switch', { name: 'All Articles' }));

    expect(patchDraft).toHaveBeenCalledWith({
      pushNotifications: { types: { allArticles: true } },
    });
  });

  it('shows an error without crashing when diagnostics fail', async () => {
    vi.mocked(adminJson).mockRejectedValueOnce(new Error('offline'));

    renderSettings();

    await waitFor(() => expect(screen.getByText('Error')).toBeInTheDocument());
    expect(screen.getAllByText('No')).toHaveLength(2);
    expect(screen.getAllByText('Unknown')).toHaveLength(6);
    expect(screen.getAllByText('None')).toHaveLength(3);
  });

  it('reads safe nested Firebase status shapes without exposing credentials', async () => {
    vi.mocked(adminJson).mockResolvedValueOnce({
      firebase: {
        configured: true,
        messaging: { available: true },
      },
      registrations: {
        token: 'secret-token',
        fid: 'secret-fid',
        registrationId: 'secret-registration',
      },
      lastFailure: {
        code: 'messaging/sender-id-mismatch',
        message: 'token=secret-token fid=secret-fid private_key=private-key client_email=private@example.com',
      },
      serviceAccount: {
        client_email: 'private@example.com',
        private_key: 'private-key',
      },
    });

    renderSettings();

    await waitFor(() => expect(screen.getByText('Configured')).toBeInTheDocument());
    expect(screen.getAllByText('Yes')).toHaveLength(2);
    expect(screen.getByText(/messaging\/sender-id-mismatch/i)).toBeInTheDocument();
    expect(screen.queryByText(/secret-token|secret-fid|secret-registration|private@example.com|private-key/i)).not.toBeInTheDocument();
  });
});
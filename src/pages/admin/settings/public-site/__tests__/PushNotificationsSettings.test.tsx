import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('PushNotificationsSettings', () => {
  const patchDraft = vi.fn();

  it('formats push timestamps in IST and returns None for missing values', () => {
    expect(formatPushIstTimestamp('2026-08-13T18:46:23.528Z')).toBe('14-08-2026:00:16:23.528 IST');
    expect(formatPushIstTimestamp('2026-08-13T07:50:40.637Z')).toBe('13-08-2026:13:20:40.637 IST');
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
              clickedCount: 1,
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
              clickedCount: 0,
            },
            {
              id: 'push-3',
              type: 'breaking',
              title: 'Sent push',
              sentAt: '2026-08-13T07:50:40.637Z',
              targetedCount: 3,
              successCount: 3,
              failureCount: 0,
              browserReceivedCount: 0,
              clickedCount: 0,
            },
            {
              id: 'push-4',
              type: 'article',
              title: 'Failed push',
              sentAt: '2026-08-13T06:00:00.000Z',
              targetedCount: 1,
              successCount: 0,
              failureCount: 1,
              browserReceivedCount: 0,
              clickedCount: 0,
              failureCode: 'messaging/registration-token-not-registered',
              failureMessage: 'Registration expired token=secret-token fid=secret-fid registrationId=secret-registration',
            },
            {
              id: 'push-5',
              type: 'breaking',
              title: 'No recipients push',
              sentAt: '2026-08-13T01:10:00.000Z',
              targetedCount: 0,
              successCount: 0,
              failureCount: 0,
              browserReceivedCount: 0,
              clickedCount: 0,
            },
            { id: 'push-6', type: 'article', title: 'Hidden sixth push', sentAt: '2026-08-13T00:30:00.000Z', targetedCount: 1, successCount: 1, failureCount: 0 },
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
    expect(screen.getAllByText('Yes')).toHaveLength(2);
    expect(screen.getByText('Total Registrations')).toBeInTheDocument();
    expect(screen.getByText('Deliverable Push Devices')).toBeInTheDocument();
    expect(screen.getByText('FID-only / Non-deliverable Records')).toBeInTheDocument();
    expect(screen.getByText('Breaking News Subscribers')).toBeInTheDocument();
    expect(screen.getByText('Article Alert Subscribers')).toBeInTheDocument();
    expect(screen.getByText('Disabled Devices')).toBeInTheDocument();
    expect(screen.getByText('Last Registration')).toBeInTheDocument();
    expect(screen.getByText('Last Successful Send')).toBeInTheDocument();
    expect(screen.getByText('Last Failed Attempt')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getAllByText('3').length).toBeGreaterThan(1);
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getAllByText('14-08-2026:00:16:23.528 IST').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12-08-2026:16:30:00.456 IST').length).toBeGreaterThan(0);
    expect(screen.getAllByText('13-08-2026:13:20:40.637 IST').length).toBeGreaterThan(0);
    expect(screen.getByText(/Code: messaging\/invalid-argument/i)).toBeInTheDocument();
    expect(screen.queryByText('MongoDB Registrations')).not.toBeInTheDocument();
    expect(screen.queryByText('Enabled Devices')).not.toBeInTheDocument();
    expect(adminJson).toHaveBeenCalledWith('/admin/push/status', { cache: 'no-store' });
    expect(adminJson).toHaveBeenCalledWith('/admin/push/history?limit=5', { cache: 'no-store' });
    expect(screen.getByText('Recent Push History')).toBeInTheDocument();
    expect(screen.getByText('Latest 5 push notification delivery records.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View All History' })).toHaveAttribute('href', '/history');
    expect(screen.getAllByText('Breaking').length).toBeGreaterThan(0);
    expect(screen.getByText('Clicked push')).toBeInTheDocument();
    expect(screen.getAllByText('14-08-2026:00:16:23.528 IST').length).toBeGreaterThan(0);
    expect(screen.getAllByText('13-08-2026:13:30:01.002 IST').length).toBeGreaterThan(0);
    expect(screen.getAllByText('13-08-2026:13:20:40.637 IST').length).toBeGreaterThan(0);
    expect(screen.getByText('No recipients')).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText('Clicked')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getAllByText('Sent').length).toBeGreaterThan(0);
    expect(screen.getByText('Targeted 1 · FCM accepted 1 · Browser received 1 · Clicked 1')).toBeInTheDocument();
    expect(screen.getByText('Targeted 2 · FCM accepted 2 · Browser received 1 · Clicked 0')).toBeInTheDocument();
    expect(screen.getByText('Targeted 3 · FCM accepted 3 · Browser received 0 · Clicked 0')).toBeInTheDocument();
    expect(screen.getByText('Targeted 1 · FCM accepted 0 · Browser received 0 · Clicked 0')).toBeInTheDocument();
    expect(screen.getByText('Targeted 0')).toBeInTheDocument();
    expect(screen.getByText('messaging/registration-token-not-registered')).toBeInTheDocument();
    expect(screen.queryByText('Hidden sixth push')).not.toBeInTheDocument();
    expect(screen.queryByText('2026-08-13T18:46:23.528Z')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Targeted' })).not.toBeInTheDocument();
    expect(screen.queryByText(/secret-token|secret-fid|secret-registration/i)).not.toBeInTheDocument();
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
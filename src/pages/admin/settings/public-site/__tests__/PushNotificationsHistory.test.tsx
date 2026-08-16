import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PushNotificationsHistory from '../PushNotificationsHistory';
import { adminJson } from '@/lib/http/adminFetch';

vi.mock('@/lib/http/adminFetch', () => ({
  adminJson: vi.fn(),
}));

const renderHistory = () => render(<PushNotificationsHistory />, { wrapper: MemoryRouter });

function makeRecord(index: number) {
  return {
    id: `push-${index}`,
    type: index % 2 === 0 ? 'article' : 'breaking',
    title: `Record ${index}`,
    sentAt: new Date(Date.now() - index * 60 * 1000).toISOString(),
    targeted: 1,
    success: 1,
    failed: 0,
  };
}

describe('PushNotificationsHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminJson).mockResolvedValue({
      items: [
        {
          id: 'breaking-clicked',
          type: 'breaking',
          title: 'Breaking clicked with a long Gujarati headline ગુજરાતી સમાચાર ખૂબ લાંબા શીર્ષક સાથે',
          sentAt: '2026-08-13T18:46:23.528Z',
          targetedCount: 10,
          successCount: 0,
          failureCount: 1,
          browserReceivedCount: 5,
          notificationShownCount: 2,
          clickedCount: 2,
          clickedInSeconds: 4.5,
          firstReceivedAt: '2026-08-13T18:46:30.000Z',
          lastReceivedAt: '2026-08-13T18:47:00.000Z',
          firstNotificationShownAt: '2026-08-13T18:46:35.000Z',
          lastNotificationShownAt: '2026-08-13T18:47:05.000Z',
          firstClickedAt: '2026-08-13T18:47:30.000Z',
          lastClickedAt: '2026-08-13T18:48:00.000Z',
          token: 'secret-token',
          fid: 'secret-fid',
          registrationId: 'secret-registration',
        },
        {
          id: 'article-received',
          type: 'article',
          title: 'Article received',
          sentAt: '2026-08-13T08:00:01.002Z',
          targetedCount: 3,
          successCount: 2,
          failureCount: 0,
          browserReceivedCount: 1,
          notificationShownCount: 0,
          clickedCount: 0,
          browserReceivedInSeconds: 3.8,
          firstReceivedAt: '2026-08-13T08:01:00.000Z',
          lastReceivedAt: '2026-08-13T08:01:00.000Z',
        },
        {
          id: 'article-shown',
          type: 'article',
          title: 'Article shown',
          sentAt: '2026-08-13T07:58:40.637Z',
          targetedCount: 4,
          successCount: 4,
          failureCount: 0,
          browserReceivedCount: 4,
          notificationShownCount: 2,
          clickedCount: 0,
          notificationShownInSeconds: 5.2,
          firstNotificationShownAt: '2026-08-13T07:58:45.837Z',
          lastNotificationShownAt: '2026-08-13T07:59:00.000Z',
        },
        {
          id: 'article-partial',
          type: 'article',
          title: 'Article partial',
          sentAt: '2026-08-13T07:55:40.637Z',
          targetedCount: 7,
          status: 'partial',
          failureCount: 3,
          browserReceivedCount: 0,
          notificationShownCount: 0,
          clickedCount: 0,
          fcmAcceptedInSeconds: 0.4,
          failureCode: 'messaging/internal-error',
        },
        {
          id: 'article-sent',
          type: 'article',
          title: 'Article sent',
          sentAt: '2026-08-13T07:50:40.637Z',
          targetedCount: 6,
          successCount: 6,
          failureCount: 0,
          browserReceivedCount: 0,
          notificationShownCount: 0,
          clickedCount: 0,
          fcmAcceptedMs: 1200,
        },
        {
          id: 'article-failed',
          type: 'article',
          title: 'Article failed',
          sentAt: '2026-08-13T06:00:00.000Z',
          targetedCount: 3,
          successCount: 0,
          failureCount: 1,
          browserReceivedCount: 0,
          notificationShownCount: 0,
          clickedCount: 0,
          failureCode: 'messaging/registration-token-not-registered',
          failureMessage: 'Registration is no longer active. token=secret-token fid=secret-fid registrationId=secret-registration\n    at sendPush (server.js:10:2)',
        },
        {
          id: 'article-empty',
          type: 'article',
          title: 'Article no recipients',
          sentAt: '2026-05-01T00:00:00.000Z',
          targetedCount: 0,
          successCount: 0,
          failureCount: 0,
          browserReceivedCount: 0,
          notificationShownCount: 0,
          clickedCount: 0,
        },
      ],
    });
  });

  it('loads full push history and filters without exposing sensitive fields', async () => {
    renderHistory();

    await waitFor(() => expect(screen.getByText(/Breaking clicked with a long Gujarati headline/i)).toBeInTheDocument());
    expect(adminJson).toHaveBeenCalledWith('/admin/push/history', { cache: 'no-store' });
    expect(screen.getByRole('link', { name: 'Back to Push Notifications' })).toHaveAttribute('href', '/admin/settings/public-site/push-notifications');
    expect(screen.getByText('14-08-2026 00:16:23.528 IST')).toBeInTheDocument();
    expect(screen.getByText('13-08-2026 13:30:01.002 IST')).toBeInTheDocument();
    expect(screen.getByText('13-08-2026 13:20:40.637 IST')).toBeInTheDocument();
    expect(screen.getByLabelText('Push history summary')).toBeInTheDocument();
    const summary = screen.getByLabelText('Push history summary');
    ['Total Pushes', 'FCM Accepted', 'Browser Received', 'Notification Shown', 'Clicked', 'Failed', 'No Recipients'].forEach((label) => expect(within(summary).getByText(label)).toBeInTheDocument());
    expect(screen.getByRole('columnheader', { name: 'Title' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Sent At' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Type' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Targeted' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'FCM Accepted' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Browser Received' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Notification Shown' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Clicked' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Final Status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Details' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Failed' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Failure Code' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Failure Message' })).not.toBeInTheDocument();
    expect(screen.getByTestId('full-push-history-scroll')).toHaveClass('overflow-x-auto');
    expect(screen.getByRole('table', { name: 'Full push history' })).toHaveClass('min-w-[1200px]', 'table-fixed');
    expect(screen.getByTitle('Breaking clicked with a long Gujarati headline ગુજરાતી સમાચાર ખૂબ લાંબા શીર્ષક સાથે')).toHaveClass('line-clamp-2');
    expect(screen.getAllByText('FCM Accepted').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Browser Received').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Shown').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Clicked').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Failed').length).toBeGreaterThan(1);
    expect(screen.getAllByText('No recipients').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Partial').length).toBeGreaterThan(1);
    expect(screen.queryByText('FCM accepted in 1.2s')).not.toBeInTheDocument();
    expect(screen.queryByText('First browser received in 3.8s')).not.toBeInTheDocument();
    expect(screen.queryByText('First notification shown in 5.2s')).not.toBeInTheDocument();
    expect(screen.queryByText('Clicked in 4.5s')).not.toBeInTheDocument();
    expect(screen.queryByText('messaging/registration-token-not-registered')).not.toBeInTheDocument();
    expect(screen.queryByText(/Registration is no longer active/i)).not.toBeInTheDocument();

    const clickedRow = screen.getByRole('row', { name: /Breaking clicked with a long Gujarati headline/i });
    fireEvent.click(within(clickedRow).getByRole('button', { name: 'View details' }));
    expect(screen.getByText('Full title')).toBeInTheDocument();
    expect(screen.getByText('Failed count')).toBeInTheDocument();
    expect(screen.getByText('FCM accepted timing')).toBeInTheDocument();
    expect(screen.getByText('First browser received timing')).toBeInTheDocument();
    expect(screen.getByText('First notification shown timing')).toBeInTheDocument();
    expect(screen.getByText('Click timing')).toBeInTheDocument();
    expect(screen.getByText('First browser received in 6.5s')).toBeInTheDocument();
    expect(screen.getByText('Clicked in 4.5s')).toBeInTheDocument();

    fireEvent.click(within(clickedRow).getByRole('button', { name: 'Hide details' }));
    const sentRow = screen.getByRole('row', { name: /Article sent/i });
    fireEvent.click(within(sentRow).getByRole('button', { name: 'View details' }));
    expect(screen.getByText('FCM accepted timing')).toBeInTheDocument();
    expect(screen.getByText('FCM accepted in 1.2s')).toBeInTheDocument();

    fireEvent.click(within(sentRow).getByRole('button', { name: 'Hide details' }));
    const shownRow = screen.getByRole('row', { name: /Article shown/i });
    fireEvent.click(within(shownRow).getByRole('button', { name: 'View details' }));
    expect(screen.getByText('First notification shown in 5.2s')).toBeInTheDocument();

    fireEvent.click(within(shownRow).getByRole('button', { name: 'Hide details' }));
    const failedRow = screen.getByRole('row', { name: /Article failed/i });
    fireEvent.click(within(failedRow).getByRole('button', { name: 'View details' }));
    expect(screen.getByText(/messaging\/registration-token-not-registered/i)).toBeInTheDocument();
    expect(screen.getByText(/Registration is no longer active/i)).toBeInTheDocument();
    expect(screen.queryByText(/secret-token|secret-fid|secret-registration/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sendPush|server\.js/i)).not.toBeInTheDocument();
    expect(screen.queryByText('2026-08-13T18:46:23.528Z')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'fcm-accepted' } });
    expect(screen.getByText('Article sent')).toBeInTheDocument();
    expect(screen.queryByText(/Breaking clicked/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'browser-received' } });
    expect(screen.getByText('Article received')).toBeInTheDocument();
    expect(screen.queryByText('Article sent')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'shown' } });
    expect(screen.getByText('Article shown')).toBeInTheDocument();
    expect(screen.queryByText('Article received')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'clicked' } });
    expect(screen.getByText(/Breaking clicked/i)).toBeInTheDocument();
    expect(screen.queryByText('Article received')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'failed' } });
    expect(screen.getByText('Article failed')).toBeInTheDocument();
    expect(screen.queryByText(/Breaking clicked/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'partial' } });
    expect(screen.getByText('Article partial')).toBeInTheDocument();
    expect(screen.queryByText('Article failed')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'no-recipients' } });
    expect(screen.getByText('Article no recipients')).toBeInTheDocument();
    expect(screen.getAllByText('No recipients').length).toBeGreaterThan(1);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '30d' } });
    expect(screen.getByText('No push history records found.')).toBeInTheDocument();
  }, 10000);

  it('paginates full push history at 20 records per page', async () => {
    vi.mocked(adminJson).mockResolvedValueOnce({ items: Array.from({ length: 22 }, (_, index) => makeRecord(index + 1)) });

    renderHistory();

    await waitFor(() => expect(screen.getByText('Record 1')).toBeInTheDocument());
    expect(screen.queryByText('Record 21')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1-20 of 22')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Record 21')).toBeInTheDocument();
    expect(screen.getByText('Record 22')).toBeInTheDocument();
    expect(screen.getByText('Showing 21-22 of 22')).toBeInTheDocument();
  });
});
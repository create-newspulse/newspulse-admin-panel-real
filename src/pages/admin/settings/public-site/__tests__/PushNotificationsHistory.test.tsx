import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
          title: 'Breaking clicked',
          sentAt: '2026-08-13T18:46:23.528Z',
          targetedCount: 10,
          successCount: 10,
          failureCount: 0,
          browserReceivedCount: 5,
          clickedCount: 2,
          firstReceivedAt: '2026-08-13T18:46:30.000Z',
          lastReceivedAt: '2026-08-13T18:47:00.000Z',
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
          clickedCount: 0,
          firstReceivedAt: '2026-08-13T08:01:00.000Z',
          lastReceivedAt: '2026-08-13T08:01:00.000Z',
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
          clickedCount: 0,
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
          clickedCount: 0,
        },
      ],
    });
  });

  it('loads full push history and filters without exposing sensitive fields', async () => {
    renderHistory();

    await waitFor(() => expect(screen.getByText('Breaking clicked')).toBeInTheDocument());
    expect(adminJson).toHaveBeenCalledWith('/admin/push/history', { cache: 'no-store' });
    expect(screen.getByRole('link', { name: 'Back to Push Notifications' })).toHaveAttribute('href', '/admin/settings/public-site/push-notifications');
    expect(screen.getByText('14-08-2026:00:16:23.528 IST')).toBeInTheDocument();
    expect(screen.getByText('13-08-2026:13:30:01.002 IST')).toBeInTheDocument();
    expect(screen.getByText('13-08-2026:13:20:40.637 IST')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Targeted' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'FCM Accepted' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Failed' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Browser Received' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Clicked' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Failure Code' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Failure Message' })).toBeInTheDocument();
    expect(screen.getByText('messaging/registration-token-not-registered')).toBeInTheDocument();
    expect(screen.getByText(/Registration is no longer active/i)).toBeInTheDocument();
    expect(screen.getByText(/First 14-08-2026:00:16:30.000 IST \| Last 14-08-2026:00:17:00.000 IST/i)).toBeInTheDocument();
    expect(screen.getByText(/First 14-08-2026:00:17:30.000 IST \| Last 14-08-2026:00:18:00.000 IST/i)).toBeInTheDocument();
    expect(screen.queryByText(/secret-token|secret-fid|secret-registration/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sendPush|server\.js/i)).not.toBeInTheDocument();
    expect(screen.queryByText('2026-08-13T18:46:23.528Z')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'sent' } });
    expect(screen.getByText('Article sent')).toBeInTheDocument();
    expect(screen.queryByText('Breaking clicked')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'received' } });
    expect(screen.getByText('Article received')).toBeInTheDocument();
    expect(screen.queryByText('Article sent')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'clicked' } });
    expect(screen.getByText('Breaking clicked')).toBeInTheDocument();
    expect(screen.queryByText('Article received')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'failed' } });
    expect(screen.getByText('Article failed')).toBeInTheDocument();
    expect(screen.queryByText('Breaking clicked')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'no-recipients' } });
    expect(screen.getByText('Article no recipients')).toBeInTheDocument();
    expect(screen.getAllByText('No recipients').length).toBeGreaterThan(1);

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '30d' } });
    expect(screen.getByText('No push history records found.')).toBeInTheDocument();
  });

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
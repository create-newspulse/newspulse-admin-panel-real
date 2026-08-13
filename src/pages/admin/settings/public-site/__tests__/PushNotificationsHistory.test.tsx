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
          id: 'breaking-sent',
          type: 'breaking',
          title: 'Breaking sent',
          sentAt: '2026-08-13T07:50:40.637Z',
          targeted: 10,
          success: 10,
          failed: 0,
          token: 'secret-token',
          fid: 'secret-fid',
          registrationId: 'secret-registration',
        },
        {
          id: 'article-failed',
          type: 'article',
          title: 'Article failed',
          sentAt: '2026-08-13T08:00:01.002Z',
          targeted: 3,
          success: 2,
          failed: 1,
          failureCode: 'messaging/registration-token-not-registered',
          failureMessage: 'Registration is no longer active. token=secret-token fid=secret-fid registrationId=secret-registration\n    at sendPush (server.js:10:2)',
        },
        {
          id: 'article-empty',
          type: 'article',
          title: 'Article no recipients',
          sentAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
          targeted: 0,
          success: 0,
          failed: 0,
        },
      ],
    });
  });

  it('loads full push history and filters without exposing sensitive fields', async () => {
    renderHistory();

    await waitFor(() => expect(screen.getByText('Breaking sent')).toBeInTheDocument());
    expect(adminJson).toHaveBeenCalledWith('/admin/push/history', { cache: 'no-store' });
    expect(screen.getByRole('link', { name: 'Back to Push Notifications' })).toHaveAttribute('href', '/admin/settings/public-site/push-notifications');
    expect(screen.getByText('13-08-2026:13:20:40.637 IST')).toBeInTheDocument();
    expect(screen.getByText('13-08-2026:13:30:01.002 IST')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Failure Code' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Failure Message' })).toBeInTheDocument();
    expect(screen.getByText('messaging/registration-token-not-registered')).toBeInTheDocument();
    expect(screen.getByText(/Registration is no longer active/i)).toBeInTheDocument();
    expect(screen.queryByText(/secret-token|secret-fid|secret-registration/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sendPush|server\.js/i)).not.toBeInTheDocument();
    expect(screen.queryByText('2026-08-13T07:50:40.637Z')).not.toBeInTheDocument();
    expect(screen.queryByText(/\d{1,2}\/\d{1,2}\/\d{4}/)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'failed' } });
    expect(screen.getByText('Article failed')).toBeInTheDocument();
    expect(screen.queryByText('Breaking sent')).not.toBeInTheDocument();

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
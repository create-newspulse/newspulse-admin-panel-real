import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAdminEffectiveAccess, clearAdminEffectiveAccessCache } from '@/hooks/useAdminEffectiveAccess';
import { ADMIN_MODULE_POLICY_EVENT, normalizeAdminModulePolicy } from '@/lib/adminModulePolicy';

const mocks = vi.hoisted(() => ({
  api: vi.fn(),
}));

vi.mock('@/lib/http', () => ({
  api: mocks.api,
}));

function AccessProbe({ user }: { user: any }) {
  const access = useAdminEffectiveAccess({ user, enabled: true });
  const addNews = access.backendAccess.add_news;
  return (
    <div>
      <div data-testid="loading">{access.isLoading ? 'loading' : 'idle'}</div>
      <div data-testid="add-news">{addNews ? `${addNews.allowed ? 'allowed' : 'locked'}:${addNews.reasonCode}` : 'none'}</div>
    </div>
  );
}

function MultipleAccessProbes({ user }: { user: any }) {
  return <><AccessProbe user={user} /><AccessProbe user={user} /></>;
}

function accessPayload(allowed: boolean, reasonCode = allowed ? 'ALLOWED' : 'STAFF_ACCESS_DISABLED') {
  return {
    success: true,
    access: {
      effectiveModuleAccess: {
        addNews: {
          allowed,
          visible: true,
          reasonCode,
          globalState: 'available',
          individualState: allowed ? 'enabled' : 'disabled',
        },
      },
    },
  };
}

beforeEach(() => {
  clearAdminEffectiveAccessCache();
  mocks.api.mockReset();
});

afterEach(() => {
  clearAdminEffectiveAccessCache();
  vi.clearAllMocks();
});

describe('useAdminEffectiveAccess', () => {
  it('loads current-user effective access from /access/me and normalizes canonical module keys', async () => {
    mocks.api.mockResolvedValueOnce(accessPayload(true));

    render(<AccessProbe user={{ id: 'staff-1', email: 'one@example.com', role: 'editor' }} />);

    await waitFor(() => expect(screen.getByTestId('add-news')).toHaveTextContent('allowed:ALLOWED'));
    expect(mocks.api).toHaveBeenCalledWith('/access/me');
  });

  it('does not reuse cached effective access after the account changes', async () => {
    mocks.api.mockResolvedValueOnce(accessPayload(true)).mockResolvedValueOnce(accessPayload(false));

    const view = render(<AccessProbe user={{ id: 'staff-1', email: 'one@example.com', role: 'editor' }} />);
    await waitFor(() => expect(screen.getByTestId('add-news')).toHaveTextContent('allowed:ALLOWED'));

    view.rerender(<AccessProbe user={{ id: 'staff-2', email: 'two@example.com', role: 'editor' }} />);
    expect(screen.getByTestId('add-news')).toHaveTextContent('none');

    await waitFor(() => expect(screen.getByTestId('add-news')).toHaveTextContent('locked:STAFF_ACCESS_DISABLED'));
    expect(mocks.api).toHaveBeenCalledTimes(2);
  });

  it('shares one startup request across simultaneous access consumers', async () => {
    mocks.api.mockResolvedValueOnce(accessPayload(true));

    render(<MultipleAccessProbes user={{ id: 'staff-1', email: 'one@example.com', role: 'editor' }} />);

    await waitFor(() => expect(screen.getAllByTestId('add-news')[0]).toHaveTextContent('allowed:ALLOWED'));
    expect(mocks.api).toHaveBeenCalledTimes(1);
  });

  it('skips effective-access loading for a founder', async () => {
    render(<AccessProbe user={{ id: 'founder-1', email: 'founder@example.com', role: 'founder' }} />);

    expect(screen.getByTestId('loading')).toHaveTextContent('idle');
    expect(mocks.api).not.toHaveBeenCalled();
  });

  it('settles access loading when the optional access request fails', async () => {
    mocks.api.mockRejectedValueOnce(new Error('Network Error'));

    render(<AccessProbe user={{ id: 'staff-1', email: 'one@example.com', role: 'editor' }} />);

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('idle'));
    expect(mocks.api).toHaveBeenCalledTimes(1);
  });

  it('refetches effective access when Founder module policy changes', async () => {
    mocks.api.mockResolvedValueOnce(accessPayload(true)).mockResolvedValueOnce(accessPayload(false, 'GLOBAL_STAFF_LOCK'));

    render(<AccessProbe user={{ id: 'staff-1', email: 'one@example.com', role: 'editor' }} />);
    await waitFor(() => expect(screen.getByTestId('add-news')).toHaveTextContent('allowed:ALLOWED'));

    window.dispatchEvent(new CustomEvent(ADMIN_MODULE_POLICY_EVENT, { detail: normalizeAdminModulePolicy({ modulePolicy: { add_news: 'staff_locked' } }) }));

    await waitFor(() => expect(screen.getByTestId('add-news')).toHaveTextContent('locked:GLOBAL_STAFF_LOCK'));
    expect(mocks.api).toHaveBeenCalledTimes(2);
  });
});

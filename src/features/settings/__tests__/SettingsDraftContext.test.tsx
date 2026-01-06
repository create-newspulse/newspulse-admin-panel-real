/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DEFAULT_SETTINGS } from '@/types/siteSettings';
import { AdminApiError } from '@/lib/http/adminFetch';

// Avoid noisy toasts during tests
vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Force settingsApi calls to fail with 404
vi.mock('@/lib/settingsApi', () => {
  return {
    default: {
      getAdminSettings: vi.fn(async () => {
        throw new AdminApiError('Not found', { status: 404, url: '/admin/settings' });
      }),
      getPublicSiteBundle: vi.fn(async () => {
        throw new AdminApiError('Not found', { status: 404, url: '/admin/settings/public' });
      }),
      savePublicSiteDraft: vi.fn(),
      publishPublicSiteSettings: vi.fn(),
      putAdminSettings: vi.fn(),
    },
  };
});

import { SettingsDraftProvider, useSettingsDraft } from '../SettingsDraftContext';

function Probe() {
  const { draft, status, dirty, backendAvailable } = useSettingsDraft();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="dirty">{String(dirty)}</div>
      <div data-testid="backend">{String(backendAvailable)}</div>
      <div data-testid="has-draft">{String(!!draft)}</div>
      <div data-testid="ticker-live">{String((draft as any)?.tickers?.liveSpeedSec)}</div>
    </div>
  );
}

describe('SettingsDraftContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns safe defaults when backend APIs 404', async () => {
    render(
      <SettingsDraftProvider>
        <Probe />
      </SettingsDraftProvider>
    );

    // Provider should still render and produce a non-null draft
    expect(await screen.findByTestId('has-draft')).toHaveTextContent('true');
    // Offline mode should be indicated
    expect(screen.getByTestId('backend')).toHaveTextContent('false');
    // Draft should at least contain schema defaults
    // Default per SiteSettingsSchema is 8
    expect(screen.getByTestId('ticker-live')).toHaveTextContent(String((DEFAULT_SETTINGS as any)?.tickers?.liveSpeedSec ?? 8));
  });

  it('never crashes when used outside provider', () => {
    render(<Probe />);
    expect(screen.getByTestId('has-draft')).toHaveTextContent('true');
  });
});

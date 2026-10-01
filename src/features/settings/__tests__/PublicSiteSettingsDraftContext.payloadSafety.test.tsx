import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  PublicSiteSettingsDraftProvider,
  usePublicSiteSettingsDraft,
} from '../PublicSiteSettingsDraftContext';
import { publicSiteSettingsApi } from '@/lib/publicSiteSettingsApi';

vi.mock('@/lib/publicSiteSettingsApi', () => ({
  publicSiteSettingsApi: {
    getAdminPublicSiteSettingsBundle: vi.fn(),
    putAdminPublicSiteSettingsDraft: vi.fn(),
    publishAdminPublicSiteSettings: vi.fn(),
  },
}));

const STORED_TICKERS = {
  pauseOnHover: false,
  live: { enabled: true, speedSec: 24, maxItems: 20, order: 4 },
  breaking: { enabled: true, speedSec: 18, maxItems: 9, order: 5 },
};

const STORED_BUNDLE = {
  draft: {
    homepage: { modules: { explore: { enabled: true, order: 1 } } },
    tickers: STORED_TICKERS,
  },
  published: {
    homepage: { modules: { explore: { enabled: true, order: 1 } } },
    tickers: STORED_TICKERS,
  },
};

function Probe() {
  const { draft, patchDraft, status } = usePublicSiteSettingsDraft();
  if (status !== 'ready' || !draft) return <div>loading</div>;
  const tickers = (draft as any).tickers;
  return (
    <div>
      <div data-testid="live-speed">{tickers.live.speedSec}</div>
      <div data-testid="live-max">{tickers.live.maxItems}</div>
      <div data-testid="live-enabled">{String(tickers.live.enabled)}</div>
      <div data-testid="breaking-speed">{tickers.breaking.speedSec}</div>
      <div data-testid="breaking-max">{tickers.breaking.maxItems}</div>
      <div data-testid="pause-on-hover">{String(tickers.pauseOnHover)}</div>
      <button onClick={() => patchDraft({ homepage: { modules: { explore: { enabled: false } } } } as any)}>
        Patch unrelated homepage field
      </button>
    </div>
  );
}

describe('PublicSiteSettingsDraftContext ticker payload safety', () => {
  it('preserves existing stored ticker values on load (no mutation)', async () => {
    vi.mocked(publicSiteSettingsApi.getAdminPublicSiteSettingsBundle).mockResolvedValue(STORED_BUNDLE as any);

    render(
      <PublicSiteSettingsDraftProvider>
        <Probe />
      </PublicSiteSettingsDraftProvider>
    );

    await waitFor(() => expect(screen.getByTestId('live-speed')).toHaveTextContent('24'));
    expect(screen.getByTestId('live-max')).toHaveTextContent('20');
    expect(screen.getByTestId('live-enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('breaking-speed')).toHaveTextContent('18');
    expect(screen.getByTestId('breaking-max')).toHaveTextContent('9');
    expect(screen.getByTestId('pause-on-hover')).toHaveTextContent('false');
  });

  it('does not reset/clear ticker settings when an unrelated field is patched', async () => {
    vi.mocked(publicSiteSettingsApi.getAdminPublicSiteSettingsBundle).mockResolvedValue(STORED_BUNDLE as any);

    render(
      <PublicSiteSettingsDraftProvider>
        <Probe />
      </PublicSiteSettingsDraftProvider>
    );

    await waitFor(() => expect(screen.getByTestId('live-speed')).toHaveTextContent('24'));

    act(() => {
      screen.getByText('Patch unrelated homepage field').click();
    });

    // Ticker values must remain exactly as loaded; patching an unrelated homepage field
    // must not inject defaults or clear any ticker property.
    expect(screen.getByTestId('live-speed')).toHaveTextContent('24');
    expect(screen.getByTestId('live-max')).toHaveTextContent('20');
    expect(screen.getByTestId('live-enabled')).toHaveTextContent('true');
    expect(screen.getByTestId('breaking-speed')).toHaveTextContent('18');
    expect(screen.getByTestId('breaking-max')).toHaveTextContent('9');
    expect(screen.getByTestId('pause-on-hover')).toHaveTextContent('false');
  });
});

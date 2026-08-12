import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PublicSiteSettingsLayout from '../../PublicSiteSettingsLayout';
import HomepageModulesSettings from '../HomepageModulesSettings';
import { usePublicSiteSettingsDraft } from '@/features/settings/PublicSiteSettingsDraftContext';

vi.mock('@context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'founder' } }),
}));

vi.mock('@/features/settings/PublicSiteSettingsDraftContext', () => ({
  PublicSiteSettingsDraftProvider: ({ children }: any) => <>{children}</>,
  usePublicSiteSettingsDraft: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderPublicSiteSettings(initialPath = '/admin/settings/public-site/homepage') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/admin/settings/public-site" element={<PublicSiteSettingsLayout />}>
          <Route path="homepage" element={<HomepageModulesSettings />} />
          <Route path="push-notifications" element={<div>Push Notifications Page Loaded</div>} />
          <Route path="preview" element={<div>Public Preview Loaded</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('PublicSiteSettingsLayout', () => {
  const patchDraft = vi.fn();
  const resetDraftRemoteToPublished = vi.fn(async () => undefined);
  const saveDraftRemote = vi.fn(async () => undefined);
  const publish = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usePublicSiteSettingsDraft).mockReturnValue({
      dirty: true,
      status: 'ready',
      patchDraft,
      resetDraftRemoteToPublished,
      saveDraftRemote,
      publish,
      draft: {
        homepage: {
          modules: {
            explore: { enabled: true, order: 1 },
            categoryStrip: { enabled: true, order: 2 },
            trending: { enabled: true, order: 3 },
            quickTools: { enabled: true, order: 6 },
            appPromo: { enabled: false, order: 7 },
            footer: { enabled: true, order: 8 },
          },
        },
        tickers: {
          live: { enabled: false, order: 4 },
          breaking: { enabled: false, order: 5 },
        },
      },
    } as any);
  });

  it('keeps existing public-site navigation and adds Push Notifications once', () => {
    renderPublicSiteSettings();

    expect(screen.getByRole('link', { name: 'Homepage Modules' })).toHaveAttribute('href', '/admin/settings/public-site/homepage');
    expect(screen.getByRole('link', { name: 'Tickers' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Live TV' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inspiration Hub' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Daily Wonders' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Footer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Language & Theme' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Push Notifications' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Push Notifications' })).toHaveAttribute('href', '/admin/settings/public-site/push-notifications');
  });

  it('opens the Push Notifications child route from the existing navigation', () => {
    renderPublicSiteSettings('/admin/settings/public-site/push-notifications');

    expect(screen.getByText('Push Notifications Page Loaded')).toBeInTheDocument();
  });

  it('keeps Homepage Modules controls, toggles, and reset order behavior available', () => {
    renderPublicSiteSettings();

    expect(screen.getByText('Toggle modules and control section ordering.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reorder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset order' })).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Explore Categories' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'App Promo' })).not.toBeChecked();

    fireEvent.click(screen.getByRole('switch', { name: 'Explore Categories' }));
    expect(patchDraft).toHaveBeenCalledWith({ homepage: { modules: { explore: { enabled: false } } } });

    fireEvent.click(screen.getByRole('button', { name: 'Reset order' }));
    expect(patchDraft).toHaveBeenLastCalledWith({
      homepage: {
        modules: {
          explore: { order: 1 },
          categoryStrip: { order: 2 },
          trending: { order: 3 },
          quickTools: { order: 6 },
          appPromo: { order: 7 },
          footer: { order: 8 },
        },
      },
      tickers: {
        live: { order: 4 },
        breaking: { order: 5 },
      },
    });
  });

  it('keeps existing Reset, Save Draft, Preview, and Publish LIVE actions available', async () => {
    renderPublicSiteSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await waitFor(() => expect(resetDraftRemoteToPublished).toHaveBeenCalledWith('reset-public-site-settings-to-published'));

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(saveDraftRemote).toHaveBeenCalledWith('save-public-site-settings'));

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByText('Public Preview Loaded')).toBeInTheDocument();
  });

  it('keeps Publish LIVE wired to the existing publish action', async () => {
    renderPublicSiteSettings();

    fireEvent.click(screen.getByRole('button', { name: 'Publish LIVE' }));

    await waitFor(() => expect(publish).toHaveBeenCalledWith('publish-public-site-settings'));
  });
});
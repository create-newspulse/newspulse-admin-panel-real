import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ARTICLE_PUSH_SPAM_WARNING } from '@/lib/pushSendFeedback';
import { listAdminAnalyticsArticles } from '@/lib/api/adminAnalytics';
import { archiveArticle, deleteArticle, listArticles, publishArticle, requeueArticleTranslations, scheduleArticle, updateArticleStatus } from '@/lib/api/articles';
import ArticlesAnalyticsPage from '@/pages/admin/analytics/ArticlesAnalyticsPage';
import { NewsTable } from '../NewsTable';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'founder' } }),
}));

vi.mock('@/context/PublishFlagContext', () => ({
  usePublishFlag: () => ({ publishEnabled: true }),
}));

vi.mock('@/lib/api/adminAnalytics', () => ({
  listAdminAnalyticsArticles: vi.fn(() => Promise.resolve({ rows: [] })),
}));

vi.mock('@/lib/api/articles', () => ({
  listArticles: vi.fn(),
  archiveArticle: vi.fn(),
  restoreArticle: vi.fn(),
  deleteArticle: vi.fn(),
  publishArticle: vi.fn(),
  updateArticleStatus: vi.fn(),
  scheduleArticle: vi.fn(),
  unscheduleArticle: vi.fn(),
  hardDeleteArticle: vi.fn(),
  bulkHardDeleteArticles: vi.fn(),
  requeueArticleTranslations: vi.fn(),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  afterEach(() => {
    cleanup();
  });
}

function renderNewsTable(overrides: Partial<React.ComponentProps<typeof NewsTable>> = {}, queryClient = createTestQueryClient()) {

  const result = render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <NewsTable
          params={{ status: 'all', page: 1, limit: 20, sort: '-updatedAt' }}
          search=""
          quickView="all"
          onCounts={vi.fn()}
          {...overrides}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { ...result, queryClient };
}

function renderNewsTableWithAnalytics(queryClient = createTestQueryClient()) {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <NewsTable
          params={{ status: 'all', page: 1, limit: 20, sort: '-updatedAt' }}
          search=""
          quickView="all"
          onCounts={vi.fn()}
        />
        <ArticlesAnalyticsPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('NewsTable article push modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigateMock.mockReset();
    vi.mocked(listArticles).mockResolvedValue({
      rows: [
        {
          _id: 'article-1',
          title: 'Published story',
          slug: 'published-story',
          summary: 'Short summary',
          category: 'World',
          status: 'published',
          language: 'en',
        },
      ],
      total: 1,
      page: 1,
      pages: 1,
    } as any);
    vi.mocked(publishArticle).mockResolvedValue({ ok: true } as any);
    vi.mocked(archiveArticle).mockResolvedValue({ ok: true } as any);
    vi.mocked(deleteArticle).mockResolvedValue({ ok: true } as any);
    vi.mocked(updateArticleStatus).mockResolvedValue({ ok: true } as any);
    vi.mocked(scheduleArticle).mockResolvedValue({ ok: true } as any);
    vi.mocked(requeueArticleTranslations).mockResolvedValue({ ok: true } as any);
  });

  it('shows the anti-spam warning in the article push confirmation modal', async () => {
    renderNewsTable();

    const pushLabels = await screen.findAllByText('Push');
    const pushButton = pushLabels[0].closest('button');
    expect(pushButton).not.toBeNull();
    fireEvent.click(pushButton as HTMLButtonElement);

    expect(screen.getByText('Send Article Push?')).toBeInTheDocument();
    expect(screen.getByText(ARTICLE_PUSH_SPAM_WARNING)).toBeInTheDocument();
  });

  it('publishes draft articles through the shared publish service used by Add News', async () => {
    vi.mocked(listArticles).mockResolvedValueOnce({
      rows: [
        {
          _id: 'draft-1',
          title: 'Draft story',
          slug: 'draft-story',
          summary: 'Short summary',
          category: 'national',
          status: 'draft',
          language: 'en',
        },
      ],
      total: 1,
      page: 1,
      pages: 1,
    } as any);

    renderNewsTable();

    const publishButtons = await screen.findAllByRole('button', { name: 'Publish' });
    fireEvent.click(publishButtons[0]);

    await waitFor(() => expect(publishArticle).toHaveBeenCalledWith('draft-1'));
    expect(updateArticleStatus).not.toHaveBeenCalledWith('draft-1', 'published');
  });

  it('renders one grouped row and keeps logical counts for linked EN/HI/GU records', async () => {
    const onCounts = vi.fn();
    vi.mocked(listArticles).mockResolvedValueOnce({
      rows: [
        { _id: 'gu-1', title: 'Gujarati translation', status: 'published', language: 'gu', translationGroupId: 'group-1', sourceLanguage: 'en' },
        { _id: 'hi-1', title: 'Hindi translation', status: 'published', language: 'hi', translationGroupId: 'group-1', sourceLanguage: 'en' },
        { _id: 'en-source', title: 'Canonical source title', status: 'published', language: 'en', translationGroupId: 'group-1', sourceLanguage: 'en' },
      ],
      total: 3,
      page: 1,
      pages: 1,
    } as any);

    renderNewsTable({ onCounts });

    expect(await screen.findAllByText('Canonical source title')).toHaveLength(2);
    expect(screen.queryByText('Gujarati translation')).not.toBeInTheDocument();
    expect(screen.queryByText('Hindi translation')).not.toBeInTheDocument();
    expect(screen.getAllByText('EN+HI+GU')).toHaveLength(2);
    expect(screen.getByText('Showing 1 of 1 loaded')).toBeInTheDocument();
    await waitFor(() => expect(onCounts).toHaveBeenLastCalledWith(expect.objectContaining({ all: 1, published: 1 })));
  });

  it('deletes one grouped multilingual story with one backend request and removes the logical row after success', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(listArticles)
      .mockResolvedValueOnce({
        rows: [
          { _id: 'gu-1', title: 'Gujarati translation', status: 'published', language: 'gu', translationGroupId: 'group-1', sourceLanguage: 'en' },
          { _id: 'hi-1', title: 'Hindi translation', status: 'published', language: 'hi', translationGroupId: 'group-1', sourceLanguage: 'en' },
          { _id: 'en-source', title: 'Canonical source title', status: 'published', language: 'en', translationGroupId: 'group-1', sourceLanguage: 'en' },
        ],
        total: 3,
        page: 1,
        pages: 1,
      } as any)
      .mockResolvedValue({ rows: [], total: 0, page: 1, pages: 1 } as any);

    renderNewsTable();

    expect(await screen.findAllByText('Canonical source title')).toHaveLength(2);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Delete' }))[0]);

    expect(confirmSpy).toHaveBeenCalledWith([
      'Delete this story?',
      '',
      'This will delete all available language versions of this story',
      '(English, Hindi and Gujarati).',
    ].join('\n'));
    await waitFor(() => expect(deleteArticle).toHaveBeenCalledWith('en-source'));
    expect(deleteArticle).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('Canonical source title')).not.toBeInTheDocument());
    await waitFor(() => expect(listArticles).toHaveBeenCalledTimes(2));
    expect(publishArticle).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('leaves a grouped row intact when deletion fails', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(deleteArticle).mockRejectedValueOnce(new Error('Delete failed'));
    vi.mocked(listArticles).mockResolvedValueOnce({
      rows: [
        { _id: 'en-source', title: 'Deletion failure source', status: 'published', language: 'en', translationGroupId: 'group-1', sourceLanguage: 'en' },
        { _id: 'hi-1', title: 'Hindi translation', status: 'published', language: 'hi', translationGroupId: 'group-1', sourceLanguage: 'en' },
        { _id: 'gu-1', title: 'Gujarati translation', status: 'published', language: 'gu', translationGroupId: 'group-1', sourceLanguage: 'en' },
      ],
      total: 3,
      page: 1,
      pages: 1,
    } as any);

    renderNewsTable();

    expect(await screen.findAllByText('Deletion failure source')).toHaveLength(2);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Delete' }))[0]);

    await waitFor(() => expect(deleteArticle).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText('Deletion failure source')).toHaveLength(2);
    expect(listArticles).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it('refreshes active article analytics so deleted stories do not remain after backend refresh', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(listArticles)
      .mockResolvedValueOnce({
        rows: [
          { _id: 'en-source', title: 'Analytics delete source', status: 'published', language: 'en', translationGroupId: 'group-1', sourceLanguage: 'en' },
          { _id: 'hi-1', title: 'Hindi translation', status: 'published', language: 'hi', translationGroupId: 'group-1', sourceLanguage: 'en' },
          { _id: 'gu-1', title: 'Gujarati translation', status: 'published', language: 'gu', translationGroupId: 'group-1', sourceLanguage: 'en' },
        ],
        total: 3,
        page: 1,
        pages: 1,
      } as any)
      .mockResolvedValue({ rows: [], total: 0, page: 1, pages: 1 } as any);
    vi.mocked(listAdminAnalyticsArticles)
      .mockResolvedValueOnce({ rows: [{ articleId: 'en-source', title: 'Analytics delete source', views: 25 }] } as any)
      .mockResolvedValue({ rows: [] } as any);

    renderNewsTableWithAnalytics();

    expect(await screen.findByText('ID: en-source')).toBeInTheDocument();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Delete' }))[0]);

    await waitFor(() => expect(deleteArticle).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(listAdminAnalyticsArticles).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('No analytics rows for these filters.')).toBeInTheDocument();
    expect(screen.queryByText('ID: en-source')).not.toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('keeps Archive, Unpublish, Edit, and Push actions on published rows unchanged', async () => {
    vi.mocked(listArticles).mockResolvedValue({
      rows: [
        { _id: 'published-source', title: 'Published action story', slug: 'published-action-story', summary: 'Summary', status: 'published', language: 'en', translationGroupId: 'group-1', sourceLanguage: 'en' },
      ],
      total: 1,
      page: 1,
      pages: 1,
    } as any);

    renderNewsTable();

    fireEvent.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    expect(navigateMock).toHaveBeenCalledWith('/admin/articles/published-source/edit');

    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0]);
    await waitFor(() => expect(archiveArticle).toHaveBeenCalled());
    expect(vi.mocked(archiveArticle).mock.calls[0][0]).toBe('published-source');

    fireEvent.click(screen.getAllByRole('button', { name: 'Unpublish' })[0]);
    await waitFor(() => expect(updateArticleStatus).toHaveBeenCalledWith('published-source', 'draft'));

    fireEvent.click(screen.getAllByRole('button', { name: 'Send Push' })[0]);
    expect(screen.getByText('Send Article Push?')).toBeInTheDocument();
    expect(deleteArticle).not.toHaveBeenCalled();
  });

  it('searches translated records but displays the source row once', async () => {
    vi.mocked(listArticles).mockResolvedValueOnce({
      rows: [
        { _id: 'hi-1', title: 'Hindi search match', status: 'published', language: 'hi', translationGroupId: 'group-1', sourceLanguage: 'en' },
        { _id: 'en-source', title: 'Canonical source title', status: 'published', language: 'en', translationGroupId: 'group-1', sourceLanguage: 'en' },
      ],
      total: 2,
      page: 1,
      pages: 1,
    } as any);

    renderNewsTable({ search: 'hindi search' });

    expect(await screen.findAllByText('Canonical source title')).toHaveLength(2);
    expect(screen.queryByText('Hindi search match')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 1 of 1 loaded')).toBeInTheDocument();
  });

  it('uses the canonical/source id for edit and publish actions on grouped draft rows', async () => {
    vi.mocked(listArticles).mockResolvedValueOnce({
      rows: [
        { _id: 'en-translation', title: 'English translation', status: 'draft', language: 'en', translationGroupId: 'group-1', sourceLanguage: 'hi' },
        { _id: 'hi-source', title: 'Hindi source title', status: 'draft', language: 'hi', translationGroupId: 'group-1', sourceLanguage: 'hi' },
        { _id: 'gu-translation', title: 'Gujarati translation', status: 'draft', language: 'gu', translationGroupId: 'group-1', sourceLanguage: 'hi' },
      ],
      total: 3,
      page: 1,
      pages: 1,
    } as any);

    renderNewsTable();

    const editButtons = await screen.findAllByRole('button', { name: 'Edit' });
    fireEvent.click(editButtons[0]);
    expect(navigateMock).toHaveBeenCalledWith('/admin/articles/hi-source/edit');

    const publishButtons = screen.getAllByRole('button', { name: 'Publish' });
    fireEvent.click(publishButtons[0]);

    await waitFor(() => expect(publishArticle).toHaveBeenCalledWith('hi-source'));
    expect(publishArticle).toHaveBeenCalledTimes(1);
    expect(updateArticleStatus).not.toHaveBeenCalledWith('hi-source', 'published');
  });

  it('selects one canonical id for one grouped logical row', async () => {
    const onSelectIds = vi.fn();
    vi.mocked(listArticles).mockResolvedValueOnce({
      rows: [
        { _id: 'en-translation', title: 'English translation', status: 'draft', language: 'en', translationGroupId: 'group-1', sourceLanguage: 'hi' },
        { _id: 'hi-source', title: 'Hindi source title', status: 'draft', language: 'hi', translationGroupId: 'group-1', sourceLanguage: 'hi' },
        { _id: 'gu-translation', title: 'Gujarati translation', status: 'draft', language: 'gu', translationGroupId: 'group-1', sourceLanguage: 'hi' },
      ],
      total: 3,
      page: 1,
      pages: 1,
    } as any);

    renderNewsTable({ onSelectIds });

    const rowCheckboxes = await screen.findAllByLabelText('Select row');
    fireEvent.click(rowCheckboxes[0]);

    await waitFor(() => expect(onSelectIds).toHaveBeenLastCalledWith(['hi-source']));
  });

  it('keeps Draft actions including Schedule and does not show Schedule for Published rows', async () => {
    vi.mocked(listArticles).mockResolvedValueOnce({
      rows: [
        { _id: 'draft-source', title: 'Draft grouped story', status: 'draft', language: 'en', translationGroupId: 'draft-group', sourceLanguage: 'en' },
        { _id: 'draft-hi', title: 'Draft Hindi', status: 'draft', language: 'hi', translationGroupId: 'draft-group', sourceLanguage: 'en' },
      ],
      total: 2,
      page: 1,
      pages: 1,
    } as any);

    const draftRender = renderNewsTable();

    expect(await screen.findAllByRole('button', { name: 'Edit' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Publish' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Schedule…' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Archive' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Delete' })).toHaveLength(2);
    draftRender.unmount();

    vi.mocked(listArticles).mockResolvedValueOnce({
      rows: [
        { _id: 'published-source', title: 'Published grouped story', slug: 'published-grouped-story', status: 'published', language: 'en', translationGroupId: 'published-group', sourceLanguage: 'en' },
        { _id: 'published-hi', title: 'Published Hindi', status: 'published', language: 'hi', translationGroupId: 'published-group', sourceLanguage: 'en' },
      ],
      total: 2,
      page: 1,
      pages: 1,
    } as any);

    renderNewsTable();

    expect(await screen.findAllByText('Published grouped story')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Schedule…' })).not.toBeInTheDocument();
  });

  it('opens the existing schedule modal and sends one schedule request for the source id', async () => {
    vi.mocked(listArticles).mockResolvedValueOnce({
      rows: [
        { _id: 'en-translation', title: 'English translation', status: 'draft', language: 'en', translationGroupId: 'group-1', sourceLanguage: 'hi' },
        { _id: 'hi-source', title: 'Hindi source title', status: 'draft', language: 'hi', translationGroupId: 'group-1', sourceLanguage: 'hi' },
      ],
      total: 2,
      page: 1,
      pages: 1,
    } as any);

    renderNewsTable();

    const scheduleButtons = await screen.findAllByRole('button', { name: 'Schedule…' });
    fireEvent.click(scheduleButtons[0]);

    expect(screen.getByRole('heading', { name: 'Schedule article' })).toBeInTheDocument();
    const dateInput = screen.getByLabelText('Date & Time (IST)');
    fireEvent.change(dateInput, { target: { value: '2026-09-09T10:30' } });

    const dialog = screen.getByRole('heading', { name: 'Schedule article' }).closest('div');
    expect(dialog).not.toBeNull();
    fireEvent.click(within(dialog as HTMLElement).getByRole('button', { name: 'Schedule' }));

    await waitFor(() => expect(scheduleArticle).toHaveBeenCalledTimes(1));
    expect(scheduleArticle).toHaveBeenCalledWith('hi-source', expect.any(String));
  });

  it('groups translations that arrive on different raw API pages', async () => {
    vi.mocked(listArticles)
      .mockResolvedValueOnce({
        rows: [
          { _id: 'en-source', title: 'Split page source', status: 'published', language: 'en', translationGroupId: 'split-group', sourceLanguage: 'en' },
        ],
        total: 3,
        page: 1,
        pages: 2,
      } as any)
      .mockResolvedValueOnce({
        rows: [
          { _id: 'hi-translation', title: 'Split Hindi', status: 'published', language: 'hi', translationGroupId: 'split-group', sourceLanguage: 'en' },
          { _id: 'gu-translation', title: 'Split Gujarati', status: 'published', language: 'gu', translationGroupId: 'split-group', sourceLanguage: 'en' },
        ],
        total: 3,
        page: 2,
        pages: 2,
      } as any);

    renderNewsTable();

    expect(await screen.findAllByText('Split page source')).toHaveLength(2);
    expect(screen.queryByText('Split Hindi')).not.toBeInTheDocument();
    expect(screen.queryByText('Split Gujarati')).not.toBeInTheDocument();
    expect(screen.getAllByText('EN+HI+GU')).toHaveLength(2);
    expect(screen.getByText('Showing 1 of 1 loaded')).toBeInTheDocument();
    expect(listArticles).toHaveBeenNthCalledWith(1, expect.objectContaining({ page: 1, limit: 20 }));
    expect(listArticles).toHaveBeenNthCalledWith(2, expect.objectContaining({ page: 2, limit: 20 }));
  });

  it('uses the shared helper for bulk Generate Missing Translations', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(listArticles).mockResolvedValueOnce({
      rows: [
        { _id: 'en-source', title: 'English source', status: 'published', language: 'en', translationGroupId: 'group-1', sourceLanguage: 'en' },
      ],
      total: 1,
      page: 1,
      pages: 1,
    } as any);

    renderNewsTable();

    fireEvent.click((await screen.findAllByLabelText('Select row'))[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Generate Missing Translations' }));

    await waitFor(() => expect(requeueArticleTranslations).toHaveBeenCalledWith('en-source', { languages: ['hi', 'gu'] }));
    expect(requeueArticleTranslations).toHaveBeenCalledTimes(1);
    expect(publishArticle).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it.each([
    ['published', 'published'],
    ['draft', 'draft'],
    ['scheduled', 'scheduled'],
  ] as const)('shows one grouped story in the %s quick filter', async (quickView, status) => {
    const onCounts = vi.fn();
    vi.mocked(listArticles).mockResolvedValueOnce({
      rows: [
        { _id: `${status}-gu`, title: `${status} Gujarati`, status, language: 'gu', translationGroupId: `${status}-group`, sourceLanguage: 'en' },
        { _id: `${status}-hi`, title: `${status} Hindi`, status, language: 'hi', translationGroupId: `${status}-group`, sourceLanguage: 'en' },
        { _id: `${status}-en`, title: `${status} source`, status, language: 'en', translationGroupId: `${status}-group`, sourceLanguage: 'en' },
      ],
      total: 3,
      page: 1,
      pages: 1,
    } as any);

    renderNewsTable({ quickView, onCounts });

    expect(await screen.findAllByText(`${status} source`)).toHaveLength(2);
    expect(screen.getByText('Showing 1 of 1 loaded')).toBeInTheDocument();
    await waitFor(() => expect(onCounts).toHaveBeenLastCalledWith(expect.objectContaining({ all: 1, [status]: 1 })));
  });
});
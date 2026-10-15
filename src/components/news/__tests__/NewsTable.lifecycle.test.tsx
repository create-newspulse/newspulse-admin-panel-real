import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article, ListResponse } from '@/lib/api/articles';
import type { ArticleLogicalCounts } from '@/lib/api/articleCounts';
import type { ManageNewsParams } from '@/types/api';
import ManageNews from '@/pages/ManageNews';
import { NewsTable } from '../NewsTable';

const mocks = vi.hoisted(() => ({
  role: 'founder',
  publishEnabled: true,
  list: vi.fn(),
  counts: vi.fn(),
  publish: vi.fn(),
  unpublish: vi.fn(),
  restore: vi.fn(),
  remove: vi.fn(),
  hardDelete: vi.fn(),
  bulkDelete: vi.fn(),
  updateStatus: vi.fn(),
  transition: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { role: mocks.role }, isFounder: mocks.role === 'founder' }),
}));
vi.mock('@/context/PublishFlagContext', () => ({
  usePublishFlag: () => ({
    publishEnabled: mocks.publishEnabled, envDefault: true, override: null, setOverride: vi.fn(),
  }),
}));
vi.mock('@/lib/api/articles', () => ({
  listArticles: mocks.list,
  publishArticle: mocks.publish,
  unpublishArticle: mocks.unpublish,
  restoreArticle: mocks.restore,
  deleteArticle: mocks.remove,
  hardDeleteArticle: mocks.hardDelete,
  bulkHardDeleteArticles: mocks.bulkDelete,
  updateArticleStatus: mocks.updateStatus,
  archiveArticle: vi.fn(),
  scheduleArticle: vi.fn(),
  unscheduleArticle: vi.fn(),
  requeueArticleTranslations: vi.fn(),
}));
vi.mock('@/lib/api/adminAnalytics', () => ({ listAdminAnalyticsArticles: vi.fn(async () => ({ rows: [] })) }));
vi.mock('@/lib/api', () => ({ default: { post: mocks.transition } }));
vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: { get: mocks.counts } }));
vi.mock('@/components/news/ArticleFilters', () => ({
  ArticleFilters: ({ params, onChange }: { params: ManageNewsParams; onChange: (params: ManageNewsParams) => void }) => (
    <>
      <button onClick={() => onChange({
        ...params, category: 'regional', language: 'hi', from: '2026-01-01', to: '2026-02-01',
      })}>Apply test filters</button>
      <button onClick={() => onChange({ ...params, sort: 'title' })}>Change sort only</button>
    </>
  ),
}));
vi.mock('@/components/news/FiltersDrawer', () => ({
  FiltersDrawer: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
}));
vi.mock('@/components/news/UploadCsvDialog', () => ({ UploadCsvDialog: () => null }));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: mocks.toastSuccess, error: mocks.toastError }),
}));

let backendRows: Article[];
const clients: QueryClient[] = [];
const story: Article = {
  _id: 'source-en', title: 'Source story', slug: 'source-story', status: 'draft',
  language: 'en', translationGroupId: 'story-group', sourceLanguage: 'en',
};

function response(rows: Article[]): ListResponse {
  return { rows, total: rows.length, page: 1, pages: 1 };
}

function countsResponse(overrides: Partial<ArticleLogicalCounts['counts']> = {}) {
  const counts = { published: 0, draft: 0, scheduled: 0, deleted: 0, archived: 0, mixed: 0, ...overrides };
  return {
    data: {
      ok: true, success: true,
      data: { unit: 'logical-story', total: Object.values(counts).reduce((sum, count) => sum + count, 0), counts },
    },
  };
}

function countButton(label: string) {
  return screen.getByRole('button', { name: new RegExp(`^${label}\\s*(?:\\d+|Loading count|Count unavailable)$`) });
}

function expectCount(label: string, value: number | string) {
  expect(within(countButton(label)).getByText(String(value), { exact: true })).toBeInTheDocument();
}

function renderTable(props: Partial<React.ComponentProps<typeof NewsTable>> = {}, managePage = false) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: 3, gcTime: Infinity }, mutations: { retry: 3 } },
  });
  clients.push(client);
  const onCounts = vi.fn();
  const onLoadStateChange = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        {managePage ? <ManageNews /> : (
          <NewsTable params={{ status: 'all', page: 1, limit: 20, sort: '-updatedAt' }}
            search="" quickView="all" onCounts={onCounts} onLoadStateChange={onLoadStateChange} {...props} />
        )}
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { client, onCounts, onLoadStateChange };
}

function action(name: string) {
  return screen.getAllByRole('button', { name })[0];
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  mocks.role = 'founder';
  mocks.publishEnabled = true;
  mocks.counts.mockResolvedValue(countsResponse({ draft: 1 }));
  backendRows = [
    { ...story },
    { ...story, _id: 'edition-hi', title: 'Hindi edition', language: 'hi' },
    { ...story, _id: 'edition-gu', title: 'Gujarati edition', language: 'gu' },
  ];
  mocks.list.mockImplementation(async (params: { status?: string }) => response(
    backendRows.filter((row) => !params.status || params.status === 'all' || row.status === params.status),
  ));
  mocks.publish.mockImplementation(async () => {
    backendRows = backendRows.map((row) => ({ ...row, status: 'published' }));
    return { ok: true, article: backendRows[0] };
  });
  mocks.unpublish.mockImplementation(async () => {
    backendRows = backendRows.map((row) => ({ ...row, status: 'draft' }));
    return { ok: true, article: backendRows[0] };
  });
  mocks.remove.mockImplementation(async () => {
    backendRows = backendRows.map((row) => ({ ...row, status: 'deleted' }));
    return { ok: true };
  });
  mocks.restore.mockImplementation(async () => {
    backendRows = backendRows.map((row) => ({ ...row, status: 'published' }));
    return { ok: true, restoredStatuses: ['published'], article: backendRows[0] };
  });
  mocks.hardDelete.mockImplementation(async () => { backendRows = []; return { ok: true }; });
  mocks.bulkDelete.mockImplementation(async () => { backendRows = []; return { ok: true }; });
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
    unobserve() {}
  });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Manage News lifecycle actions', () => {
  it.each(['refresh', 'lifecycle'])('keeps Edit and Push usable during an unrelated %s while locking lifecycle actions', async (pending) => {
    backendRows = backendRows.map((row) => ({ ...row, status: 'published' }));
    const { client } = renderTable();
    await screen.findAllByText('Source story');
    let finish!: () => void;
    let refresh: Promise<void> | undefined;
    if (pending === 'refresh') {
      mocks.list.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve(response(backendRows)); }));
      act(() => { refresh = client.invalidateQueries({ queryKey: ['articles'] }); });
    } else {
      mocks.unpublish.mockImplementationOnce(() => new Promise((resolve) => { finish = () => resolve({ ok: true }); }));
      fireEvent.click(action('Unpublish'));
    }
    await waitFor(() => expect(action('Unpublish')).toBeDisabled());
    expect(action('Edit')).toBeEnabled();
    expect(action('Send Push')).toBeEnabled();
    fireEvent.click(action('Send Push'));
    expect(screen.getByText('Send Article Push?')).toBeInTheDocument();
    await act(async () => { finish(); await refresh; });
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('publishes one logical story once, then refreshes rows and the existing grouped counts once', async () => {
    const { onCounts } = renderTable();
    await screen.findAllByText('Source story');
    fireEvent.click(action('Publish'));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(1));
    expect(mocks.publish.mock.calls[0]).toEqual(['source-en']);
    await waitFor(() => expect(onCounts).toHaveBeenLastCalledWith(expect.objectContaining({ all: 1, published: 1, draft: 0 })));
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });

  it('prevents repeated clicks while a whole-story action is in flight', async () => {
    let finish!: (value: { ok: boolean }) => void;
    mocks.publish.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    renderTable();
    await screen.findAllByText('Source story');
    const publish = action('Publish');
    fireEvent.click(publish);
    fireEvent.click(publish);
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(1));
    expect(action('Publish')).toBeDisabled();
    await act(async () => { finish({ ok: true }); });
    await waitFor(() => expect(action('Publish')).toBeEnabled());
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });

  it('unpublishes via the dedicated operation and immediately removes the stale Published row after refresh', async () => {
    backendRows = backendRows.map((row) => ({ ...row, status: 'published', publishedAt: '2026-01-02T10:00:00Z' }));
    const { onCounts } = renderTable({ params: { status: 'published', page: 1, limit: 20, sort: '-updatedAt' } });
    await screen.findAllByText('Source story');
    fireEvent.click(action('Unpublish'));
    await screen.findByText('No stories found.');
    expect(mocks.unpublish.mock.calls).toEqual([['source-en']]);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
    expect(backendRows.every((row) => row.publishedAt === '2026-01-02T10:00:00Z')).toBe(true);
    expect(onCounts).toHaveBeenLastCalledWith(expect.objectContaining({ published: 0 }));
  });

  it('soft-deletes one group, then refreshes the active list without optimistic lifecycle state', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { client } = renderTable();
    await screen.findAllByText('Source story');
    fireEvent.click(action('Delete'));
    await screen.findByText('No stories found.');
    expect(mocks.remove.mock.calls).toEqual([['source-en']]);
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(client.getQueryCache().getAll().filter((query) => query.queryKey[0] === 'articles')).toHaveLength(1);
  });

  it('reflects the restored Published state rather than forcing Draft', async () => {
    backendRows = backendRows.map((row) => ({ ...row, status: 'deleted', deletedFromStatus: 'published' }));
    renderTable({ params: { status: 'deleted', page: 1, limit: 20, sort: '-updatedAt' } });
    await screen.findAllByText('Source story');
    fireEvent.click(action('Restore'));
    await screen.findByText('No stories found.');
    expect(mocks.restore.mock.calls).toEqual([['source-en']]);
    expect(mocks.updateStatus).not.toHaveBeenCalled();
    expect(backendRows.every((row) => row.status === 'published')).toBe(true);
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it.each(['admin', 'editor', 'staff'])('does not grant %s publication or permanent deletion rights', async (role) => {
    mocks.role = role;
    renderTable();
    await screen.findAllByText('Source story');
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Edit' }).length).toBeGreaterThan(0);
    cleanup();
    backendRows = [{ ...story, status: 'deleted', deletedFromStatus: 'published' }];
    renderTable({ params: { status: 'deleted', page: 1, limit: 20, sort: '-updatedAt' } });
    await screen.findAllByText('Source story');
    expect(screen.queryByRole('button', { name: 'Delete forever' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete Selected Forever/ })).not.toBeInTheDocument();
    if (role !== 'staff') expect(screen.getAllByRole('button', { name: /Founder permission is required to restore/ })[0]).toBeDisabled();
  });

  it('requires typed irreversible confirmation for permanent whole-story deletion', async () => {
    backendRows = backendRows.map((row) => ({ ...row, status: 'deleted' }));
    const prompt = vi.spyOn(window, 'prompt').mockReturnValueOnce(null).mockReturnValueOnce('DELETE');
    renderTable({ params: { status: 'deleted', page: 1, limit: 20, sort: '-updatedAt' } });
    await screen.findAllByText('Source story');
    fireEvent.click(action('Delete forever'));
    expect(mocks.hardDelete).not.toHaveBeenCalled();
    fireEvent.click(action('Delete forever'));
    await screen.findByText('No stories found.');
    expect(prompt).toHaveBeenCalledWith(expect.stringContaining('all available language versions'));
    expect(mocks.hardDelete.mock.calls).toEqual([['source-en']]);
    expect(mocks.list).toHaveBeenCalledTimes(2);
  });

  it('does not optimistically remove a permanently deleted row on failure', async () => {
    backendRows = [{ ...story, status: 'deleted' }];
    mocks.hardDelete.mockRejectedValue({ response: { status: 503 } });
    vi.spyOn(window, 'prompt').mockReturnValue('DELETE');
    renderTable({ params: { status: 'deleted', page: 1, limit: 20, sort: '-updatedAt' } });
    await screen.findAllByText('Source story');
    fireEvent.click(action('Delete forever'));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('temporarily unavailable')));
    expect(screen.getAllByText('Source story')).toHaveLength(2);
    expect(mocks.hardDelete).toHaveBeenCalledTimes(1);
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });

  it('uses one confirmed bulk operation for selected deleted logical stories', async () => {
    backendRows = [...backendRows.map((row) => ({ ...row, status: 'deleted' as const })), { ...story, _id: 'other', title: 'Other story', translationGroupId: 'other-group', status: 'deleted' }];
    vi.spyOn(window, 'prompt').mockReturnValue('DELETE');
    renderTable({ params: { status: 'deleted', page: 1, limit: 20, sort: '-updatedAt' } });
    await screen.findAllByText('Source story');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all visible' }));
    fireEvent.click(screen.getByRole('button', { name: /Delete Selected Forever/ }));
    await screen.findByText('No stories found.');
    expect(mocks.bulkDelete.mock.calls).toEqual([[['source-en', 'other']]]);
    expect(mocks.hardDelete).not.toHaveBeenCalled();
  });

  it('drops selected ids that disappear from the authoritative refreshed list', async () => {
    const onSelectIds = vi.fn();
    const { client } = renderTable({ onSelectIds });
    await screen.findAllByText('Source story');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all visible' }));
    await waitFor(() => expect(onSelectIds).toHaveBeenLastCalledWith(['source-en']));
    backendRows = [];
    await act(async () => { await client.invalidateQueries({ queryKey: ['articles'] }); });
    await waitFor(() => expect(onSelectIds).toHaveBeenLastCalledWith([]));
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('shows a legitimate 409 and refreshes once, without retrying the mutation', async () => {
    mocks.publish.mockRejectedValue({ response: { status: 409, data: { message: 'Slug already exists', code: 'SLUG_CONFLICT' } } });
    renderTable();
    await screen.findAllByText('Source story');
    fireEvent.click(action('Publish'));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Slug already exists'));
    await waitFor(() => expect(action('Publish')).toBeEnabled());
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it('keeps a successful mutation distinct from a failed follow-up refresh', async () => {
    mocks.list.mockResolvedValueOnce(response(backendRows)).mockRejectedValue({ response: { status: 503 } });
    mocks.counts.mockResolvedValueOnce(countsResponse({ draft: 1 })).mockResolvedValue(countsResponse({ published: 1 }));
    renderTable({}, true);
    await screen.findAllByText('Source story');
    await waitFor(() => expect(action('Refresh')).toBeEnabled());
    fireEvent.click(action('Publish'));
    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(
      'The action completed, but the refreshed list could not be loaded. Refresh the list; do not repeat the action.',
    ));
    expectCount('Published', 1);
    expect(mocks.counts).toHaveBeenCalledTimes(2);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    mocks.list.mockImplementation(async () => response(backendRows));
    fireEvent.click(action('Retry'));
    await screen.findAllByRole('button', { name: 'Unpublish' });
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });
});

describe('Manage News chronology and request states', () => {
  it.each(['status', 'quickView'])('orders Published by publishedAt for the %s view, never updatedAt', async (view) => {
    backendRows = [
      { ...story, _id: 'older', title: 'Older publication edited today', translationGroupId: 'old', status: 'published', publishedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-10-14T00:00:00Z' },
      { ...story, _id: 'newer', title: 'Newer publication', translationGroupId: 'new', status: 'published', publishedAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' },
      { ...story, _id: 'unknown', title: 'Unknown publication date', translationGroupId: 'unknown', status: 'published', updatedAt: '2026-12-01T00:00:00Z' },
    ];
    renderTable(view === 'status'
      ? { params: { status: 'published', page: 1, limit: 20, sort: '-updatedAt' } }
      : { quickView: 'published' });
    await screen.findAllByText('Newer publication');
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Newer publication');
    expect(rows[1]).toHaveTextContent('Older publication edited today');
    expect(rows[2]).toHaveTextContent('Unknown publication date');
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ sort: '-publishedAt' }));
  });

  it('does not display zero counts or an empty newsroom during initial loading', async () => {
    let finish!: (result: ListResponse) => void;
    mocks.list.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    renderTable({}, true);
    expect(screen.getByText('Loading stories...')).toBeInTheDocument();
    expect(screen.getAllByLabelText('Loading count')).toHaveLength(9);
    expect(screen.queryByText('No stories found.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing 0/)).not.toBeInTheDocument();
    await act(async () => { finish(response([])); });
    await screen.findByText('No stories found.');
    expect(screen.queryByText('Loading stories...')).not.toBeInTheDocument();
    expect(screen.getByText('Showing 0 of 0 loaded')).toBeInTheDocument();
  });

  it.each([
    [401, 'session'],
    [403, 'permission'],
    [409, 'conflict'],
    [503, 'temporarily unavailable'],
    [0, 'Cannot reach the Backend'],
  ])('distinguishes HTTP/network failure %s from successful empty results', async (status, message) => {
    mocks.list.mockRejectedValue(status
      ? { response: { status, data: {} } }
      : { code: 'BACKEND_OFFLINE' });
    renderTable({}, true);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    await waitFor(() => expect(screen.getAllByLabelText('Count unavailable')).toHaveLength(5));
    expectCount('Draft', 1);
    expect(screen.queryByText('No stories found.')).not.toBeInTheDocument();
    expect(screen.queryByText(/Showing 0/)).not.toBeInTheDocument();
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });

  it('makes Refresh refetch the existing list instead of merely cloning params', async () => {
    renderTable({}, true);
    await screen.findAllByText('Source story');
    await waitFor(() => expect(action('Refresh')).toBeEnabled());
    backendRows = [{ ...story, title: 'Latest server title' }];
    fireEvent.click(action('Refresh'));
    await screen.findAllByText('Latest server title');
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.counts).toHaveBeenCalledTimes(2);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('refreshes once after bulk Publish and sends one operation per selected logical story', async () => {
    renderTable({}, true);
    await screen.findAllByText('Source story');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all visible' }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const buttons = screen.getAllByRole('button', { name: 'Publish' });
    fireEvent.click(buttons[buttons.length - 1]);
    await screen.findAllByRole('button', { name: 'Unpublish' });
    expect(mocks.publish.mock.calls).toEqual([['source-en']]);
    expect(mocks.list).toHaveBeenCalledTimes(2);
    expect(mocks.counts).toHaveBeenCalledTimes(2);
  });

  it.each([
    { operation: 'toReview', label: /^To Review$/, status: 409, failedCount: 1 },
    { operation: 'toLegal', label: /^To Legal$/, status: 503, failedCount: 1 },
    { operation: 'approve', label: /Approve/, status: 403, failedCount: 1 },
    { operation: 'toReview', label: /^To Review$/, status: 403, failedCount: 3 },
  ])('attempts every selected story after $failedCount $operation failures and refreshes only once', async ({ operation, label, status, failedCount }) => {
    backendRows = ['first', 'second', 'third'].map((id) => ({
      ...story, _id: id, title: `${id} story`, translationGroupId: id,
    }));
    for (let index = 0; index < failedCount; index++) {
      mocks.transition.mockRejectedValueOnce({ response: { status, data: { message: 'Article changed. Reload and retry.' } } });
    }
    mocks.transition.mockResolvedValue({ data: { ok: true } });
    renderTable({}, true);
    await screen.findAllByText('first story');
    await waitFor(() => expect(action('Refresh')).toBeEnabled());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all visible' }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: label }));
    await waitFor(() => expect(mocks.transition).toHaveBeenCalledTimes(3));
    expect(mocks.transition.mock.calls).toEqual(
      ['first', 'second', 'third'].map((id) => [`/news/${id}/transition`, { action: operation }]),
    );
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    expect(mocks.counts).toHaveBeenCalledTimes(2);
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining(`${3 - failedCount} of 3 stories updated. ${failedCount} failed.`));
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  describe('Manage News authoritative logical-story counters', () => {
    it.each([
      { operation: 'publish', label: 'Publish' },
      { operation: 'toReview', label: 'To Review' },
      { operation: 'refresh', label: 'Refresh' },
    ] as const)('keeps $label usable while initial and refreshed counts are pending', async ({ operation, label }) => {
      const pendingCounts: Array<(data: ReturnType<typeof countsResponse>) => void> = [];
      mocks.counts.mockImplementation(() => new Promise<ReturnType<typeof countsResponse>>((resolve) => {
        pendingCounts.push(resolve);
      }));
      mocks.transition.mockResolvedValue({ data: { ok: true } });
      renderTable({}, true);
      await screen.findAllByText('Source story');
      await waitFor(() => expect(action('Refresh')).toBeEnabled());
      expectCount('Draft', '...');
      if (operation === 'refresh') {
        backendRows = backendRows.map((row) => ({ ...row, title: 'Latest server title' }));
      } else {
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select all visible' }));
        vi.spyOn(window, 'confirm').mockReturnValue(true);
      }
      const buttons = screen.getAllByRole('button', { name: label });
      expect(buttons[buttons.length - 1]).toBeEnabled();
      fireEvent.click(buttons[buttons.length - 1]);
      await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(action('Refresh')).toBeEnabled());
      expect(mocks.counts).toHaveBeenCalledTimes(2);
      expect(mocks.counts.mock.calls[0][1].signal.aborted).toBe(true);
      expectCount('Draft', '...');
      expect(mocks.toastError).not.toHaveBeenCalled();
      if (operation === 'publish') {
        expect(mocks.publish.mock.calls).toEqual([['source-en']]);
        expect(action('Unpublish')).toBeEnabled();
      } else if (operation === 'toReview') {
        expect(mocks.transition.mock.calls).toEqual([['/news/source-en/transition', { action: 'toReview' }]]);
        expect(action('To Review')).toBeEnabled();
      } else {
        await screen.findAllByText('Latest server title');
        expect(mocks.publish).not.toHaveBeenCalled();
        expect(mocks.transition).not.toHaveBeenCalled();
      }
      await act(async () => {
        pendingCounts[1](countsResponse(operation === 'publish' ? { published: 1 } : { draft: 1 }));
        pendingCounts[0](countsResponse({ draft: 1 }));
      });
      await waitFor(() => expectCount('Published', operation === 'publish' ? 1 : 0));
      expect(mocks.counts).toHaveBeenCalledTimes(2);
    });

    it('maps the four status counters directly while keeping Archived unnumbered and mixed separate', async () => {
      mocks.counts.mockResolvedValue(countsResponse({ published: 12, draft: 4, scheduled: 2, deleted: 2, archived: 1, mixed: 1 }));
      const { client } = renderTable({}, true);
      await waitFor(() => expect(action('Refresh')).toBeEnabled());
      expectCount('Published', 12);
      expectCount('Draft', 4);
      expectCount('Scheduled', 2);
      expectCount('Deleted', 2);
      expectCount('All', 1);
      expect(screen.getByRole('button', { name: 'Archived' })).toHaveTextContent(/^Archived$/);
      expect(screen.getByText('Stories with mixed lifecycle statuses: 1. Counted separately.')).toHaveAttribute('role', 'status');
      expect(client.getQueriesData<ArticleLogicalCounts>({ queryKey: ['articles', 'logical-counts'] })[0]?.[1])
        .toMatchObject({ total: 22, counts: { archived: 1, mixed: 1 } });
      expect(mocks.counts).toHaveBeenCalledTimes(1);
    });

    it('shows one logical story, not three language editions or a locally derived status count', async () => {
      backendRows = backendRows.map((row) => ({ ...row, status: 'published' }));
      mocks.counts.mockResolvedValue(countsResponse({ published: 1 }));
      renderTable({}, true);
      await waitFor(() => expect(action('Refresh')).toBeEnabled());
      expectCount('Published', 1);
      expectCount('Draft', 0);
      await expect(mocks.list.mock.results[0].value).resolves.toMatchObject({ total: 3, rows: expect.any(Array) });
      expect(mocks.counts).toHaveBeenCalledTimes(1);
    });

    it('keeps all four counts unknown while loading, then displays genuine empty-selection zeros', async () => {
      let finish!: (response: ReturnType<typeof countsResponse>) => void;
      mocks.counts.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
      renderTable({}, true);
      await screen.findAllByText('Source story');
      for (const label of ['Published', 'Draft', 'Scheduled', 'Deleted']) expectCount(label, '...');
      expectCount('All', 1);
      await act(async () => { finish(countsResponse()); });
      await waitFor(() => expect(action('Refresh')).toBeEnabled());
      for (const label of ['Published', 'Draft', 'Scheduled', 'Deleted']) expectCount(label, 0);
      expect(screen.queryByRole('alert', { name: 'Logical story counts unavailable' })).not.toBeInTheDocument();
    });

    it.each([
      [401, 'session has expired'],
      [403, 'permission'],
      [419, 'session has expired'],
      [503, 'temporarily unavailable'],
      [0, 'Cannot reach the Backend'],
    ])('keeps failed status counts unknown for HTTP/network %s without hiding the loaded list', async (status, message) => {
      mocks.counts.mockRejectedValue(status
        ? { response: { status, data: { message: 'Private Backend diagnostic' } } }
        : { code: 'BACKEND_OFFLINE' });
      renderTable({}, true);
      const alert = await screen.findByRole('alert', { name: 'Logical story counts unavailable' });
      expect(alert).toHaveTextContent(message);
      expect(alert).not.toHaveTextContent('Private Backend diagnostic');
      await screen.findAllByText('Source story');
      for (const label of ['Published', 'Draft', 'Scheduled', 'Deleted']) expectCount(label, '--');
      expectCount('All', 1);
      expect(mocks.counts).toHaveBeenCalledTimes(1);
      expect(mocks.list).toHaveBeenCalledTimes(1);
    });

    it.each(['malformed', 'identity conflict'])('does not reinterpret a %s response as zero counts', async (failure) => {
      if (failure === 'malformed') {
        const invalid = countsResponse();
        invalid.data.data.counts.draft = -1;
        mocks.counts.mockResolvedValue(invalid);
      } else {
        mocks.counts.mockRejectedValue({
          response: { status: 409, data: { code: 'ARTICLE_LOGICAL_IDENTITY_CONFLICT', message: 'Private identity documents and stack trace' } },
        });
      }
      renderTable({}, true);
      const alert = await screen.findByRole('alert', { name: 'Logical story counts unavailable' });
      expect(alert).toHaveTextContent(failure === 'malformed' ? 'response could not be read' : 'HTTP 409');
      if (failure === 'identity conflict') expect(alert).toHaveTextContent('article identities conflict');
      expect(alert).not.toHaveTextContent('Private identity documents');
      for (const label of ['Published', 'Draft', 'Scheduled', 'Deleted']) expectCount(label, '--');
      expect(mocks.counts).toHaveBeenCalledTimes(1);
    });

    it('retries counts deliberately without reloading the list or replaying a lifecycle operation', async () => {
      mocks.counts.mockRejectedValueOnce({ response: { status: 503 } }).mockResolvedValue(countsResponse({ draft: 7 }));
      renderTable({}, true);
      await screen.findByRole('alert', { name: 'Logical story counts unavailable' });
      fireEvent.click(screen.getByRole('button', { name: 'Retry counts' }));
      await waitFor(() => expectCount('Draft', 7));
      expect(mocks.counts).toHaveBeenCalledTimes(2);
      expect(mocks.list).toHaveBeenCalledTimes(1);
      expect(mocks.publish).not.toHaveBeenCalled();
    });

    it('mirrors supported active list filters without including sort or quick-view-only selection', async () => {
      renderTable({}, true);
      await waitFor(() => expect(action('Refresh')).toBeEnabled());
      fireEvent.click(screen.getByRole('button', { name: 'Published' }));
      await waitFor(() => expect(mocks.counts).toHaveBeenCalledTimes(2));
      fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
      fireEvent.click(screen.getByRole('button', { name: 'Apply test filters' }));
      await waitFor(() => expect(mocks.counts).toHaveBeenCalledTimes(3));
      fireEvent.change(screen.getByPlaceholderText(/Search title, summary, content, tags/), { target: { value: ' Source ' } });
      await waitFor(() => expect(mocks.counts).toHaveBeenCalledTimes(4));
      const scope = {
        status: 'published', category: 'regional', language: 'hi', from: '2026-01-01', to: '2026-02-01', q: 'Source',
      };
      expect(mocks.counts).toHaveBeenLastCalledWith('articles/counts', expect.objectContaining({ params: scope }));
      expect(mocks.list).toHaveBeenLastCalledWith(expect.objectContaining(scope));
      const listCalls = mocks.list.mock.calls.length;
      fireEvent.click(screen.getByRole('button', { name: 'Change sort only' }));
      await waitFor(() => expect(action('Refresh')).toBeEnabled());
      expect(mocks.list).toHaveBeenCalledTimes(listCalls);
      fireEvent.click(countButton('Draft'));
      expect(mocks.counts).toHaveBeenCalledTimes(4);
    });

    it('preserves record-page loading and existing grouped-row pagination, independently of count totals', async () => {
      backendRows = Array.from({ length: 22 }, (_, index) => ['en', 'hi', 'gu'].map((language) => ({
        ...story, _id: `story-${index}-${language}`, title: `Story ${index}`, language, translationGroupId: `story-${index}`,
      }))).flat();
      mocks.list.mockImplementation(async ({ page = 1, limit = 20 }: ManageNewsParams) => ({
        rows: backendRows.slice((page - 1) * limit, page * limit), total: 66, page, pages: Math.ceil(66 / limit),
      }));
      mocks.counts.mockResolvedValue(countsResponse({ draft: 125 }));
      renderTable({}, true);
      await waitFor(() => expect(screen.getByText('Refresh', { selector: 'button' })).toBeEnabled());
      expect(screen.getByText('125', { selector: 'span' })).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
      expect(mocks.list).toHaveBeenCalledTimes(4);
      expect(mocks.list.mock.calls.map(([params]) => params.page)).toEqual([1, 2, 3, 4]);
      expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(21);
      fireEvent.click(screen.getByText('Next', { selector: 'button' }));
      expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
      expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(3);
      expect(mocks.list).toHaveBeenCalledTimes(4);
      expect(mocks.counts).toHaveBeenCalledTimes(1);
    }, 10_000);

    it.each([
      { operation: 'publish', label: 'Publish', before: 'draft', after: 'published' },
      { operation: 'unpublish', label: 'Unpublish', before: 'published', after: 'draft' },
      { operation: 'remove', label: 'Delete', before: 'draft', after: 'deleted' },
      { operation: 'restore', label: 'Restore', before: 'deleted', after: null },
      { operation: 'hardDelete', label: 'Delete forever', before: 'deleted', after: null },
    ] as const)('finishes $operation and refreshes rows without waiting for logical counts', async ({ operation, label, before, after }) => {
      backendRows = backendRows.map((row) => ({ ...row, status: before, deletedFromStatus: 'published' }));
      mocks.counts.mockResolvedValue(countsResponse({ [before]: 1 }));
      const { client } = renderTable({}, true);
      await waitFor(() => expect(action('Refresh')).toBeEnabled());
      if (before === 'deleted') {
        fireEvent.click(countButton('Deleted'));
        await screen.findAllByText('Source story');
        await waitFor(() => expect(action('Refresh')).toBeEnabled());
      }
      const countCalls = mocks.counts.mock.calls.length;
      const listCalls = mocks.list.mock.calls.length;
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      vi.spyOn(window, 'prompt').mockReturnValue('DELETE');
      let finishCounts!: (data: ReturnType<typeof countsResponse>) => void;
      mocks.counts.mockImplementationOnce(() => new Promise((resolve) => { finishCounts = resolve; }));
      fireEvent.click(action(label));
      await waitFor(() => expect(mocks.counts).toHaveBeenCalledTimes(countCalls + 1));
      await waitFor(() => expect(action('Refresh')).toBeEnabled());
      expect(mocks[operation].mock.calls).toEqual([['source-en']]);
      expect(mocks.list).toHaveBeenCalledTimes(listCalls + 1);
      expect(client.isMutating({ mutationKey: ['articles', 'lifecycle'] })).toBe(0);
      for (const countLabel of ['Published', 'Draft', 'Scheduled', 'Deleted']) expectCount(countLabel, '...');
      if (after === 'published') expect(action('Unpublish')).toBeEnabled();
      if (after === 'draft') expect(action('Publish')).toBeEnabled();
      await act(async () => { finishCounts(countsResponse(after ? { [after]: 1 } : {})); });
      await waitFor(() => expect(screen.queryByLabelText('Loading count')).not.toBeInTheDocument());
      for (const bucket of ['published', 'draft', 'scheduled', 'deleted']) {
        expectCount(bucket[0].toUpperCase() + bucket.slice(1), bucket === after ? 1 : 0);
      }
    });

    it('replaces an initial pending count request after lifecycle success and ignores its late stale response', async () => {
      let finishStale!: (response: ReturnType<typeof countsResponse>) => void;
      mocks.counts.mockImplementationOnce(() => new Promise((resolve) => { finishStale = resolve; }))
        .mockResolvedValue(countsResponse({ published: 1 }));
      renderTable({}, true);
      await screen.findAllByText('Source story');
      expectCount('Draft', '...');
      fireEvent.click(action('Publish'));
      await waitFor(() => expect(mocks.counts).toHaveBeenCalledTimes(2));
      await waitFor(() => expectCount('Published', 1));
      expect(mocks.counts.mock.calls[0][1].signal.aborted).toBe(true);
      await act(async () => { finishStale(countsResponse({ draft: 1 })); });
      expectCount('Published', 1);
      expectCount('Draft', 0);
      expect(mocks.counts).toHaveBeenCalledTimes(2);
      expect(mocks.list).toHaveBeenCalledTimes(2);
      expect(mocks.publish).toHaveBeenCalledTimes(1);
    });

    it.each([403, 409, 503])('does not optimistically change counts after lifecycle HTTP %s failure', async (status) => {
      mocks.publish.mockRejectedValue({ response: { status, data: {} } });
      renderTable({}, true);
      await waitFor(() => expect(action('Refresh')).toBeEnabled());
      fireEvent.click(action('Publish'));
      await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
      await waitFor(() => expect(action('Refresh')).toBeEnabled());
      expectCount('Published', 0);
      expectCount('Draft', 1);
      expect(mocks.counts).toHaveBeenCalledTimes(status === 409 ? 2 : 1);
      expect(mocks.publish).toHaveBeenCalledTimes(1);
      expect(mocks.toastSuccess).not.toHaveBeenCalled();
    });

    it.each([503, 409])('isolates count HTTP %s after a successful mutation and list refresh', async (status) => {
      mocks.counts.mockResolvedValueOnce(countsResponse({ draft: 1 })).mockRejectedValue({
        response: { status, data: status === 409 ? { code: 'ARTICLE_LOGICAL_IDENTITY_CONFLICT' } : {} },
      });
      renderTable({}, true);
      await waitFor(() => expect(action('Refresh')).toBeEnabled());
      fireEvent.click(action('Publish'));
      expect(await screen.findByRole('alert', { name: 'Logical story counts unavailable' })).toHaveTextContent(`HTTP ${status}`);
      await waitFor(() => expect(action('Unpublish')).toBeEnabled());
      for (const label of ['Published', 'Draft', 'Scheduled', 'Deleted']) expectCount(label, '--');
      expect(mocks.toastSuccess).toHaveBeenCalledWith('Published');
      expect(mocks.toastError).not.toHaveBeenCalled();
      expect(mocks.publish).toHaveBeenCalledTimes(1);
      expect(mocks.list).toHaveBeenCalledTimes(2);
      expect(mocks.counts).toHaveBeenCalledTimes(2);
      mocks.counts.mockResolvedValue(countsResponse({ published: 1 }));
      fireEvent.click(screen.getByRole('button', { name: 'Retry counts' }));
      await waitFor(() => expectCount('Published', 1));
      expect(mocks.counts).toHaveBeenCalledTimes(3);
      expect(mocks.list).toHaveBeenCalledTimes(2);
      expect(mocks.publish).toHaveBeenCalledTimes(1);
    });

    it('does not add polling or duplicate requests on rerenders, selection, or quick-view changes', async () => {
      vi.useFakeTimers();
      try {
        await act(async () => {
          renderTable({}, true);
          await vi.advanceTimersByTimeAsync(1);
        });
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(mocks.counts).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole('checkbox', { name: 'Select all visible' }));
        fireEvent.click(countButton('Draft'));
        await act(async () => { await vi.advanceTimersByTimeAsync(120_000); });
        expectCount('Draft', 1);
        expect(mocks.counts).toHaveBeenCalledTimes(1);
        expect(mocks.list).toHaveBeenCalledTimes(1);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('does not continue a Publish batch after a conflict or replay its mutation', async () => {
    backendRows = ['first', 'second'].map((id) => ({ ...story, _id: id, title: `${id} story`, translationGroupId: id }));
    mocks.publish.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Article group changed. Reload and retry.' } } });
    renderTable({}, true);
    await screen.findAllByText('first story');
    await waitFor(() => expect(action('Refresh')).toBeEnabled());
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all visible' }));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const publish = screen.getAllByRole('button', { name: 'Publish' });
    fireEvent.click(publish[publish.length - 1]);
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    expect(mocks.publish.mock.calls).toEqual([['first']]);
    expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('Article group changed. Reload and retry.'));
  });
});

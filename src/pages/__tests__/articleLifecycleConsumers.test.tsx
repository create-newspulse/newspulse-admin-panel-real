import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article, ArticleRestoreEligibility } from '@/lib/api/articles';
import DraftDeskPage from '@/pages/admin/DraftDeskPage';
import EditNews from '@/pages/EditNews';

const mocks = vi.hoisted(() => ({
  role: 'founder',
  modules: ['manage_news'],
  permanentRestore: false,
  temporaryRestore: false,
  eligibility: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  list: vi.fn(),
  ownList: vi.fn(),
  publish: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  restore: vi.fn(),
  hardDelete: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({
  user: {
    id: 'synthetic-desk-user', role: mocks.role, moduleAccess: mocks.modules,
    specialRightsConfigured: mocks.permanentRestore,
    specialRightsOverride: mocks.permanentRestore ? ['news_restore'] : [],
    specialRights: mocks.permanentRestore || mocks.temporaryRestore ? ['news_restore'] : [],
    temporaryAccess: mocks.temporaryRestore ? [{ rightKey: 'news_restore', enabled: true }] : [],
  },
  isAuthenticated: true, isReady: true, isLoading: false, isRestoring: false,
}) }));
vi.mock('@/hooks/useAdminEffectiveAccess', () => ({ useAdminEffectiveAccess: () => ({
  isLoading: false, error: null, backendAccess: {},
  modulePolicy: {
    manage_news: { moduleKey: 'manage_news', state: 'available' },
    add_news: { moduleKey: 'add_news', state: 'available' },
    draft_desk: { moduleKey: 'draft_desk', state: 'available' },
  },
}) }));
vi.mock('@/context/PublishFlagContext', () => ({ usePublishFlag: () => ({ publishEnabled: true }) }));
vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: { get: mocks.get, post: mocks.post } }));
vi.mock('@/lib/api/articles', () => ({
  listArticles: mocks.list, listOwnDrafts: mocks.ownList, publishArticle: mocks.publish, updateArticle: mocks.update,
  deleteArticle: mocks.remove, restoreArticle: mocks.restore, hardDeleteArticle: mocks.hardDelete,
  getArticleRestoreEligibility: mocks.eligibility,
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: mocks.success, error: mocks.error }) }));
vi.mock('@/components/articles/CoverImageUpload', () => ({ default: () => null }));
vi.mock('@/lib/api/media', () => ({ uploadCoverImage: vi.fn() }));
vi.mock('@/components/editor/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Legacy content" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

const source: Article = {
  _id: 'source-en', title: 'Lifecycle source story', slug: 'lifecycle-source',
  content: 'A source story with body content.', summary: 'A summary.',
  category: 'National', status: 'draft', language: 'en', translationGroupId: 'group-1',
};
let records: Article[];
const clients: QueryClient[] = [];

function restoreAssessment(restoreStatus = 'draft'): ArticleRestoreEligibility {
  return {
    articleId: 'source-en', eligible: true, decision: 'eligible', complete: true, requiresFounder: false,
    reasonCodes: [], publicCopies: [],
    members: [
      { id: 'source-en', language: 'en', status: 'deleted', restoreStatus, historyKnown: true },
      { id: 'edition-hi', language: 'hi', status: 'deleted', restoreStatus, historyKnown: true },
    ],
  };
}

function renderPage(legacy = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[legacy ? '/edit/source-en' : '/draft-desk']}>
        <Routes>
          <Route path="/edit/:id" element={<EditNews />} />
          <Route path="/draft-desk" element={<DraftDeskPage />} />
          <Route path="/add" element={<div>Create route</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.role = 'founder';
  mocks.modules = ['manage_news'];
  mocks.permanentRestore = false;
  mocks.temporaryRestore = false;
  mocks.eligibility.mockResolvedValue(restoreAssessment());
  mocks.ownList.mockResolvedValue({ items: [], total: 0, page: 1, pages: 1 });
  records = [source, { ...source, _id: 'edition-hi', title: 'Hindi edition', language: 'hi' }];
  mocks.list.mockImplementation(async (params: { status: string }) => {
    const rows = records.filter((record) => record.status === params.status);
    return { rows, total: rows.length, page: 1, pages: 1 };
  });
  mocks.get.mockImplementation(async (path: string) => path.endsWith('/workflow') ? {
    data: {
      status: records[0].status,
      stage: records[0].status === 'published' ? 'published' : 'approved',
      checklist: { ptiCompliance: true, rightsCleared: true, attributionPresent: true, defamationScanOk: true },
    },
  } : { data: { article: records[0] } });
  mocks.publish.mockImplementation(async () => {
    records = records.map((record) => ({ ...record, status: 'published', publishedAt: '2026-01-15T10:00:00.000Z' }));
    return { ok: true, article: records[0] };
  });
  mocks.update.mockImplementation(async (id: string, payload: Partial<Article>) => {
    records[0] = { ...records[0], ...payload, _id: id };
    return { ok: true, article: records[0] };
  });
  mocks.remove.mockImplementation(async () => {
    records = records.map((record) => ({ ...record, status: 'deleted' }));
    return { ok: true, deletedIds: records.map((record) => record._id) };
  });
  mocks.restore.mockImplementation(async () => {
    records = records.map((record) => ({ ...record, status: 'published' }));
    return { ok: true, changedIds: records.map((record) => record._id), restoredStatuses: ['published'] };
  });
  mocks.hardDelete.mockImplementation(async () => {
    const deletedIds = records.map((record) => record._id);
    records = [];
    return { ok: true, deletedIds };
  });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
});

describe('Draft Desk existing lifecycle controls', () => {
  it.each(['add_news', 'draft_desk'])('offers authorized %s staff a creation route without deleted listing or restore', async module => {
    mocks.role = 'editor';
    mocks.modules = [module];
    renderPage();
    await screen.findByText('No eligible own drafts found.');
    expect(mocks.list).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Deleted' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add New' }));
    expect(screen.getByText('Create route')).toBeInTheDocument();
  });

  it.each(['draft', 'archived', 'published', 'scheduled'] as const)(
    'blocks staff restoration of visible %s history until eligibility is assessed', async previous => {
      mocks.role = 'editor';
      mocks.permanentRestore = true;
      records = records.map(record => ({ ...record, status: 'deleted', deletedFromStatus: previous }));
      renderPage();
      fireEvent.click(screen.getByRole('button', { name: 'Deleted' }));
      await screen.findByText('Lifecycle source story');
      const restore = screen.getByRole('button', { name: 'Restore' });
      expect(restore).toBeDisabled();
      expect(restore).toHaveAttribute('title', expect.stringMatching(/Check restore eligibility/i));
      fireEvent.click(restore);
      expect(mocks.restore).not.toHaveBeenCalled();
      expect(mocks.eligibility).not.toHaveBeenCalled();
    },
  );

  it('does not accept a temporary-only restore right in the full Draft Desk', async () => {
    mocks.role = 'admin';
    mocks.temporaryRestore = true;
    records = records.map(record => ({ ...record, status: 'deleted', deletedFromStatus: 'draft' }));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Deleted' }));
    await screen.findByText('Lifecycle source story');
    const restore = screen.getByRole('button', { name: 'Restore' });
    expect(restore).toBeDisabled();
    expect(restore).toHaveAttribute('title', expect.stringMatching(/permanent/i));
    fireEvent.click(restore);
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it.each(['draft', 'archived'] as const)('assesses and rechecks eligible deleted %s groups before the existing POST', async restoreStatus => {
    mocks.role = 'editor';
    mocks.permanentRestore = true;
    records = records.map(record => ({ ...record, status: 'deleted', deletedFromStatus: restoreStatus }));
    mocks.eligibility.mockResolvedValue(restoreAssessment(restoreStatus));
    mocks.restore.mockImplementation(async () => {
      records = records.map(record => ({ ...record, status: restoreStatus }));
      return { ok: true, changedIds: records.map(record => record._id), restoredStatuses: [restoreStatus] };
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Deleted' }));
    await screen.findByText('Lifecycle source story');
    expect(mocks.eligibility).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Check restore' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const restore = screen.getByRole('button', { name: 'Restore' });
    fireEvent.click(restore);
    fireEvent.click(restore);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(`Story restored (${restoreStatus})`));
    expect(mocks.eligibility.mock.calls.map(([id]) => id)).toEqual(['source-en', 'source-en']);
    expect(mocks.restore.mock.calls).toEqual([['source-en']]);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(records.map(record => record._id)).toEqual(['source-en', 'edition-hi']);
  });

  it.each(['published', 'scheduled'])('uses complete Backend evidence to keep hidden %s history Founder-only', async restoreStatus => {
    mocks.role = 'editor';
    mocks.permanentRestore = true;
    records = records.map(record => ({ ...record, status: 'deleted', deletedFromStatus: 'draft' }));
    mocks.eligibility.mockResolvedValue({
      ...restoreAssessment(restoreStatus), eligible: false, decision: 'founder_required', requiresFounder: true,
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Deleted' }));
    await screen.findByText('Lifecycle source story');
    fireEvent.click(screen.getByRole('button', { name: 'Check restore' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/Founder permission/)));
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled();
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it.each([
    { eligible: false }, { complete: false }, { decision: 'blocked' }, { decision: 'incomplete' },
  ])('fails closed on an unsuccessful Draft Desk assessment %j', async overrides => {
    mocks.role = 'editor';
    mocks.permanentRestore = true;
    records = records.map(record => ({ ...record, status: 'deleted' }));
    mocks.eligibility.mockResolvedValue({ ...restoreAssessment(), ...overrides });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Deleted' }));
    await screen.findByText('Lifecycle source story');
    fireEvent.click(screen.getByRole('button', { name: 'Check restore' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled();
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it('ignores a late assessment after leaving Deleted', async () => {
    mocks.role = 'editor';
    mocks.permanentRestore = true;
    records = records.map(record => ({ ...record, status: 'deleted' }));
    let resolve!: (value: ArticleRestoreEligibility) => void;
    mocks.eligibility.mockReturnValue(new Promise<ArticleRestoreEligibility>(done => { resolve = done; }));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Deleted' }));
    await screen.findByText('Lifecycle source story');
    fireEvent.click(screen.getByRole('button', { name: 'Check restore' }));
    fireEvent.click(screen.getByRole('button', { name: 'All Drafts' }));
    await act(async () => { resolve(restoreAssessment()); });
    expect(screen.queryByRole('button', { name: 'Restore' })).not.toBeInTheDocument();
    expect(mocks.restore).not.toHaveBeenCalled();
  });

  it('does not consume or mutate a verified story when confirmation is cancelled', async () => {
    mocks.role = 'editor';
    mocks.permanentRestore = true;
    records = records.map(record => ({ ...record, status: 'deleted' }));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Deleted' }));
    await screen.findByText('Lifecycle source story');
    fireEvent.click(screen.getByRole('button', { name: 'Check restore' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled());
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    expect(mocks.eligibility).toHaveBeenCalledTimes(1);
    expect(mocks.restore).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled();
  });

  it('refreshes eligibility after a denied POST and preserves the permission error', async () => {
    mocks.role = 'editor';
    mocks.permanentRestore = true;
    records = records.map(record => ({ ...record, status: 'deleted' }));
    mocks.restore.mockRejectedValue({ response: { status: 403, data: { code: 'ARTICLE_RESTORE_FORBIDDEN' } } });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Deleted' }));
    await screen.findByText('Lifecycle source story');
    fireEvent.click(screen.getByRole('button', { name: 'Check restore' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Restore' })).toBeEnabled());
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Access denied. You do not have permission for this action.'));
    expect(mocks.eligibility).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled();
    expect(mocks.restore).toHaveBeenCalledTimes(1);
  });

  it('soft-deletes the whole story once and refreshes the current list and existing article queries', async () => {
    const client = renderPage();
    client.setQueryData(['articles', 'meta'], { total: 20 });
    client.setQueryData(['articles', 'logical-counts'], { counts: { draft: 1 } });
    await screen.findByText('Lifecycle source story');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete draft' }));
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    expect(mocks.remove.mock.calls).toEqual([['source-en']]);
    expect(screen.queryByText('Lifecycle source story')).not.toBeInTheDocument();
    expect(screen.queryByText('Hindi edition')).not.toBeInTheDocument();
    expect(client.getQueryState(['articles', 'meta'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['articles', 'logical-counts'])?.isInvalidated).toBe(true);
  });

  it('does not promise a Draft restore when Backend restores a Published story', async () => {
    records = records.map((record) => ({ ...record, status: 'deleted', deletedFromStatus: 'published' }));
    const client = renderPage();
    client.setQueryData(['articles', 'logical-counts'], { counts: { deleted: 1 } });
    fireEvent.click(screen.getByRole('button', { name: 'Deleted' }));
    await screen.findByText('Lifecycle source story');
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Story restored (published)'));
    expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('Backend will determine the restored status'));
    expect(mocks.restore.mock.calls).toEqual([['source-en']]);
    expect(mocks.eligibility).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(records.every((record) => record.status === 'published')).toBe(true);
    expect(client.getQueryState(['articles', 'logical-counts'])?.isInvalidated).toBe(true);
  });

  it.each(['admin', 'editor', 'staff'])('never exposes permanent deletion to %s', async (role) => {
    mocks.role = role;
    records = records.map((record) => ({ ...record, status: 'deleted', deletedFromStatus: 'published' }));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Deleted' }));
    await screen.findByText('Lifecycle source story');
    expect(screen.queryByRole('button', { name: 'Delete Permanent' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore' })).toBeDisabled();
    expect(mocks.hardDelete).not.toHaveBeenCalled();
  });

  it('requires typed confirmation before Founder permanently deletes the deleted story', async () => {
    records = records.map((record) => ({ ...record, status: 'deleted' }));
    const client = renderPage();
    client.setQueryData(['articles', 'logical-counts'], { counts: { deleted: 1 } });
    fireEvent.click(screen.getByRole('button', { name: 'Deleted' }));
    await screen.findByText('Lifecycle source story');
    const confirmation = vi.spyOn(window, 'prompt').mockReturnValueOnce('delete').mockReturnValueOnce('DELETE');
    fireEvent.click(screen.getByRole('button', { name: 'Delete Permanent' }));
    expect(mocks.hardDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Permanent' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Story permanently deleted'));
    expect(confirmation).toHaveBeenCalledWith(expect.stringContaining('all available language versions'));
    expect(mocks.hardDelete.mock.calls).toEqual([['source-en']]);
    expect(client.getQueryState(['articles', 'logical-counts'])?.isInvalidated).toBe(true);
  });
});

describe('Legacy editor publication integration', () => {
  it.each([
    { operation: 'toReview', stage: 'draft', label: /Send to Review/ },
    { operation: 'toLegal', stage: 'review', label: /Send to Legal/ },
    { operation: 'approve', stage: 'legal', label: /Approve/ },
    { operation: 'schedule', stage: 'approved', label: /^.*Schedule$/ },
  ])('preserves the existing $operation workflow without applying publication refreshes', async ({ operation, stage, label }) => {
    mocks.get.mockImplementation(async (path: string) => path.endsWith('/workflow') ? {
      data: { status: 'draft', stage, checklist: { ptiCompliance: true, rightsCleared: true, attributionPresent: true, defamationScanOk: true } },
    } : { data: { article: records[0] } });
    mocks.post.mockResolvedValue({ data: { status: 'draft', stage: operation } });
    const client = renderPage(true);
    client.setQueryData(['articles', 'list'], []);
    const button = await screen.findByRole('button', { name: label });
    await waitFor(() => expect(button).toBeEnabled());
    const scheduledAt = '2026-11-01T10:30';
    if (operation === 'schedule') {
      const input = button.parentElement?.querySelector('input');
      if (!input) throw new Error('Schedule control not found');
      fireEvent.change(input, { target: { value: scheduledAt } });
    }
    fireEvent.click(button);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining(`${operation} complete`)));
    expect(mocks.post.mock.calls).toEqual([['/news/source-en/transition',
      operation === 'schedule' ? { action: operation, scheduledAt } : { action: operation },
    ]]);
    expect(client.getQueryState(['articles', 'list'])?.isInvalidated).toBe(false);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('keeps checklist/Founder protection and uses one canonical Publish operation', async () => {
    const client = renderPage(true);
    const publish = await screen.findByRole('button', { name: /Publish Now/ });
    await waitFor(() => expect(publish).toBeEnabled());
    fireEvent.click(publish);
    fireEvent.click(publish);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('publish complete')));
    expect(mocks.publish.mock.calls).toEqual([['source-en']]);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(publish).toBeDisabled();
    expect(client.getQueryData(['articles', 'one', 'source-en'])).toMatchObject({ status: 'published' });
  });

  it('preserves the committed edit and slug conflict without retrying Publish', async () => {
    mocks.publish.mockRejectedValue({ response: { status: 409, data: { message: 'Slug already exists' } } });
    renderPage(true);
    const publish = await screen.findByRole('button', { name: /Publish Now/ });
    await waitFor(() => expect(publish).toBeEnabled());
    fireEvent.change(screen.getByRole('textbox', { name: 'Legacy content' }), { target: { value: 'Keep this unsaved edit' } });
    fireEvent.click(publish);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Slug already exists')));
    expect(screen.getByRole('textbox', { name: 'Legacy content' })).toHaveValue('Keep this unsaved edit');
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith('source-en', expect.objectContaining({ content: 'Keep this unsaved edit' }));
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('remain committed'));
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('does not grant publication to an ordinary editor', async () => {
    mocks.role = 'editor';
    renderPage(true);
    const publish = await screen.findByRole('button', { name: /Publish Now/ });
    expect(publish).toBeDisabled();
    fireEvent.click(publish);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('keeps publication committed when the response has no article and the workflow read fails', async () => {
    records[0] = { ...source, _id: 'public-copy-1', sourceNewsId: 'source-en' };
    mocks.publish.mockImplementationOnce(async () => {
      mocks.get.mockRejectedValue({ response: { status: 503, data: {} } });
      return { committed: true, revalidation: { ok: false } };
    });
    renderPage(true);
    const publish = await screen.findByRole('button', { name: /Publish Now/ });
    await waitFor(() => expect(publish).toBeEnabled());
    fireEvent.click(publish);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Published, but')));
    expect(publish).toBeDisabled();
    fireEvent.click(publish);
    expect(mocks.publish.mock.calls).toEqual([['source-en']]);
    expect(mocks.post).not.toHaveBeenCalled();
  });
});

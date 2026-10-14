import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article, ListResponse } from '@/lib/api/articles';
import { ArticleForm } from '../ArticleForm';
import ArticleEditPage from '@/pages/ArticleEditPage';

const mocks = vi.hoisted(() => ({
  role: 'founder',
  publishEnabled: true,
  create: vi.fn<(data: Partial<Article>) => Promise<{ article: Article }>>(),
  update: vi.fn<(id: string, data: Partial<Article>) => Promise<{ article: Article }>>(),
  get: vi.fn<(id: string) => Promise<Article>>(),
  publish: vi.fn<(id: string) => Promise<{ article: Article; publishedLanguages: string[] }>>(),
  group: vi.fn<() => Promise<ListResponse>>(),
  translations: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'test-user', role: mocks.role } }) }));
vi.mock('@/context/PublishFlagContext', () => ({ usePublishFlag: () => ({ publishEnabled: mocks.publishEnabled }) }));
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(async () => ({ data: ['en', 'hi', 'gu'] })) } }));
vi.mock('@/lib/api/articles', () => ({
  createArticle: mocks.create, updateArticle: mocks.update, getArticle: mocks.get,
  publishArticle: mocks.publish, listArticlesByTranslationGroupId: mocks.group,
  retryArticleTranslation: vi.fn(), requeueArticleTranslations: mocks.translations,
}));
vi.mock('@/lib/api/media', () => ({
  getMediaStatus: vi.fn(async () => ({ ok: true, uploadEnabled: true })), uploadCoverImage: vi.fn(),
}));
vi.mock('@/lib/api/language', () => ({ verifyLanguage: vi.fn(), readability: vi.fn() }));
vi.mock('@/lib/slugAvailability', () => ({
  buildSlugSuggestions: vi.fn(() => []), checkSlugAvailability: vi.fn(async () => ({ available: true })),
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: mocks.success, error: mocks.error }) }));
vi.mock('@/components/editor/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Story content" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));
vi.mock('@/components/articles/CoverImageUpload', () => ({ default: () => null }));
vi.mock('@/components/media/MediaLibrarySelector', () => ({ default: () => null }));
vi.mock('@/components/preview/PreviewModal', () => ({ default: () => null }));
vi.mock('@/components/ui/ConfirmModal', () => ({ default: () => null }));
vi.mock('@/components/news/PulseDialogueDetailsSection', () => ({ default: () => null }));
vi.mock('@/components/analytics/ArticleAnalyticsPanel', () => ({ ArticleAnalyticsPanel: () => null }));

const originalPublishedAt = '2026-01-15T10:00:00.000Z';
const source: Article = {
  _id: 'source-1', title: 'Published source story', slug: 'source-story',
  summary: 'Hand-written story summary.',
  content: 'A complete source story with enough content for normal article publication and save validation.',
  category: 'national', language: 'en', lang: 'en', status: 'published',
  translationGroupId: 'story-group', sourceLanguage: 'en',
  publishedAt: originalPublishedAt, updatedAt: '2026-10-14T10:00:00.000Z',
  imageUrl: 'https://images.example.test/cover.jpg',
  tags: ['local-news'],
};
let stored: Article;
const clients: QueryClient[] = [];

function titleInput(): HTMLInputElement {
  const input = screen.getByText('Title').parentElement?.querySelector('input');
  if (!input) throw new Error('Title input not found');
  return input;
}

function renderForm(article: Article | null = source, fullPage = false) {
  if (article) stored = { ...article };
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: 3 } },
  });
  clients.push(client);
  const onDirtyChange = vi.fn();
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/articles/source-1/edit']}>
        {fullPage ? (
          <Routes><Route path="/admin/articles/:id/edit" element={<ArticleEditPage />} /></Routes>
        ) : (
          <ArticleForm mode={article ? 'edit' : 'create'} id={article?._id} initialValues={article || undefined}
            userRole="admin" onDirtyChange={onDirtyChange} />
        )}
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, client, onDirtyChange };
}

function conflict(message = 'Article lifecycle changed. Reload and retry the edit.') {
  return { response: { status: 409, data: { message } } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = 'founder';
  mocks.publishEnabled = true;
  stored = { ...source };
  mocks.get.mockImplementation(async () => ({ ...stored }));
  mocks.update.mockImplementation(async (id, payload) => {
    stored = { ...stored, ...payload, _id: id };
    return { article: { ...stored } };
  });
  mocks.create.mockImplementation(async (payload) => {
    stored = { _id: 'created-1', title: '', ...payload };
    return { article: { ...stored } };
  });
  mocks.publish.mockImplementation(async (id) => {
    stored = { ...stored, _id: id, status: 'published', publishedAt: stored.publishedAt || originalPublishedAt };
    return { article: { ...stored }, publishedLanguages: ['en', 'hi', 'gu'] };
  });
  mocks.group.mockImplementation(async () => ({
    rows: [
      { ...stored },
      { ...stored, _id: 'edition-hi', title: 'Hindi edition', language: 'hi', lang: 'hi' },
      { ...stored, _id: 'edition-gu', title: 'Gujarati edition', language: 'gu', lang: 'gu' },
    ],
    total: 3, page: 1, pages: 1,
  }));
  mocks.translations.mockResolvedValue({ ok: true });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Trending tag membership through Save Update', () => {
  it.each([
    ['faith-culture', 'navratri-2026'],
    ['tech', 'ai-2026'],
  ])('adds and removes an exact Trending tag without changing the %s story or its publication', async (category, tag) => {
    const otherTag = tag.toUpperCase();
    const originalTags = ['local-news', otherTag];
    const { client } = renderForm({ ...source, category, tags: originalTags });
    const pinKey = ['articles', 'trending-pin', source._id];
    const candidatesKey = ['articles', 'trending-candidates', '', 1];
    client.setQueryData(pinKey, { ...stored });
    client.setQueryData(candidatesKey, { rows: [{ ...stored }] });

    const input = screen.getByPlaceholderText('Type and press Enter');
    fireEvent.change(input, { target: { value: tag } });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled());
    expect(mocks.update.mock.calls[0]).toEqual([source._id, expect.objectContaining({
      category, tags: [...originalTags, tag],
    })]);
    expect(stored).toMatchObject({ category, status: 'published', publishedAt: originalPublishedAt, tags: [...originalTags, tag] });
    expect(client.getQueryData(['articles', 'one', source._id])).toMatchObject({
      category, status: 'published', publishedAt: originalPublishedAt, tags: [...originalTags, tag],
    });
    expect(client.getQueryState(pinKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(candidatesKey)?.isInvalidated).toBe(true);

    const chip = screen.getByText(tag, { exact: true }).closest('span');
    if (!chip) throw new Error('Trending tag chip not found');
    fireEvent.click(within(chip).getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(2));
    expect(mocks.update.mock.calls[1]).toEqual([source._id, expect.objectContaining({ category, tags: originalTags })]);
    for (const [, payload] of mocks.update.mock.calls) {
      expect(payload).not.toHaveProperty('status');
      expect(payload).not.toHaveProperty('publishedAt');
    }
    expect(stored).toMatchObject({ _id: source._id, category, status: 'published', publishedAt: originalPublishedAt, tags: originalTags });
    expect(client.getQueryData(['articles', 'one', source._id])).toMatchObject({ category, tags: originalTags });
    expect(mocks.update).toHaveBeenCalledTimes(2);
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.translations).not.toHaveBeenCalled();
  });

  it('retains case-distinct saved Trending tags when hydrating and saving another edit', async () => {
    const tags = ['navratri-2026', 'Navratri-2026', 'topic:Navratri-2026'];
    renderForm({ ...source, category: 'faith-culture', tags });
    for (const tag of tags) expect(screen.getByText(tag, { exact: true })).toBeInTheDocument();
    fireEvent.change(titleInput(), { target: { value: 'Same story, updated headline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.update.mock.calls[0][1]).toMatchObject({ category: 'faith-culture', tags });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});

describe('Founder Edit Published - Save Update', () => {
  it('retains the supported editor and unsaved content if a background article read fails', async () => {
    const { client } = renderForm(source, true);
    await screen.findByDisplayValue('Published source story');
    fireEvent.change(titleInput(), { target: { value: 'Unsaved page-level edit' } });
    mocks.get.mockRejectedValueOnce({ response: { status: 503 } });
    await act(async () => { await client.invalidateQueries({ queryKey: ['articles', 'one', 'source-1'] }); });
    expect(await screen.findByRole('alert')).toHaveTextContent('unsaved edits are still available');
    expect(titleInput()).toHaveValue('Unsaved page-level edit');
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading article' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry loading article' })).not.toBeInTheDocument());
    expect(titleInput()).toHaveValue('Unsaved page-level edit');
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('updates the existing article once, without republishing, creating editions, or resetting chronology', async () => {
    const { client } = renderForm();
    fireEvent.change(titleInput(), { target: { value: 'Updated published headline' } });
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][0]).toBe('source-1');
    const payload = mocks.update.mock.calls[0][1];
    expect(payload).toMatchObject({
      title: 'Updated published headline', slug: source.slug, content: source.content,
      summary: source.summary, category: source.category, tags: source.tags, imageUrl: source.imageUrl,
    });
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('publishedAt');
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(mocks.get).toHaveBeenCalledWith('source-1');
    expect(mocks.translations).not.toHaveBeenCalled();
    expect(client.getQueryData(['articles', 'one', 'source-1'])).toMatchObject({
      status: 'published', publishedAt: originalPublishedAt, title: 'Updated published headline',
    });
  });

  it('routes form submission on a published article to Save Update, not Publish', async () => {
    renderForm();
    fireEvent.change(titleInput(), { target: { value: 'Keyboard submitted edit' } });
    const form = titleInput().closest('form');
    if (!form) throw new Error('Form not found');
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it.each([false, true])('uses later detail refreshes after Save Update while protecting dirty edits (%s)', async (dirty) => {
    const { client } = renderForm(source, true);
    await screen.findByDisplayValue(source.title);
    fireEvent.change(titleInput(), { target: { value: 'First saved update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled());
    if (dirty) fireEvent.change(titleInput(), { target: { value: 'Keep this newer unsaved edit' } });
    stored = { ...stored, title: 'Latest Backend headline', status: 'draft' };
    await act(async () => { await client.invalidateQueries({ queryKey: ['articles', 'one', source._id] }); });
    await waitFor(() => expect(titleInput()).toHaveValue(dirty ? 'Keep this newer unsaved edit' : 'Latest Backend headline'));
    if (!dirty) expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled();
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('prevents duplicate Save Update requests and retains edits made while saving', async () => {
    let finish!: (result: { article: Article }) => void;
    mocks.update.mockImplementation((_id, payload) => {
      stored = { ...stored, ...payload };
      return new Promise((resolve) => { finish = resolve; });
    });
    const { onDirtyChange } = renderForm();
    fireEvent.change(titleInput(), { target: { value: 'First edit' } });
    const save = screen.getByRole('button', { name: 'Save Update' });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    fireEvent.change(titleInput(), { target: { value: 'New unsaved edit while saving' } });
    await act(async () => { finish({ article: { ...stored } }); });
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(titleInput()).toHaveValue('New unsaved edit while saving');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])('applies the saved Backend values after a slow group refresh without replacing dirty input (%s)', async (dirty) => {
    const { client } = renderForm();
    await waitFor(() => expect(client.getQueryState(['articles', 'translationGroup', 'story-group'])?.fetchStatus).toBe('idle'));
    let finishRefresh!: (result: ListResponse) => void;
    mocks.group.mockImplementationOnce(() => new Promise((resolve) => { finishRefresh = resolve; }));
    mocks.update.mockImplementationOnce(async (id, payload) => {
      stored = { ...stored, ...payload, _id: id, title: 'Backend-normalized headline' };
      return { article: { ...stored } };
    });
    fireEvent.change(titleInput(), { target: { value: 'Submitted headline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.group).toHaveBeenCalledTimes(2));
    expect(client.getQueryData(['articles', 'one', source._id])).toMatchObject({ title: 'Backend-normalized headline' });
    if (dirty) fireEvent.change(titleInput(), { target: { value: 'Keep my newer edit' } });
    await act(async () => { finishRefresh({ rows: [{ ...stored }], total: 1, page: 1, pages: 1 }); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled());
    expect(titleInput()).toHaveValue(dirty ? 'Keep my newer edit' : 'Backend-normalized headline');
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(stored.publishedAt).toBe(originalPublishedAt);
  });

  it.each([false, true])('coalesces an explicitly queued save only when newer edits exist (%s)', async (changed) => {
    let finish!: (result: { article: Article }) => void;
    mocks.update.mockImplementationOnce((_id, payload) => {
      stored = { ...stored, ...payload };
      return new Promise((resolve) => { finish = resolve; });
    });
    renderForm();
    fireEvent.change(titleInput(), { target: { value: 'First submitted edit' } });
    const form = titleInput().closest('form');
    if (!form) throw new Error('Form not found');
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    if (changed) fireEvent.change(titleInput(), { target: { value: 'Explicitly queued edit' } });
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ article: { ...stored } }); });
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(changed ? 2 : 1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled());
    expect(stored.title).toBe(changed ? 'Explicitly queued edit' : 'First submitted edit');
    for (const [, payload] of mocks.update.mock.calls) {
      expect(payload).not.toHaveProperty('status');
      expect(payload).not.toHaveProperty('publishedAt');
    }
    expect(stored.publishedAt).toBe(originalPublishedAt);
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each(['conflict', 'refresh'])('discards a queued save after a %s failure instead of replaying it', async (failure) => {
    let finish!: (result: { article: Article }) => void;
    let reject!: (error: unknown) => void;
    mocks.update.mockImplementationOnce((_id, payload) => {
      stored = { ...stored, ...payload };
      return new Promise((resolve, rejectPromise) => { finish = resolve; reject = rejectPromise; });
    });
    renderForm();
    fireEvent.change(titleInput(), { target: { value: 'First submitted edit' } });
    const form = titleInput().closest('form');
    if (!form) throw new Error('Form not found');
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    fireEvent.change(titleInput(), { target: { value: 'Keep this queued edit unsaved' } });
    fireEvent.submit(form);
    if (failure === 'refresh') mocks.get.mockRejectedValueOnce({ response: { status: 503 } });
    await act(async () => {
      if (failure === 'conflict') reject(conflict());
      else finish({ article: { ...stored } });
    });
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh latest state' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled());
    expect(titleInput()).toHaveValue('Keep this queued edit unsaved');
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('refreshes latest lifecycle state after a conflict without overwriting unsaved content or replaying the mutation', async () => {
    mocks.update.mockRejectedValueOnce(conflict());
    mocks.get.mockImplementation(async () => ({ ...stored, status: 'draft' }));
    renderForm();
    fireEvent.change(titleInput(), { target: { value: 'Keep my unsaved headline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Article lifecycle changed. Reload and retry the edit.'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled());
    expect(titleInput()).toHaveValue('Keep my unsaved headline');
    expect(screen.getByRole('alert')).toHaveTextContent('Latest status: draft');
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('preserves useful duplicate-slug conflicts instead of claiming every 409 is stale data', async () => {
    mocks.update.mockRejectedValueOnce(conflict('Slug already exists'));
    renderForm();
    fireEvent.change(titleInput(), { target: { value: 'Conflicting edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Slug already exists'));
    expect(screen.getByRole('alert')).toHaveTextContent('Slug already exists');
    expect(titleInput()).toHaveValue('Conflicting edit');
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it('recovers from a failed conflict refresh by retrying only the read', async () => {
    mocks.update.mockRejectedValueOnce(conflict());
    mocks.get.mockRejectedValueOnce({ response: { status: 503 } });
    renderForm();
    fireEvent.change(titleInput(), { target: { value: 'Unsaved conflict recovery edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Could not refresh')));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh latest state' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Save Update' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled());
    expect(mocks.get).toHaveBeenCalledTimes(2);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(titleInput()).toHaveValue('Unsaved conflict recovery edit');
  });

  it('does not retry a committed save when the authoritative follow-up read fails', async () => {
    mocks.get.mockRejectedValueOnce({ response: { status: 503 } });
    renderForm();
    fireEvent.change(titleInput(), { target: { value: 'Committed edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('change was saved')));
    expect(screen.getByRole('button', { name: 'Save Update' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh latest state' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled());
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(stored.publishedAt).toBe(originalPublishedAt);
  });

  it('pauses autosave after a 409 instead of replaying a failed save on the next interval', async () => {
    vi.useFakeTimers();
    mocks.update.mockRejectedValue(conflict());
    renderForm();
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    fireEvent.change(titleInput(), { target: { value: 'Unsaved auto-retry guard' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(titleInput()).toHaveValue('Unsaved auto-retry guard');
  });

  it('keeps the autosave Retry disabled until a failed conflict refresh recovers', async () => {
    vi.useFakeTimers();
    mocks.update.mockRejectedValueOnce(conflict());
    mocks.get.mockRejectedValueOnce({ response: { status: 503 } });
    renderForm();
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    fireEvent.change(titleInput(), { target: { value: 'Unsaved autosave recovery' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_010); });
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
    expect(titleInput()).toHaveValue('Unsaved autosave recovery');
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });
});

describe('Scheduled multilingual authoring', () => {
  it('saves existing language editions and still queues automatic translations without changing lifecycle fields', async () => {
    const scheduledAt = '2026-11-01T10:00:00.000Z';
    mocks.update.mockImplementation(async (id, payload) => {
      const wirePayload = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
      const article = { ...stored, ...wirePayload, _id: id };
      if (id === source._id) stored = article;
      return { article };
    });
    renderForm({ ...source, status: 'scheduled', scheduledAt, publishAt: scheduledAt });
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3));
    fireEvent.change(titleInput(), { target: { value: 'Updated scheduled headline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.translations).toHaveBeenCalledTimes(1));
    expect(mocks.update.mock.calls.map(([id]) => id)).toEqual(['source-1', 'edition-hi', 'edition-gu']);
    for (const [, payload] of mocks.update.mock.calls) {
      expect(payload).not.toHaveProperty('status');
      expect(payload).not.toHaveProperty('publishedAt');
    }
    expect(stored).toMatchObject({ status: 'scheduled', scheduledAt, publishAt: scheduledAt, publishedAt: originalPublishedAt });
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('still creates a manually authored missing language draft for a Scheduled source', async () => {
    mocks.group.mockImplementation(async () => ({ rows: [{ ...stored }], total: 1, page: 1, pages: 1 }));
    mocks.create.mockImplementation(async (payload) => ({ article: { ...source, ...payload, _id: 'created-hi' } }));
    renderForm({ ...source, status: 'scheduled' });
    const language = screen.getByText('Language').parentElement?.querySelector('select');
    if (!language) throw new Error('Language control not found');
    fireEvent.change(language, { target: { value: 'hi' } });
    await waitFor(() => {
      expect(language).toHaveValue('hi');
      expect(titleInput()).toHaveValue('');
    });
    fireEvent.change(titleInput(), { target: { value: 'Manually authored Hindi edition' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Story content' }), { target: { value: 'Hindi edition body.' } });
    fireEvent.change(language, { target: { value: 'en' } });
    await waitFor(() => {
      expect(language).toHaveValue('en');
      expect(titleInput()).toHaveValue(source.title);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Manually authored Hindi edition', language: 'hi', status: 'draft', translationGroupId: 'story-group',
    })));
    expect(stored.status).toBe('scheduled');
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('status');
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});

describe('ArticleForm canonical publication', () => {
  it('saves changed content without a draft downgrade, then publishes the group exactly once', async () => {
    renderForm({ ...source, status: 'draft' });
    fireEvent.change(titleInput(), { target: { value: 'Ready to publish' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledWith('source-1'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled());
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('status');
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('publishedAt');
    expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(mocks.publish.mock.invocationCallOrder[0]);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.get).toHaveBeenCalledTimes(1);
    expect(stored.publishedAt).toBe(originalPublishedAt);
  });

  it('does not save unchanged content as a draft before publishing', async () => {
    const { onDirtyChange } = renderForm({ ...source, status: 'draft' });
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(1));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it.each(['admin', 'editor', 'staff'])('does not elevate %s through a hard-coded admin form prop', async (role) => {
    mocks.role = role;
    renderForm({ ...source, status: 'draft' });
    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(publish).toBeDisabled();
    fireEvent.click(publish);
    expect(mocks.publish).not.toHaveBeenCalled();
    fireEvent.change(titleInput(), { target: { value: 'Allowed existing draft edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalled());
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('status');
  });

  it('preserves the runtime publishing flag', () => {
    mocks.publishEnabled = false;
    renderForm({ ...source, status: 'draft' });
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('keeps the created draft id after a failed Publish so an explicit retry cannot create duplicates', async () => {
    mocks.publish.mockRejectedValueOnce(conflict('Slug already exists'));
    renderForm(null);
    fireEvent.change(titleInput(), { target: { value: 'New story' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Story content' }), { target: { value: source.content } });
    const category = screen.getByText('Category').parentElement?.querySelector('select');
    if (!category) throw new Error('Category control not found');
    fireEvent.change(category, { target: { value: 'national' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Slug already exists'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled());
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledWith('created-1');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledTimes(2));
    expect(mocks.publish.mock.calls).toEqual([['created-1'], ['created-1']]);
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('publishedAt');
  });
});

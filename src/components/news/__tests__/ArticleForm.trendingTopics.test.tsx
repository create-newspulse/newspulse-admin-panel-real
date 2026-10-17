import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article, ListResponse } from '@/lib/api/articles';
import type { adminApiClient } from '@/lib/adminApiClient';
import type { AvailableTopic } from '@/lib/api/trendingTopics';
import { ArticleForm } from '@/components/news/ArticleForm';
import EditNews from '@/pages/EditNews';
import {
  availableTopic, otherTopic, membershipResult, pageResult, topicStory,
  STORY_ID, TOPIC_ID, OTHER_TOPIC_ID,
} from '@/tests/fixtures/trendingTopics';

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: 'founder-1', role: 'founder', moduleAccess: ['manage_news'], specialRights: [] as string[] },
    isAuthenticated: true, isFounder: true, isReady: true, isRestoring: false, isLoading: false,
  },
  create: vi.fn<(payload: Partial<Article>) => Promise<{ article: Article }>>(),
  update: vi.fn<(id: string, payload: Partial<Article>) => Promise<{ article: Article }>>(),
  get: vi.fn<(id: string) => Promise<Article>>(),
  publish: vi.fn<(id: string) => Promise<{ article: Article; publishedLanguages: string[] }>>(),
  group: vi.fn<() => Promise<ListResponse>>(),
  translations: vi.fn(),
  info: vi.fn(), success: vi.fn(), error: vi.fn(),
  client: {
    get: vi.fn<typeof adminApiClient.get>(),
    post: vi.fn<(url: string, body: { storyIds: string[] }) => Promise<unknown>>(),
    patch: vi.fn<typeof adminApiClient.patch>(),
    put: vi.fn<typeof adminApiClient.put>(),
  },
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useAdminEffectiveAccess', () => ({
  useAdminEffectiveAccess: () => ({
    isLoading: false, error: null, backendAccess: {},
    modulePolicy: { manage_news: { moduleKey: 'manage_news', state: 'available' } },
  }),
}));
vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: mocks.client }));
vi.mock('@/context/PublishFlagContext', () => ({ usePublishFlag: () => ({ publishEnabled: true }) }));
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
vi.mock('react-hot-toast', () => ({ default: Object.assign(mocks.info, { success: mocks.success, error: mocks.error }) }));
vi.mock('@/components/editor/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Story content" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));
vi.mock('@/components/articles/CoverImageUpload', () => ({ default: () => null }));
vi.mock('@/components/media/MediaLibrarySelector', () => ({ default: () => null }));
vi.mock('@/components/preview/PreviewModal', () => ({ default: () => null }));
vi.mock('@/components/news/PulseDialogueDetailsSection', () => ({ default: () => null }));

type StoredArticle = Article & { seo?: { keywords: string[] } };
const originalPublishedAt = '2026-10-01T08:00:00.000Z';
const source: StoredArticle = {
  _id: STORY_ID, title: 'Festival source report', slug: 'festival-source-report',
  summary: 'The newsroom summary remains independent of topic membership.',
  content: 'A complete original festival report with enough content for the existing publication checks and the normal editorial workflow.',
  category: 'regional', language: 'gu', lang: 'gu', status: 'draft', translationGroupId: 'festival-logical-group',
  sourceLanguage: 'gu', imageUrl: 'https://images.example.test/festival.jpg',
  tags: ['ordinary-report'], seo: { keywords: ['navratri', 'gujarat festivals'] },
};
let stored: StoredArticle;
let options: AvailableTopic[];
let readFailure: unknown;
let writeFailure: unknown;
let failingTopic: string | null;
let order: string[];
const clients: QueryClient[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.assign(mocks.auth, {
    user: { id: 'founder-1', role: 'founder', moduleAccess: ['manage_news'], specialRights: [] },
    isAuthenticated: true, isFounder: true, isReady: true, isRestoring: false, isLoading: false,
  });
  stored = { ...source, tags: [...source.tags!] };
  options = [availableTopic(), otherTopic()];
  readFailure = null;
  writeFailure = null;
  failingTopic = null;
  order = [];
  mocks.get.mockImplementation(async () => ({ ...stored, tags: [...(stored.tags || [])] }));
  mocks.create.mockImplementation(async (payload) => {
    order.push('create');
    stored = { _id: STORY_ID, title: '', ...payload };
    return { article: { ...stored } };
  });
  mocks.update.mockImplementation(async (id, payload) => {
    order.push('update');
    stored = { ...stored, ...payload, _id: id };
    return { article: { ...stored } };
  });
  mocks.publish.mockImplementation(async (id) => {
    order.push('publish');
    stored = { ...stored, _id: id, status: 'published', publishedAt: stored.publishedAt || originalPublishedAt };
    return { article: { ...stored }, publishedLanguages: ['en', 'hi', 'gu'] };
  });
  mocks.group.mockImplementation(async () => ({ rows: [{ ...stored }], total: 1, page: 1, pages: 1 }));
  mocks.translations.mockResolvedValue({ ok: true });
  mocks.client.get.mockImplementation(async (url, config) => {
    if (url === 'admin/topics/available') {
      if (readFailure) throw readFailure;
      const storyId = config?.params?.storyId;
      const items = options.map((topic) => ({
        ...topic,
        ...(storyId ? { attached: stored.tags?.some((tag) => topic.articleTags.includes(tag)) === true, membershipConsistent: true } : {}),
      }));
      return { data: { ...pageResult(items, { limit: Number(config?.params?.limit || 100) }), lang: config?.params?.lang || 'gu',
        ...(storyId ? { logicalStoryId: STORY_ID } : {}) } };
    }
    if (url === `articles/${STORY_ID}`) return { data: { article: stored } };
    if (url === `/news/${STORY_ID}/workflow`) return { data: {
      status: stored.status, stage: 'approved',
      checklist: { ptiCompliance: true, rightsCleared: true, attributionPresent: true, defamationScanOk: true },
    } };
    throw new Error(`Unexpected read: ${url}`);
  });
  mocks.client.post.mockImplementation(async (url, body: { storyIds: string[] }) => {
    const topic = options.find((option) => String(url).startsWith(`admin/topics/${option.id}/stories/`));
    if (!topic) throw new Error(`Unexpected membership request: ${url}`);
    if (writeFailure && (!failingTopic || failingTopic === topic.id)) throw writeFailure;
    const action = String(url).endsWith('/attach') ? 'attach' : 'detach';
    order.push(`${action}:${topic.id}`);
    if (body.storyIds.length !== 1 || body.storyIds[0] !== STORY_ID) throw new Error('Expected one CMS logical-story request');
    stored.tags = action === 'attach'
      ? [...new Set([...(stored.tags || []), topic.membershipTag!])]
      : (stored.tags || []).filter((tag) => !topic.articleTags.includes(tag));
    return { data: membershipResult(action, {
      topicId: topic.id, items: [topicStory({ attached: action === 'attach', category: stored.category, status: stored.status || 'draft' })],
    }) };
  });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderForm(article: StoredArticle | null = source, legacy = false) {
  if (article) stored = { ...article, tags: [...(article.tags || [])] };
  const client = new QueryClient({ defaultOptions: {
    queries: { retry: false, gcTime: Infinity }, mutations: { retry: 3 },
  } });
  clients.push(client);
  const onDirtyChange = vi.fn();
  const result = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[legacy ? `/edit/${STORY_ID}` : article ? `/admin/articles/${STORY_ID}/edit` : '/admin/add-news']}>
        {legacy ? <Routes>
          <Route path="/edit/:id" element={<EditNews />} />
          <Route path="/manage-news" element={<p>Returned to Manage News</p>} />
        </Routes> : <ArticleForm mode={article ? 'edit' : 'create'} id={article?._id}
          initialValues={article || undefined} userRole="admin" onDirtyChange={onDirtyChange} />}
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, client, onDirtyChange };
}

function control<T extends HTMLInputElement | HTMLSelectElement>(label: string, selector: string): T {
  const found = screen.getByText(label, { exact: true }).parentElement?.querySelector<T>(selector);
  if (!found) throw new Error(`Missing ${label} control`);
  return found;
}

async function loadedTopics() {
  const selector = await screen.findByRole('region', { name: 'Trending Topics' });
  await within(selector).findByRole('checkbox', { name: 'Trending Topic: Navratri 2026' });
}

function selectTopic(title: string) {
  fireEvent.click(screen.getByRole('checkbox', { name: `Trending Topic: ${title}` }));
}

async function fillCreate(category = 'regional') {
  await loadedTopics();
  fireEvent.change(control<HTMLInputElement>('Title', 'input'), { target: { value: source.title } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Story content' }), { target: { value: source.content } });
  fireEvent.change(control<HTMLSelectElement>('Category', 'select'), { target: { value: category } });
}

async function saveDraft() {
  mocks.success.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
  await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(expect.stringMatching(/^Draft (saved|updated)$/)));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled());
}

describe('ArticleForm V2 Trending Topic selection and existing saves', () => {
  it('loads authoritative options and keeps a single control outside SEO and ordinary Tags', async () => {
    renderForm();
    await loadedTopics();
    const selector = screen.getByRole('region', { name: 'Trending Topics' });
    expect(screen.getAllByRole('region', { name: 'Trending Topics' })).toHaveLength(1);
    expect(within(selector).queryByPlaceholderText('Type and press Enter')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Type and press Enter')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Trending Topic: Navratri 2026' })).not.toBeChecked();
    expect(mocks.client.get).toHaveBeenCalledWith('admin/topics/available', expect.objectContaining({
      params: { storyId: STORY_ID, lang: 'gu', active: 'all', page: 1, limit: 100 },
    }));
    expect(mocks.client.post).not.toHaveBeenCalled();
  });

  it.each([0, 1, 2])('Save Draft supports %i selected topics without encoding selections into article tags', async (count) => {
    renderForm(null);
    await fillCreate();
    if (count >= 1) selectTopic('Navratri 2026');
    if (count === 2) selectTopic('Gujarat Festivals');
    expect(mocks.client.post).not.toHaveBeenCalled();
    await saveDraft();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.create.mock.calls[0][0]).toMatchObject({ category: 'regional', status: 'draft', tags: [] });
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('topicIds');
    expect(mocks.create.mock.calls[0][0]).not.toHaveProperty('trendingTopics');
    expect(mocks.client.post).toHaveBeenCalledTimes(count);
    expect(order[0]).toBe('create');
    if (count) expect(mocks.client.post).toHaveBeenCalledWith(`admin/topics/${TOPIC_ID}/stories/attach`, { storyIds: [STORY_ID] });
    if (count === 2) expect(mocks.client.post).toHaveBeenCalledWith(`admin/topics/${OTHER_TOPIC_ID}/stories/attach`, { storyIds: [STORY_ID] });
    expect(stored.status).toBe('draft');
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('loads existing memberships and does not infer extra membership from matching SEO keywords', async () => {
    renderForm({ ...source, tags: ['ordinary-report', 'topic:navratri-2026'] });
    await loadedTopics();
    expect(screen.getByRole('checkbox', { name: 'Trending Topic: Navratri 2026' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Trending Topic: Gujarat Festivals' })).not.toBeChecked();
    expect(screen.queryByText('topic:navratri-2026', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText('ordinary-report', { exact: true })).toBeInTheDocument();
    expect(mocks.client.post).not.toHaveBeenCalled();
  });

  it('preserves all memberships on unrelated edits, including a later externally attached topic', async () => {
    renderForm({ ...source, status: 'published', publishedAt: originalPublishedAt, tags: ['ordinary-report', 'topic:navratri-2026'] });
    await loadedTopics();
    stored.tags = [...stored.tags!, 'topic:gujarat-festivals'];
    fireEvent.change(control<HTMLInputElement>('Title', 'input'), { target: { value: 'Updated headline only' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('tags');
    expect(stored.tags).toEqual(['ordinary-report', 'topic:navratri-2026', 'topic:gujarat-festivals']);
    expect(stored).toMatchObject({ category: 'regional', status: 'published', publishedAt: originalPublishedAt, seo: source.seo });
    expect(mocks.client.post).not.toHaveBeenCalled();
  });

  it('adds one membership to an existing draft with one logical-story mutation', async () => {
    const { onDirtyChange } = renderForm();
    await loadedTopics();
    selectTopic('Navratri 2026');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    await saveDraft();
    expect(mocks.client.post).toHaveBeenCalledExactlyOnceWith(`admin/topics/${TOPIC_ID}/stories/attach`, { storyIds: [STORY_ID] });
    expect(stored.tags).toEqual(['ordinary-report', 'topic:navratri-2026']);
    expect(mocks.update.mock.calls.every(([, payload]) => !('tags' in payload))).toBe(true);
  });

  it.each(['tech', 'tech-gadgets'])('Save Update removes only one topic and preserves %s, SEO, other tags, and publication', async (category) => {
    renderForm({ ...source, category, status: 'published', publishedAt: originalPublishedAt,
      tags: ['ordinary-report', 'topic:navratri-2026', 'topic:gujarat-festivals'] });
    await loadedTopics();
    selectTopic('Navratri 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.client.post).toHaveBeenCalledExactlyOnceWith(`admin/topics/${TOPIC_ID}/stories/detach`, { storyIds: [STORY_ID] });
    expect(stored).toMatchObject({
      category, status: 'published', publishedAt: originalPublishedAt, seo: source.seo,
      tags: ['ordinary-report', 'topic:gujarat-festivals'],
    });
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('tags');
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('publishedAt');
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('status');
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('keeps current Backend association tags when ordinary article tags are intentionally edited', async () => {
    renderForm({ ...source, status: 'published', publishedAt: originalPublishedAt, tags: ['ordinary-report', 'topic:navratri-2026'] });
    await loadedTopics();
    stored.tags = [...stored.tags!, 'topic:gujarat-festivals'];
    const tags = screen.getByPlaceholderText('Type and press Enter');
    fireEvent.change(tags, { target: { value: 'new-ordinary-tag' } });
    fireEvent.keyDown(tags, { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(stored.tags).toEqual(expect.arrayContaining(['ordinary-report', 'new-ordinary-tag', 'topic:navratri-2026', 'topic:gujarat-festivals']));
    expect(mocks.client.post).not.toHaveBeenCalled();
  });

  it('does not let the ordinary tag input bypass topic attachment safety', async () => {
    renderForm();
    await loadedTopics();
    const tags = screen.getByPlaceholderText('Type and press Enter');
    fireEvent.change(tags, { target: { value: 'topic:navratri-2026' } });
    fireEvent.keyDown(tags, { key: 'Enter' });
    expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/Use Trending Topics/));
    expect(screen.getByRole('checkbox', { name: 'Trending Topic: Navratri 2026' })).not.toBeChecked();
    expect(mocks.client.post).not.toHaveBeenCalled();
  });

  it('saves a new draft, assigns topics, then uses the existing Publish endpoint', async () => {
    renderForm(null);
    await fillCreate();
    selectTopic('Navratri 2026');
    selectTopic('Gujarat Festivals');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mocks.publish).toHaveBeenCalledExactlyOnceWith(STORY_ID));
    expect(order).toEqual(['create', `attach:${TOPIC_ID}`, `attach:${OTHER_TOPIC_ID}`, 'publish']);
    expect(stored.status).toBe('published');
    expect(stored.tags).toEqual(['topic:navratri-2026', 'topic:gujarat-festivals']);
  });

  it.each(['attach', 'detach'] as const)('keeps failed %s choices pending after UNSAFE_TOPIC_TAGS without a false save-success toast', async (action) => {
    writeFailure = { response: { status: 409, data: { ok: false, code: 'UNSAFE_TOPIC_TAGS' } } };
    renderForm({ ...source, status: 'published', publishedAt: originalPublishedAt,
      tags: action === 'detach' ? ['ordinary-report', 'topic:navratri-2026'] : ['ordinary-report'] });
    await loadedTopics();
    selectTopic('Navratri 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/article was saved.*UNSAFE_TOPIC_TAGS/)));
    expect(screen.getByRole('checkbox', { name: 'Trending Topic: Navratri 2026' }).getAttribute('type')).toBe('checkbox');
    expect(screen.getByText(action === 'attach' ? /Pending addition/ : /Pending removal/)).toBeInTheDocument();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.client.post).toHaveBeenCalledTimes(1);
    expect(mocks.client.put).not.toHaveBeenCalled();
    expect(stored.tags).toEqual(action === 'detach' ? ['ordinary-report', 'topic:navratri-2026'] : ['ordinary-report']);
  });

  it('stops Publish on a membership conflict and retains the created draft ID for retry', async () => {
    writeFailure = { response: { status: 409, data: { ok: false, code: 'UNSAFE_TOPIC_TAGS' } } };
    renderForm(null);
    await fillCreate();
    selectTopic('Navratri 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('UNSAFE_TOPIC_TAGS')));
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(stored.status).toBe('draft');
    writeFailure = null;
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled());
    await saveDraft();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalled();
    expect(stored.tags).toContain('topic:navratri-2026');
  });

  it('retains partial-save truth and retries only the remaining topic, without creating a second draft', async () => {
    writeFailure = { response: { status: 409, data: { ok: false, code: 'UNSAFE_TOPIC_TAGS' } } };
    failingTopic = OTHER_TOPIC_ID;
    renderForm(null);
    await fillCreate();
    selectTopic('Navratri 2026');
    selectTopic('Gujarat Festivals');
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/Some topic changes were saved/)));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(stored.tags).toEqual(['topic:navratri-2026']);
    writeFailure = null;
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled());
    await saveDraft();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.client.post.mock.calls.filter(([url]) => url === `admin/topics/${TOPIC_ID}/stories/attach`)).toHaveLength(1);
    expect(mocks.client.post.mock.calls.filter(([url]) => url === `admin/topics/${OTHER_TOPIC_ID}/stories/attach`)).toHaveLength(2);
    expect(stored.tags).toEqual(['topic:navratri-2026', 'topic:gujarat-festivals']);
  });

  it('uses existing autosave for a topic-only edit without changing publication', async () => {
    renderForm({ ...source, status: 'published', publishedAt: originalPublishedAt });
    await loadedTopics();
    vi.useFakeTimers();
    selectTopic('Navratri 2026');
    await act(async () => { await vi.advanceTimersByTimeAsync(30_100); });
    expect(mocks.client.post).toHaveBeenCalledExactlyOnceWith(`admin/topics/${TOPIC_ID}/stories/attach`, { storyIds: [STORY_ID] });
    expect(stored.status).toBe('published');
    expect(stored.publishedAt).toBe(originalPublishedAt);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('distinguishes a genuinely empty catalog from an API failure and preserves unrelated saving', async () => {
    options = [];
    const first = renderForm();
    await screen.findByText('No Trending Topics are available.');
    first.unmount();
    options = [availableTopic()];
    readFailure = { response: { status: 503, data: { ok: false } } };
    renderForm({ ...source, tags: ['ordinary-report', 'topic:navratri-2026'] });
    await screen.findByRole('button', { name: 'Retry Trending Topics' });
    expect(screen.queryByText('No Trending Topics are available.')).not.toBeInTheDocument();
    fireEvent.change(control<HTMLInputElement>('Title', 'input'), { target: { value: 'Unrelated draft edit' } });
    await saveDraft();
    expect(stored.tags).toEqual(['ordinary-report', 'topic:navratri-2026']);
    expect(mocks.client.post).not.toHaveBeenCalled();
  });

  it('shows staff memberships read-only without the news_edit special right', async () => {
    mocks.auth.isFounder = false;
    mocks.auth.user.role = 'editor';
    renderForm();
    await loadedTopics();
    expect(screen.getByRole('checkbox', { name: 'Trending Topic: Navratri 2026' })).toBeDisabled();
    expect(screen.getByText(/Read-only.*Edit news/)).toBeInTheDocument();
    expect(mocks.client.post).not.toHaveBeenCalled();
  });

  it('does not rewrite possible legacy membership tags when the authoritative catalog is unavailable', async () => {
    readFailure = { response: { status: 503, data: { ok: false } } };
    renderForm({ ...source, tags: ['ordinary-report', 'legacy-shared-tag'] });
    await screen.findByRole('button', { name: 'Retry Trending Topics' });
    const chip = screen.getByText('legacy-shared-tag', { exact: true }).closest('span');
    if (!chip) throw new Error('Legacy article tag chip not found');
    fireEvent.click(within(chip).getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Load Trending Topics successfully before changing tags')));
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.client.post).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(stored.tags).toEqual(['ordinary-report', 'legacy-shared-tag']);
  });

  it('uses the same selector and membership endpoints in the retained legacy editor', async () => {
    renderForm({ ...source, category: 'Regional', language: 'Gujarati' }, true);
    await loadedTopics();
    selectTopic('Navratri 2026');
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/ }));
    await screen.findByText('Returned to Manage News');
    expect(mocks.client.post).toHaveBeenCalledExactlyOnceWith(`admin/topics/${TOPIC_ID}/stories/attach`, { storyIds: [STORY_ID] });
    expect(mocks.update.mock.calls[0][1]).not.toHaveProperty('tags');
    expect(stored.category).toBe('Regional');
  });
});

import appSource from '@/App.tsx?raw';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Editorial from '@/pages/admin/Editorial';
import TrendingTopics from '@/pages/admin/TrendingTopics';
import FounderRoute from '@/components/FounderRoute';
import AdminModuleRoute from '@/components/AdminModuleRoute';
import type { adminApiClient } from '@/lib/adminApiClient';
import type { Article } from '@/lib/api/articles';
import type { CreateEditorialTopicPayload, EditorialTopic, UpdateEditorialTopicPayload } from '@/lib/api/trendingTopics';

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: 'synthetic-founder', role: 'founder', moduleAccess: ['editorial'] },
    isAuthenticated: true, isFounder: true, isReady: true, isRestoring: false, isLoading: false,
    restoreSession: vi.fn(),
  },
}));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useAdminEffectiveAccess', () => ({
  useAdminEffectiveAccess: () => ({
    isLoading: false,
    modulePolicy: { editorial: { moduleKey: 'editorial', state: 'available' } },
    backendAccess: {},
  }),
}));
const client = vi.hoisted(() => ({
  get: vi.fn<typeof adminApiClient.get>(),
  post: vi.fn<(url: string, payload: CreateEditorialTopicPayload) => Promise<unknown>>(),
  patch: vi.fn<(url: string, payload: UpdateEditorialTopicPayload) => Promise<unknown>>(),
  put: vi.fn<typeof adminApiClient.put>(),
  delete: vi.fn<typeof adminApiClient.delete>(),
}));
vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: client }));
const path = '/admin/editorial/trending-topics';
const topicId = '000000000000000000000101';
const newsId = '000000000000000000000201';
const makeTopic = (overrides: Partial<EditorialTopic> = {}): EditorialTopic => ({
  id: topicId, slug: 'navratri-2026',
  name: { gu: 'નવરાત્રી', hi: 'नवरात्रि', en: 'Navratri' },
  description: { gu: '', hi: '', en: '' }, articleTags: ['topic:navratri-2026'],
  startsAt: '2026-10-15T04:00:12.123Z', expiresAt: '2026-10-20T04:00:00.000Z',
  active: false, order: 0, pinnedArticleId: null, ...overrides,
});
let topics: EditorialTopic[];
let news: Article[];

function listResponse(page = 1, limit = 20) {
  const items = topics.slice((page - 1) * limit, page * limit);
  return { ok: true, items, total: topics.length, count: items.length, page, limit, totalPages: Math.ceil(topics.length / limit), hasNextPage: page * limit < topics.length };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('VITE_DEMO_MODE', 'false');
  vi.stubEnv('VITE_DEV_LOOSEN_FOUNDER_ROUTES', 'false');
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  Object.assign(mocks.auth, {
    user: { id: 'synthetic-founder', role: 'founder', moduleAccess: ['editorial'] },
    isAuthenticated: true, isFounder: true, isReady: true, isRestoring: false, isLoading: false,
  });
  topics = [makeTopic()];
  news = [{ _id: newsId, title: 'Published festival story', language: 'gu', status: 'published', tags: ['topic:navratri-2026'] }];
  client.get.mockImplementation(async (url, options) => {
    if (url === 'admin/topics') return { data: listResponse(Number(options?.params?.page) || 1) };
    if (String(url).startsWith('admin/topics/')) {
      const topic = topics.find((item) => `admin/topics/${item.id}` === url);
      if (!topic) throw { response: { status: 404 } };
      return { data: { ok: true, topic } };
    }
    if (url === 'articles') return { data: { ok: true, items: news, total: news.length, page: Number(options?.params?.page) || 1, limit: 20 } };
    if (String(url).startsWith('articles/')) {
      const article = news.find((item) => `articles/${item._id}` === url);
      if (!article) throw { response: { status: 404 } };
      return { data: { ok: true, article } };
    }
    throw new Error(`Unexpected GET: ${url}`);
  });
  client.post.mockImplementation(async (url, payload) => {
    if (url !== 'admin/topics') throw new Error(`Unexpected POST: ${url}`);
    const saved = makeTopic({
      ...payload, id: '000000000000000000000102',
      description: { gu: '', hi: '', en: '', ...payload.description },
    });
    topics.push(saved);
    return { data: { ok: true, topic: saved } };
  });
  client.patch.mockImplementation(async (url, payload) => {
    const index = topics.findIndex((item) => `admin/topics/${item.id}` === url);
    if (index < 0) throw new Error(`Unexpected PATCH: ${url}`);
    const previous = topics[index];
    topics[index] = {
      ...previous, ...payload,
      name: { ...previous.name, ...payload.name },
      description: { ...previous.description, ...payload.description },
    };
    return { data: { ok: true, topic: topics[index] } };
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function renderRoute(initialPath = path) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/admin/editorial" element={<AdminModuleRoute moduleKey="editorial"><Editorial /></AdminModuleRoute>} />
          <Route path={path} element={<AdminModuleRoute moduleKey="editorial"><FounderRoute><TrendingTopics /></FounderRoute></AdminModuleRoute>} />
          <Route path="/unauthorized" element={<p>Unauthorized route</p>} />
          <Route path="/login" element={<p>Login route</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function loadedPage() {
  renderRoute();
  await waitFor(() => expect(screen.queryByText('Loading topics...')).not.toBeInTheDocument());
}

async function createForm() {
  await loadedPage();
  fireEvent.click(screen.getByRole('button', { name: 'Create Topic' }));
  return screen.getByRole('region', { name: 'Create Topic' });
}

async function editForm() {
  await loadedPage();
  fireEvent.click(screen.getByRole('button', { name: 'Edit નવરાત્રી' }));
  await waitFor(() => expect(screen.getByLabelText('Gujarati Name *')).toHaveValue('નવરાત્રી'));
  return screen.getByRole('region', { name: 'Edit Topic' });
}

function fillForm() {
  fireEvent.change(screen.getByLabelText('Gujarati Name *'), { target: { value: ' નવું નામ ' } });
  fireEvent.change(screen.getByLabelText('Hindi Name *'), { target: { value: ' नया नाम ' } });
  fireEvent.change(screen.getByLabelText('English Name *'), { target: { value: ' New Topic ' } });
  fireEvent.change(screen.getByLabelText('Canonical Slug *', { exact: false }), { target: { value: 'new-topic' } });
  fireEvent.change(screen.getByLabelText('Article Tags *', { exact: false }), { target: { value: ' topic:navratri-2026 \ntopic:navratri-2026\n Festival ' } });
  fireEvent.change(screen.getByLabelText('Starts At *'), { target: { value: '2030-10-15T09:30' } });
}

function expectNoWrites() {
  expect(client.post).not.toHaveBeenCalled();
  expect(client.patch).not.toHaveBeenCalled();
  expect(client.put).not.toHaveBeenCalled();
  expect(client.delete).not.toHaveBeenCalled();
}

describe('Trending Topics routing and Founder access', () => {
  it('wires the actual App route through both existing guards and keeps Editorial intact', () => {
    expect(appSource).toContain('path="/admin/editorial/trending-topics" element={<AdminModuleRoute moduleKey="editorial"><FounderRoute><TrendingTopics /></FounderRoute></AdminModuleRoute>}');
    expect(appSource).toContain('path="/admin/editorial" element={<AdminModuleRoute moduleKey="editorial"><Editorial /></AdminModuleRoute>}');
  });

  it('preserves the four Editorial cards and lets the Founder follow the new card', async () => {
    renderRoute('/admin/editorial');
    const originalLinks = [
      ['Create Editorial / Special Story', '/admin/add-news?category=editorial'],
      ['Review Editorial Drafts', '/draft-desk?category=editorial'],
      ['Manage Editorial Articles', '/admin/articles?category=editorial'],
      ['View Public Editorial Page', 'https://www.newspulse.co.in/editorial'],
    ];
    for (const [name, href] of originalLinks) expect(screen.getByRole('link', { name: new RegExp(name.replace('/', '\\/')) })).toHaveAttribute('href', href);
    const card = screen.getByRole('link', { name: /Trending Topics/ });
    expect(card).toHaveAttribute('href', path);
    fireEvent.click(card);
    await screen.findByRole('heading', { name: 'Trending Topics' });
    await waitFor(() => expect(client.get).toHaveBeenCalledWith('admin/topics', expect.anything()));
    expectNoWrites();
  });

  it.each(['admin', 'editor', 'manager', 'reporter'])('hides the card from %s without changing Editorial cards', async (role) => {
    mocks.auth.user.role = role;
    mocks.auth.isFounder = false;
    renderRoute('/admin/editorial');
    await screen.findByRole('heading', { name: 'Editorial Desk' });
    expect(screen.queryByRole('link', { name: /Trending Topics/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expectNoWrites();
  });

  it.each(['admin', 'editor', 'manager', 'reporter'])('denies direct access for %s even with Editorial module access', (role) => {
    mocks.auth.user.role = role;
    mocks.auth.isFounder = false;
    renderRoute();
    expect(screen.getByText('Unauthorized route')).toBeInTheDocument();
    expect(client.get).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it('does not let the development Founder-route allowance unlock this page', () => {
    vi.stubEnv('VITE_DEV_LOOSEN_FOUNDER_ROUTES', 'true');
    mocks.auth.user.role = 'admin';
    mocks.auth.isFounder = false;
    renderRoute();
    expect(screen.getByText(/Trending Topics management is restricted/)).toBeInTheDocument();
    expect(client.get).not.toHaveBeenCalled();
  });

  it('waits for auth readiness and redirects unauthenticated access without topic requests', () => {
    mocks.auth.isReady = false;
    const mounted = renderRoute();
    expect(screen.getByText(/Loading News Pulse Admin/)).toBeInTheDocument();
    expect(client.get).not.toHaveBeenCalled();
    mounted.unmount();
    mocks.auth.isReady = true;
    mocks.auth.isAuthenticated = false;
    renderRoute();
    expect(screen.getByText('Login route')).toBeInTheDocument();
    expect(client.get).not.toHaveBeenCalled();
  });
});

describe('Trending Topics list', () => {
  it('loads the complete list shape without any writes or article requests', async () => {
    await loadedPage();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('topic:navratri-2026')).toBeInTheDocument();
    expect(client.get).toHaveBeenCalledExactlyOnceWith('admin/topics', {
      params: { active: 'all', page: 1, limit: 20 }, headers: { 'Cache-Control': 'no-store' },
    });
    expectNoWrites();
  });

  it('shows loading before a request resolves', () => {
    client.get.mockImplementationOnce(() => new Promise(() => {}));
    renderRoute();
    expect(screen.getByText('Loading topics...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Topic' })).toBeDisabled();
    expectNoWrites();
  });

  it('shows a real empty state', async () => {
    topics = [];
    await loadedPage();
    expect(screen.getByText('No topics found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Topic' })).toBeEnabled();
    expectNoWrites();
  });

  it.each([503, 500, 403])('shows HTTP %i as an error, not an editable empty success, and allows retry', async (status) => {
    client.get.mockRejectedValueOnce({ response: { status } });
    await loadedPage();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('No topics found.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Topic' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry topics' }));
    await screen.findByRole('table');
    expectNoWrites();
  });

  it('shows inactive, scheduled, eligible and expired states without auto-deactivation', async () => {
    topics = [
      makeTopic(),
      makeTopic({ id: '000000000000000000000102', active: true, startsAt: '2099-01-01T00:00:00.000Z', expiresAt: null }),
      makeTopic({ id: '000000000000000000000103', active: true, startsAt: '2020-01-01T00:00:00.000Z', expiresAt: null }),
      makeTopic({ id: '000000000000000000000104', active: true, startsAt: '2020-01-01T00:00:00.000Z', expiresAt: '2020-02-01T00:00:00.000Z' }),
    ];
    await loadedPage();
    for (const text of ['Inactive', 'Scheduled', 'Eligible for Trending Strip', 'Expired']) expect(screen.getByText(text)).toBeInTheDocument();
    const expired = screen.getByText('Expired').closest('tr')!;
    expect(within(expired).getByText('ON')).toBeInTheDocument();
    expect(within(expired).getByRole('button', { name: 'Deactivate નવરાત્રી' })).toBeInTheDocument();
    expectNoWrites();
  });

  it('paginates topics through the existing list contract', async () => {
    topics = Array.from({ length: 21 }, (_, index) => makeTopic({ id: String(index + 1).padStart(24, '0') }));
    await loadedPage();
    fireEvent.click(screen.getByRole('button', { name: 'Next topics' }));
    await waitFor(() => expect(screen.getByText(/Page 2 of 2/)).toBeInTheDocument());
    expect(client.get).toHaveBeenLastCalledWith('admin/topics', { params: { active: 'all', page: 2, limit: 20 }, headers: { 'Cache-Control': 'no-store' } });
    expect(screen.getByRole('button', { name: 'Next topics' })).toBeDisabled();
    expectNoWrites();
  });

  it('updates eligibility at start/expiry boundaries without switching Active off or writing', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00.000Z'));
    topics = [makeTopic({ active: true, startsAt: '2030-01-01T00:00:01.000Z', expiresAt: '2030-01-01T00:00:02.000Z' })];
    renderRoute();
    await act(async () => {});
    expect(screen.getByText('Scheduled')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('Eligible for Trending Strip')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('ON')).toBeInTheDocument();
    expectNoWrites();
  });
});

describe('Trending Topics create/edit', () => {
  it('orders the fields GU/HI/EN and validates all required fields without saving', async () => {
    await createForm();
    const names = screen.getAllByRole('textbox', { name: /Name \*/ });
    expect(names.map((input) => input.closest('label')?.textContent)).toEqual(['Gujarati Name *', 'Hindi Name *', 'English Name *']);
    expect(screen.getByRole('switch', { name: 'Active' })).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    for (const label of ['Gujarati', 'Hindi', 'English']) expect(screen.getByText(`${label} Name is required.`)).toBeInTheDocument();
    expect(screen.getByText('Canonical Slug is required.')).toBeInTheDocument();
    expect(screen.getByText('At least one article tag is required.')).toBeInTheDocument();
    expect(screen.getByText(/Starts At is required/)).toBeInTheDocument();
    expectNoWrites();
  });

  it.each(['2030-10-15T09:30', '2030-10-15T09:29'])('rejects expiry at or before the start: %s', async (expiry) => {
    await createForm();
    fillForm();
    fireEvent.change(screen.getByLabelText('Expires At'), { target: { value: expiry } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Expires At must be later than Starts At.')).toBeInTheDocument();
    expectNoWrites();
  });

  it('saves one multilingual topic only on explicit Save, with exact deduplicated tags and inactive default', async () => {
    await createForm();
    fillForm();
    fireEvent.change(screen.getByLabelText('Gujarati Description'), { target: { value: ' વર્ણન ' } });
    fireEvent.change(screen.getByLabelText('Hindi Description'), { target: { value: ' विवरण ' } });
    fireEvent.change(screen.getByLabelText('English Description'), { target: { value: ' Description ' } });
    fireEvent.change(screen.getByLabelText('Order'), { target: { value: '-3' } });
    expectNoWrites();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Topic saved.');
    expect(client.post).toHaveBeenCalledExactlyOnceWith('admin/topics', {
      slug: 'new-topic', name: { gu: 'નવું નામ', hi: 'नया नाम', en: 'New Topic' },
      description: { gu: 'વર્ણન', hi: 'विवरण', en: 'Description' },
      articleTags: ['topic:navratri-2026', 'Festival'], pinnedArticleId: null,
      startsAt: new Date('2030-10-15T09:30').toISOString(), expiresAt: null, active: false, order: -3,
    });
    expect(client.patch).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
    await screen.findByText('New Topic');
  });

  it('converts browser-local datetimes to UTC while preserving their local wall-clock meaning', async () => {
    await createForm();
    fillForm();
    fireEvent.change(screen.getByLabelText('Expires At'), { target: { value: '2030-10-16T10:45' } });
    expect(screen.getByText(Intl.DateTimeFormat().resolvedOptions().timeZone, { exact: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Topic saved.');
    const saved = client.post.mock.calls[0][1];
    expect(saved.startsAt).toMatch(/Z$/);
    expect(new Date(saved.startsAt).getHours()).toBe(9);
    expect(new Date(saved.startsAt).getMinutes()).toBe(30);
    expect(new Date(saved.expiresAt!).getHours()).toBe(10);
    expect(new Date(saved.expiresAt!).getMinutes()).toBe(45);
  });

  it('allows explicit Active ON during create but does not auto-save the switch', async () => {
    await createForm();
    fillForm();
    fireEvent.click(screen.getByRole('switch', { name: 'Active' }));
    expectNoWrites();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(client.post).toHaveBeenCalledWith('admin/topics', expect.objectContaining({ active: true })));
  });

  it('cancels creation without a mutation', async () => {
    await createForm();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('region', { name: 'Create Topic' })).not.toBeInTheDocument();
    expectNoWrites();
  });

  it('rejects fractional order and wildcard tags visibly', async () => {
    await createForm();
    fillForm();
    fireEvent.change(screen.getByLabelText('Order'), { target: { value: '1.5' } });
    fireEvent.change(screen.getByLabelText('Article Tags *', { exact: false }), { target: { value: 'topic:*' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Order must be a whole safe integer.')).toBeInTheDocument();
    expect(screen.getByText(/without wildcards or control characters/)).toBeInTheDocument();
    expectNoWrites();
  });

  it('loads edits by id, keeps the slug read-only, and clears expiry to null', async () => {
    const originalStart = topics[0].startsAt;
    await editForm();
    expect(client.get).toHaveBeenCalledWith(`admin/topics/${topicId}`, { headers: { 'Cache-Control': 'no-store' } });
    expect(screen.getByLabelText('Canonical Slug *', { exact: false })).toHaveAttribute('readonly');
    fireEvent.change(screen.getByLabelText('Canonical Slug *', { exact: false }), { target: { value: 'attempted-change' } });
    expect(screen.getByLabelText('Canonical Slug *', { exact: false })).toHaveValue('navratri-2026');
    fireEvent.change(screen.getByLabelText('Gujarati Name *'), { target: { value: 'સુધારેલું નામ' } });
    fireEvent.change(screen.getByLabelText('Hindi Name *'), { target: { value: 'बदला हुआ नाम' } });
    fireEvent.change(screen.getByLabelText('English Name *'), { target: { value: 'Edited name' } });
    for (const label of ['Gujarati', 'Hindi', 'English']) fireEvent.change(screen.getByLabelText(`${label} Description`), { target: { value: `${label} description` } });
    fireEvent.change(screen.getByLabelText('Article Tags *', { exact: false }), { target: { value: 'topic:changed\n topic:changed ' } });
    fireEvent.change(screen.getByLabelText('Order'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Expires At'), { target: { value: '' } });
    expectNoWrites();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Topic saved.');
    expect(client.patch).toHaveBeenCalledExactlyOnceWith(`admin/topics/${topicId}`, {
      name: { gu: 'સુધારેલું નામ', hi: 'बदला हुआ नाम', en: 'Edited name' },
      description: { gu: 'Gujarati description', hi: 'Hindi description', en: 'English description' },
      articleTags: ['topic:changed'], pinnedArticleId: null, order: 12, active: false,
      startsAt: originalStart, expiresAt: null,
    });
    expect(client.patch.mock.calls[0][1]).not.toHaveProperty('slug');
  });

  it('preserves and validates an unchanged schedule shorter than one minute', async () => {
    topics[0].expiresAt = '2026-10-15T04:00:45.678Z';
    const schedule = { startsAt: topics[0].startsAt, expiresAt: topics[0].expiresAt };
    await editForm();
    const localStart = (screen.getByLabelText('Starts At *') as HTMLInputElement).value;
    expect(screen.getByLabelText('Expires At')).toHaveValue(localStart);
    fireEvent.change(screen.getByLabelText('English Name *'), { target: { value: 'Updated short schedule' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Topic saved.');
    expect(client.patch).toHaveBeenCalledExactlyOnceWith(`admin/topics/${topicId}`, expect.objectContaining(schedule));
  });

  it.each([409, 403, 503])('retains unsaved edit values after HTTP %i and retries only on another Save', async (status) => {
    await editForm();
    client.patch.mockRejectedValueOnce({ response: { status, data: { code: 'EDIT_CONFLICT' } } });
    fireEvent.change(screen.getByLabelText('English Name *'), { target: { value: 'Unsaved edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('English Name *')).toHaveValue('Unsaved edit');
    expect(client.patch).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Topic saved.')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Topic saved.');
    expect(client.patch).toHaveBeenCalledTimes(2);
  });

  it('surfaces a slug conflict and preserves all create inputs', async () => {
    await createForm();
    fillForm();
    client.post.mockRejectedValueOnce({ response: { status: 409, data: { code: 'SLUG_CONFLICT' } } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText(/canonical slug already exists/);
    expect(screen.getByLabelText('English Name *')).toHaveValue(' New Topic ');
    expect(screen.getByLabelText('Canonical Slug *', { exact: false })).toHaveValue('new-topic');
    expect(client.post).toHaveBeenCalledTimes(1);
  });

  it('does not offer a blank editable form when getTopic fails', async () => {
    await loadedPage();
    client.get.mockRejectedValueOnce({ response: { status: 404 } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit નવરાત્રી' }));
    await screen.findByText(/Topic not found/);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry topic' }));
    await screen.findByLabelText('Gujarati Name *');
    expectNoWrites();
  });

  it('disables the form and suppresses duplicate saves while a save is pending', async () => {
    const region = await createForm();
    fillForm();
    let finish!: (response: { data: { ok: true; topic: EditorialTopic } }) => void;
    client.post.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const form = region.querySelector('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByLabelText('English Name *')).toBeDisabled();
    await act(async () => { finish({ data: { ok: true, topic: makeTopic() } }); });
  });
});

describe('Trending Topics activation', () => {
  it('activates with PATCH active:true and no other fields', async () => {
    await loadedPage();
    fireEvent.click(screen.getByRole('button', { name: 'Activate નવરાત્રી' }));
    await screen.findByText('Topic activated. Its schedule still applies.');
    expect(client.patch).toHaveBeenCalledExactlyOnceWith(`admin/topics/${topicId}`, { active: true });
    expect(client.post).not.toHaveBeenCalled();
  });

  it('requires confirmation for deactivation and never deletes', async () => {
    topics[0].active = true;
    await loadedPage();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate નવરાત્રી' }));
    expectNoWrites();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Nothing is deleted/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }));
    await screen.findByText('Topic deactivated.');
    expect(client.patch).toHaveBeenCalledExactlyOnceWith(`admin/topics/${topicId}`, { active: false });
    expect(client.delete).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
  });

  it('cancels deactivation without any request', async () => {
    topics[0].active = true;
    await loadedPage();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate નવરાત્રી' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expectNoWrites();
  });

  it('keeps a failed deactivation visible and retries only after confirmation again', async () => {
    topics[0].active = true;
    await loadedPage();
    client.patch.mockRejectedValueOnce({ response: { status: 503 } });
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate નવરાત્રી' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }));
    await screen.findByText(/temporarily unavailable/);
    expect(screen.getByText('ON')).toBeInTheDocument();
    expect(screen.queryByText('Topic deactivated.')).not.toBeInTheDocument();
    expect(client.patch).toHaveBeenCalledTimes(1);
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Deactivate' }));
    await screen.findByText('Topic deactivated.');
    expect(client.patch).toHaveBeenCalledTimes(2);
  });
});

describe('Trending Topics CMS News pin', () => {
  it('searches published CMS News, shows identity, and saves only the selected News._id', async () => {
    await createForm();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Choose pinned story' }));
    fireEvent.change(screen.getByLabelText('Search published stories'), { target: { value: 'festival' } });
    await screen.findByRole('option', { name: /Published festival story \| gu \| published/ });
    expect(client.get).toHaveBeenCalledWith('articles', {
      params: { q: 'festival', status: 'published', page: 1, limit: 20, sort: '-publishedAt' },
    });
    fireEvent.change(screen.getByLabelText('Published CMS News story'), { target: { value: newsId } });
    await screen.findByText('Published festival story | gu | published');
    expectNoWrites();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Topic saved.');
    expect(client.post).toHaveBeenCalledWith('admin/topics', expect.objectContaining({ pinnedArticleId: newsId }));
    expect(client.patch).not.toHaveBeenCalled();
    expect(client.put).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
  });

  it('clears an existing pin with explicit null without editing the article', async () => {
    topics[0].pinnedArticleId = newsId;
    await editForm();
    await screen.findByText('Published festival story | gu | published');
    fireEvent.click(screen.getByRole('button', { name: 'Clear pinned story' }));
    expect(screen.getByText('No pinned story')).toBeInTheDocument();
    expectNoWrites();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Topic saved.');
    expect(client.patch).toHaveBeenCalledExactlyOnceWith(`admin/topics/${topicId}`, expect.objectContaining({ pinnedArticleId: null }));
    expect(client.put).not.toHaveBeenCalled();
    expect(client.delete).not.toHaveBeenCalled();
  });

  it('does not offer draft, archived, or non-ObjectId article candidates', async () => {
    news.push(
      { _id: 'compatibility-article-id', title: 'Invalid reference', status: 'published' },
      { _id: '000000000000000000000202', title: 'Draft candidate', status: 'draft' },
      { _id: '000000000000000000000203', title: 'Archived candidate', status: 'archived' },
    );
    await createForm();
    fireEvent.click(screen.getByRole('button', { name: 'Choose pinned story' }));
    await screen.findByRole('option', { name: /Published festival story/ });
    expect(screen.queryByRole('option', { name: /Invalid reference|Draft candidate|Archived candidate/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /article id/i })).not.toBeInTheDocument();
    expectNoWrites();
  });

  it('shows search failures and retries without a mutation', async () => {
    await createForm();
    client.get.mockRejectedValueOnce({ response: { status: 503 } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose pinned story' }));
    await screen.findByText(/Published CMS News stories could not be loaded/);
    expect(screen.queryByLabelText('Published CMS News story')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry story search' }));
    await screen.findByRole('option', { name: /Published festival story/ });
    expectNoWrites();
  });

  it('paginates the published News selector without changing topic or article data', async () => {
    await createForm();
    client.get.mockResolvedValueOnce({ data: { items: news, total: 21, page: 1, limit: 20 } });
    fireEvent.click(screen.getByRole('button', { name: 'Choose pinned story' }));
    await screen.findByRole('option', { name: /Published festival story/ });
    client.get.mockResolvedValueOnce({ data: { items: [{ _id: '000000000000000000000222', title: 'Next published story', language: 'hi', status: 'published' }], total: 21, page: 2, limit: 20 } });
    fireEvent.click(screen.getByRole('button', { name: 'Next stories' }));
    await screen.findByRole('option', { name: /Next published story \| hi \| published/ });
    expect(client.get).toHaveBeenLastCalledWith('articles', { params: { q: undefined, status: 'published', page: 2, limit: 20, sort: '-publishedAt' } });
    expectNoWrites();
  });

  it('does not silently clear a saved pin that cannot be loaded', async () => {
    topics[0].pinnedArticleId = newsId;
    news = [];
    await editForm();
    await screen.findByText(/saved CMS News reference could not be loaded/);
    expect(screen.getByRole('button', { name: 'Clear pinned story' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Pinned Story' })).toHaveTextContent(newsId);
    expectNoWrites();
  });
});

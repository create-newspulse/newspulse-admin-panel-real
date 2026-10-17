import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { adminApiClient } from '@/lib/adminApiClient';
import type { TopicStory } from '@/lib/api/trendingTopics';
import TopicStoryManager from '@/components/news/TopicStoryManager';
import AdminModuleRoute from '@/components/AdminModuleRoute';
import TrendingTopics from '@/pages/admin/TrendingTopics';
import {
  availableTopic, membershipResult, pageResult, syntheticId, topicStory, GUJARATI_ID, STORY_ID, TOPIC_ID,
} from '@/tests/fixtures/trendingTopics';

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: 'founder-1', role: 'founder', moduleAccess: ['manage_news'], specialRights: [] as string[] },
    isAuthenticated: true, isFounder: true, isReady: true, isLoading: false, isRestoring: false,
  },
  client: {
    get: vi.fn<typeof adminApiClient.get>(),
    post: vi.fn<(url: string, body: { storyIds: string[] }) => Promise<unknown>>(),
    patch: vi.fn<typeof adminApiClient.patch>(),
    put: vi.fn<typeof adminApiClient.put>(),
    delete: vi.fn<typeof adminApiClient.delete>(),
  },
}));
vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: mocks.client }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useAdminEffectiveAccess', () => ({
  useAdminEffectiveAccess: () => ({
    isLoading: false, error: null, backendAccess: {},
    modulePolicy: { manage_news: { moduleKey: 'manage_news', state: 'available' } },
  }),
}));

const topic = availableTopic();
const path = '/admin/editorial/trending-topics';
const resource = `admin/topics/${TOPIC_ID}`;
const science = topicStory({ logicalStoryId: syntheticId(301), articleId: syntheticId(301), variantIds: [syntheticId(301)],
  title: 'Science report', category: 'tech', status: 'draft', publishedAt: null, availableLanguages: ['gu'], attached: false });
const gadgets = topicStory({ logicalStoryId: syntheticId(401), articleId: syntheticId(401), variantIds: [syntheticId(401)],
  title: 'Gadget report', category: 'tech-gadgets', attached: false });
let attached: TopicStory[];
let searchRows: TopicStory[];
let candidates: TopicStory[];
let readFailure: unknown;
let writeFailure: unknown;
let revalidationFailed: boolean;
const clients: QueryClient[] = [];

function renderPage(directory = false, canEdit = true) {
  const client = new QueryClient({ defaultOptions: {
    queries: { retry: 3, gcTime: Infinity }, mutations: { retry: 3 },
  } });
  clients.push(client);
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        {directory ? <Routes>
          <Route path={path} element={<AdminModuleRoute moduleKey="manage_news"><TrendingTopics /></AdminModuleRoute>} />
          <Route path="/login" element={<p>Login</p>} />
        </Routes> : <TopicStoryManager topic={topic} canEdit={canEdit} onClose={vi.fn()} />}
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return client;
}

beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(mocks.auth, {
    user: { id: 'founder-1', role: 'founder', moduleAccess: ['manage_news'], specialRights: [] },
    isAuthenticated: true, isFounder: true, isReady: true, isLoading: false, isRestoring: false,
  });
  attached = [topicStory({ pinned: true })];
  searchRows = [topicStory(), science, gadgets];
  candidates = [topicStory({ ...science, matchReasons: [
    { field: 'title', term: 'festival' }, { field: 'seo.keywords', term: 'navratri' }, { field: 'tags', term: 'report' },
  ] })];
  readFailure = null;
  writeFailure = null;
  revalidationFailed = false;
  mocks.client.get.mockImplementation(async (url, config) => {
    if (readFailure) throw readFailure;
    const page = Number(config?.params?.page || 1);
    const limit = Number(config?.params?.limit || 20);
    const lang = config?.params?.lang || 'gu';
    if (url === 'admin/topics/available') return { data: { ...pageResult([topic], { page, limit }), lang } };
    if (url === 'admin/topics') return { data: pageResult([{ ...topic, description: { gu: '', hi: '', en: '' }, order: 0, pinnedArticleId: null }]) };
    const rows = url === `${resource}/stories` ? attached : url === `${resource}/stories/search` ? searchRows : url === `${resource}/candidates` ? candidates : null;
    if (!rows) throw new Error(`Unexpected read: ${url}`);
    const items = rows.slice((page - 1) * limit, page * limit).map((row) => ({
      ...row, attached: attached.some((item) => item.logicalStoryId === row.logicalStoryId),
    }));
    return { data: {
      ...pageResult(items, { page, limit, total: rows.length }), lang, unit: 'logical-story', topicId: TOPIC_ID,
      ...(url === `${resource}/stories/search` ? { q: config?.params?.q } : {}),
      ...(url === `${resource}/candidates` ? { suggestionOnly: true, terms: ['navratri'] } : {}),
    } };
  });
  mocks.client.post.mockImplementation(async (url, body: { storyIds: string[] }) => {
    if (writeFailure) throw writeFailure;
    const action = url === `${resource}/stories/attach` ? 'attach' : url === `${resource}/stories/detach` ? 'detach' : null;
    if (!action) throw new Error(`Unexpected write: ${url}`);
    const rows = body.storyIds.map((id) => {
      const row = [...attached, ...searchRows, ...candidates].find((item) => item.logicalStoryId === id);
      if (!row) throw new Error(`Unknown synthetic story: ${id}`);
      return { ...row, attached: action === 'attach', membershipConsistent: true };
    });
    attached = attached.filter((row) => !body.storyIds.includes(row.logicalStoryId));
    if (action === 'attach') attached.push(...rows);
    return { data: membershipResult(action, {
      count: rows.length, changedVariants: rows.reduce((sum, row) => sum + row.variantIds.length, 0), items: rows,
      revalidation: { ok: !revalidationFailed },
    }) };
  });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.restoreAllMocks();
});

async function search() {
  fireEvent.click(screen.getByRole('button', { name: 'Search Existing Stories' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search existing stories' }), { target: { value: 'navratri' } });
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  await screen.findByText('Science report');
}

async function confirmDetach() {
  fireEvent.click(await screen.findByRole('button', { name: 'Detach Festival report' }));
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Detach' }));
}

describe('Trending Topic attached/search/candidate UI', () => {
  it('shows one logical row with real category, lifecycle, date, editions, pin, and CMS edit link', async () => {
    renderPage();
    await screen.findByText('Festival report');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Regional')).toBeInTheDocument();
    expect(screen.getByText('published', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('EN / HI / GU')).toBeInTheDocument();
    expect(screen.getByText(/Pinned \(presentation only\)/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View/Edit' })).toHaveAttribute('href', `/admin/articles/${GUJARATI_ID}/edit`);
    expect(screen.getByText(/1 logical stories/)).toBeInTheDocument();
    expect(mocks.client.post).not.toHaveBeenCalled();
  });

  it('requests the chosen language without making three translation rows', async () => {
    renderPage();
    await screen.findByText('Festival report');
    fireEvent.change(screen.getByRole('combobox', { name: 'Story language' }), { target: { value: 'hi' } });
    await waitFor(() => expect(mocks.client.get).toHaveBeenLastCalledWith(`${resource}/stories`, expect.objectContaining({ params: { lang: 'hi', page: 1, limit: 20 } })));
    await screen.findByText('Festival report');
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('runs bounded server search, distinguishes attached results, and preserves both tech categories', async () => {
    renderPage();
    await screen.findByText('Festival report');
    await search();
    expect(mocks.client.get).toHaveBeenCalledWith(`${resource}/stories/search`, expect.objectContaining({
      params: { q: 'navratri', lang: 'gu', page: 1, limit: 20 },
    }));
    expect(screen.getByRole('checkbox', { name: 'Select Festival report' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Select Science report' })).not.toBeChecked();
    expect(screen.getByText('Science & Technology')).toBeInTheDocument();
    expect(screen.getByText('Tech & Gadgets')).toBeInTheDocument();
    expect(screen.getAllByText('Available to attach')).toHaveLength(2);
    expect(screen.getByText('Already attached')).toBeInTheDocument();
    expect(mocks.client.post).not.toHaveBeenCalled();
  });

  it('does not search before submission or accept fewer than two characters', async () => {
    renderPage();
    await screen.findByText('Festival report');
    fireEvent.click(screen.getByRole('button', { name: 'Search Existing Stories' }));
    const input = screen.getByRole('textbox', { name: 'Search existing stories' });
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.submit(input.closest('form')!);
    expect(screen.getByRole('alert')).toHaveTextContent('between 2 and 120');
    expect(mocks.client.get.mock.calls.some(([url]) => String(url).endsWith('/stories/search'))).toBe(false);
    expect(screen.queryByText('No matching stories found.')).not.toBeInTheDocument();
  });

  it.each([1, 2])('attaches %i explicitly selected logical stories with no article/config writes', async (count) => {
    renderPage();
    await screen.findByText('Festival report');
    await search();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Science report' }));
    if (count === 2) fireEvent.click(screen.getByRole('checkbox', { name: 'Select Gadget report' }));
    fireEvent.click(screen.getByRole('button', { name: `Add Selected (${count})` }));
    await screen.findByText(`${count} logical ${count === 1 ? 'story' : 'stories'} attached.`);
    expect(mocks.client.post).toHaveBeenCalledExactlyOnceWith(`${resource}/stories/attach`, {
      storyIds: count === 1 ? [science.logicalStoryId] : [science.logicalStoryId, gadgets.logicalStoryId],
    });
    expect(mocks.client.put).not.toHaveBeenCalled();
    expect(mocks.client.patch).not.toHaveBeenCalled();
    expect(mocks.client.delete).not.toHaveBeenCalled();
  });

  it('requires confirmation and detaches only this topic using the logical ID', async () => {
    renderPage();
    await confirmDetach();
    await screen.findByText('1 logical story detached.');
    await screen.findByText('No stories are attached to this topic.');
    expect(mocks.client.post).toHaveBeenCalledExactlyOnceWith(`${resource}/stories/detach`, { storyIds: [STORY_ID] });
    expect(mocks.client.patch).not.toHaveBeenCalled();
    expect(mocks.client.put).not.toHaveBeenCalled();
  });

  it('shows Backend candidates and match reasons without selecting or attaching them', async () => {
    renderPage();
    await screen.findByText('Festival report');
    fireEvent.click(screen.getByRole('button', { name: 'Suggested Related Stories' }));
    await screen.findByText('Science report');
    expect(screen.getByText('Matched headline: festival')).toBeInTheDocument();
    expect(screen.getByText('Matched SEO keyword: navratri')).toBeInTheDocument();
    expect(screen.getByText('Matched article tag: report')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Science report' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Add Selected (0)' })).toBeDisabled();
    expect(mocks.client.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Science report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Selected (1)' }));
    await screen.findByText('1 logical story attached.');
  });

  it('distinguishes loading and successful empty results', async () => {
    attached = [];
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent('Loading stories');
    expect(screen.queryByText('No stories are attached to this topic.')).not.toBeInTheDocument();
    await screen.findByText('No stories are attached to this topic.');
    expect(screen.getByText(/0 logical stories/)).toBeInTheDocument();
  });

  it('shows a failed read instead of no stories, and retries only explicitly', async () => {
    readFailure = { response: { status: 503, data: { ok: false } } };
    renderPage();
    await screen.findByRole('alert');
    expect(screen.queryByText(/No stories/)).not.toBeInTheDocument();
    expect(mocks.client.get).toHaveBeenCalledTimes(1);
    readFailure = null;
    fireEvent.click(screen.getByRole('button', { name: 'Retry stories' }));
    await screen.findByText('Festival report');
    expect(mocks.client.get).toHaveBeenCalledTimes(2);
  });

  it.each(['attach', 'detach'] as const)('shows UNSAFE_TOPIC_TAGS for %s without optimistic success or automatic retry', async (action) => {
    writeFailure = { response: { status: 409, data: { ok: false, code: 'UNSAFE_TOPIC_TAGS' } } };
    renderPage();
    if (action === 'attach') {
      await screen.findByText('Festival report');
      await search();
      fireEvent.click(screen.getByRole('checkbox', { name: 'Select Science report' }));
      fireEvent.click(screen.getByRole('button', { name: 'Add Selected (1)' }));
    } else await confirmDetach();
    await screen.findByText(/UNSAFE_TOPIC_TAGS/);
    expect(screen.queryByText(/logical stor(?:y|ies) (?:attached|detached)\./)).not.toBeInTheDocument();
    expect(attached).toHaveLength(1);
    expect(attached[0].logicalStoryId).toBe(STORY_ID);
    expect(mocks.client.post).toHaveBeenCalledTimes(1);
    expect(mocks.client.put).not.toHaveBeenCalled();
    expect(mocks.client.patch).not.toHaveBeenCalled();
    if (action === 'attach') expect(screen.getByRole('checkbox', { name: 'Select Science report' })).toBeChecked();
    else expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('does not claim success for an HTTP-200 uncommitted mutation', async () => {
    mocks.client.post.mockResolvedValue({ data: { ...membershipResult(), committed: false } });
    renderPage();
    await screen.findByText('Festival report');
    await search();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Science report' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add Selected (1)' }));
    await screen.findByRole('alert');
    expect(screen.queryByText('1 logical story attached.')).not.toBeInTheDocument();
    expect(mocks.client.post).toHaveBeenCalledTimes(1);
  });

  it('warns when persistence succeeds but public revalidation fails', async () => {
    revalidationFailed = true;
    renderPage();
    await confirmDetach();
    await screen.findByText('1 logical story detached.');
    expect(await screen.findByRole('alert')).toHaveTextContent(/saved.*follow-up failed.*do not repeat/);
    expect(mocks.client.post).toHaveBeenCalledTimes(1);
  });

  it('paginates using real logical-story totals', async () => {
    attached = Array.from({ length: 21 }, (_, index) => topicStory({
      title: `Story ${index}`, logicalStoryId: syntheticId(600 + index),
      articleId: syntheticId(600 + index), variantIds: [syntheticId(600 + index)],
    }));
    renderPage();
    await screen.findByText('Story 0');
    expect(screen.getByText(/Page 1 of 2 \(21 logical stories\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next stories' }));
    await screen.findByText('Story 20');
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(mocks.client.get).toHaveBeenLastCalledWith(`${resource}/stories`, expect.objectContaining({ params: { lang: 'gu', page: 2, limit: 20 } }));
  });
});

describe('Trending Topics mounted permission surfaces', () => {
  it('preserves Founder configuration controls and adds Manage Stories', async () => {
    renderPage(true);
    await screen.findByRole('button', { name: 'Create Topic' });
    expect(await screen.findByRole('button', { name: 'Edit Navratri 2026' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Manage Stories Navratri 2026' }));
    await screen.findByText('Festival report');
    expect(screen.getByRole('button', { name: 'Detach Festival report' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Trending Topics' }));
    expect(screen.getByRole('button', { name: 'Create Topic' })).toBeInTheDocument();
  });

  it.each([false, true])('allows staff manage_news reads with news_edit=%s but never Founder configuration', async (editRight) => {
    mocks.auth.isFounder = false;
    mocks.auth.user.role = 'editor';
    mocks.auth.user.specialRights = editRight ? ['can_edit_news'] : [];
    renderPage(true);
    fireEvent.click(await screen.findByRole('button', { name: 'Manage Stories' }));
    await screen.findByText('Festival report');
    expect(screen.queryByRole('button', { name: 'Create Topic' })).not.toBeInTheDocument();
    expect(mocks.client.get.mock.calls.some(([url]) => url === 'admin/topics')).toBe(false);
    const detach = screen.getByRole('button', { name: 'Detach Festival report' });
    if (editRight) {
      expect(detach).toBeEnabled();
      await confirmDetach();
      await screen.findByText('1 logical story detached.');
    } else {
      expect(detach).toBeDisabled();
      await search();
      expect(screen.getByRole('checkbox', { name: 'Select Science report' })).toBeDisabled();
      expect(mocks.client.post).not.toHaveBeenCalled();
    }
    expect(mocks.client.patch).not.toHaveBeenCalled();
  });

  it('denies staff without manage_news even if they have news_edit and Editorial', () => {
    mocks.auth.isFounder = false;
    mocks.auth.user.role = 'editor';
    mocks.auth.user.moduleAccess = ['editorial'];
    mocks.auth.user.specialRights = ['can_edit_news'];
    renderPage(true);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(mocks.client.get).not.toHaveBeenCalled();
    expect(mocks.client.post).not.toHaveBeenCalled();
  });
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useNavigate, type NavigateFunction } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article } from '@/lib/api/articles';
import type { RichTextEditorProps } from '@/components/editor/RichTextEditor';
import type { CoverImageUploadProps } from '@/components/articles/CoverImageUpload';
import type { ArticleTrendingTopicsState } from '@/hooks/useArticleTrendingTopics';
import EditNews from '@/pages/EditNews';
import {
  availableTopic, otherTopic, membershipResult, pageResult, STORY_ID, TOPIC_ID, OTHER_TOPIC_ID,
} from '@/tests/fixtures/trendingTopics';

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: 'founder-1', role: 'founder', moduleAccess: ['manage_news'], specialRights: [] as string[], newsPublishGrantRecorded: false },
    isAuthenticated: true, isFounder: true, isReady: true, isRestoring: false, isLoading: false,
  },
  publishEnabled: true,
  get: vi.fn<(url: string, config?: { params?: Record<string, unknown> }) => Promise<{ data: unknown }>>(),
  put: vi.fn<(url: string, payload: Partial<Article>) => Promise<{ data: unknown }>>(),
  post: vi.fn<(url: string, payload?: { storyIds?: string[]; content?: string }) => Promise<{ data: unknown }>>(),
  upload: vi.fn(),
  richText: null as RichTextEditorProps | null,
  cover: null as CoverImageUploadProps | null,
  selectTopic: null as ((id: string, selected: boolean) => void) | null,
  navigate: null as NavigateFunction | null,
  info: vi.fn(), success: vi.fn(), error: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/useAdminEffectiveAccess', () => ({ useAdminEffectiveAccess: () => ({
  isLoading: false, error: null, backendAccess: {},
  modulePolicy: { manage_news: { moduleKey: 'manage_news', state: 'available' } },
}) }));
vi.mock('@/context/PublishFlagContext', () => ({ usePublishFlag: () => ({ publishEnabled: mocks.publishEnabled }) }));
vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: { get: mocks.get, put: mocks.put, post: mocks.post } }));
vi.mock('@/lib/api/media', () => ({ uploadCoverImage: mocks.upload }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(mocks.info, { success: mocks.success, error: mocks.error }) }));
vi.mock('@/components/editor/RichTextEditor', () => ({
  default: (props: RichTextEditorProps) => {
    mocks.richText = props;
    return <textarea aria-label="Legacy content" value={props.value} onChange={event => props.onChange(event.target.value)} />;
  },
}));
vi.mock('@/components/articles/CoverImageUpload', () => ({
  default: (props: CoverImageUploadProps) => {
    mocks.cover = props;
    return <button type="button" disabled={props.disabled} onClick={props.onRemove}>Remove cover</button>;
  },
}));
vi.mock('@/components/news/TrendingTopicSelector', async importOriginal => {
  const { default: Selector } = await importOriginal<typeof import('@/components/news/TrendingTopicSelector')>();
  return { default: (props: { topics: ArticleTrendingTopicsState; disabled?: boolean }) => {
    mocks.selectTopic = props.topics.setSelected;
    return <Selector {...props} />;
  } };
});

const source: Article = {
  _id: STORY_ID, title: 'Accepted original headline', content: '<p>Accepted original body.</p>',
  summary: 'Original summary', slug: 'keep-original-slug', category: 'National',
  language: 'English', lang: 'en', status: 'draft', translationGroupId: 'original-group',
  imageUrl: '/original-cover.jpg', coverImage: { url: '/original-cover.jpg', publicId: 'original-cover' },
  tags: ['ordinary-tag'],
};
const clients: QueryClient[] = [];
let stored: Article;
let order: string[];
let publishedContent: { title: string; content: string | undefined } | null;

function NavigationProbe() {
  mocks.navigate = useNavigate();
  return <Link to="/manage-news">Leave editor</Link>;
}

function viewEditor(client: QueryClient, storyId = STORY_ID) {
  return <QueryClientProvider client={client}>
    <MemoryRouter initialEntries={[`/edit/${storyId}`]}>
      <NavigationProbe />
      <Routes>
        <Route path="/edit/:id" element={<EditNews />} />
        <Route path="/manage-news" element={<p>Returned to Manage News</p>} />
      </Routes>
    </MemoryRouter>
  </QueryClientProvider>;
}

async function open(expectPublish = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: 3 } } });
  clients.push(client);
  const rendered = render(viewEditor(client));
  await screen.findByDisplayValue(source.title);
  await screen.findByRole('checkbox', { name: 'Trending Topic: Navratri 2026' });
  const publish = await screen.findByRole('button', { name: /Publish Now/ });
  if (expectPublish) await waitFor(() => expect(publish).toBeEnabled());
  return { client, ...rendered };
}

function editHeadline(value = 'Current headline awaiting publication') {
  const input = document.querySelector<HTMLInputElement>('input[name="title"]');
  if (!input) throw new Error('Headline control missing');
  fireEvent.change(input, { target: { value } });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(complete => { resolve = complete; });
  return { promise, resolve };
}

function publicationCalls() {
  return mocks.post.mock.calls.filter(([url]) => url.endsWith('/publish'));
}

async function refresh() {
  fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Refresh latest state' })).not.toBeInTheDocument());
}

function submitSave() {
  const form = screen.getByRole('button', { name: /Save Changes/ }).closest('form');
  if (!form) throw new Error('Legacy article form missing');
  fireEvent.submit(form);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  mocks.auth.user = { id: 'founder-1', role: 'founder', moduleAccess: ['manage_news'], specialRights: [], newsPublishGrantRecorded: false };
  Object.assign(mocks.auth, { isAuthenticated: true, isFounder: true, isReady: true, isRestoring: false, isLoading: false });
  mocks.publishEnabled = true;
  mocks.richText = null;
  mocks.cover = null;
  mocks.selectTopic = null;
  mocks.navigate = null;
  stored = { ...source, tags: [...source.tags!] };
  order = [];
  publishedContent = null;
  mocks.get.mockImplementation(async (url, config) => {
    if (url === 'admin/topics/available') {
      const items = [availableTopic(), otherTopic()].map(topic => ({
        ...topic, attached: stored.tags?.includes(topic.membershipTag!) === true, membershipConsistent: true,
      }));
      return { data: { ...pageResult(items, { limit: 100 }), logicalStoryId: STORY_ID, lang: config?.params?.lang || 'en' } };
    }
    if (url === `articles/${STORY_ID}`) return { data: { article: { ...stored } } };
    if (url === `/news/${STORY_ID}/workflow`) return { data: {
      status: stored.status, stage: stored.status === 'published' ? 'published' : 'approved',
      checklist: { ptiCompliance: true, rightsCleared: true, attributionPresent: true, defamationScanOk: true },
    } };
    throw new Error(`Unexpected read: ${url}`);
  });
  mocks.put.mockImplementation(async (url, payload) => {
    if (url !== `articles/${STORY_ID}`) throw new Error('Unrelated article write');
    order.push('article');
    stored = { ...stored, ...Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) };
    return { data: { ok: true, article: { ...stored } } };
  });
  mocks.post.mockImplementation(async (url, payload) => {
    if (url === `articles/${STORY_ID}/publish`) {
      order.push('publish');
      publishedContent = { title: stored.title, content: stored.content };
      stored = { ...stored, status: 'published', publishedAt: stored.publishedAt || '2026-10-20T08:00:00.000Z' };
      return { data: { ok: true, article: { ...stored } } };
    }
    const topic = [availableTopic(), otherTopic()].find(item => url.startsWith(`admin/topics/${item.id}/stories/`));
    if (!topic || payload?.storyIds?.[0] !== STORY_ID) throw new Error(`Unexpected mutation: ${url}`);
    const action = url.endsWith('/attach') ? 'attach' : 'detach';
    order.push(`${action}:${topic.id}`);
    stored.tags = action === 'attach' ? [...new Set([...stored.tags || [], topic.membershipTag!])]
      : stored.tags?.filter(tag => tag !== topic.membershipTag);
    return { data: membershipResult(action, { topicId: topic.id }) };
  });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  vi.restoreAllMocks();
});

describe('Legacy publication and acknowledged-save recovery', () => {
  it('persists the current headline and body before Publish Now uses them', async () => {
    await open();
    editHeadline();
    fireEvent.change(screen.getByRole('textbox', { name: 'Legacy content' }), { target: { value: '<p>Current body awaiting publication.</p>' } });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('publish complete')));
    expect(publishedContent).toEqual({ title: 'Current headline awaiting publication', content: '<p>Current body awaiting publication.</p>' });
    expect(order).toEqual(['article', 'publish']);
    expect(mocks.put).toHaveBeenCalledTimes(1);
  });

  it('does not repeat an acknowledged article PUT when retrying a denied topic save', async () => {
    await open();
    editHeadline();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trending Topic: Navratri 2026' }));
    mocks.post.mockRejectedValueOnce({ response: { status: 403, data: {} } });
    submitSave();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('article was saved')));
    expect(mocks.put).toHaveBeenCalledTimes(1);
    submitSave();
    await screen.findByText('Returned to Manage News');
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(order).toEqual(['article', `attach:${TOPIC_ID}`]);
  });

  it.each([401, 403, 409, 503])('blocks publication and keeps local values after article-save HTTP %s', async status => {
    await open();
    editHeadline();
    mocks.put.mockRejectedValueOnce({ response: { status, data: {} } });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(publicationCalls()).toHaveLength(0);
    expect(stored.title).toBe(source.title);
    expect(screen.getByDisplayValue('Current headline awaiting publication')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Legacy content' })).toHaveValue(source.content);
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it.each([401, 403, 409])('retries only a rejected article save after authorized recovery from HTTP %s', async status => {
    await open();
    editHeadline();
    mocks.put.mockRejectedValueOnce({ response: { status, data: {} } });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    if (status === 409) await refresh();
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(publicationCalls()).toHaveLength(1));
    expect(mocks.put).toHaveBeenCalledTimes(2);
    expect(publishedContent?.title).toBe('Current headline awaiting publication');
  });

  it.each([401, 403, 409, 503])('retains the acknowledged article when publication returns HTTP %s', async status => {
    await open();
    editHeadline();
    mocks.post.mockRejectedValueOnce({ response: { status, data: {} } });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('remain committed')));
    expect(stored.title).toBe('Current headline awaiting publication');
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(publicationCalls()).toHaveLength(1);
    expect(stored.status).toBe('draft');
    if (status !== 503) {
      if (status === 409) await refresh();
      fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
      await waitFor(() => expect(stored.status).toBe('published'));
      expect(mocks.put).toHaveBeenCalledTimes(1);
      expect(publicationCalls()).toHaveLength(2);
    }
  });

  it.each(['network', 'unavailable response'])('verifies a committed source after an ambiguous %s without replaying its PUT', async failure => {
    await open();
    editHeadline();
    const put = mocks.put.getMockImplementation()!;
    mocks.put.mockImplementationOnce(async (url, payload) => {
      await put(url, payload);
      if (failure === 'network') throw { code: 'ERR_NETWORK', message: 'Connection interrupted' };
      return { data: null };
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await screen.findByRole('button', { name: 'Refresh latest state' });
    expect(publicationCalls()).toHaveLength(0);
    await refresh();
    expect(mocks.put).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(publicationCalls()).toHaveLength(1));
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(publishedContent?.title).toBe('Current headline awaiting publication');
  });

  it('does not infer failure or repeat an ambiguous PUT when the latest read still shows old content', async () => {
    await open();
    editHeadline();
    mocks.put.mockRejectedValueOnce({ response: { status: 503, data: {} } });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await screen.findByRole('button', { name: 'Refresh latest state' });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('No revision or request-status contract')));
    submitSave();
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(publicationCalls()).toHaveLength(0);
    expect(screen.getByDisplayValue('Current headline awaiting publication')).toBeInTheDocument();
  });

  it('does not overwrite remotely changed content while recovering an article conflict', async () => {
    await open();
    editHeadline();
    mocks.put.mockRejectedValueOnce({ response: { status: 409, data: {} } });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await screen.findByRole('button', { name: 'Refresh latest state' });
    stored = { ...stored, title: 'A different accepted remote edit' };
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Founder review is required')));
    expect(screen.getByDisplayValue('Current headline awaiting publication')).toBeInTheDocument();
    expect(stored.title).toBe('A different accepted remote edit');
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(publicationCalls()).toHaveLength(0);
  });

  it('keeps article-save follow-up warnings visible and stops all remaining operations until verification', async () => {
    await open();
    editHeadline();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trending Topic: Navratri 2026' }));
    const put = mocks.put.getMockImplementation()!;
    mocks.put.mockImplementationOnce(async (url, payload) => {
      await put(url, payload);
      return { data: { ok: true, committed: true, article: { ...stored }, postCommitWarnings: [{ code: 'FOLLOW_UP' }] } };
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await screen.findByText(/Article save committed\. The change was saved/);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.put).toHaveBeenCalledTimes(1);
    await refresh();
    expect(screen.getByText(/Article save committed\. The change was saved/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(publicationCalls()).toHaveLength(1));
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['article', `attach:${TOPIC_ID}`, 'publish']);
    expect(screen.getByText(/Article save committed\. The change was saved/)).toBeInTheDocument();
  });

  it('retries only the unfinished topic after an article and the first topic have committed', async () => {
    await open();
    editHeadline();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trending Topic: Navratri 2026' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trending Topic: Gujarat Festivals' }));
    const post = mocks.post.getMockImplementation()!;
    let failed = false;
    mocks.post.mockImplementation(async (url, payload) => {
      if (!failed && url.includes(OTHER_TOPIC_ID)) {
        failed = true;
        throw { response: { status: 403, data: {} } };
      }
      return post(url, payload);
    });
    submitSave();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('article was saved')));
    expect(order).toEqual(['article', `attach:${TOPIC_ID}`]);
    submitSave();
    await screen.findByText('Returned to Manage News');
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual([
      `admin/topics/${TOPIC_ID}/stories/attach`,
      `admin/topics/${OTHER_TOPIC_ID}/stories/attach`,
      `admin/topics/${OTHER_TOPIC_ID}/stories/attach`,
    ]);
  });

  it('verifies a lost topic acknowledgement instead of repeating its committed membership request', async () => {
    await open();
    editHeadline();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trending Topic: Navratri 2026' }));
    const post = mocks.post.getMockImplementation()!;
    mocks.post.mockImplementationOnce(async (url, payload) => {
      await post(url, payload);
      throw { response: { status: 503, data: {} } };
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await screen.findByRole('button', { name: 'Refresh latest state' });
    await refresh();
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(publicationCalls()).toHaveLength(1));
    expect(order).toEqual(['article', `attach:${TOPIC_ID}`, 'publish']);
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(mocks.put).toHaveBeenCalledTimes(1);
  });

  it('does not repeat an uncertain membership request based on an old unattached read', async () => {
    await open();
    editHeadline();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trending Topic: Navratri 2026' }));
    mocks.post.mockRejectedValueOnce({ response: { status: 503, data: {} } });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await screen.findByRole('button', { name: 'Refresh latest state' });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('topic request outcome is still uncertain')));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(publicationCalls()).toHaveLength(0);
  });

  it('stops at a committed topic warning and resumes only the remaining topic and publication', async () => {
    await open();
    editHeadline();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trending Topic: Navratri 2026' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trending Topic: Gujarat Festivals' }));
    const post = mocks.post.getMockImplementation()!;
    mocks.post.mockImplementationOnce(async (url, payload) => {
      await post(url, payload);
      return { data: membershipResult('attach', { revalidation: { ok: false } }) };
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await screen.findByRole('button', { name: 'Refresh latest state' });
    expect(order).toEqual(['article', `attach:${TOPIC_ID}`]);
    await refresh();
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(publicationCalls()).toHaveLength(1));
    expect(order).toEqual(['article', `attach:${TOPIC_ID}`, `attach:${OTHER_TOPIC_ID}`, 'publish']);
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/The change was saved, but a Backend follow-up failed/)).toBeInTheDocument();
  });

  it('keeps native and programmatic edits locked through delayed save and publication, duplicate clicks and navigation', async () => {
    const saveGate = deferred();
    const publishGate = deferred();
    const put = mocks.put.getMockImplementation()!;
    const post = mocks.post.getMockImplementation()!;
    mocks.put.mockImplementation(async (url, payload) => { await saveGate.promise; return put(url, payload); });
    mocks.post.mockImplementation(async (url, payload) => { await publishGate.promise; return post(url, payload); });
    await open();
    editHeadline();
    const richChange = mocks.richText!.onChange;
    const coverChange = mocks.cover!.onRemove;
    const selectTopic = mocks.selectTopic!;
    const publish = screen.getByRole('button', { name: /Publish Now/ });
    fireEvent.click(publish);
    await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
    expect(screen.getByDisplayValue('Current headline awaiting publication')).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Legacy content' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Legacy content' }).parentElement?.inert).toBe(true);
    act(() => {
      richChange('<p>Must not become accepted content.</p>');
      coverChange();
      selectTopic(TOPIC_ID, true);
      mocks.navigate?.('/manage-news');
    });
    editHeadline('Must not replace the locked headline');
    submitSave();
    fireEvent.click(publish);
    fireEvent.click(screen.getByRole('link', { name: 'Leave editor' }));
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    expect(window.confirm).not.toHaveBeenCalled();
    expect(screen.queryByText('Returned to Manage News')).not.toBeInTheDocument();
    expect(publicationCalls()).toHaveLength(0);
    await act(async () => { saveGate.resolve(); });
    await waitFor(() => expect(publicationCalls()).toHaveLength(1));
    expect(publish).toBeDisabled();
    act(() => richChange('<p>Still locked during publication.</p>'));
    expect(screen.getByRole('textbox', { name: 'Legacy content' })).toHaveValue(source.content);
    await act(async () => { publishGate.resolve(); });
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(expect.stringContaining('publish complete')));
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(publicationCalls()).toHaveLength(1);
    expect(publishedContent).toEqual({ title: 'Current headline awaiting publication', content: source.content });
    expect(stored.imageUrl).toBe(source.imageUrl);
    expect(stored.tags).toEqual(source.tags);
  });

  it.each(['permission', 'flag', 'actor'])('rechecks the %s after saving and stops before publication when it changes', async change => {
    const gate = deferred();
    const put = mocks.put.getMockImplementation()!;
    mocks.put.mockImplementation(async (url, payload) => { await gate.promise; return put(url, payload); });
    const { client, rerender } = await open();
    editHeadline();
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
    if (change === 'permission') {
      mocks.auth.user = { ...mocks.auth.user, role: 'editor', specialRights: [] };
      mocks.auth.isFounder = false;
    } else if (change === 'flag') mocks.publishEnabled = false;
    else mocks.auth.user = { ...mocks.auth.user, id: 'different-actor' };
    rerender(viewEditor(client));
    await act(async () => { gate.resolve(); });
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('remain committed')));
    expect(publicationCalls()).toHaveLength(0);
    expect(stored.title).toBe('Current headline awaiting publication');
    expect(mocks.put).toHaveBeenCalledTimes(1);
  });

  it('rechecks topic and publication authority between separate membership writes', async () => {
    const gate = deferred();
    const post = mocks.post.getMockImplementation()!;
    mocks.post.mockImplementationOnce(async (url, payload) => { await gate.promise; return post(url, payload); });
    const { client, rerender } = await open();
    editHeadline();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trending Topic: Navratri 2026' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Trending Topic: Gujarat Festivals' }));
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    mocks.auth.user = { ...mocks.auth.user, role: 'editor', specialRights: [] };
    mocks.auth.isFounder = false;
    rerender(viewEditor(client));
    await act(async () => { gate.resolve(); });
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('remain committed')));
    expect(order).toEqual(['article', `attach:${TOPIC_ID}`]);
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it('does not bind a late save or continue publication after the original editor unmounts', async () => {
    const gate = deferred();
    const put = mocks.put.getMockImplementation()!;
    mocks.put.mockImplementation(async (url, payload) => { await gate.promise; return put(url, payload); });
    const { unmount } = await open();
    editHeadline();
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
    unmount();
    const otherId = '000000000000000000000999';
    const get = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation(async (url, config) => {
      if (url === `articles/${otherId}`) return { data: { article: { ...source, _id: otherId, title: 'Unrelated opened story', translationGroupId: 'unrelated-group' } } };
      if (url === `/news/${otherId}/workflow`) return get(`/news/${STORY_ID}/workflow`, config);
      return get(url, config);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(client);
    render(viewEditor(client, otherId));
    await screen.findByDisplayValue('Unrelated opened story');
    await act(async () => { gate.resolve(); });
    await waitFor(() => expect(stored.title).toBe('Current headline awaiting publication'));
    expect(screen.getByDisplayValue('Unrelated opened story')).toBeInTheDocument();
    expect(publicationCalls()).toHaveLength(0);
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual([`articles/${STORY_ID}`]);
  });

  it.each([
    { _id: 'unrelated-story' }, { sourceNewsId: 'unrelated-story' },
    { translationGroupId: 'unrelated-group' }, { translationKey: 'unrelated-group' },
    { language: 'Hindi', lang: 'hi' },
  ])('does not use a contradictory save receipt %j for publication or a new save target', async patch => {
    await open();
    editHeadline();
    const put = mocks.put.getMockImplementation()!;
    mocks.put.mockImplementationOnce(async (url, payload) => {
      await put(url, payload);
      return { data: { ok: true, article: { ...stored, ...patch } } };
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await screen.findByRole('button', { name: 'Refresh latest state' });
    expect(publicationCalls()).toHaveLength(0);
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual([`articles/${STORY_ID}`]);
    await refresh();
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(publicationCalls()).toHaveLength(1));
    expect(publicationCalls()[0][0]).toBe(`articles/${STORY_ID}/publish`);
    expect(mocks.put).toHaveBeenCalledTimes(1);
  });

  it.each([['en', 'English'], ['hi', 'Hindi'], ['gu', 'Gujarati']])('preserves the %s identity, slug, media and publication chronology on an accepted legacy edit', async (lang, language) => {
    const publishedAt = '2026-01-15T10:00:00.000Z';
    stored = { ...stored, lang, language, status: 'published', publishedAt };
    await open(false);
    editHeadline();
    submitSave();
    await screen.findByText('Returned to Manage News');
    expect(stored).toMatchObject({ _id: STORY_ID, lang, language, status: 'published', publishedAt,
      slug: source.slug, translationGroupId: source.translationGroupId, imageUrl: source.imageUrl, tags: source.tags });
    const payload = mocks.put.mock.calls[0][1];
    for (const key of ['_id', 'sourceNewsId', 'slug', 'publishedAt', 'status', 'translationGroupId', 'tags']) {
      expect(payload).not.toHaveProperty(key);
    }
    expect(publicationCalls()).toHaveLength(0);
  });

  it('keeps the existing effective staff publication grant without enabling ordinary staff', async () => {
    mocks.auth.isFounder = false;
    mocks.auth.user = { ...mocks.auth.user, role: 'editor', specialRights: ['can_edit_news', 'can_publish_news'], newsPublishGrantRecorded: true };
    const { client, rerender } = await open();
    editHeadline();
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(publicationCalls()).toHaveLength(1));
    expect(publishedContent?.title).toBe('Current headline awaiting publication');
    mocks.auth.user = { ...mocks.auth.user, specialRights: [], newsPublishGrantRecorded: false };
    rerender(viewEditor(client));
    expect(screen.getByRole('button', { name: /Publish Now/ })).toBeDisabled();
  });

  it('prevents publication while an inline upload is pending, including direct save callbacks', async () => {
    await open();
    editHeadline();
    act(() => mocks.richText?.onPendingUploadChange?.(true));
    expect(screen.getByRole('button', { name: /Publish Now/ })).toBeDisabled();
    submitSave();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(publicationCalls()).toHaveLength(0);
    act(() => mocks.richText?.onPendingUploadChange?.(false));
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(publicationCalls()).toHaveLength(1));
  });

  it('verifies an accepted publication after its response is lost without publishing again', async () => {
    await open();
    editHeadline();
    const post = mocks.post.getMockImplementation()!;
    mocks.post.mockImplementationOnce(async (url, payload) => {
      await post(url, payload);
      throw { code: 'ERR_NETWORK', message: 'Connection interrupted' };
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await screen.findByRole('button', { name: 'Refresh latest state' });
    await refresh();
    expect(screen.getByRole('button', { name: /Publish Now/ })).toBeDisabled();
    expect(publicationCalls()).toHaveLength(1);
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(stored.status).toBe('published');
  });

  it('keeps a failed or stale post-publication workflow read from unlocking a committed publication', async () => {
    await open();
    editHeadline();
    const get = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation(async (url, config) => {
      if (url.endsWith('/workflow')) throw { response: { status: 503, data: {} } };
      return get(url, config);
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Published, but')));
    expect(screen.getByRole('button', { name: /Publish Now/ })).toBeDisabled();
    expect(publicationCalls()).toHaveLength(1);
    mocks.get.mockImplementation(async (url, config) => {
      if (url.endsWith('/workflow')) return { data: {
        status: 'draft', stage: 'approved',
        checklist: { ptiCompliance: true, rightsCleared: true, attributionPresent: true, defamationScanOk: true },
      } };
      return get(url, config);
    });
    await refresh();
    expect(screen.getByRole('button', { name: /Publish Now/ })).toBeDisabled();
    expect(publicationCalls()).toHaveLength(1);
  });

  it.each([401, 403, 409, 503])('keeps recovery paused when verification returns HTTP %s, without extra writes', async status => {
    await open();
    editHeadline();
    mocks.put.mockRejectedValueOnce({ response: { status: 503, data: {} } });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    const verify = await screen.findByRole('button', { name: 'Refresh latest state' });
    mocks.get.mockRejectedValueOnce({ response: { status, data: {} } });
    const errors = mocks.error.mock.calls.length;
    fireEvent.click(verify);
    await waitFor(() => expect(mocks.error.mock.calls.length).toBeGreaterThan(errors));
    expect(verify).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publish Now/ })).toBeDisabled();
    expect(screen.getByDisplayValue('Current headline awaiting publication')).toBeInTheDocument();
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(publicationCalls()).toHaveLength(0);
  });

  it.each([false, true])('does not publish using an old text receipt, including when the write actually committed (%s)', async committed => {
    await open();
    editHeadline();
    const put = mocks.put.getMockImplementation()!;
    mocks.put.mockImplementationOnce(async (url, payload) => {
      if (committed) await put(url, payload);
      return { data: { ok: true, article: { ...source } } };
    });
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await screen.findByRole('button', { name: 'Refresh latest state' });
    expect(publicationCalls()).toHaveLength(0);
    expect(screen.getByText(/The article save was acknowledged, but its returned state/)).toBeInTheDocument();
    if (committed) {
      await refresh();
      fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
      await waitFor(() => expect(publicationCalls()).toHaveLength(1));
      expect(publishedContent?.title).toBe('Current headline awaiting publication');
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state' }));
      await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Founder review is required')));
      expect(publicationCalls()).toHaveLength(0);
    }
    expect(mocks.put).toHaveBeenCalledTimes(1);
  });

  it('does not cache a contradictory Draft publication receipt as a completed publication', async () => {
    const { client } = await open();
    editHeadline();
    mocks.post.mockImplementationOnce(async () => ({ data: { ok: true, article: { ...stored, status: 'draft' } } }));
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await screen.findByRole('button', { name: 'Refresh latest state' });
    expect(mocks.success).not.toHaveBeenCalledWith(expect.stringContaining('publish complete'));
    expect(client.getQueryData(['articles', 'one', STORY_ID])).toBeUndefined();
    expect(publicationCalls()).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Publish Now/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Publication outcome is still uncertain')));
    expect(publicationCalls()).toHaveLength(1);
  });

  it('waits for an accepted cover upload and persists that media before publication', async () => {
    const gate = deferred();
    mocks.upload.mockImplementation(async () => {
      await gate.promise;
      return { url: '/uploaded-cover.jpg', publicId: 'uploaded-cover' };
    });
    await open();
    const file = new File(['synthetic image'], 'cover.jpg', { type: 'image/jpeg' });
    act(() => mocks.cover?.onChangeFile(file));
    expect(screen.getByRole('button', { name: /Publish Now/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    expect(mocks.put).not.toHaveBeenCalled();
    expect(publicationCalls()).toHaveLength(0);
    await act(async () => { gate.resolve(); });
    await waitFor(() => expect(screen.getByRole('button', { name: /Publish Now/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(publicationCalls()).toHaveLength(1));
    expect(mocks.put.mock.calls[0][1]).toMatchObject({
      imageUrl: '/uploaded-cover.jpg', coverImage: { url: '/uploaded-cover.jpg', publicId: 'uploaded-cover' },
    });
    expect(order).toEqual(['article', 'publish']);
  });

  it('serializes a delayed AI summary and saves its accepted value before publication', async () => {
    const gate = deferred();
    const post = mocks.post.getMockImplementation()!;
    mocks.post.mockImplementation(async (url, payload) => {
      if (url === 'ai/summarize') {
        await gate.promise;
        return { data: { summary: 'New accepted summary' } };
      }
      return post(url, payload);
    });
    await open();
    fireEvent.click(screen.getByRole('button', { name: /Auto-Summarize/ }));
    expect(screen.getByRole('button', { name: /Publish Now/ })).toBeDisabled();
    submitSave();
    expect(mocks.put).not.toHaveBeenCalled();
    await act(async () => { gate.resolve(); });
    await screen.findByDisplayValue('New accepted summary');
    fireEvent.click(screen.getByRole('button', { name: /Publish Now/ }));
    await waitFor(() => expect(publicationCalls()).toHaveLength(1));
    expect(mocks.put.mock.calls[0][1].summary).toBe('New accepted summary');
  });
});

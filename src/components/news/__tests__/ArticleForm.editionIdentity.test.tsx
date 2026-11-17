import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article } from '@/lib/api/articles';
import { backendTranslationStatus, editionLanguages } from '@/tests/articleEditionFixtures';
import { ArticleForm } from '../ArticleForm';
import ArticleEditPage from '@/pages/ArticleEditPage';

type GenerationPayload = { targetLanguages: Array<'en' | 'hi' | 'gu'>; overwrite: false };
type NewStoryGenerationPayload = { languages: string[] };

const mocks = vi.hoisted(() => ({
  role: 'founder',
  modules: ['manage_news'],
  specialRights: [] as string[],
  get: vi.fn<(url: string) => Promise<{ data: unknown }>>(),
  put: vi.fn<(url: string, payload: Partial<Article>) => Promise<{ data: unknown }>>(),
  post: vi.fn<(url: string, payload?: Partial<Article> | GenerationPayload | NewStoryGenerationPayload) => Promise<{ data: unknown }>>(),
  upload: vi.fn<(file: File) => Promise<{ url: string; publicId?: string }>>(),
  libraryUrl: 'https://images.example.test/reviewed-cover.jpg',
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: { get: mocks.get, put: mocks.put, post: mocks.post } }));
vi.mock('@/lib/http', () => ({ api: vi.fn() }));
vi.mock('@context/AuthContext', () => ({ useAuth: () => ({
  isAuthenticated: true, isReady: true, isLoading: false, isRestoring: false,
  user: { id: 'founder-test', role: mocks.role, moduleAccess: mocks.modules, specialRights: mocks.specialRights },
}) }));
vi.mock('@/hooks/useAdminEffectiveAccess', async importOriginal => ({
  ...await importOriginal<typeof import('@/hooks/useAdminEffectiveAccess')>(),
  useAdminEffectiveAccess: () => ({
  isLoading: false, error: null, backendAccess: {},
  modulePolicy: {
    manage_news: { moduleKey: 'manage_news', state: 'available' },
    add_news: { moduleKey: 'add_news', state: 'available' },
    draft_desk: { moduleKey: 'draft_desk', state: 'available' },
  },
}) }));
vi.mock('@/hooks/useTrendingTopicsAccess', () => ({
  useTrendingTopicsAccess: () => ({ canRead: true, canEdit: true, isFounder: true, loading: false, reason: '' }),
}));
vi.mock('@/lib/api/trendingTopics', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/api/trendingTopics')>(),
  loadAvailableTopics: vi.fn(async () => ({ items: [] })),
}));
vi.mock('@/context/PublishFlagContext', () => ({ usePublishFlag: () => ({ publishEnabled: true }) }));
vi.mock('@/lib/api', () => ({ default: { get: vi.fn(async () => ({ data: ['en', 'hi', 'gu'] })) } }));
vi.mock('@/lib/api/media', () => ({
  getMediaStatus: vi.fn(async () => ({ ok: true, uploadEnabled: true })), uploadCoverImage: mocks.upload,
}));
vi.mock('@/lib/api/language', () => ({ verifyLanguage: vi.fn(), readability: vi.fn() }));
vi.mock('@/lib/slugAvailability', () => ({
  buildSlugSuggestions: vi.fn(() => []), checkSlugAvailability: vi.fn(async () => ({ available: true })),
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: mocks.success, error: mocks.error }) }));
vi.mock('@/components/editor/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Story content" value={value} onChange={event => onChange(event.target.value)} />
  ),
}));
vi.mock('@/components/articles/CoverImageUpload', () => ({
  default: ({ url, onChooseFromLibrary, onRemove, onChangeFile }: {
    url: string; onChooseFromLibrary: () => void; onRemove: () => void; onChangeFile: (file: File | null) => void;
  }) => (
    <div>
      <output data-testid="cover-url">{url}</output>
      <button type="button" onClick={onChooseFromLibrary}>Choose test cover</button>
      <button type="button" onClick={onRemove}>Remove test cover</button>
      <input type="file" aria-label="Test cover file" onChange={event => onChangeFile(event.target.files?.[0] || null)} />
    </div>
  ),
}));
vi.mock('@/components/media/MediaLibrarySelector', () => ({
  default: ({ open, onSelect }: { open: boolean; onSelect: (asset: { id: string; url: string }) => void }) => open ? (
    <button type="button" onClick={() => onSelect({ id: 'library-item-not-an-asset-public-id', url: mocks.libraryUrl })}>Use test cover</button>
  ) : null,
}));
vi.mock('@/components/preview/PreviewModal', () => ({ default: () => null }));
vi.mock('@/components/ui/ConfirmModal', () => ({ default: () => null }));
vi.mock('@/components/news/PulseDialogueDetailsSection', () => ({ default: () => null }));
vi.mock('@/components/analytics/ArticleAnalyticsPanel', () => ({ ArticleAnalyticsPanel: () => null }));

const source: Article = {
  _id: 'story-a-en', title: 'Story A source', slug: 'story-a-source',
  summary: 'An existing summary.', content: 'Existing source article content for editorial testing.',
  category: 'national', language: 'en', lang: 'en', status: 'published',
  translationGroupId: 'group-a', sourceLanguage: 'en', tags: [],
  publishedAt: '2026-01-15T10:00:00.000Z', imageUrl: 'https://images.example.test/original.jpg',
};
let records: Record<string, Article>;
let perLang: Record<string, unknown>;
let lookupFailure: unknown;
const clients: QueryClient[] = [];
const missingEdition = { present: false, presence: 'missing', articleId: null, childArticleId: null };

function markMissing(...languages: Array<'en' | 'hi' | 'gu'>) {
  for (const language of languages) {
    perLang[language] = { ...missingEdition };
    delete records[`story-a-${language}`];
  }
}

function completeGeneration() {
  const post = mocks.post.getMockImplementation()!;
  mocks.post.mockImplementation(async (url, payload) => {
    if (!url.endsWith('/translations/generate')) return post(url, payload);
    if (!payload || !('targetLanguages' in payload) || payload.overwrite !== false) throw new Error('Unsafe generation payload');
    const sourceId = decodeURIComponent(url.slice('articles/'.length, -'/translations/generate'.length));
    if (!records[sourceId]) throw new Error('Unexpected generation source');
    for (const code of payload.targetLanguages) {
      const id = `story-a-${code}`;
      if (records[id]) throw new Error('Attempted to overwrite an existing edition');
      records[id] = {
        ...records[sourceId], _id: id, title: `Generated ${code} draft`, slug: `generated-${code}`,
        language: code, lang: code, status: 'draft', publishedAt: undefined, sourceNewsId: undefined,
      };
      perLang[code] = { present: true, presence: 'present', articleId: id, childArticleId: id, status: 'ready' };
    }
    return { data: { ok: true } };
  });
}

function input(label: string, tag: 'input' | 'select') {
  const control = screen.getByText(label).parentElement?.querySelector(tag);
  if (!control) throw new Error(`${label} control not found`);
  return control;
}

function editor(client: QueryClient, article: Article) {
  return <QueryClientProvider client={client}><MemoryRouter>
    <ArticleForm mode="edit" id={article._id} initialValues={article} />
  </MemoryRouter></QueryClientProvider>;
}

async function open(expectedEditions = 3, article = records[source._id]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: 3 } } });
  clients.push(client);
  const rendered = render(editor(client, article));
  await screen.findByText('No Trending Topics are available.');
  await waitFor(() => expect(client.getQueryState(['articles', 'translationEditions', article.sourceNewsId || article._id])?.fetchStatus).toBe('idle'));
  expect(screen.queryAllByTitle('Open this language variant')).toHaveLength(expectedEditions);
  return { client, ...rendered };
}

function configureNewStory() {
  const post = mocks.post.getMockImplementation()!;
  mocks.post.mockImplementation(async (url, payload) => {
    if (url === 'articles') {
      if (!payload || !('lang' in payload) || !payload.lang) throw new Error('Missing source language');
      const id = `created-${payload.lang}`;
      if (records[id]) throw new Error('Attempted to create the source twice');
      records[id] = { _id: id, title: '', ...payload, sourceLanguage: payload.lang };
      perLang = Object.fromEntries(['en', 'hi', 'gu'].map(code => [
        code, code === payload.lang ? { articleId: id } : { ...missingEdition },
      ]));
      return { data: { ok: true, article: { ...records[id] } } };
    }
    if (url.includes('/created-') && url.endsWith('/translations/generate')) {
      if (!payload) throw new Error('Missing generation payload');
      const normal = url.startsWith('admin/articles/');
      const languages = 'languages' in payload ? payload.languages : 'targetLanguages' in payload ? payload.targetLanguages : [];
      if (!normal && (!('overwrite' in payload) || payload.overwrite !== false)) throw new Error('Unsafe recovery payload');
      const sourceId = decodeURIComponent(url.slice(normal ? 'admin/articles/'.length : 'articles/'.length, -'/translations/generate'.length));
      const saved = records[sourceId];
      if (!saved) throw new Error('Unexpected generation source');
      for (const code of languages) {
        const id = `created-${code}`;
        if (records[id]) throw new Error('Attempted to overwrite an edition');
        records[id] = { ...saved, _id: id, title: `Generated ${code}`, slug: `created-${code}`, lang: code, language: code, status: 'draft' };
        perLang[code] = { articleId: id, childArticleId: id, present: true, presence: 'present' };
      }
      return { data: { ok: true } };
    }
    return post(url, payload);
  });
}

function creator(client: QueryClient) {
  return <QueryClientProvider client={client}><MemoryRouter><ArticleForm mode="create" /></MemoryRouter></QueryClientProvider>;
}

async function openNewStory(language: 'en' | 'hi' | 'gu' = 'gu') {
  window.history.replaceState({}, '', '/add');
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: 3 } } });
  clients.push(client);
  const rendered = render(creator(client));
  await screen.findByText('No Trending Topics are available.');
  fireEvent.change(input('Language', 'select'), { target: { value: language } });
  fireEvent.change(input('Title', 'input'), { target: { value: `New ${language} source` } });
  fireEvent.change(input('Category', 'select'), { target: { value: 'national' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Story content' }), {
    target: { value: 'A new source article with enough editorial content for translation and review.' },
  });
  await waitFor(() => expect(input('Language', 'select')).toHaveValue(language));
  return { client, ...rendered };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.role = 'founder';
  mocks.modules = ['manage_news'];
  mocks.specialRights = [];
  mocks.libraryUrl = 'https://images.example.test/reviewed-cover.jpg';
  lookupFailure = null;
  records = { [source._id]: { ...source } };
  for (const language of ['hi', 'gu']) {
    records[`story-a-${language}`] = {
      ...source, _id: `story-a-${language}`, title: `Story A ${language}`, slug: `story-a-${language}`, language, lang: language,
    };
    records[`unrelated-${language}`] = {
      ...source, _id: `unrelated-${language}`, title: `Unrelated ${language}`, slug: `unrelated-${language}`,
      language, lang: language, translationGroupId: 'unrelated-group',
    };
  }
  perLang = { en: { articleId: 'story-a-en' }, hi: { articleId: 'story-a-hi' }, gu: { articleId: 'story-a-gu' } };
  mocks.get.mockImplementation(async url => {
    if (url.endsWith('/translation-status')) {
      if (lookupFailure) throw lookupFailure;
      return { data: { data: { perLang } } };
    }
    if (url === 'articles') {
      const rows = ['unrelated-hi', 'unrelated-gu', 'story-a-en', 'story-a-hi', 'story-a-gu'].map(id => ({ ...records[id] }));
      return { data: { rows, total: rows.length, page: 1, pages: 1 } };
    }
    const id = decodeURIComponent(url.slice('articles/'.length));
    if (!records[id]) throw { response: { status: 404, data: {} } };
    return { data: { article: { ...records[id] } } };
  });
  mocks.put.mockImplementation(async (url, payload) => {
    const id = decodeURIComponent(url.slice('articles/'.length));
    if (!records[id]) throw new Error('Unexpected mutation target');
    records[id] = { ...records[id], ...Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)) };
    return { data: { ok: true, article: { ...records[id] } } };
  });
  mocks.post.mockImplementation(async url => {
    if (url.endsWith('/publish')) {
      const id = decodeURIComponent(url.slice('articles/'.length, -'/publish'.length));
      records[id] = { ...records[id], status: 'published' };
      return { data: { article: { ...records[id] }, publishedLanguages: ['en', 'hi', 'gu'] } };
    }
    return { data: { ok: true } };
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  clients.splice(0).forEach(client => client.clear());
  vi.restoreAllMocks();
});

describe('Published article cover intent', () => {
  function configureBackendStory(status: 'draft' | 'scheduled' | 'published' = 'published') {
    records = Object.fromEntries(editionLanguages.map(language => [`story-a-${language}`, {
      ...source, status, _id: `story-a-${language}`, title: `Reviewed ${language} headline`, slug: `stored-${language}-slug`,
      content: `Manually reviewed ${language} content that must not be regenerated or replaced by another edition.`,
      summary: `Manually reviewed ${language} summary.`,
      language, lang: language, originalLang: language, sourceLanguage: 'gu', sourceArticleId: 'story-a-gu',
      translationKey: 'group-a', machineGenerated: language !== 'gu', humanEdited: true,
      publishedAt: `2026-01-${language === 'en' ? '15' : language === 'hi' ? '16' : '17'}T10:00:00.000Z`,
      imageUrl: `https://images.example.test/${language}.jpg`,
      imageURL: `https://images.example.test/${language}.jpg`,
      coverImageUrl: `https://images.example.test/${language}.jpg`,
      coverImage: { url: `https://images.example.test/${language}.jpg`, publicId: `cover-${language}` },
    }]));
    mocks.get.mockImplementation(async url => {
      const suffix = '/translation-status';
      const id = url.slice('articles/'.length, url.endsWith(suffix) ? -suffix.length : undefined);
      const article = records[id];
      if (!article) throw new Error('Unexpected article read');
      if (url.endsWith(suffix)) {
        if (lookupFailure) throw lookupFailure;
        return { data: backendTranslationStatus(article, Object.values(records)) };
      }
      return { data: {
        ok: true, success: true, article: { ...article }, data: { article: { ...article } },
        translationGroupStatus: backendTranslationStatus(article, Object.values(records)).data.languageStates,
      } };
    });
    mocks.put.mockImplementation(async (url, payload) => {
      const id = url.slice('articles/'.length);
      const current = records[id];
      if (!current) throw new Error('Unexpected CMS mutation target');
      const { removeCoverImage, ...wire }: Partial<Article> & { removeCoverImage?: true } = JSON.parse(JSON.stringify(payload));
      const oldCover = typeof current.coverImage === 'object' ? current.coverImage : undefined;
      const oldUrl = oldCover?.url || current.coverImageUrl || current.imageUrl;
      records[id] = { ...current, ...wire };
      if (removeCoverImage || wire.coverImage && typeof wire.coverImage === 'object') {
        const cover = !removeCoverImage && typeof wire.coverImage === 'object' ? { ...oldCover, ...wire.coverImage } : undefined;
        const imageFields = { coverImage: cover, imageUrl: cover?.url, imageURL: cover?.url, coverImageUrl: cover?.url };
        Object.assign(records[id], imageFields);
        for (const sibling of Object.values(records).filter(row => row._id !== current._id)) {
          const siblingUrl = typeof sibling.coverImage === 'object' ? sibling.coverImage.url : sibling.coverImageUrl || sibling.imageUrl;
          if (!siblingUrl || siblingUrl === oldUrl) {
            Object.assign(sibling, { ...imageFields, coverImage: cover ? { ...cover } : undefined });
          }
        }
      }
      return { data: { ok: true, success: true, article: { ...records[id] }, data: { article: { ...records[id] } } } };
    });
  }

  it.each(editionLanguages)('cover intent: keeps the published %s cover and article fields unchanged through Save Update and reload', async language => {
    configureBackendStory();
    const id = `story-a-${language}`;
    const before = structuredClone(records);
    const mounted = await open(3, records[id]);
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith(`articles/${id}`, expect.any(Object));
    const wire: Partial<Article> = JSON.parse(JSON.stringify(mocks.put.mock.calls[0][1]));
    for (const field of ['removeCoverImage', 'coverImage', 'coverImageUrl', 'imageUrl', 'imageURL', 'status', 'publishedAt', 'publishAt', 'scheduledAt']) {
      expect(wire).not.toHaveProperty(field);
    }
    expect(records[id]).toMatchObject(before[id]);
    expect(Object.keys(records)).toEqual(Object.keys(before));
    for (const other of editionLanguages.filter(code => code !== language)) {
      expect(records[`story-a-${other}`]).toEqual(before[`story-a-${other}`]);
    }
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    mounted.unmount();
    await open(3, records[id]);
    expect(screen.getByTestId('cover-url')).toHaveTextContent(before[id].coverImageUrl!);
    expect(input('Title', 'input')).toHaveValue(before[id].title);
    expect(screen.getByRole('textbox', { name: 'Story content' })).toHaveValue(before[id].content);
    expect(input('Language', 'select')).toHaveValue(language);
  });

  it('cover intent: does not infer removal from an unchanged empty cover', async () => {
    configureBackendStory();
    const id = 'story-a-hi';
    for (const field of ['coverImage', 'coverImageUrl', 'imageUrl', 'imageURL'] as const) delete records[id][field];
    await open(3, records[id]);
    expect(screen.getByTestId('cover-url')).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith(`articles/${id}`, expect.any(Object));
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('removeCoverImage');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(editionLanguages)('cover intent: removes the published %s cover explicitly without an upload or changes to article fields and editions', async language => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    configureBackendStory();
    const id = `story-a-${language}`;
    const before = structuredClone(records);
    const mounted = await open(3, records[id]);
    fireEvent.click(screen.getByText('Remove test cover'));
    expect(screen.getByTestId('cover-url')).toBeEmptyDOMElement();
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(records).toEqual(before);
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('Article updated');
      expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled();
    });
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith(`articles/${id}`, expect.objectContaining({ removeCoverImage: true }));
    const wire: Partial<Article> = JSON.parse(JSON.stringify(mocks.put.mock.calls[0][1]));
    for (const field of ['coverImage', 'coverImageUrl', 'imageUrl', 'imageURL', 'status', 'publishedAt', 'publishAt', 'scheduledAt']) {
      expect(wire).not.toHaveProperty(field);
    }
    expect(records[id]).toMatchObject({
      ...before[id], coverImage: undefined, coverImageUrl: undefined, imageUrl: undefined, imageURL: undefined,
    });
    expect(Object.keys(records)).toEqual(Object.keys(before));
    for (const other of editionLanguages.filter(code => code !== language)) {
      expect(records[`story-a-${other}`]).toEqual(before[`story-a-${other}`]);
    }
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(mocks.put).toHaveBeenCalledTimes(1);
    fireEvent.change(input('Title', 'input'), { target: { value: 'Text-only approved change' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledTimes(2));
    expect(mocks.put).toHaveBeenCalledTimes(2);
    expect(mocks.put.mock.calls[1][1]).not.toHaveProperty('removeCoverImage');
    expect(mocks.put.mock.calls[1][1]).not.toHaveProperty('coverImage');
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    mounted.unmount();
    await open(3, records[id]);
    expect(screen.getByTestId('cover-url')).toBeEmptyDOMElement();
    expect(input('Title', 'input')).toHaveValue('Text-only approved change');
    expect(screen.getByRole('textbox', { name: 'Story content' })).toHaveValue(before[id].content);
    expect(input('Language', 'select')).toHaveValue(language);
  });

  it.each(editionLanguages)('cover intent: replaces only the published %s cover while preserving content, URL, chronology and editions', async language => {
    configureBackendStory();
    const id = `story-a-${language}`;
    const before = structuredClone(records);
    const mounted = await open(3, records[id]);
    const file = new File(['synthetic image'], 'reviewed.jpg', { type: 'image/jpeg' });
    const replacement = { url: 'https://images.example.test/uploaded.jpg', publicId: 'uploaded-asset' };
    mocks.upload.mockResolvedValueOnce(replacement);
    fireEvent.change(screen.getByLabelText('Test cover file'), { target: { files: [file] } });
    await waitFor(() => expect(screen.getByTestId('cover-url')).toHaveTextContent(replacement.url));
    expect(mocks.upload).toHaveBeenCalledExactlyOnceWith(file);
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith(`articles/${id}`, expect.objectContaining({
      coverImage: replacement, imageUrl: replacement.url, coverImageUrl: replacement.url,
    }));
    const wire: Partial<Article> = JSON.parse(JSON.stringify(mocks.put.mock.calls[0][1]));
    for (const field of ['removeCoverImage', 'status', 'publishedAt', 'publishAt', 'scheduledAt']) expect(wire).not.toHaveProperty(field);
    expect(records[id]).toMatchObject({
      ...before[id], coverImage: replacement, imageUrl: replacement.url, imageURL: replacement.url, coverImageUrl: replacement.url,
    });
    expect(Object.keys(records)).toEqual(Object.keys(before));
    for (const other of editionLanguages.filter(code => code !== language)) {
      expect(records[`story-a-${other}`]).toEqual(before[`story-a-${other}`]);
    }
    expect(mocks.post).not.toHaveBeenCalled();
    mounted.unmount();
    await open(3, records[id]);
    expect(screen.getByTestId('cover-url')).toHaveTextContent(replacement.url);
    expect(input('Title', 'input')).toHaveValue(before[id].title);
    expect(screen.getByRole('textbox', { name: 'Story content' })).toHaveValue(before[id].content);
    expect(input('Language', 'select')).toHaveValue(language);
  });

  it.each(['Library', 'upload'] as const)('cover intent: a %s replacement cancels an unsaved removal, even with the original URL', async choice => {
    configureBackendStory();
    const id = 'story-a-hi';
    const before = structuredClone(records);
    await open(3, records[id]);
    fireEvent.click(screen.getByText('Remove test cover'));
    expect(screen.getByTestId('cover-url')).toBeEmptyDOMElement();
    mocks.libraryUrl = before[id].coverImageUrl!;
    if (choice === 'Library') {
      fireEvent.click(screen.getByText('Choose test cover'));
      fireEvent.click(screen.getByText('Use test cover'));
    } else {
      mocks.upload.mockResolvedValueOnce({ url: mocks.libraryUrl, publicId: 'replacement-asset' });
      fireEvent.change(screen.getByLabelText('Test cover file'), {
        target: { files: [new File(['synthetic'], 'replacement.jpg', { type: 'image/jpeg' })] },
      });
    }
    await waitFor(() => expect(screen.getByTestId('cover-url')).toHaveTextContent(mocks.libraryUrl));
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('Article updated');
      expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled();
    });
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith(`articles/${id}`, expect.objectContaining({
      coverImage: { url: mocks.libraryUrl, publicId: choice === 'Library' ? null : 'replacement-asset' },
    }));
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('removeCoverImage');
    expect(JSON.stringify(mocks.put.mock.calls[0][1])).not.toContain('library-item-not-an-asset-public-id');
    expect(records['story-a-gu']).toEqual(before['story-a-gu']);
    expect(records['story-a-en']).toEqual(before['story-a-en']);
    fireEvent.change(input('Title', 'input'), { target: { value: 'Later text-only edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success.mock.calls.filter(([message]) => message === 'Article updated')).toHaveLength(2));
    expect(mocks.put.mock.calls[1][1]).not.toHaveProperty('coverImage');
    expect(mocks.put.mock.calls[1][1]).not.toHaveProperty('removeCoverImage');
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(['remove', 'replace'] as const)('cover intent: keeps pending %s scoped to its edition across another edition save', async choice => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    configureBackendStory();
    const before = structuredClone(records);
    await open(3, records['story-a-gu']);
    if (choice === 'remove') fireEvent.click(screen.getByText('Remove test cover'));
    else {
      fireEvent.click(screen.getByText('Choose test cover'));
      fireEvent.click(screen.getByText('Use test cover'));
    }
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    expect(screen.getByTestId('cover-url')).toHaveTextContent(before['story-a-hi'].coverImageUrl!);
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('Article updated');
      expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled();
    });
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith('articles/story-a-hi', expect.any(Object));
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('removeCoverImage');
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('coverImage');
    expect(records['story-a-gu']).toEqual(before['story-a-gu']);
    fireEvent.change(input('Language', 'select'), { target: { value: 'gu' } });
    if (choice === 'remove') expect(screen.getByTestId('cover-url')).toBeEmptyDOMElement();
    else expect(screen.getByTestId('cover-url')).toHaveTextContent(mocks.libraryUrl);
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success.mock.calls.filter(([message]) => message === 'Article updated')).toHaveLength(2));
    expect(mocks.put.mock.calls[1]).toEqual(['articles/story-a-gu', expect.objectContaining(choice === 'remove'
      ? { removeCoverImage: true } : { coverImage: { url: mocks.libraryUrl, publicId: null } })]);
    expect(records['story-a-hi']).toMatchObject(before['story-a-hi']);
    expect(records['story-a-en']).toEqual(before['story-a-en']);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('cover intent: explicit removal supersedes an unfinished replacement upload', async () => {
    configureBackendStory();
    await open(3, records['story-a-hi']);
    let finish!: (value: { url: string; publicId: string }) => void;
    mocks.upload.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    fireEvent.change(screen.getByLabelText('Test cover file'), {
      target: { files: [new File(['synthetic'], 'late.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.click(screen.getByText('Remove test cover'));
    await act(async () => { finish({ url: mocks.libraryUrl, publicId: 'late-upload' }); });
    expect(screen.getByTestId('cover-url')).toBeEmptyDOMElement();
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith('articles/story-a-hi', expect.objectContaining({ removeCoverImage: true }));
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('coverImage');
    expect(records['story-a-hi'].coverImage).toBeUndefined();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('cover intent: an older removal acknowledgement does not consume a newer replacement', async () => {
    configureBackendStory();
    await open(3, records['story-a-hi']);
    fireEvent.click(screen.getByText('Remove test cover'));
    const put = mocks.put.getMockImplementation()!;
    let finish!: () => void;
    mocks.put.mockImplementationOnce((url, payload) => new Promise(resolve => { finish = () => resolve(put(url, payload)); }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(finish).toBeDefined());
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    await act(async () => { finish(); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled());
    expect(records['story-a-hi'].coverImage).toBeUndefined();
    expect(screen.getByTestId('cover-url')).toHaveTextContent(mocks.libraryUrl);
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success.mock.calls.filter(([message]) => message === 'Article updated')).toHaveLength(2));
    expect(mocks.put.mock.calls[0][1]).toHaveProperty('removeCoverImage', true);
    expect(mocks.put.mock.calls[1][1]).not.toHaveProperty('removeCoverImage');
    expect(records['story-a-hi'].coverImage).toEqual({ url: mocks.libraryUrl, publicId: null });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('cover intent: reports failed removal without changing stored content or automatically retrying', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    configureBackendStory();
    const before = structuredClone(records);
    await open(3, records['story-a-hi']);
    fireEvent.click(screen.getByText('Remove test cover'));
    mocks.put.mockRejectedValueOnce({ response: { status: 503, data: {} } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Backend is temporarily unavailable')));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(records).toEqual(before);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith('articles/story-a-hi', expect.objectContaining({ removeCoverImage: true }));
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put.mock.calls[1][1]).not.toHaveProperty('removeCoverImage');
    expect(records['story-a-hi'].coverImage).toEqual({ url: mocks.libraryUrl, publicId: null });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(['editor', 'admin'])('cover intent: does not grant %s staff removal but preserves their existing replacement access', async role => {
    mocks.role = role;
    mocks.specialRights = ['news_edit'];
    configureBackendStory();
    const before = structuredClone(records);
    await open(3, records['story-a-hi']);
    fireEvent.click(screen.getByText('Remove test cover'));
    expect(screen.getByTestId('cover-url')).toHaveTextContent(before['story-a-hi'].coverImageUrl!);
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Only Founder'));
    expect(records).toEqual(before);
    expect(mocks.put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith('articles/story-a-hi', expect.objectContaining({
      coverImage: { url: mocks.libraryUrl, publicId: null },
    }));
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('removeCoverImage');
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(['draft', 'scheduled'] as const)('cover intent: keeps an existing %s cover when Founder attempts removal', async status => {
    configureBackendStory(status);
    const before = structuredClone(records);
    await open(3, records['story-a-hi']);
    fireEvent.click(screen.getByText('Remove test cover'));
    expect(screen.getByTestId('cover-url')).toHaveTextContent(before['story-a-hi'].coverImageUrl!);
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('only for existing published articles'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('removeCoverImage');
    expect(records['story-a-hi']).toMatchObject(before['story-a-hi']);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('cover intent: rechecks published status before sending a pending removal', async () => {
    configureBackendStory();
    await open(3, records['story-a-hi']);
    fireEvent.click(screen.getByText('Remove test cover'));
    records['story-a-hi'].status = 'draft';
    const before = structuredClone(records);
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('only for existing published articles')));
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(records).toEqual(before);
  });

  it('cover intent: rechecks Founder access before sending a pending removal', async () => {
    configureBackendStory();
    const before = structuredClone(records);
    const { client, rerender } = await open(3, records['story-a-hi']);
    fireEvent.click(screen.getByText('Remove test cover'));
    mocks.role = 'editor';
    mocks.specialRights = ['news_edit'];
    rerender(editor(client, records['story-a-hi']));
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Only Founder')));
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(records).toEqual(before);
  });

  it.each(['Library', 'upload'] as const)('secondary cover: preserves the existing %s replacement path in a multi-edition draft save', async choice => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    configureBackendStory('draft');
    const before = structuredClone(records);
    await open(3, records['story-a-gu']);
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    if (choice === 'Library') {
      fireEvent.click(screen.getByText('Choose test cover'));
      fireEvent.click(screen.getByText('Use test cover'));
    } else {
      mocks.upload.mockResolvedValueOnce({ url: mocks.libraryUrl, publicId: 'secondary-asset' });
      fireEvent.change(screen.getByLabelText('Test cover file'), {
        target: { files: [new File(['synthetic'], 'secondary.jpg', { type: 'image/jpeg' })] },
      });
      await waitFor(() => expect(screen.getByTestId('cover-url')).toHaveTextContent(mocks.libraryUrl));
    }
    fireEvent.change(input('Language', 'select'), { target: { value: 'gu' } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Saved Gujarati draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('Draft updated');
      expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled();
    });
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual(['articles/story-a-gu', 'articles/story-a-hi']);
    expect(mocks.put.mock.calls[1][1]).toMatchObject({
      coverImage: { url: mocks.libraryUrl, publicId: choice === 'Library' ? null : 'secondary-asset' },
    });
    for (const [, payload] of mocks.put.mock.calls) {
      expect(payload).not.toHaveProperty('removeCoverImage');
      expect(payload).not.toHaveProperty('status');
      expect(payload).not.toHaveProperty('publishedAt');
    }
    expect(records['story-a-gu'].coverImage).toEqual(before['story-a-gu'].coverImage);
    expect(records['story-a-en']).toEqual(before['story-a-en']);
    expect(mocks.post).not.toHaveBeenCalled();
  });
});

describe('Normal new-story automatic translation', () => {
  function permissionReads(allowed: () => boolean) {
    const get = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation(async url => {
      if (url === 'admin/me') return { data: { user: { id: 'founder-test', role: mocks.role, specialRights: [] } } };
      if (url === 'access/me') return { data: { effectiveModuleAccess: {
        addNews: { allowed: allowed(), visible: true, policyState: 'available', reasonCode: allowed() ? 'ALLOWED' : 'STAFF_ACCESS_DISABLED' },
      } } };
      return get(url);
    });
  }

  it('recovers a new-story 403 by refreshing permissions without an ID or losing edits, then retries explicitly', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    mocks.role = 'editor';
    mocks.modules = ['add_news'];
    configureNewStory();
    permissionReads(() => true);
    mocks.post.mockRejectedValueOnce({ response: { status: 403, data: {} } });
    await openNewStory();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await screen.findByText(/Access denied/);
    fireEvent.change(screen.getByRole('textbox', { name: 'Story content' }), { target: { value: 'Keep my edited body after the denial.' } });
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh permissions' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled());
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.get.mock.calls.map(([url]) => url)).toEqual(['admin/me', 'access/me']);
    expect(input('Title', 'input')).toHaveValue('New gu source');
    expect(screen.getByRole('textbox', { name: 'Story content' })).toHaveValue('Keep my edited body after the denial.');
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Translation job queued for EN+HI'));
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles', 'articles', 'admin/articles/created-gu/translations/generate']);
    expect(records['created-gu'].content).toBe('Keep my edited body after the denial.');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('keeps a denied new-story retry blocked until a later permission refresh confirms access', async () => {
    mocks.role = 'editor';
    mocks.modules = ['draft_desk'];
    configureNewStory();
    let allowed = false;
    permissionReads(() => allowed);
    mocks.post.mockRejectedValueOnce({ response: { status: 403, data: {} } });
    await openNewStory('en');
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await screen.findByText(/Access denied/);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh permissions' }));
    await screen.findByText(/Creation is not currently authorized/);
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    expect(input('Title', 'input')).toHaveValue('New en source');
    expect(mocks.post).toHaveBeenCalledTimes(1);
    allowed = true;
    fireEvent.click(screen.getByRole('button', { name: 'Refresh permissions' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled());
    expect(mocks.post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Translation job queued for HI+GU'));
  });

  it.each([401, 403, 503])('retains a new-story buffer after permission refresh HTTP %s', async status => {
    mocks.role = 'editor';
    mocks.modules = ['add_news'];
    configureNewStory();
    mocks.post.mockRejectedValueOnce({ response: { status: 403, data: {} } });
    mocks.get.mockRejectedValueOnce({ response: { status, data: {} } });
    await openNewStory('hi');
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await screen.findByText(/Access denied/);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh permissions' }));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh permissions' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    expect(input('Title', 'input')).toHaveValue('New hi source');
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it('does not offer no-ID permission recovery for an acknowledged create with an unknown saved identity', async () => {
    configureNewStory();
    mocks.post.mockResolvedValueOnce({ data: { ok: true } });
    await openNewStory();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await screen.findByText(/save committed but its source identity could not be verified/);
    expect(screen.queryByRole('button', { name: 'Refresh permissions' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it.each(['gu', 'hi', 'en'] as const)('saves a new %s source and queues the other two languages once', async language => {
    configureNewStory();
    await openNewStory(language);
    expect(screen.getByLabelText('Generate translations after Save Draft')).toBeChecked();
    expect(mocks.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success.mock.calls.length + mocks.error.mock.calls.length).toBeGreaterThan(0));
    expect(mocks.error.mock.calls).toEqual([]);
    const languages = ['en', 'hi', 'gu'].filter(code => code !== language);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(`Translation job queued for ${languages.map(code => code.toUpperCase()).join('+')}`));
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles', `admin/articles/created-${language}/translations/generate`]);
    expect(mocks.post.mock.calls[1][1]).toEqual({ languages });
    expect(records[`created-${language}`]).toMatchObject({ title: `New ${language} source`, lang: language, language, status: 'draft' });
    const group = records[`created-${language}`].translationGroupId;
    expect(group).toBeTruthy();
    for (const code of ['en', 'hi', 'gu']) {
      expect(records[`created-${code}`]).toMatchObject({ translationGroupId: group, lang: code, language: code, status: 'draft' });
      expect(records[`created-${code}`].publishedAt).toBeUndefined();
    }
    expect(mocks.put).not.toHaveBeenCalled();
    expect(records['unrelated-hi'].title).toBe('Unrelated hi');
    expect(records['unrelated-gu'].title).toBe('Unrelated gu');
    expect(screen.getByRole('alert')).toHaveTextContent('drafts requiring translation review');
  });

  it.each(['add_news', 'draft_desk'])('retains authorized %s creation without Manage News discovery or Edit news rights', async module => {
    mocks.role = 'editor';
    mocks.modules = [module];
    configureNewStory();
    await openNewStory();
    expect(screen.getByRole('button', { name: 'Generate Translations' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Translation job queued for EN+HI'));
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles', 'admin/articles/created-gu/translations/generate']);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('creates and translates for Manage News staff with effective news_edit', async () => {
    mocks.role = 'editor';
    mocks.modules = ['manage_news'];
    mocks.specialRights = ['news_edit'];
    configureNewStory();
    await openNewStory('en');
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Translation job queued for HI+GU'));
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles', 'admin/articles/created-en/translations/generate']);
    expect(['en', 'hi', 'gu'].map(code => records[`created-${code}`].status)).toEqual(['draft', 'draft', 'draft']);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('does not save or generate an unsaved source for Manage News-only readers', async () => {
    mocks.role = 'editor';
    mocks.modules = ['manage_news'];
    configureNewStory();
    await openNewStory();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generate Translations' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('restores unsaved Generate Translations as save-then-generate even when after-save generation was unchecked', async () => {
    configureNewStory();
    await openNewStory();
    fireEvent.click(screen.getByLabelText('Generate translations after Save Draft'));
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Translation job queued for EN+HI'));
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles', 'admin/articles/created-gu/translations/generate']);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('can explicitly generate an opted-out newly saved source without saving or creating it again', async () => {
    mocks.role = 'editor';
    mocks.modules = ['add_news'];
    configureNewStory();
    await openNewStory();
    fireEvent.click(screen.getByLabelText('Generate translations after Save Draft'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Draft saved'));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Translation job queued for EN+HI'));
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('does not replay the creation job on later manual saves or autosaves', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    mocks.role = 'editor';
    mocks.modules = ['add_news'];
    configureNewStory();
    await openNewStory();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Translation job queued for EN+HI'));
    fireEvent.change(input('Title', 'input'), { target: { value: 'Later source edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Draft updated'));
    fireEvent.change(input('Title', 'input'), { target: { value: 'Later autosaved source edit' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(2));
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles', 'admin/articles/created-gu/translations/generate']);
    expect(records['created-gu'].title).toBe('Later autosaved source edit');
    expect(records['created-en'].title).toBe('Generated en');
    expect(records['created-hi'].title).toBe('Generated hi');
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it.each([401, 403, 409, 503])('does not generate after source-save HTTP %s and preserves unsaved content', async status => {
    mocks.role = 'editor';
    mocks.modules = ['add_news'];
    configureNewStory();
    mocks.post.mockRejectedValueOnce({ response: { status, data: {} } });
    await openNewStory();
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles']);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(input('Title', 'input')).toHaveValue('New gu source');
  });

  it.each([401, 403, 409, 503])('keeps the accepted source after generation HTTP %s without retry or a discovery bypass', async status => {
    mocks.role = 'editor';
    mocks.modules = ['add_news'];
    configureNewStory();
    const post = mocks.post.getMockImplementation()!;
    mocks.post.mockImplementation(async (url, payload) => {
      if (url.startsWith('admin/articles/')) throw { response: { status, data: {} } };
      return post(url, payload);
    });
    await openNewStory();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('acknowledged saves were kept')));
    expect(records['created-gu']).toMatchObject({ title: 'New gu source', status: 'draft' });
    expect(mocks.success).toHaveBeenCalledWith('Draft saved');
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles', 'admin/articles/created-gu/translations/generate']);
    expect(screen.getByRole('button', { name: 'Generate Translations' })).toBeDisabled();
    fireEvent.change(input('Title', 'input'), { target: { value: 'Source retained after translation failure' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Draft updated'));
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('uses separately verified overwrite:false recovery after a failed creation job, without repeating the source save', async () => {
    configureNewStory();
    const post = mocks.post.getMockImplementation()!;
    mocks.post.mockImplementation(async (url, payload) => {
      if (url.startsWith('admin/articles/')) throw { response: { status: 503, data: {} } };
      return post(url, payload);
    });
    await openNewStory();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('acknowledged saves were kept')));
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3));
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual([
      'articles', 'admin/articles/created-gu/translations/generate', 'articles/created-gu/translations/generate',
    ]);
    expect(mocks.post.mock.calls[2][1]).toEqual({ targetLanguages: ['en', 'hi'], overwrite: false });
    expect(mocks.get).toHaveBeenCalledWith('articles/created-gu/translation-status');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it.each([
    { _id: undefined }, { _id: '../unrelated' }, { sourceNewsId: 'unrelated-hi' },
    { lang: 'hi', language: 'hi' }, { translationGroupId: 'unrelated-group' },
    { translationKey: 'unrelated-group' }, { sourceArticle: { _id: 'unrelated-hi' } },
  ])('keeps an acknowledged create with unsafe identity %j outside generation, save and publication targets', async patch => {
    configureNewStory();
    const post = mocks.post.getMockImplementation()!;
    mocks.post.mockImplementation(async (url, payload) => {
      const result = await post(url, payload);
      if (url === 'articles') return { data: { ok: true, article: { ...records['created-gu'], ...patch } } };
      return result;
    });
    await openNewStory();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('save committed but its source identity could not be verified'));
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles']);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(input('Title', 'input')).toHaveValue('New gu source');
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
  });

  it('preserves text typed during generation without replaying the save or publishing', async () => {
    configureNewStory();
    const post = mocks.post.getMockImplementation()!;
    let finish!: () => void;
    mocks.post.mockImplementation(async (url, payload) => {
      if (url.startsWith('admin/articles/')) await new Promise<void>(resolve => { finish = resolve; });
      return post(url, payload);
    });
    await openNewStory();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(finish).toBeDefined());
    fireEvent.change(input('Title', 'input'), { target: { value: 'Still unsaved while translations run' } });
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    await act(async () => { finish(); });
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Translation job queued for EN+HI'));
    expect(input('Title', 'input')).toHaveValue('Still unsaved while translations run');
    expect(records['created-gu'].title).toBe('New gu source');
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('keeps a committed-save warning separate and requires review before explicitly continuing generation', async () => {
    configureNewStory();
    const post = mocks.post.getMockImplementation()!;
    mocks.post.mockImplementation(async (url, payload) => {
      const result = await post(url, payload);
      return url === 'articles'
        ? { data: { ok: true, article: { ...records['created-gu'] }, committed: true, postCommitWarnings: [{ code: 'FOLLOW_UP' }] } }
        : result;
    });
    await openNewStory();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('GU save committed'));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Translation job queued for EN+HI'));
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles', 'admin/articles/created-gu/translations/generate']);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert').some(alert => alert.textContent?.includes('GU save committed'))).toBe(true);
  });

  it('does not make new-source generation depend on recovery discovery being available', async () => {
    configureNewStory();
    lookupFailure = { response: { status: 503, data: {} } };
    await openNewStory('hi');
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Translation job queued for EN+GU'));
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles', 'admin/articles/created-hi/translations/generate']);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(input('Title', 'input')).toHaveValue('New hi source');
  });

  it.each([null, {}, { ok: false }, { success: false }])('does not report normal generation success for an unavailable or rejected response %j', async data => {
    mocks.role = 'editor';
    mocks.modules = ['add_news'];
    configureNewStory();
    const post = mocks.post.getMockImplementation()!;
    mocks.post.mockImplementation(async (url, payload) => url.startsWith('admin/articles/') ? { data } : post(url, payload));
    await openNewStory();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('acknowledged saves were kept')));
    expect(mocks.success).not.toHaveBeenCalledWith(expect.stringContaining('Translation job queued'));
    expect(records['created-gu'].title).toBe('New gu source');
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it('rechecks creation access after an in-flight source save before generating', async () => {
    mocks.role = 'editor';
    mocks.modules = ['add_news'];
    configureNewStory();
    const post = mocks.post.getMockImplementation()!;
    let finish!: () => void;
    mocks.post.mockImplementation(async (url, payload) => {
      if (url === 'articles') await new Promise<void>(resolve => { finish = resolve; });
      return post(url, payload);
    });
    const { client, rerender } = await openNewStory();
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    await waitFor(() => expect(finish).toBeDefined());
    mocks.modules = [];
    rerender(creator(client));
    await act(async () => { finish(); });
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Creation access could not be verified. Translation generation is blocked.'));
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles']);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(records['created-gu'].title).toBe('New gu source');
  });

  it('does not attach a late creation receipt to a different opened story or generate from that workspace', async () => {
    configureNewStory();
    const post = mocks.post.getMockImplementation()!;
    let finish!: () => void;
    mocks.post.mockImplementation(async (url, payload) => {
      if (url === 'articles') await new Promise<void>(resolve => { finish = resolve; });
      return post(url, payload);
    });
    const { client, rerender } = await openNewStory();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(finish).toBeDefined());
    perLang = { hi: { articleId: 'unrelated-hi' } };
    rerender(<QueryClientProvider client={client}><MemoryRouter>
      <ArticleForm mode="edit" id="unrelated-hi" initialValues={records['unrelated-hi']} />
    </MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(input('Title', 'input')).toHaveValue('Unrelated hi'));
    await act(async () => { finish(); });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('save committed for the previous workspace'));
    expect(input('Title', 'input')).toHaveValue('Unrelated hi');
    expect(records['unrelated-hi'].title).toBe('Unrelated hi');
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles']);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(window.location.search).not.toContain('created-gu');
  });
});

describe('Verified language edition identity', () => {
  it.each(['hi', 'gu'])('never saves an unrelated %s story returned by ignored group filtering', async language => {
    await open();
    fireEvent.change(input('Language', 'select'), { target: { value: language } });
    fireEvent.change(input('Title', 'input'), { target: { value: `Accepted ${language} edit` } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(1));

    expect(mocks.put.mock.calls[0][0]).toBe(`articles/story-a-${language}`);
    expect(mocks.get.mock.calls.every(([url]) => url !== 'articles')).toBe(true);
    expect(records[`unrelated-${language}`].title).toBe(`Unrelated ${language}`);
    expect(records[`story-a-${language}`]).toMatchObject({
      title: `Accepted ${language} edit`, slug: `story-a-${language}`,
      translationGroupId: 'group-a', publishedAt: source.publishedAt, imageUrl: source.imageUrl,
    });
  });

  it.each([undefined, null, {}, { articleId: null }, { state: 'pending' }])(
    'never selects, creates or generates an unverified HI edition (%j)',
    async entry => {
      perLang.hi = entry;
      records[source._id].translations = { hi: { _id: 'unrelated-hi', title: 'Untrusted metadata' } };
      await open(2);
      fireEvent.change(input('Title', 'input'), { target: { value: 'Keep this accepted source edit' } });
      fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
      expect(input('Language', 'select')).toHaveValue('en');
      expect(input('Title', 'input')).toHaveValue('Keep this accepted source edit');
      expect(screen.getByRole('option', { name: 'Hindi (hi)' })).toBeDisabled();
      const create = screen.getByRole('button', { name: 'Create Hindi version' });
      expect(create).toBeDisabled();
      fireEvent.click(create);
      fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
      expect(mocks.post).not.toHaveBeenCalled();
      expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Translation generation blocked'));
      fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
      await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
      expect(mocks.put.mock.calls.map(([url]) => url)).toEqual(['articles/story-a-en']);
      expect(records['unrelated-hi'].title).toBe('Unrelated hi');
      expect(mocks.post).not.toHaveBeenCalled();
    },
    15_000,
  );

  it.each([
    { articleId: 'unrelated-hi' }, { articleId: 'story-a-en' }, { articleId: 123 }, { articleId: {} },
  ])('fails closed for inconsistent/ambiguous HI identity %j', async entry => {
    perLang.hi = entry;
    await open(0);
    fireEvent.change(input('Title', 'input'), { target: { value: 'Do not lose this edit' } });
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    expect(input('Language', 'select')).toHaveValue('en');
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(input('Title', 'input')).toHaveValue('Do not lose this edit');
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each([401, 403, 409, 503])('preserves edits on lookup HTTP %s and permits an explicit authorized retry', async status => {
    lookupFailure = { response: { status, data: {} } };
    await open(0);
    fireEvent.change(input('Title', 'input'), { target: { value: 'Recoverable source edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(input('Title', 'input')).toHaveValue('Recoverable source edit');
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    lookupFailure = null;
    const verify = screen.getByRole('button', { name: 'Verify language editions' });
    await waitFor(() => expect(verify).toBeEnabled());
    fireEvent.click(verify);
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3));
    const save = screen.getByRole('button', { name: 'Save Update' });
    if (save.hasAttribute('disabled')) {
      fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state' }));
    }
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual(['articles/story-a-en']);
    expect(records[source._id].title).toBe('Recoverable source edit');
  });

  it('revalidates before saving and never retargets a buffered edition to a replacement ID', async () => {
    await open();
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Only for the original Hindi article' } });
    records['replacement-hi'] = { ...records['story-a-hi'], _id: 'replacement-hi', title: 'Replacement article' };
    perLang.hi = { articleId: 'replacement-hi' };
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('language edition ID changed'));
    expect(input('Title', 'input')).toHaveValue('Only for the original Hindi article');
    expect(mocks.put).not.toHaveBeenCalled();
    perLang.hi = { articleId: 'story-a-hi' };
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual(['articles/story-a-hi']);
    expect(records['replacement-hi'].title).toBe('Replacement article');
  });

  it('revalidates story membership before publication and sends no write for a foreign edition', async () => {
    for (const id of ['story-a-en', 'story-a-hi', 'story-a-gu']) records[id].status = 'draft';
    await open();
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Accepted Hindi content' } });
    perLang.hi = { articleId: 'unrelated-hi' };
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('does not match this story'));
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(input('Title', 'input')).toHaveValue('Accepted Hindi content');
  });

  it('does not reuse a committed ID when that edition is no longer verified', async () => {
    await open();
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Acknowledged Hindi edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    fireEvent.change(input('Title', 'input'), { target: { value: 'Still unsaved Hindi edit' } });
    perLang.hi = { articleId: null };
    fireEvent.click(screen.getByRole('button', { name: 'Verify language editions' }));
    await waitFor(() => expect(screen.queryAllByTitle('Open this language variant')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Edition identity is unverified'));
    expect(input('Title', 'input')).toHaveValue('Still unsaved Hindi edit');
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('rejects a changed anchor language instead of rebinding existing buffers', async () => {
    perLang = { en: { articleId: 'story-a-en' } };
    await open(1);
    fireEvent.change(input('Title', 'input'), { target: { value: 'English-only accepted edit' } });
    records[source._id] = { ...records[source._id], language: 'hi', lang: 'hi' };
    perLang = { hi: { articleId: 'story-a-en' } };
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('source language identity changed'));
    expect(input('Title', 'input')).toHaveValue('English-only accepted edit');
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('retains a committed source and its unsaved secondary buffer without creating an unknown edition', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const get = mocks.get.getMockImplementation()!;
    let verifiedHindi = false;
    mocks.get.mockImplementation(async url => {
      if (url === 'articles/new-source/translation-status') return { data: { data: { perLang: {
        gu: { articleId: 'new-source' }, ...(verifiedHindi ? { hi: { articleId: 'verified-hi' } } : {}),
      } } } };
      return get(url);
    });
    mocks.post.mockImplementation(async (url, payload) => {
      if (url !== 'articles') throw new Error('Unexpected creation or publication');
      records['new-source'] = { _id: 'new-source', title: '', ...payload };
      return { data: { article: { ...records['new-source'] } } };
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    clients.push(client);
    render(<QueryClientProvider client={client}><MemoryRouter><ArticleForm mode="create" /></MemoryRouter></QueryClientProvider>);
    fireEvent.change(input('Title', 'input'), { target: { value: 'New Gujarati source' } });
    fireEvent.change(input('Category', 'select'), { target: { value: 'national' } });
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Keep this local Hindi draft' } });
    fireEvent.change(input('Language', 'select'), { target: { value: 'gu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/GU saved.*HI save did not complete.*unverified/));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(records['new-source']).toMatchObject({ title: 'New Gujarati source', lang: 'gu', status: 'draft' });
    expect(mocks.put).not.toHaveBeenCalled();

    records['verified-hi'] = { ...records['new-source'], _id: 'verified-hi', language: 'hi', lang: 'hi', title: 'Verified Hindi edition' };
    verifiedHindi = true;
    const verify = screen.getByRole('button', { name: 'Verify language editions' });
    await waitFor(() => expect(verify).toBeEnabled());
    fireEvent.click(verify);
    await waitFor(() => expect(screen.queryAllByTitle('Open this language variant')).toHaveLength(2));
    const refresh = screen.getByRole('button', { name: 'Refresh latest state' });
    await waitFor(() => expect(refresh).toBeEnabled());
    fireEvent.click(refresh);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled());
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    expect(input('Title', 'input')).toHaveValue('Keep this local Hindi draft');
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Draft updated'));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual(['articles/verified-hi']);
    expect(records['verified-hi'].title).toBe('Keep this local Hindi draft');
  });

  it('preserves an acknowledged source save when opted-in missing-edition generation fails, then retries only that job', async () => {
    for (const id of ['story-a-en', 'story-a-hi', 'story-a-gu']) records[id].status = 'draft';
    markMissing('gu');
    await open(2);
    mocks.post.mockRejectedValueOnce({ response: { status: 503, data: {} } });
    fireEvent.click(screen.getByLabelText('Generate translations after Save Draft'));
    fireEvent.change(input('Title', 'input'), { target: { value: 'Source already saved' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('Backend is temporarily unavailable')));
    expect(mocks.success).toHaveBeenCalledWith('Draft updated');
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.post.mock.calls[0]).toEqual(['articles/story-a-en/translations/generate', { targetLanguages: ['gu'], overwrite: false }]);
    expect(records[source._id].title).toBe('Source already saved');
    const retry = screen.getByRole('button', { name: 'Regenerate Translations' });
    await waitFor(() => expect(retry).toBeEnabled());
    fireEvent.click(retry);
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Missing-edition generation requested for GU'));
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 409, 503])('saves the verified HI edition before POST publish and never replays its save after HTTP %s', async status => {
    for (const id of ['story-a-en', 'story-a-hi', 'story-a-gu']) records[id].status = 'draft';
    await open();
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Saved Hindi publication text' } });
    mocks.post.mockRejectedValueOnce({ response: { status, data: {} } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/HI saved.*Publication did not complete/));
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual(['articles/story-a-hi']);
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles/story-a-hi/publish']);
    expect(mocks.put.mock.invocationCallOrder[0]).toBeLessThan(mocks.post.mock.invocationCallOrder[0]);
    expect(records['story-a-hi'].title).toBe('Saved Hindi publication text');
    const refresh = screen.getByRole('button', { name: 'Refresh latest state' });
    await waitFor(() => expect(refresh).toBeEnabled());
    fireEvent.click(refresh);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Publish' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles/story-a-hi/publish', 'articles/story-a-hi/publish']);
    expect(records['story-a-hi']).toMatchObject({
      status: 'published', slug: 'story-a-hi', translationGroupId: 'group-a', publishedAt: source.publishedAt, imageUrl: source.imageUrl,
    });
    expect(records['unrelated-hi'].title).toBe('Unrelated hi');
  });

  it('rejects a programmatic group change instead of using it as an edition lookup or update', async () => {
    await open();
    const group = input('Translation Group ID (optional)', 'input');
    expect(group).toHaveAttribute('readonly');
    fireEvent.change(group, { target: { value: 'unrelated-group' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('translation group changed'));
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.get.mock.calls.every(([url]) => url !== 'articles')).toBe(true);
  });

  it('ignores an older discovery completion after the editor changes to another story', async () => {
    let finish!: (value: { data: unknown }) => void;
    const get = mocks.get.getMockImplementation()!;
    const olderStatus = new Promise<{ data: unknown }>(resolve => { finish = resolve; });
    const second = { ...source, _id: 'story-b-en', title: 'Story B source', translationGroupId: 'group-b' };
    records[second._id] = second;
    for (const code of ['hi', 'gu']) records[`story-b-${code}`] = {
      ...second, _id: `story-b-${code}`, title: `Story B ${code}`, language: code, lang: code,
    };
    mocks.get.mockImplementation(async url => {
      if (url === 'articles/story-a-en/translation-status') return olderStatus;
      if (url === 'articles/story-b-en/translation-status') return { data: { data: { perLang: {
        en: { articleId: 'story-b-en' }, hi: { articleId: 'story-b-hi' }, gu: { articleId: 'story-b-gu' },
      } } } };
      return get(url);
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    clients.push(client);
    const rendered = render(editor(client, records[source._id]));
    await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('articles/story-a-en/translation-status'));
    rendered.rerender(editor(client, second));
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3));
    await act(async () => { finish({ data: { data: { perLang } } }); });
    expect(input('Title', 'input')).toHaveValue('Story B source');
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    expect(input('Title', 'input')).toHaveValue('Story B hi');
    fireEvent.change(input('Title', 'input'), { target: { value: 'Only update Story B hi' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual(['articles/story-b-hi']);
  });

  it('redirects own-draft-only staff before making any Manage News edition or detail read', async () => {
    mocks.role = 'editor';
    mocks.modules = ['draft_desk'];
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(client);
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/admin/articles/story-a-en/edit']}>
      <Routes>
        <Route path="/admin/articles/:id/edit" element={<ArticleEditPage />} />
        <Route path="/draft-desk/:id" element={<div>Restricted own-draft workspace</div>} />
      </Routes>
    </MemoryRouter></QueryClientProvider>);
    await screen.findByText('Restricted own-draft workspace');
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });
});

describe('Verified missing-edition generation', () => {
  it.each([false, true])('never generates on opening or autosave ticks, including a failed lookup (%s)', async failLookup => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    markMissing('gu');
    records[source._id].translations = { status: 'failed' };
    if (failLookup) lookupFailure = { response: { status: 503, data: {} } };
    await open(failLookup ? 0 : 2);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it.each(['pending', 'failed', 'ready'])('does not generate a present, incomplete %s translation', async status => {
    records['story-a-gu'].content = '';
    perLang.gu = { present: true, presence: 'present', articleId: 'story-a-gu', childArticleId: 'story-a-gu', status };
    const before = { ...records['story-a-gu'] };
    await open();
    expect(screen.getByText(status === 'ready' ? 'Present - incomplete translation' : `Present - translation ${status}`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Translations' }));
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(records['story-a-gu']).toEqual(before);
  });

  it.each(['pending', 'failed', 'ready'])('does not infer absence from stored status %s without presence evidence', async status => {
    perLang.gu = { status };
    await open(2);
    expect(screen.getByRole('button', { name: 'Create Gujarati version' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.queryByText('Missing (verified)')).not.toBeInTheDocument();
  });

  it.each(['pending', 'failed', 'ready'])('generates only verified absence (%s), preserving saved content and unsaved language buffers', async status => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    markMissing('gu');
    perLang.gu = { ...missingEdition, status };
    completeGeneration();
    const sourceBefore = { ...records[source._id] };
    const hindiBefore = { ...records['story-a-hi'] };
    await open(2);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Generate translations after Save Draft')).not.toBeChecked();
    fireEvent.change(input('Title', 'input'), { target: { value: 'Unsaved source headline' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Story content' }), { target: { value: 'Unsaved source content buffer' } });
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Unsaved Hindi headline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Gujarati version' }));
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3));
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      'articles/story-a-en/translations/generate', { targetLanguages: ['gu'], overwrite: false },
    );
    expect(mocks.put).not.toHaveBeenCalled();
    expect(records[source._id]).toEqual(sourceBefore);
    expect(records['story-a-hi']).toEqual(hindiBefore);
    expect(input('Language', 'select')).toHaveValue('hi');
    expect(input('Title', 'input')).toHaveValue('Unsaved Hindi headline');
    fireEvent.change(input('Language', 'select'), { target: { value: 'en' } });
    expect(input('Title', 'input')).toHaveValue('Unsaved source headline');
    expect(screen.getByRole('textbox', { name: 'Story content' })).toHaveValue('Unsaved source content buffer');
    expect(records['story-a-gu']).toMatchObject({ status: 'draft', lang: 'gu', translationGroupId: 'group-a' });
    expect(records['story-a-gu'].publishedAt).toBeUndefined();
    expect(screen.getByRole('alert')).toHaveTextContent('drafts requiring translation review');
  });

  it.each([
    ['en', 'gu'], ['hi', 'en'], ['gu', 'en'],
  ] as const)('creates the missing %s edition from canonical %s and only saves/publishes its verified CMS ID', async (target, sourceLanguage) => {
    Object.values(records).forEach(record => { record.sourceLanguage = sourceLanguage; });
    markMissing(target);
    completeGeneration();
    const sourceId = `story-a-${sourceLanguage}`;
    await open(2, records[sourceId]);
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3));
    fireEvent.change(input('Language', 'select'), { target: { value: target } });
    expect(input('Title', 'input')).toHaveValue(`Generated ${target} draft`);
    fireEvent.change(input('Title', 'input'), { target: { value: `Human-reviewed ${target} edition` } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Draft updated'));
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(2));
    expect(mocks.post.mock.calls).toEqual([
      [`articles/${sourceId}/translations/generate`, { targetLanguages: [target], overwrite: false }],
      [`articles/story-a-${target}/publish`],
    ]);
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual([`articles/story-a-${target}`]);
    expect(records[sourceId].publishedAt).toBe(source.publishedAt);
    expect(records[`story-a-${target}`].title).toBe(`Human-reviewed ${target} edition`);
    expect(records['unrelated-hi'].title).toBe('Unrelated hi');
    expect(records['unrelated-gu'].title).toBe('Unrelated gu');
    expect(mocks.get.mock.calls.every(([url]) => url !== 'articles')).toBe(true);
  });

  it.each([
    { name: 'conflicting group keys', count: 0, change: () => { records['story-a-en'].translationKey = 'other-group'; } },
    { name: 'conflicting source languages', count: 2, change: () => { records['story-a-hi'].sourceLanguage = 'hi'; } },
    { name: 'missing source metadata', count: 2, change: () => { Object.values(records).forEach(record => { delete record.sourceLanguage; }); } },
    { name: 'duplicate siblings', count: 0, change: () => { perLang.hi = [{ articleId: 'story-a-hi' }, { articleId: 'other-hi' }]; } },
    { name: 'conflicting edition IDs', count: 0, change: () => { perLang.hi = { articleId: 'story-a-hi', childArticleId: 'other-hi' }; } },
    { name: 'an unrelated story', count: 0, change: () => { perLang.hi = { articleId: 'unrelated-hi' }; } },
  ])('blocks generation for $name', async ({ count, change }) => {
    markMissing('gu');
    change();
    await open(count);
    fireEvent.change(input('Title', 'input'), { target: { value: 'Keep my local content' } });
    expect(screen.getByRole('button', { name: 'Create Gujarati version' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(input('Title', 'input')).toHaveValue('Keep my local content');
  });

  it.each([401, 403, 409, 503])('revalidates before creation and does not infer absence from lookup HTTP %s', async status => {
    markMissing('gu');
    await open(2);
    lookupFailure = { response: { status, data: {} } };
    fireEvent.click(screen.getByRole('button', { name: 'Create Gujarati version' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('acknowledged saves were kept'));
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    lookupFailure = null;
    const verify = screen.getByRole('button', { name: 'Verify language editions' });
    await waitFor(() => expect(verify).toBeEnabled());
    fireEvent.click(verify);
    await waitFor(() => expect(verify).toBeEnabled());
    expect(mocks.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Create Gujarati version' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Missing-edition generation requested for GU'));
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 409, 503])('reports generation HTTP %s without retry, fallback, save or publication', async status => {
    markMissing('gu');
    await open(2);
    mocks.post.mockRejectedValueOnce({ response: { status, data: {} } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Unsaved content survives denied generation' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Gujarati version' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Verify language editions before retrying'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create Gujarati version' })).toBeEnabled());
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      'articles/story-a-en/translations/generate', { targetLanguages: ['gu'], overwrite: false },
    );
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.success).not.toHaveBeenCalled();
    expect(input('Title', 'input')).toHaveValue('Unsaved content survives denied generation');
    expect(records[source._id].title).toBe(source.title);
  });

  it('allows effective Manage News plus Edit news authority, without relying on the userRole prop', async () => {
    mocks.role = 'editor';
    mocks.specialRights = ['news_edit'];
    markMissing('gu');
    completeGeneration();
    await open(2);
    fireEvent.click(screen.getByRole('button', { name: 'Create Gujarati version' }));
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3));
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      'articles/story-a-en/translations/generate', { targetLanguages: ['gu'], overwrite: false },
    );
  });

  it('keeps read-only Manage News staff outside generation even after verified absence', async () => {
    mocks.role = 'editor';
    markMissing('gu');
    await open(2);
    expect(mocks.get).toHaveBeenCalledWith('articles/story-a-en/translation-status');
    expect(screen.getByRole('button', { name: 'Create Gujarati version' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generate Translations' })).toBeDisabled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('blocks a canonical source change discovered immediately before mutation', async () => {
    markMissing('gu');
    await open(2);
    records['story-a-en'].sourceLanguage = 'hi';
    records['story-a-hi'].sourceLanguage = 'hi';
    fireEvent.click(screen.getByRole('button', { name: 'Create Gujarati version' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('canonical source identity changed'));
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('uses the verified CMS source ID rather than a public-copy ID for generation', async () => {
    records[source._id] = { ...records[source._id], _id: 'public-copy-en', sourceNewsId: source._id };
    markMissing('gu');
    completeGeneration();
    await open(2);
    fireEvent.click(screen.getByRole('button', { name: 'Create Gujarati version' }));
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3));
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(
      'articles/story-a-en/translations/generate', { targetLanguages: ['gu'], overwrite: false },
    );
    expect(mocks.get).not.toHaveBeenCalledWith('articles/public-copy-en');
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('rechecks effective generation authority after asynchronous identity verification', async () => {
    mocks.role = 'editor';
    mocks.specialRights = ['news_edit'];
    markMissing('gu');
    const mounted = await open(2);
    let finish!: (value: { data: unknown }) => void;
    const get = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation(async url => url.endsWith('/translation-status')
      ? new Promise(resolve => { finish = resolve; }) : get(url));
    fireEvent.click(screen.getByRole('button', { name: 'Create Gujarati version' }));
    await waitFor(() => expect(finish).toBeDefined());
    mocks.specialRights = [];
    mounted.rerender(editor(mounted.client, records[source._id]));
    await act(async () => { finish({ data: { data: { perLang } } }); });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Edit news special right'));
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('does not replay an accepted generation request while its edition is not yet available', async () => {
    markMissing('gu');
    await open(2);
    fireEvent.click(screen.getByRole('button', { name: 'Create Gujarati version' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Missing-edition generation requested for GU'));
    const verify = screen.getByRole('button', { name: 'Verify language editions' });
    await waitFor(() => expect(verify).toBeEnabled());
    fireEvent.click(verify);
    await waitFor(() => expect(verify).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Create Gujarati version' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Translations' }));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('already bound or requested');
  });

  it('reports an accepted request separately from a failed verification without replaying it', async () => {
    markMissing('gu');
    await open(2);
    mocks.post.mockImplementationOnce(async () => {
      lookupFailure = { response: { status: 503, data: {} } };
      return { data: { ok: true } };
    });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Keep content through follow-up failure' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Gujarati version' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Do not repeat the accepted generation request'));
    expect(input('Title', 'input')).toHaveValue('Keep content through follow-up failure');
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).toHaveBeenCalledTimes(1);
    lookupFailure = null;
    fireEvent.click(screen.getByRole('button', { name: 'Verify language editions' }));
    await waitFor(() => expect(screen.queryAllByTitle('Open this language variant')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Translations' }));
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it('does not recreate a previously bound missing edition or discard its unsaved buffer', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await open();
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Bound Hindi unsaved buffer' } });
    perLang.hi = { ...missingEdition };
    fireEvent.click(screen.getByRole('button', { name: 'Verify language editions' }));
    await waitFor(() => expect(screen.queryAllByTitle('Open this language variant')).toHaveLength(2));
    fireEvent.change(input('Language', 'select'), { target: { value: 'en' } });
    expect(screen.getByRole('button', { name: 'Create Hindi version' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    expect(mocks.post).not.toHaveBeenCalled();
    perLang.hi = { articleId: 'story-a-hi' };
    fireEvent.click(screen.getByRole('button', { name: 'Verify language editions' }));
    await waitFor(() => expect(screen.queryAllByTitle('Open this language variant')).toHaveLength(3));
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    expect(input('Title', 'input')).toHaveValue('Bound Hindi unsaved buffer');
  });

  it('serializes generation against saves and retains edits made during the request', async () => {
    markMissing('gu');
    let finish!: (value: { data: unknown }) => void;
    mocks.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await open(2);
    fireEvent.click(screen.getByRole('button', { name: 'Create Gujarati version' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
    fireEvent.change(input('Title', 'input'), { target: { value: 'Typed while generating' } });
    expect(screen.getByRole('button', { name: 'Save Update' })).toBeDisabled();
    const form = input('Title', 'input').closest('form');
    if (!form) throw new Error('Article form not found');
    fireEvent.submit(form);
    expect(mocks.put).not.toHaveBeenCalled();
    await act(async () => { finish({ data: { ok: true } }); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled());
    expect(input('Title', 'input')).toHaveValue('Typed while generating');
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.put).not.toHaveBeenCalled();
  });
});

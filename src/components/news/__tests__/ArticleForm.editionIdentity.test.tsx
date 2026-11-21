import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Article, ArticleTranslationEditions } from '@/lib/api/articles';
import { articleEditionGroupKey, articleEditionLanguage } from '@/lib/api/articles';
import { applyLegacyEditionVariant, backendGenerationReceipt, backendTranslationStatus, editionLanguages, sourceEditLanguageCases } from '@/tests/articleEditionFixtures';
import { TRANSLATION_SOURCE_REVIEW_MESSAGE } from '@/lib/articleLifecycle';
import { ArticleForm } from '../ArticleForm';
import ArticleEditPage from '@/pages/ArticleEditPage';

type GenerationPayload = { targetLanguages: Array<'en' | 'hi' | 'gu'>; overwrite: false };
type NewStoryGenerationPayload = { targetLanguages: Array<'en' | 'hi' | 'gu'>; overwrite?: false };

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
const firstPublishedAt = '2026-02-01T10:00:00.000Z';

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
    const sourceLanguage = articleEditionLanguage(records[sourceId]);
    const group = Object.values(records).map(articleEditionGroupKey).find(Boolean) || 'initialized-story-group';
    records[sourceId] = { ...records[sourceId], translationGroupId: group, translationKey: group };
    const created: Partial<Record<typeof editionLanguages[number], string>> = {};
    const skipped: Partial<Record<typeof editionLanguages[number], { id: string; reason: 'human_edited' }>> = {};
    for (const code of payload.targetLanguages) {
      const id = `story-a-${code}`;
      if (records[id]) {
        skipped[code] = { id, reason: 'human_edited' };
        continue;
      }
      const child = {
        ...records[sourceId], _id: id, title: `Generated ${code} draft`, slug: `generated-${code}`,
        language: code, lang: code, status: 'draft' as const, publishedAt: undefined, sourceNewsId: undefined,
        originalLang: code, sourceLanguage, sourceArticleId: sourceId, humanEdited: false, machineGenerated: true,
        translationMeta: {
          ...records[sourceId].translationMeta, sourceArticleId: sourceId,
          sourceLanguage, targetLanguage: code,
        },
      };
      records[id] = child;
      created[code] = id;
      perLang[code] = { present: true, presence: 'translated', articleId: id, childArticleId: id, status: 'ready' };
    }
    return { data: backendGenerationReceipt(sourceLanguage, group, payload.targetLanguages, created, skipped) };
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
  const get = mocks.get.getMockImplementation()!;
  mocks.get.mockImplementation(async url => {
    const suffix = '/translation-status';
    const id = url.slice('articles/'.length, url.endsWith(suffix) ? -suffix.length : undefined);
    if (!id.startsWith('created-') || !records[id]) return get(url);
    if (url.endsWith(suffix)) {
      if (lookupFailure) throw lookupFailure;
      return { data: backendTranslationStatus(records[id], Object.values(records).filter(row => row._id.startsWith('created-'))) };
    }
    return { data: { ok: true, success: true, article: { ...records[id] }, data: { article: { ...records[id] } } } };
  });
  const post = mocks.post.getMockImplementation()!;
  mocks.post.mockImplementation(async (url, payload) => {
    if (url === 'articles') {
      if (!payload || !('lang' in payload) || !payload.lang) throw new Error('Missing source language');
      const id = `created-${payload.lang}`;
      if (records[id]) throw new Error('Attempted to create the source twice');
      records[id] = {
        _id: id, title: '', ...payload, sourceLanguage: payload.lang, sourceArticleId: id, originalLang: payload.lang,
        translationGroupId: payload.translationGroupId || `backend-assigned-${payload.lang}`,
      };
      perLang = Object.fromEntries(['en', 'hi', 'gu'].map(code => [
        code, code === payload.lang ? { articleId: id } : { ...missingEdition },
      ]));
      const article = { ...records[id], id };
      return { data: { ok: true, success: true, status: 201, article, data: { article } } };
    }
    if (url.includes('/created-') && url.endsWith('/translations/generate')) {
      if (!payload || !('targetLanguages' in payload)) throw new Error('Missing generation targets');
      const normal = url.startsWith('admin/articles/');
      const languages = payload.targetLanguages;
      if ('overwrite' in payload && payload.overwrite !== false) throw new Error('Unexpected translation overwrite');
      if (!normal && (!('overwrite' in payload) || payload.overwrite !== false)) throw new Error('Unsafe recovery payload');
      const sourceId = decodeURIComponent(url.slice(normal ? 'admin/articles/'.length : 'articles/'.length, -'/translations/generate'.length));
      const saved = records[sourceId];
      if (!saved) throw new Error('Unexpected generation source');
      for (const code of languages) {
        const id = `created-${code}`;
        if (records[id]) throw new Error('Attempted to overwrite an edition');
        records[id] = {
          ...saved, _id: id, title: `Generated ${code}`, slug: `created-${code}`, lang: code, language: code,
          originalLang: code, sourceArticleId: sourceId, status: 'draft',
        };
        perLang[code] = { articleId: id, childArticleId: id, present: true, presence: 'translated' };
      }
      return { data: { ok: true } };
    }
    if (url.startsWith('articles/created-') && url.endsWith('/publish')) {
      const id = decodeURIComponent(url.slice('articles/'.length, -'/publish'.length));
      if (!records[id]) throw new Error('Unknown CMS publication target');
      const group = records[id].translationGroupId;
      const editions = Object.values(records).filter(row => row.translationGroupId === group);
      for (const row of editions) records[row._id] = { ...row, status: 'published', publishedAt: row.publishedAt || firstPublishedAt };
      const article = { ...records[id] };
      return { data: {
        ok: true, success: true, status: 200, article, data: { article },
        translationGroupId: group, publishedLanguages: editions.map(row => row.lang),
      } };
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

async function enabledStoryAction(name: 'Publish' | 'Save Update' | 'Refresh latest state') {
  // While the action is absent, avoid rebuilding the whole editor's accessibility diagnostics on each poll.
  await waitFor(() => expect(screen.queryByText(name, { selector: 'button' })).toBeEnabled());
  const button = screen.getByRole('button', { name });
  expect(button).toBeEnabled();
  return button;
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
      const source = records[id];
      if (!source) throw new Error('Unknown CMS publication target');
      for (const [editionId, article] of Object.entries(records)) {
        if (article.translationGroupId === source.translationGroupId) {
          records[editionId] = { ...article, status: 'published', publishedAt: article.publishedAt || firstPublishedAt };
        }
      }
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

  it.each(editionLanguages)('first publishes a new %s source with the Backend-assigned group and no second create', async language => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    configureNewStory();
    await openNewStory(language);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await enabledStoryAction('Save Update');
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles', `articles/created-${language}/publish`]);
    const wire = JSON.parse(JSON.stringify(mocks.post.mock.calls[0][1]));
    expect(wire).toMatchObject({ status: 'draft', lang: language, language, title: `New ${language} source` });
    expect(wire).not.toHaveProperty('translationGroupId');
    expect(wire).not.toHaveProperty('publishedAt');
    expect(records[`created-${language}`]).toMatchObject({
      status: 'published', sourceArticleId: `created-${language}`, sourceLanguage: language,
      translationGroupId: `backend-assigned-${language}`, publishedAt: firstPublishedAt,
    });
    expect(input('Translation Group ID (optional)', 'input')).toHaveValue(`backend-assigned-${language}`);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(mocks.post).toHaveBeenCalledTimes(2);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(Object.keys(records).filter(id => id.startsWith('created-'))).toEqual([`created-${language}`]);
  });

  it.each(editionLanguages)('preserves Save Draft then Publish for a new %s source without recreating it', async language => {
    configureNewStory();
    await openNewStory(language);
    fireEvent.click(screen.getByLabelText('Generate translations after Save Draft'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Draft saved'));
    const saved = structuredClone(records[`created-${language}`]);
    expect(saved.translationGroupId).toBeTruthy();
    expect(mocks.post.mock.calls[0][1]).toMatchObject({ translationGroupId: saved.translationGroupId, status: 'draft' });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await enabledStoryAction('Save Update');
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles', `articles/created-${language}/publish`]);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(records[`created-${language}`]).toEqual({ ...saved, status: 'published', publishedAt: firstPublishedAt });
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it.each(editionLanguages)('retries only canonical Publish after a new %s draft was acknowledged', async language => {
    configureNewStory();
    const post = mocks.post.getMockImplementation()!;
    let failed = false;
    mocks.post.mockImplementation(async (url, payload) => {
      if (url.endsWith('/publish') && !failed) {
        failed = true;
        throw { response: { status: 503, data: {} } };
      }
      return post(url, payload);
    });
    await openNewStory(language);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await screen.findByText(new RegExp(`${language.toUpperCase()} saved.*Publication did not complete`));
    expect(input('Title', 'input')).toHaveValue(`New ${language} source`);
    expect(records[`created-${language}`].status).toBe('draft');
    fireEvent.click(await enabledStoryAction('Refresh latest state'));
    fireEvent.click(await enabledStoryAction('Publish'));
    await enabledStoryAction('Save Update');
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual([
      'articles', `articles/created-${language}/publish`, `articles/created-${language}/publish`,
    ]);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(records[`created-${language}`].translationGroupId).toBe(`backend-assigned-${language}`);
  });

  it.each([
    { id: 'different-source' }, { sourceNewsId: 'different-cms-id' },
    { lang: 'hi' }, { sourceLanguage: 'en' }, { sourceArticleId: 'different-source' },
    { translationMeta: { sourceArticleId: 'different-source' } },
    { translationGroupId: 'conflicting-group' }, { sourceArticleId: undefined, sourceLanguage: undefined },
  ])('keeps the committed first-Publish draft paused after conflicting or unverified receipt %j', async patch => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    configureNewStory();
    const post = mocks.post.getMockImplementation()!;
    mocks.post.mockImplementation(async (url, payload) => {
      if (url !== 'articles') return post(url, payload);
      await post(url, payload);
      return { data: { ok: true, success: true, status: 201,
        article: { ...records['created-gu'], id: 'created-gu', ...patch }, data: { article: { ...records['created-gu'] } },
      } };
    });
    await openNewStory();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await screen.findByText(/save committed but its source identity could not be verified/);
    expect(screen.getByRole('alert')).toHaveTextContent('Autosave is paused');
    expect(input('Title', 'input')).toHaveValue('New gu source');
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles']);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(records['created-gu'].status).toBe('draft');
  });

  it.each([undefined, null, {}, [], 'unrecognized response', { ok: false, committed: true }, { ok: false }, { ok: true, success: false }])(
    'does not retry creation when the successful create request returns an unreadable acknowledgement %j',
    async data => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      configureNewStory();
      const post = mocks.post.getMockImplementation()!;
      mocks.post.mockImplementation(async (url, payload) => {
        const result = await post(url, payload);
        return url === 'articles' ? { data } : result;
      });
      await openNewStory();
      fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
      await screen.findByText(/creation response could not be verified; a draft may already exist/);
      expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
      expect(input('Title', 'input')).toHaveValue('New gu source');
      expect(screen.queryByRole('button', { name: 'Refresh permissions' })).not.toBeInTheDocument();
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles']);
      expect(mocks.put).not.toHaveBeenCalled();
      expect(records['created-gu'].status).toBe('draft');
    },
  );

  it('parks a new draft after the server saves it but the creation response is lost', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    configureNewStory();
    const post = mocks.post.getMockImplementation()!;
    mocks.post.mockImplementation(async (url, payload) => {
      const result = await post(url, payload);
      if (url === 'articles') throw new Error('Connection closed before receipt');
      return result;
    });
    await openNewStory();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await screen.findByText(/a draft may already exist/i);
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(records['created-gu'].status).toBe('draft');
    expect(input('Title', 'input')).toHaveValue('New gu source');
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles']);
  });

  it('preserves edits typed during first Publish while binding the acknowledged source ID and group', async () => {
    configureNewStory();
    const post = mocks.post.getMockImplementation()!;
    let finish!: () => void;
    mocks.post.mockImplementation(async (url, payload) => {
      if (url === 'articles') await new Promise<void>(resolve => { finish = resolve; });
      return post(url, payload);
    });
    await openNewStory('hi');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(finish).toBeDefined());
    fireEvent.change(input('Title', 'input'), { target: { value: 'Unsaved text typed after Publish' } });
    await act(async () => { finish(); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled());
    expect(input('Title', 'input')).toHaveValue('Unsaved text typed after Publish');
    expect(records['created-hi']).toMatchObject({ title: 'New hi source', status: 'published', translationGroupId: 'backend-assigned-hi' });
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles', 'articles/created-hi/publish']);
    expect(mocks.put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual(['articles/created-hi']);
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('publishedAt');
    expect(records['created-hi']).toMatchObject({
      title: 'Unsaved text typed after Publish', status: 'published', translationGroupId: 'backend-assigned-hi', publishedAt: firstPublishedAt,
    });
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });

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
    expect(mocks.post.mock.calls[1][1]).toEqual({ targetLanguages: languages });
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

  it.each([
    { sourceLanguage: 'gu', targetLanguage: 'en' },
    { sourceLanguage: 'gu', targetLanguage: 'hi' },
    { sourceLanguage: 'hi', targetLanguage: 'gu' },
    { sourceLanguage: 'en', targetLanguage: 'gu' },
  ] as const)('creates only the selected $targetLanguage edition for a new $sourceLanguage source', async ({ sourceLanguage, targetLanguage }) => {
    configureNewStory();
    const before = structuredClone(records);
    await openNewStory(sourceLanguage);
    const labels = { en: 'English', hi: 'Hindi', gu: 'Gujarati' };
    for (const code of editionLanguages.filter(code => code !== sourceLanguage && code !== targetLanguage)) {
      const checkbox = screen.getByRole('checkbox', { name: labels[code] });
      expect(checkbox).toBeChecked();
      fireEvent.click(checkbox);
    }

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(`Translation job queued for ${targetLanguage.toUpperCase()}`));
    const sourceId = `created-${sourceLanguage}`;
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual([
      'articles', `admin/articles/${sourceId}/translations/generate`,
    ]);
    expect(mocks.post.mock.calls[1][1]).toEqual({ targetLanguages: [targetLanguage] });
    expect(Object.keys(records).filter(id => id.startsWith('created-')).sort())
      .toEqual([sourceId, `created-${targetLanguage}`].sort());
    expect(records[`created-${targetLanguage}`]).toMatchObject({
      _id: `created-${targetLanguage}`, sourceArticleId: sourceId,
      sourceLanguage, lang: targetLanguage, language: targetLanguage,
      translationGroupId: records[sourceId].translationGroupId, status: 'draft',
    });
    for (const [id, article] of Object.entries(before)) expect(records[id]).toEqual(article);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
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
  function configureBackendStory(sourceLanguage: typeof editionLanguages[number], status: 'draft' | 'published' = 'published') {
    records = Object.fromEntries(editionLanguages.map(language => [`story-a-${language}`, {
      ...source, status, _id: `story-a-${language}`, title: `Reviewed ${language} headline`, slug: `stored-${language}-slug`,
      content: `Manually reviewed ${language} content that must not be regenerated or replaced by another edition.`,
      summary: `Manually reviewed ${language} summary.`,
      language, lang: language, originalLang: language, sourceLanguage, sourceArticleId: `story-a-${sourceLanguage}`,
      translationKey: 'group-a', machineGenerated: language !== sourceLanguage, humanEdited: true,
      publishedAt: `2026-01-${language === 'en' ? '15' : language === 'hi' ? '16' : '17'}T10:00:00.000Z`,
      imageUrl: `https://images.example.test/${language}.jpg`,
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
      const wire: Partial<Article> = JSON.parse(JSON.stringify(payload));
      const oldCover = typeof current.coverImage === 'object' ? current.coverImage : undefined;
      const oldUrl = oldCover?.url || current.coverImageUrl || current.imageUrl;
      records[id] = { ...current, ...wire };
      if (wire.coverImage && typeof wire.coverImage === 'object') {
        const cover = { ...oldCover, ...wire.coverImage };
        Object.assign(records[id], { coverImage: cover, imageUrl: cover.url, imageURL: cover.url, coverImageUrl: cover.url });
        for (const sibling of Object.values(records).filter(row => row._id !== current._id)) {
          const siblingUrl = typeof sibling.coverImage === 'object' ? sibling.coverImage.url : sibling.coverImageUrl || sibling.imageUrl;
          if (!siblingUrl || siblingUrl === oldUrl) {
            Object.assign(sibling, { coverImage: { ...cover }, imageUrl: cover.url, imageURL: cover.url, coverImageUrl: cover.url });
          }
        }
      }
      return { data: { ok: true, success: true, article: { ...records[id] }, data: { article: { ...records[id] } } } };
    });
  }

  it.each(sourceEditLanguageCases)(
    'saves a linked legacy $editLanguage edition of a $sourceLanguage source without creating group keys',
    async ({ sourceLanguage, editLanguage }) => {
      configureBackendStory(sourceLanguage);
      applyLegacyEditionVariant(Object.values(records), sourceLanguage, 'all-missing-groups');
      const before = structuredClone(records);
      const id = `story-a-${editLanguage}`;
      await open(3, records[id]);
      expect(input('Language', 'select')).toHaveValue(editLanguage);
      expect(screen.queryByText('Canonical source unverified')).not.toBeInTheDocument();
      expect(screen.getByText('No stored group key. Updating this edition will not create one.')).toBeInTheDocument();
      fireEvent.change(input('Title', 'input'), { target: { value: 'Reviewed legacy headline' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
      await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
      expect(mocks.put.mock.calls.map(([url]) => url)).toEqual([`articles/${id}`]);
      const wire = JSON.parse(JSON.stringify(mocks.put.mock.calls[0][1]));
      expect(wire).not.toHaveProperty('translationGroupId');
      expect(wire).not.toHaveProperty('translationKey');
      expect(wire).not.toHaveProperty('sourceArticleId');
      expect(wire).not.toHaveProperty('publishedAt');
      expect(wire).not.toHaveProperty('status');
      expect(wire).not.toHaveProperty('coverImage');
      expect(records[id]).toMatchObject({ ...before[id], title: 'Reviewed legacy headline' });
      for (const language of editionLanguages) {
        expect(records[`story-a-${language}`].translationGroupId).toBeUndefined();
        expect(records[`story-a-${language}`].translationKey).toBeUndefined();
        if (language !== editLanguage) expect(records[`story-a-${language}`]).toEqual(before[`story-a-${language}`]);
      }
      expect(mocks.post).not.toHaveBeenCalled();
    },
  );

  it.each([
    { variant: 'child-missing-groups', sourceLanguage: 'gu', editLanguage: 'hi' },
    { variant: 'source-missing-groups', sourceLanguage: 'hi', editLanguage: 'hi' },
    { variant: 'placeholder-groups', sourceLanguage: 'en', editLanguage: 'gu' },
    { variant: 'placeholder-group-with-key', sourceLanguage: 'gu', editLanguage: 'hi' },
    { variant: 'translation-key-only', sourceLanguage: 'hi', editLanguage: 'en' },
    { variant: 'original-language-only-source', sourceLanguage: 'gu', editLanguage: 'gu' },
    { variant: 'nested-canonical-metadata', sourceLanguage: 'hi', editLanguage: 'gu' },
    ...editionLanguages.map(sourceLanguage => ({
      variant: 'language-aliases' as const, sourceLanguage,
      editLanguage: editionLanguages.find(language => language !== sourceLanguage)!,
    })),
  ] as const)('hydrates and saves legacy $variant for $sourceLanguage/$editLanguage', async ({ variant, sourceLanguage, editLanguage }) => {
    configureBackendStory(sourceLanguage);
    applyLegacyEditionVariant(Object.values(records), sourceLanguage, variant);
    const before = structuredClone(records);
    const id = `story-a-${editLanguage}`;
    await open(3, records[id]);
    expect(input('Language', 'select')).toHaveValue(editLanguage);
    expect(screen.getByText('Source Language').parentElement).toHaveTextContent(`(${sourceLanguage})`);
    fireEvent.change(input('Title', 'input'), { target: { value: 'A verified legacy update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual([`articles/${id}`]);
    expect(records[id]).toMatchObject({
      ...before[id], title: 'A verified legacy update', language: editLanguage, lang: editLanguage,
    });
    expect(records[id].translationGroupId).toBe(before[id].translationGroupId);
    expect(records[id].translationKey).toBe(before[id].translationKey);
    expect(records[id].sourceArticleId).toBe(before[id].sourceArticleId);
    expect(records[id].translationMeta).toEqual(before[id].translationMeta);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each([
    ...(['all-missing-groups', 'placeholder-groups'] as const).flatMap(variant =>
      sourceEditLanguageCases.map(combination => ({ ...combination, variant }))),
    ...(['child-missing-groups', 'source-missing-groups', 'trimmed-group-keys',
      'translation-key-only', 'original-language-only-source', 'language-aliases'] as const).flatMap(variant =>
      editionLanguages.map(sourceLanguage => ({ sourceLanguage, editLanguage: sourceLanguage, variant }))),
  ])('generates verified legacy $variant for $sourceLanguage/$editLanguage and then saves the same CMS edition', async ({
    sourceLanguage, editLanguage, variant,
  }) => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    configureBackendStory(sourceLanguage);
    const target = editionLanguages.find(code => code !== sourceLanguage && code !== editLanguage)!;
    delete records[`story-a-${target}`];
    applyLegacyEditionVariant(Object.values(records), sourceLanguage, variant);
    const before = structuredClone(records);
    completeGeneration();
    const sourceId = `story-a-${sourceLanguage}`;
    const editedId = `story-a-${editLanguage}`;
    await open(2, records[editedId]);
    fireEvent.change(input('Title', 'input'), { target: { value: 'Preserved unsaved legacy headline' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3));
    expect(mocks.error).not.toHaveBeenCalled();
    expect(screen.queryByText(/Edition identity is unverified/)).not.toBeInTheDocument();
    expect(input('Title', 'input')).toHaveValue('Preserved unsaved legacy headline');
    expect(input('Language', 'select')).toHaveValue(editLanguage);
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith(`articles/${sourceId}/translations/generate`, {
      targetLanguages: [target], overwrite: false,
    });
    expect(mocks.put).not.toHaveBeenCalled();
    const group = records[sourceId].translationGroupId;
    expect(group).toBeTruthy();
    for (const [id, article] of Object.entries(before)) {
      expect(records[id]).toEqual(id === sourceId ? { ...article, translationGroupId: group, translationKey: group } : article);
    }
    expect(records[`story-a-${target}`]).toMatchObject({
      lang: target, language: target, sourceArticleId: sourceId, sourceLanguage, status: 'draft',
      translationGroupId: group, translationKey: group, humanEdited: false,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.put.mock.calls[0][0]).toBe(`articles/${editedId}`);
    const wire = JSON.parse(JSON.stringify(mocks.put.mock.calls[0][1]));
    for (const field of ['publishedAt', 'sourceArticleId', 'translationKey', 'status', 'coverImage', 'coverImageUrl', 'imageUrl']) {
      expect(wire).not.toHaveProperty(field);
    }
    if (!articleEditionGroupKey(before[editedId]) && editedId !== sourceId) expect(wire).not.toHaveProperty('translationGroupId');
    expect(records[editedId]).toMatchObject({
      title: 'Preserved unsaved legacy headline', publishedAt: before[editedId].publishedAt,
      slug: before[editedId].slug, coverImage: before[editedId].coverImage, sourceArticleId: sourceId, status: 'published',
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.put).toHaveBeenCalledTimes(1);
  });

  it.each([
    { name: 'missing receipt metadata', patch: { sourceLanguage: undefined, translationGroupId: undefined, translationKey: undefined } },
    { name: 'conflicting receipt group', patch: { translationGroupId: 'other-group', translationKey: 'other-group' } },
    { name: 'conflicting source language', patch: { sourceLanguage: 'hi' } },
    { name: 'conflicting source ID', patch: { sourceArticleId: 'story-a-hi' } },
    { name: 'wrong target language', patch: { targetLanguages: ['hi'] } },
    { name: 'duplicate target languages', patch: { targetLanguages: ['en', 'en'] } },
    { name: 'different created CMS ID', patch: { created: { en: 'another-en' } } },
    { name: 'missing created ID', patch: { created: {} } },
    { name: 'unrequested updated edition', patch: { updated: { hi: 'story-a-hi' } } },
    { name: 'failed target', patch: { failed: { en: ['translation failed'] } } },
    { name: 'duplicate created and skipped target', patch: { skipped: { en: { id: 'story-a-en', reason: 'human_edited' } } } },
    { name: 'invalid skipped reason', patch: { created: {}, skipped: { en: { id: 'story-a-en', reason: 'unverified' } } } },
  ])('pauses key initialization after $name without adopting identity or replaying generation', async ({ patch }) => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    configureBackendStory('gu');
    delete records['story-a-en'];
    applyLegacyEditionVariant(Object.values(records), 'gu', 'all-missing-groups');
    completeGeneration();
    const post = mocks.post.getMockImplementation()!;
    mocks.post.mockImplementation(async (url, payload) => {
      const result = await post(url, payload);
      if (!result.data || typeof result.data !== 'object') throw new Error('Missing fixture receipt');
      return { data: { ...result.data, ...patch } };
    });
    const { client } = await open(2, records['story-a-gu']);
    fireEvent.change(input('Title', 'input'), { target: { value: 'Keep this unverified-generation buffer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    await screen.findByText(/Do not repeat the accepted generation request/);
    expect(screen.getAllByRole('alert').some(alert => alert.textContent?.includes('Founder review is required'))).toBe(true);
    expect(screen.getByRole('button', { name: 'Save Update' })).toBeDisabled();
    expect(input('Title', 'input')).toHaveValue('Keep this unverified-generation buffer');
    expect(client.getQueryData<ArticleTranslationEditions>(['articles', 'translationEditions', 'story-a-gu'])?.translationGroupId).toBeNull();
    expect(input('Translation Group ID (optional)', 'input')).toHaveValue('');
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Translations' }));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it.each(['changed held ID', 'changed canonical link', 'changed held group', 'uninitialized source', 'failed verification'] as const)(
    'keeps buffers and pauses after accepted legacy generation with %s',
    async failure => {
      vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
      configureBackendStory('gu');
      delete records['story-a-en'];
      applyLegacyEditionVariant(Object.values(records), 'gu', 'placeholder-groups');
      completeGeneration();
      const post = mocks.post.getMockImplementation()!;
      mocks.post.mockImplementation(async (url, payload) => {
        const result = await post(url, payload);
        if (failure === 'changed held ID') {
          records['replacement-hi'] = { ...records['story-a-hi'], _id: 'replacement-hi' };
          delete records['story-a-hi'];
        } else if (failure === 'changed canonical link') {
          records['story-a-gu'] = { ...records['story-a-gu'], sourceArticleId: 'story-a-hi' };
        } else if (failure === 'changed held group') {
          records['story-a-hi'] = { ...records['story-a-hi'], translationGroupId: 'initialized-story-group', translationKey: 'initialized-story-group' };
        } else if (failure === 'uninitialized source') {
          records['story-a-gu'] = { ...records['story-a-gu'], translationGroupId: 'null', translationKey: 'undefined' };
        } else {
          lookupFailure = { response: { status: 503, data: {} } };
        }
        return result;
      });
      const { client } = await open(2, records['story-a-gu']);
      fireEvent.change(input('Title', 'input'), { target: { value: 'Keep the previous CMS edition buffer' } });
      fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
      await screen.findByText(/Do not repeat the accepted generation request/);
      expect(screen.getByRole('button', { name: 'Save Update' })).toBeDisabled();
      expect(input('Title', 'input')).toHaveValue('Keep the previous CMS edition buffer');
      expect(client.getQueryData<ArticleTranslationEditions>(['articles', 'translationEditions', 'story-a-gu'])?.translationGroupId).toBeNull();
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      fireEvent.click(screen.getByRole('button', { name: 'Regenerate Translations' }));
      expect(mocks.post).toHaveBeenCalledTimes(1);
      expect(mocks.put).not.toHaveBeenCalled();
    },
  );

  it('accepts a verified skipped human-edited target without overwriting it during key initialization', async () => {
    configureBackendStory('hi');
    applyLegacyEditionVariant(Object.values(records), 'hi', 'all-missing-groups');
    const humanEdition = structuredClone(records['story-a-en']);
    delete records['story-a-en'];
    completeGeneration();
    const post = mocks.post.getMockImplementation()!;
    mocks.post.mockImplementation(async (url, payload) => {
      records['story-a-en'] = humanEdition;
      return post(url, payload);
    });
    await open(2, records['story-a-hi']);
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3));
    expect(records['story-a-en']).toEqual(humanEdition);
    expect(mocks.error).not.toHaveBeenCalled();
    expect(mocks.post).toHaveBeenCalledExactlyOnceWith('articles/story-a-hi/translations/generate', {
      targetLanguages: ['en'], overwrite: false,
    });
    expect(mocks.put).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled();
  });

  it('keeps both source and sibling buffers when a keyless source is initialized', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    configureBackendStory('gu');
    delete records['story-a-en'];
    applyLegacyEditionVariant(Object.values(records), 'gu', 'all-missing-groups');
    const before = structuredClone(records);
    completeGeneration();
    await open(2, records['story-a-gu']);
    fireEvent.change(input('Title', 'input'), { target: { value: 'Unsaved Gujarati source' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Story content' }), { target: { value: 'Unsaved Gujarati body' } });
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Unsaved Hindi sibling' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3));
    expect(input('Title', 'input')).toHaveValue('Unsaved Hindi sibling');
    fireEvent.change(input('Language', 'select'), { target: { value: 'gu' } });
    expect(input('Title', 'input')).toHaveValue('Unsaved Gujarati source');
    expect(screen.getByRole('textbox', { name: 'Story content' })).toHaveValue('Unsaved Gujarati body');
    expect(records['story-a-hi']).toEqual(before['story-a-hi']);
    expect(records['story-a-gu']).toEqual({
      ...before['story-a-gu'], translationGroupId: 'initialized-story-group', translationKey: 'initialized-story-group',
    });
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it('does not let an older edition read replace the verified initialized group', async () => {
    configureBackendStory('gu');
    delete records['story-a-en'];
    applyLegacyEditionVariant(Object.values(records), 'gu', 'all-missing-groups');
    completeGeneration();
    const post = mocks.post.getMockImplementation()!;
    const get = mocks.get.getMockImplementation()!;
    let finishPost!: () => void;
    let finishOldRead!: () => void;
    let holdOldRead = false;
    mocks.post.mockImplementation(async (url, payload) => {
      await new Promise<void>(resolve => { finishPost = resolve; });
      return post(url, payload);
    });
    mocks.get.mockImplementation(async url => {
      const result = await get(url);
      if (holdOldRead && url === 'articles/story-a-gu/translation-status') {
        holdOldRead = false;
        await new Promise<void>(resolve => { finishOldRead = resolve; });
      }
      return result;
    });
    const { client } = await open(2, records['story-a-gu']);
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    await waitFor(() => expect(finishPost).toBeDefined());
    holdOldRead = true;
    let staleRead!: Promise<void>;
    act(() => { staleRead = client.refetchQueries({ queryKey: ['articles', 'translationEditions', 'story-a-gu'] }); });
    await waitFor(() => expect(finishOldRead).toBeDefined());
    await act(async () => { finishPost(); });
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3));
    await act(async () => { finishOldRead(); await staleRead; });
    expect(client.getQueryData<ArticleTranslationEditions>(['articles', 'translationEditions', 'story-a-gu'])?.translationGroupId)
      .toBe('initialized-story-group');
    expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3);
    expect(input('Translation Group ID (optional)', 'input')).toHaveValue('initialized-story-group');
    fireEvent.change(input('Title', 'input'), { target: { value: 'Safe after an older response' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual(['articles/story-a-gu']);
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it('does not apply a late initialized-group acknowledgement to a different workspace', async () => {
    configureBackendStory('gu');
    delete records['story-a-en'];
    applyLegacyEditionVariant(Object.values(records), 'gu', 'all-missing-groups');
    completeGeneration();
    const get = mocks.get.getMockImplementation()!;
    let finish!: () => void;
    mocks.get.mockImplementation(async url => {
      const result = await get(url);
      if (url === 'articles/story-a-en') await new Promise<void>(resolve => { finish = resolve; });
      return result;
    });
    const mounted = await open(2, records['story-a-gu']);
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    await waitFor(() => expect(finish).toBeDefined());
    const other: Article = {
      ...source, _id: 'other-gu', title: 'Different workspace', lang: 'gu', language: 'gu',
      originalLang: 'gu', sourceLanguage: 'gu', sourceArticleId: 'other-gu',
      translationGroupId: 'other-group', translationKey: 'other-group',
    };
    records = { 'other-gu': other };
    mounted.rerender(editor(mounted.client, other));
    await waitFor(() => expect(input('Title', 'input')).toHaveValue('Different workspace'));
    await act(async () => { finish(); });
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(1));
    expect(input('Title', 'input')).toHaveValue('Different workspace');
    expect(input('Translation Group ID (optional)', 'input')).toHaveValue('other-group');
    expect(records['other-gu']).toEqual(other);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it('uses the verified nested canonical source for missing-edition generation', async () => {
    configureBackendStory('gu');
    applyLegacyEditionVariant(Object.values(records), 'gu', 'nested-canonical-metadata');
    delete records['story-a-en'];
    completeGeneration();
    await open(2, records['story-a-hi']);
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledExactlyOnceWith('articles/story-a-gu/translations/generate', {
      targetLanguages: ['en'], overwrite: false,
    }));
    await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3));
    expect(mocks.put).not.toHaveBeenCalled();
    expect(records['story-a-en']).toMatchObject({ lang: 'en', sourceArticleId: 'story-a-gu', status: 'draft' });
  });

  it('keeps legacy buffers and sends no mutation after a nested source link conflicts', async () => {
    configureBackendStory('gu');
    applyLegacyEditionVariant(Object.values(records), 'gu', 'all-missing-groups');
    await open(3, records['story-a-hi']);
    fireEvent.change(input('Title', 'input'), { target: { value: 'Keep this legacy edit' } });
    records['story-a-hi'].translationMeta = { sourceArticleId: 'story-a-en' };
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Founder review is required'));
    expect(screen.getByRole('alert')).toHaveTextContent('Autosave is paused');
    expect(input('Title', 'input')).toHaveValue('Keep this legacy edit');
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(['lookup', 'save'] as const)('preserves exact source-identity 409 Founder guidance after %s without retry', async phase => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    configureBackendStory('gu');
    const before = structuredClone(records);
    await open(3, records['story-a-hi']);
    fireEvent.change(input('Title', 'input'), { target: { value: 'Keep my unpublished changes to this published edition' } });
    const message = 'Conflicting translation source links. Founder review is required.';
    const error = { response: { status: 409, data: { code: 'TRANSLATION_SOURCE_IDENTITY_INVALID', message } } };
    if (phase === 'lookup') lookupFailure = error;
    else mocks.put.mockRejectedValueOnce(error);
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(message));
    expect(screen.getByRole('alert')).toHaveTextContent('Autosave is paused');
    expect(input('Language', 'select')).toHaveValue('hi');
    expect(input('Title', 'input')).toHaveValue('Keep my unpublished changes to this published edition');
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(mocks.put).toHaveBeenCalledTimes(phase === 'save' ? 1 : 0);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(records).toEqual(before);
  });

  it('sanitizes an untrusted source-identity 409 message while retaining Founder guidance and edits', async () => {
    configureBackendStory('gu');
    await open(3, records['story-a-hi']);
    lookupFailure = { response: { status: 409, data: { code: 'TRANSLATION_SOURCE_IDENTITY_INVALID', message: 'PrivateDiagnostic: untrusted details' } } };
    fireEvent.change(input('Title', 'input'), { target: { value: 'Do not lose this title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(TRANSLATION_SOURCE_REVIEW_MESSAGE));
    expect(screen.queryByText(/PrivateDiagnostic/)).not.toBeInTheDocument();
    expect(input('Title', 'input')).toHaveValue('Do not lose this title');
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('secondary cover: preserves a rejected selection and retries only its unsaved edition', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    configureBackendStory('gu', 'draft');
    const before = structuredClone(records);
    const put = mocks.put.getMockImplementation()!;
    let rejectHindi = true;
    mocks.put.mockImplementation(async (url, payload) => {
      if (url === 'articles/story-a-hi' && rejectHindi) {
        rejectHindi = false;
        throw { response: { status: 409, data: {} } };
      }
      return put(url, payload);
    });
    await open(3, records['story-a-gu']);
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    fireEvent.change(input('Language', 'select'), { target: { value: 'gu' } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Acknowledged Gujarati draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await screen.findByText(/GU saved.*HI save did not complete/);
    expect(mocks.put.mock.calls[1][1]).toMatchObject({ coverImage: { url: mocks.libraryUrl, publicId: null } });
    expect(records['story-a-hi']).toEqual(before['story-a-hi']);
    expect(mocks.success).not.toHaveBeenCalledWith('Draft updated');
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(mocks.put).toHaveBeenCalledTimes(2);
    const refresh = screen.getByRole('button', { name: 'Refresh latest state' });
    await waitFor(() => expect(refresh).toBeEnabled());
    fireEvent.click(refresh);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled());
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    expect(screen.getByTestId('cover-url')).toHaveTextContent(mocks.libraryUrl);
    fireEvent.change(input('Language', 'select'), { target: { value: 'gu' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Draft updated'));
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual([
      'articles/story-a-gu', 'articles/story-a-hi', 'articles/story-a-hi',
    ]);
    expect(records['story-a-hi'].coverImage).toEqual({ url: mocks.libraryUrl, publicId: null });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('secondary cover: acknowledges only the submitted revision when a newer upload finishes during its save', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    configureBackendStory('gu', 'draft');
    await open(3, records['story-a-gu']);
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    let finishUpload!: () => void;
    mocks.upload.mockImplementationOnce(() => new Promise(resolve => {
      finishUpload = () => resolve({ url: mocks.libraryUrl, publicId: 'newer-secondary-asset' });
    }));
    fireEvent.change(screen.getByLabelText('Test cover file'), {
      target: { files: [new File(['synthetic'], 'newer-secondary.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.change(input('Language', 'select'), { target: { value: 'gu' } });
    const put = mocks.put.getMockImplementation()!;
    let finishSave!: () => void;
    mocks.put.mockImplementation(async (url, payload) => {
      if (url === 'articles/story-a-hi') await new Promise<void>(resolve => { finishSave = resolve; });
      return put(url, payload);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(finishSave).toBeDefined());
    await act(async () => { finishUpload(); finishSave(); });
    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('Draft updated');
      expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled();
    });
    expect(records['story-a-hi'].coverImage).toEqual({ url: mocks.libraryUrl, publicId: null });
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    expect(screen.getByTestId('cover-url')).toHaveTextContent(mocks.libraryUrl);
    mocks.put.mockImplementation(put);
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success.mock.calls.filter(([message]) => message === 'Draft updated')).toHaveLength(2));
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual([
      'articles/story-a-gu', 'articles/story-a-hi', 'articles/story-a-hi',
    ]);
    expect(mocks.put.mock.calls[2][1]).toMatchObject({
      coverImage: { url: mocks.libraryUrl, publicId: 'newer-secondary-asset' },
    });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('cover intent: preserves a pending cover choice across another edition save without copying it', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    configureBackendStory('gu');
    const before = structuredClone(records);
    await open(3, records['story-a-gu']);
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    expect(screen.getByTestId('cover-url')).toHaveTextContent('https://images.example.test/hi.jpg');
    fireEvent.change(input('Title', 'input'), { target: { value: 'Independent Hindi edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('Article updated');
      expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled();
    });
    expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('coverImage');
    expect(records['story-a-gu']).toEqual(before['story-a-gu']);
    fireEvent.change(input('Language', 'select'), { target: { value: 'gu' } });
    expect(screen.getByTestId('cover-url')).toHaveTextContent(mocks.libraryUrl);
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.put).toHaveBeenCalledTimes(2));
    expect(mocks.put.mock.calls[1]).toEqual(['articles/story-a-gu', expect.objectContaining({
      coverImage: { url: mocks.libraryUrl, publicId: null },
    })]);
    expect(records['story-a-hi'].coverImage).toEqual(before['story-a-hi'].coverImage);
    expect(records['story-a-en']).toEqual(before['story-a-en']);
  });

  it('cover intent: retains a newer same-URL choice while an older save is being acknowledged', async () => {
    configureBackendStory('gu');
    await open(3, records['story-a-hi']);
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    const put = mocks.put.getMockImplementation()!;
    let finish!: () => void;
    mocks.put.mockImplementationOnce((url, payload) => new Promise(resolve => { finish = () => resolve(put(url, payload)); }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(finish).toBeDefined());
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    await act(async () => { finish(); });
    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('Article updated');
      expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success.mock.calls.filter(([message]) => message === 'Article updated')).toHaveLength(2));
    expect(mocks.put).toHaveBeenCalledTimes(2);
    expect(mocks.put.mock.calls[1][1]).toMatchObject({ coverImage: { url: mocks.libraryUrl, publicId: null } });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('cover intent: does not resend an acknowledged cover during a later text-only update', async () => {
    configureBackendStory('gu');
    await open(3, records['story-a-hi']);
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('Article updated');
      expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled();
    });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Later text-only update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success.mock.calls.filter(([message]) => message === 'Article updated')).toHaveLength(2));
    expect(mocks.put.mock.calls[1][1]).not.toHaveProperty('coverImage');
    expect(mocks.put.mock.calls[1][1]).not.toHaveProperty('imageUrl');
    expect(records['story-a-hi'].coverImage).toEqual({ url: mocks.libraryUrl, publicId: null });
  });

  it('cover intent: displays refreshed cover metadata rather than an already acknowledged selection after switching', async () => {
    configureBackendStory('gu');
    const { client } = await open(3, records['story-a-hi']);
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('Article updated');
      expect(screen.getByRole('button', { name: 'Save Update' })).toBeEnabled();
    });
    records['story-a-hi'].coverImage = { url: 'https://images.example.test/refreshed-hi.jpg', publicId: 'refreshed-hi' };
    records['story-a-hi'].coverImageUrl = 'https://images.example.test/refreshed-hi.jpg';
    await act(async () => { await client.invalidateQueries({ queryKey: ['articles'] }); });
    fireEvent.change(input('Language', 'select'), { target: { value: 'gu' } });
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    expect(screen.getByTestId('cover-url')).toHaveTextContent('https://images.example.test/refreshed-hi.jpg');
    expect(mocks.put).toHaveBeenCalledTimes(1);
  });

  it('cover intent: binds an upload finishing after a language switch to its original edition', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    configureBackendStory('gu');
    await open(3, records['story-a-gu']);
    let finish!: () => void;
    mocks.upload.mockImplementationOnce(() => new Promise(resolve => {
      finish = () => resolve({ url: 'https://images.example.test/late-gu.jpg', publicId: 'late-gu-asset' });
    }));
    fireEvent.change(screen.getByLabelText('Test cover file'), {
      target: { files: [new File(['synthetic'], 'gu.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => expect(finish).toBeDefined());
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    await act(async () => { finish(); });
    expect(input('Language', 'select')).toHaveValue('hi');
    expect(screen.getByTestId('cover-url')).toHaveTextContent('https://images.example.test/hi.jpg');
    expect(mocks.put).not.toHaveBeenCalled();
    fireEvent.change(input('Language', 'select'), { target: { value: 'gu' } });
    expect(screen.getByTestId('cover-url')).toHaveTextContent('https://images.example.test/late-gu.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith('articles/story-a-gu', expect.objectContaining({
      coverImage: { url: 'https://images.example.test/late-gu.jpg', publicId: 'late-gu-asset' },
    }));
    expect(records['story-a-hi'].coverImageUrl).toBe('https://images.example.test/hi.jpg');
  });

  it('cover intent: ignores an upload completing after the article workspace changes', async () => {
    configureBackendStory('gu');
    const { client, rerender } = await open(3, records['story-a-gu']);
    let finish!: () => void;
    mocks.upload.mockImplementationOnce(() => new Promise(resolve => {
      finish = () => resolve({ url: 'https://images.example.test/previous-workspace.jpg', publicId: 'previous-asset' });
    }));
    fireEvent.change(screen.getByLabelText('Test cover file'), {
      target: { files: [new File(['synthetic'], 'previous.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => expect(finish).toBeDefined());
    rerender(editor(client, records['story-a-hi']));
    await waitFor(() => expect(input('Language', 'select')).toHaveValue('hi'));
    await act(async () => { finish(); });
    expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('previous workspace'));
    expect(screen.getByTestId('cover-url')).toHaveTextContent('https://images.example.test/hi.jpg');
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(['success', 'failure'] as const)('cover intent: preserves a later Library choice when an earlier upload finishes with %s', async result => {
    configureBackendStory('gu');
    await open(3, records['story-a-hi']);
    let finish!: () => void;
    mocks.upload.mockImplementationOnce(() => new Promise((resolve, reject) => {
      finish = () => result === 'success'
        ? resolve({ url: 'https://images.example.test/obsolete-upload.jpg', publicId: 'obsolete-asset' })
        : reject(new Error('Earlier upload failed'));
    }));
    fireEvent.change(screen.getByLabelText('Test cover file'), {
      target: { files: [new File(['synthetic'], 'earlier.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => expect(finish).toBeDefined());
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    await act(async () => { finish(); });
    expect(screen.getByTestId('cover-url')).toHaveTextContent(mocks.libraryUrl);
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith('articles/story-a-hi', expect.objectContaining({
      coverImage: { url: mocks.libraryUrl, publicId: null },
    }));
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(['older-first', 'newer-first'] as const)('cover intent: orders overlapping uploads by file selection rather than response order (%s)', async order => {
    configureBackendStory('gu');
    await open(3, records['story-a-hi']);
    const finish: Array<() => void> = [];
    mocks.upload.mockImplementation(file => new Promise(resolve => {
      finish.push(() => resolve({ url: `https://images.example.test/${file.name}`, publicId: file.name }));
    }));
    for (const name of ['earlier.jpg', 'latest.jpg']) {
      fireEvent.change(screen.getByLabelText('Test cover file'), {
        target: { files: [new File(['synthetic'], name, { type: 'image/jpeg' })] },
      });
    }
    await waitFor(() => expect(finish).toHaveLength(2));
    const sequence = order === 'older-first' ? [0, 1] : [1, 0];
    await act(async () => { finish[sequence[0]](); });
    if (order === 'older-first') expect(screen.getByText(/^Uploading/)).toBeInTheDocument();
    await act(async () => { finish[sequence[1]](); });
    expect(screen.getByTestId('cover-url')).toHaveTextContent('https://images.example.test/latest.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith('articles/story-a-hi', expect.objectContaining({
      coverImage: { url: 'https://images.example.test/latest.jpg', publicId: 'latest.jpg' },
    }));
  });

  it('cover intent: retains the previous unsaved cover choice when its replacement upload fails', async () => {
    configureBackendStory('gu');
    await open(3, records['story-a-hi']);
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    mocks.upload.mockRejectedValueOnce(new Error('Replacement upload failed'));
    fireEvent.change(screen.getByLabelText('Test cover file'), {
      target: { files: [new File(['synthetic'], 'failed.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(screen.getByTestId('cover-url')).toHaveTextContent(mocks.libraryUrl);
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put).toHaveBeenCalledWith('articles/story-a-hi', expect.objectContaining({
      coverImage: { url: mocks.libraryUrl, publicId: null },
    }));
  });

  it.each(['Library', 'upload'] as const)('cover intent: preserves a %s selection made while the first source save is pending', async selection => {
    configureNewStory();
    await openNewStory();
    fireEvent.click(screen.getByLabelText('Generate translations after Save Draft'));
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    const submittedUrl = mocks.libraryUrl;
    const post = mocks.post.getMockImplementation()!;
    let finish!: () => Promise<void>;
    mocks.post.mockImplementationOnce((url, payload) => new Promise(resolve => {
      finish = async () => resolve(await post(url, payload));
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(finish).toBeDefined());
    mocks.libraryUrl = 'https://images.example.test/newer-create-choice.jpg';
    let finishUpload: (() => void) | undefined;
    if (selection === 'Library') {
      fireEvent.click(screen.getByText('Choose test cover'));
      fireEvent.click(screen.getByText('Use test cover'));
    } else {
      mocks.upload.mockImplementationOnce(() => new Promise(resolve => {
        finishUpload = () => resolve({ url: mocks.libraryUrl, publicId: 'late-create-asset' });
      }));
      fireEvent.change(screen.getByLabelText('Test cover file'), {
        target: { files: [new File(['synthetic'], 'late-create.jpg', { type: 'image/jpeg' })] },
      });
      await waitFor(() => expect(finishUpload).toBeDefined());
    }
    await act(async () => { await finish(); });
    if (finishUpload) await act(async () => { finishUpload!(); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled());
    expect(records['created-gu'].coverImage).toMatchObject({ url: submittedUrl });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Draft updated'));
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith('articles/created-gu', expect.objectContaining({
      coverImage: { url: mocks.libraryUrl, publicId: selection === 'Library' ? null : 'late-create-asset' },
    }));
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles']);
  });

  it('cover intent: preserves authorized shared-cover synchronization without overwriting a custom sibling cover', async () => {
    configureBackendStory('gu');
    Object.assign(records['story-a-hi'], {
      coverImage: { url: records['story-a-gu'].coverImageUrl!, publicId: 'cover-gu' },
      coverImageUrl: records['story-a-gu'].coverImageUrl, imageUrl: records['story-a-gu'].imageUrl,
    });
    const customSibling = structuredClone(records['story-a-en']);
    await open(3, records['story-a-gu']);
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual(['articles/story-a-gu']);
    expect(records['story-a-hi'].coverImage).toEqual({ url: mocks.libraryUrl, publicId: null });
    expect(records['story-a-en']).toEqual(customSibling);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(sourceEditLanguageCases)(
    'updates a published $editLanguage edition of a $sourceLanguage source through the actual Backend-shaped contract',
    async ({ sourceLanguage, editLanguage }) => {
      configureBackendStory(sourceLanguage);
      const before = structuredClone(records);
      const id = `story-a-${editLanguage}`;
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
      clients.push(client);
      render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/admin/articles/${id}/edit`]}>
        <Routes><Route path="/admin/articles/:id/edit" element={<ArticleEditPage />} /></Routes>
      </MemoryRouter></QueryClientProvider>);
      await waitFor(() => expect(screen.getAllByTitle('Open this language variant')).toHaveLength(3));
      await screen.findByText('No Trending Topics are available.');
      const sourceLabel = { en: 'English (en)', hi: 'Hindi (hi)', gu: 'Gujarati (gu)' }[sourceLanguage];
      expect(screen.getByText('Source Language').parentElement).toHaveTextContent(sourceLabel);
      expect(input('Language', 'select')).toHaveValue(editLanguage);
      expect(input('Title', 'input')).toHaveValue(before[id].title);
      fireEvent.change(input('Title', 'input'), { target: { value: `Approved ${editLanguage} headline update` } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
      await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
      expect(mocks.put).toHaveBeenCalledTimes(1);
      const [url, payload] = mocks.put.mock.calls[0];
      expect(url).toBe(`articles/${id}`);
      expect(payload).toMatchObject({
        title: `Approved ${editLanguage} headline update`, slug: before[id].slug,
        language: editLanguage, lang: editLanguage, translationGroupId: 'group-a',
        content: before[id].content, summary: before[id].summary,
      });
      expect(payload).not.toHaveProperty('status');
      expect(payload).not.toHaveProperty('publishedAt');
      expect(payload).not.toHaveProperty('sourceArticleId');
      expect(payload).not.toHaveProperty('sourceLanguage');
      expect(payload).not.toHaveProperty('originalLang');
      expect(records[id]).toMatchObject({
        ...before[id], title: `Approved ${editLanguage} headline update`,
      });
      for (const language of editionLanguages.filter(code => code !== editLanguage)) {
        expect(records[`story-a-${language}`]).toEqual(before[`story-a-${language}`]);
      }
      expect(mocks.post).not.toHaveBeenCalled();
      expect(mocks.error).not.toHaveBeenCalled();
      expect(screen.queryByText('Canonical source unverified')).not.toBeInTheDocument();
    },
  );

  it('uses the scalar canonical CMS source for source labels rather than the child originalLang', async () => {
    configureBackendStory('gu');
    Object.values(records).forEach(record => { delete record.sourceLanguage; });
    await open(3, records['story-a-hi']);
    expect(screen.getByText('Source Language').parentElement).toHaveTextContent('Gujarati (gu)');
    expect(screen.queryByText('Canonical source unverified')).not.toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(sourceEditLanguageCases)(
    'preserves edition-specific media when selecting $editLanguage in the $sourceLanguage source workspace',
    async ({ sourceLanguage, editLanguage }) => {
      configureBackendStory(sourceLanguage);
      const before = structuredClone(records);
      await open(3, records[`story-a-${sourceLanguage}`]);
      fireEvent.change(input('Language', 'select'), { target: { value: editLanguage } });
      const id = `story-a-${editLanguage}`;
      expect(input('Title', 'input')).toHaveValue(before[id].title);
      fireEvent.change(input('Title', 'input'), { target: { value: `Reviewed ${editLanguage} update after switching` } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
      await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
      expect(mocks.put.mock.calls.map(([url]) => url)).toEqual([`articles/${id}`]);
      expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('imageUrl');
      expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('coverImageUrl');
      expect(mocks.put.mock.calls[0][1]).not.toHaveProperty('coverImage');
      expect(records[id]).toMatchObject({ ...before[id], title: `Reviewed ${editLanguage} update after switching` });
      for (const language of editionLanguages.filter(code => code !== editLanguage)) {
        expect(records[`story-a-${language}`]).toEqual(before[`story-a-${language}`]);
      }
      expect(mocks.post).not.toHaveBeenCalled();
    },
  );

  it('saves an explicitly chosen child cover without copying it back on the next source update', async () => {
    configureBackendStory('gu');
    const sourceCover = records['story-a-gu'].coverImage;
    await open(3, records['story-a-gu']);
    const languageSelect = input('Language', 'select');
    const saveButton = screen.getByRole('button', { name: 'Save Update' });
    fireEvent.change(languageSelect, { target: { value: 'hi' } });
    fireEvent.click(screen.getByText('Choose test cover'));
    fireEvent.click(screen.getByText('Use test cover'));
    fireEvent.click(saveButton);
    await waitFor(() => {
      expect(mocks.success).toHaveBeenCalledWith('Article updated');
      expect(saveButton).toBeEnabled();
    });
    expect(mocks.put).toHaveBeenCalledExactlyOnceWith('articles/story-a-hi', expect.objectContaining({
      coverImage: { url: 'https://images.example.test/reviewed-cover.jpg', publicId: null },
    }));
    fireEvent.change(languageSelect, { target: { value: 'gu' } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Updated original GU headline' } });
    fireEvent.click(saveButton);
    await waitFor(() => expect(mocks.success.mock.calls.filter(([message]) => message === 'Article updated')).toHaveLength(2));
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual(['articles/story-a-hi', 'articles/story-a-gu']);
    expect(mocks.put.mock.calls[1][1]).not.toHaveProperty('coverImage');
    expect(records['story-a-gu'].coverImage).toEqual(sourceCover);
    expect(records['story-a-hi'].coverImage).toMatchObject({ url: 'https://images.example.test/reviewed-cover.jpg' });
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('updates the verified CMS edition rather than a public-copy ID or its canonical source ID', async () => {
    configureBackendStory('gu');
    records['story-a-hi'] = { ...records['story-a-hi'], _id: 'public-copy-hi', sourceNewsId: 'story-a-hi' };
    await open(3, records['story-a-hi']);
    fireEvent.change(input('Title', 'input'), { target: { value: 'Approved HI copy-backed edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Article updated'));
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual(['articles/story-a-hi']);
    expect(mocks.get).not.toHaveBeenCalledWith('articles/public-copy-hi');
    expect(mocks.post).not.toHaveBeenCalled();
    expect(records['story-a-hi'].sourceArticleId).toBe('story-a-gu');
    expect(records['story-a-gu'].title).toBe('Reviewed gu headline');
  });

  it.each([
    { articleId: null }, { articleId: 'story-a-hi' }, { childArticleId: 'unrelated-id' },
    { sourceArticleId: 'unrelated-id' }, { presence: 'duplicate' },
  ])('keeps edits and sends no mutation for inconsistent Backend-shaped edition identity %j', async patch => {
    configureBackendStory('gu');
    const get = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation(async url => {
      if (!url.endsWith('/translation-status')) return get(url);
      const response = backendTranslationStatus(records['story-a-hi'], Object.values(records));
      Object.assign(response.data.perLang.gu, patch);
      return { data: response };
    });
    await open(0, records['story-a-hi']);
    fireEvent.change(input('Title', 'input'), { target: { value: 'Preserve this HI edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Update' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Invalid or ambiguous'));
    expect(input('Title', 'input')).toHaveValue('Preserve this HI edit');
    expect(screen.getByRole('alert')).toHaveTextContent('Autosave is paused');
    expect(mocks.put).not.toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

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

  it.each([
    { language: 'hi', status: 401 }, { language: 'gu', status: 403 },
    { language: 'hi', status: 409 }, { language: 'gu', status: 503 },
  ])('canonical publication: saves $language separately and never replays its save after HTTP $status', async ({ language, status }) => {
    for (const id of ['story-a-en', 'story-a-hi', 'story-a-gu']) records[id].status = 'draft';
    const id = `story-a-${language}`;
    records[id].publishedAt = '2026-01-20T10:00:00.000Z';
    const before = structuredClone(records);
    const { client } = await open();
    fireEvent.change(input('Language', 'select'), { target: { value: language } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Saved translated publication text' } });
    mocks.post.mockRejectedValueOnce({ response: { status, data: {} } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toHaveTextContent(new RegExp(`${language.toUpperCase()} saved.*Publication did not complete`)));
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual([`articles/${id}`]);
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual([`articles/${id}/publish`]);
    expect(mocks.put.mock.invocationCallOrder[0]).toBeLessThan(mocks.post.mock.invocationCallOrder[0]);
    expect(records[id].title).toBe('Saved translated publication text');
    fireEvent.click(await enabledStoryAction('Refresh latest state'));
    fireEvent.click(await enabledStoryAction('Publish'));
    await enabledStoryAction('Save Update');
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual([`articles/${id}/publish`, `articles/${id}/publish`]);
    expect(records[id]).toMatchObject({ ...before[id], status: 'published', title: 'Saved translated publication text' });
    expect(records[source._id]).toEqual({ ...before[source._id], status: 'published' });
    expect(client.getQueryData(['articles', 'one', id])).toMatchObject({
      _id: id, lang: language, publishedAt: before[id].publishedAt, title: 'Saved translated publication text',
    });
    expect(input('Language', 'select')).toHaveValue(language);
    expect(input('Title', 'input')).toHaveValue('Saved translated publication text');
    expect(records['unrelated-hi'].title).toBe('Unrelated hi');
  });

  it('canonical publication: refuses an unresolved source without publishing or dropping edits', async () => {
    for (const id of ['story-a-en', 'story-a-hi', 'story-a-gu']) {
      records[id].status = 'draft';
      delete records[id].sourceLanguage;
    }
    await open();
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Keep this unresolved-source edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await screen.findByText(/canonical source.*unverified/i);
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/canonical source.*unverified/i)));
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
    expect(input('Title', 'input')).toHaveValue('Keep this unresolved-source edit');
  });

  it('canonical publication: rechecks the source after saving the selected edition', async () => {
    for (const id of ['story-a-en', 'story-a-hi', 'story-a-gu']) records[id].status = 'draft';
    const put = mocks.put.getMockImplementation()!;
    mocks.put.mockImplementation(async (url, payload) => {
      const result = await put(url, payload);
      for (const id of ['story-a-en', 'story-a-hi', 'story-a-gu']) records[id].sourceLanguage = 'gu';
      return result;
    });
    await open();
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Acknowledged Hindi edition' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await screen.findByText(/HI saved.*Publication did not complete/);
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual(['articles/story-a-hi']);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(records['story-a-hi'].title).toBe('Acknowledged Hindi edition');
    expect(input('Title', 'input')).toHaveValue('Acknowledged Hindi edition');
  });

  it('canonical publication: never uses the source receipt as the child state when its refresh fails', async () => {
    configureBackendStory('gu', 'draft');
    records['story-a-hi'].tags = ['child-only-tag'];
    records['story-a-gu'].tags = ['source-only-tag'];
    const before = structuredClone(records);
    const post = mocks.post.getMockImplementation()!;
    const get = mocks.get.getMockImplementation()!;
    let published = false;
    mocks.post.mockImplementation(async (url, payload) => {
      const result = await post(url, payload);
      published = true;
      return { ...result, data: { article: { ...records['story-a-gu'] }, publishedLanguages: ['en', 'hi', 'gu'] } };
    });
    mocks.get.mockImplementation(async url => {
      if (published && url === 'articles/story-a-hi') throw { response: { status: 503, data: {} } };
      return get(url);
    });
    const { client } = await open(3, records['story-a-hi']);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await screen.findByText(/change was saved, but the latest article could not be loaded/);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh latest state' })).toBeEnabled());
    expect(mocks.post.mock.calls.map(([url]) => url)).toEqual(['articles/story-a-hi/publish']);
    expect(mocks.put).not.toHaveBeenCalled();
    expect(input('Language', 'select')).toHaveValue('hi');
    expect(input('Title', 'input')).toHaveValue(before['story-a-hi'].title);
    expect(client.getQueryData<Article>(['articles', 'one', 'story-a-hi'])?._id).not.toBe('story-a-gu');
    expect(screen.getByText('child-only-tag')).toBeInTheDocument();
    expect(screen.queryByText('source-only-tag')).not.toBeInTheDocument();
  });

  it('canonical publication: preserves the saved edition but stops if publishing permission is revoked', async () => {
    for (const id of ['story-a-en', 'story-a-hi', 'story-a-gu']) records[id].status = 'draft';
    const put = mocks.put.getMockImplementation()!;
    let finishSave!: () => void;
    mocks.put.mockImplementationOnce(async (url, payload) => {
      await new Promise<void>(resolve => { finishSave = resolve; });
      return put(url, payload);
    });
    const { client, rerender } = await open();
    fireEvent.change(input('Language', 'select'), { target: { value: 'hi' } });
    fireEvent.change(input('Title', 'input'), { target: { value: 'Saved before access changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(finishSave).toBeDefined());
    mocks.role = 'editor';
    rerender(editor(client, records[source._id]));
    await act(async () => { finishSave(); });
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith(expect.stringMatching(/HI saved.*Publication did not complete/)));
    expect(mocks.put.mock.calls.map(([url]) => url)).toEqual(['articles/story-a-hi']);
    expect(records['story-a-hi'].title).toBe('Saved before access changed');
    expect(mocks.post).not.toHaveBeenCalled();
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
    expect(records[source._id]).toEqual({ ...sourceBefore, translationKey: sourceBefore.translationGroupId });
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
  ] as const)('creates missing %s from canonical %s and submits the reviewed edition to group Publish', async (target, sourceLanguage) => {
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
    expect(records[`story-a-${target}`]).toMatchObject({
      title: `Human-reviewed ${target} edition`, sourceArticleId: sourceId,
      translationGroupId: records[sourceId].translationGroupId, status: 'published',
    });
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

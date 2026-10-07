import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticleForm } from '@/components/news/ArticleForm';
import type { Article, ListResponse } from '@/lib/api/articles';
import { ARTICLE_CATEGORY_OPTIONS } from '@/lib/articleCategories';
import { isFaithCultureTopic } from '@/lib/faithCultureTopics';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  getMediaStatus: vi.fn(),
  createArticle: vi.fn<(payload: Partial<Article>) => Promise<{ article: Article }>>(),
  updateArticle: vi.fn<(id: string, payload: Partial<Article>) => Promise<{ article: Article }>>(),
  getArticle: vi.fn<(id: string) => Promise<Article>>(),
  publishArticle: vi.fn(),
  retryArticleTranslation: vi.fn(),
  requeueArticleTranslations: vi.fn(),
  listArticlesByTranslationGroupId: vi.fn<() => Promise<ListResponse>>(),
  checkSlugAvailability: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'admin-1', role: 'admin' } }),
}));
vi.mock('@/context/PublishFlagContext', () => ({ usePublishFlag: () => ({ publishEnabled: true }) }));
vi.mock('@/lib/api', () => ({ default: { get: mocks.apiGet } }));
vi.mock('@/lib/api/articles', () => ({
  createArticle: mocks.createArticle,
  updateArticle: mocks.updateArticle,
  getArticle: mocks.getArticle,
  publishArticle: mocks.publishArticle,
  retryArticleTranslation: mocks.retryArticleTranslation,
  requeueArticleTranslations: mocks.requeueArticleTranslations,
  listArticlesByTranslationGroupId: mocks.listArticlesByTranslationGroupId,
}));
vi.mock('@/lib/api/pulseDialogue', () => ({
  listPulseDialogueContributors: vi.fn(async () => ({ items: [], total: 0, page: 1, limit: 20 })),
  getPulseDialogueContributor: vi.fn(async () => ({ id: 'contributor-1', canonicalName: 'Guest Writer', status: 'active' })),
  createPulseDialogueContributor: vi.fn(),
  updatePulseDialogueContributor: vi.fn(),
  changePulseDialogueContributorSlug: vi.fn(),
  listPulseDialogueSeries: vi.fn(async () => ({ items: [{ id: 's1', title: 'Ideas & Society', slug: 'ideas-society' }], total: 1, page: 1, limit: 20 })),
  getPulseDialogueSeries: vi.fn(),
  createPulseDialogueSeries: vi.fn(),
  updatePulseDialogueSeries: vi.fn(),
}));
vi.mock('@/lib/slugAvailability', () => ({
  buildSlugSuggestions: vi.fn(() => []),
  checkSlugAvailability: mocks.checkSlugAvailability,
}));
vi.mock('react-hot-toast', () => ({
  default: Object.assign(mocks.toastInfo, { success: mocks.toastSuccess, error: mocks.toastError }),
}));
vi.mock('@/lib/api/media', () => ({ getMediaStatus: mocks.getMediaStatus, uploadCoverImage: vi.fn() }));
vi.mock('@/lib/api/language', () => ({ verifyLanguage: vi.fn(), readability: vi.fn() }));
vi.mock('@/components/editor/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Content editor input" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('@/components/articles/CoverImageUpload', () => ({ default: () => null }));
vi.mock('@/components/media/MediaLibrarySelector', () => ({ default: () => null }));
vi.mock('@/components/preview/PreviewModal', () => ({ default: () => null }));
vi.mock('@/components/ui/ConfirmModal', () => ({ default: () => null }));

const approvedTopics = [
  { value: 'faith-spiritual-life', label: 'Faith & Spiritual Life' },
  { value: 'living-heritage', label: 'Living Heritage & Traditions' },
  { value: 'food-agricultural-heritage', label: 'Food & Agricultural Heritage' },
  { value: 'architecture-art-public-heritage', label: 'Architecture, Art & Public Heritage' },
  { value: 'community-social-traditions', label: 'Community & Social Traditions' },
  { value: 'folk-arts-festivals-textiles', label: 'Folk Arts, Festivals & Textiles' },
  { value: 'language-cultural-identity', label: 'Language & Cultural Identity' },
];
const sourceContent = 'A detailed report on local heritage and cultural traditions with enough text to satisfy the existing article publication requirements.';
const sourceArticle: Article = {
  _id: 'source-1',
  title: 'Faith culture source story',
  slug: 'faith-culture-source-story',
  summary: sourceContent,
  content: sourceContent,
  category: 'faith-culture',
  topic: 'living-heritage',
  language: 'en',
  lang: 'en',
  status: 'draft',
  translationGroupId: 'faith-group',
  sourceLanguage: 'en',
  tags: ['heritage-report'],
};
const emptyGroup: ListResponse = { rows: [], total: 0, page: 1, pages: 1 };
let storedArticle: Article;
const queryClients: QueryClient[] = [];

function renderForm(article?: Article, loadFromApi = false) {
  if (article) storedArticle = { ...article };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  });
  queryClients.push(queryClient);
  const onDirtyChange = vi.fn();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[article ? `/admin/articles/${article._id}/edit` : '/admin/add-news']}>
        <ArticleForm
          mode={article ? 'edit' : 'create'}
          id={article?._id}
          initialValues={loadFromApi ? undefined : article}
          userRole="admin"
          onDirtyChange={onDirtyChange}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...result, onDirtyChange };
}

function control<T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(label: string, selector: string): T {
  const parent = screen.getByText(label).parentElement;
  const element = parent?.querySelector<T>(selector) ?? parent?.parentElement?.querySelector<T>(selector);
  if (!element) throw new Error(`Missing ${label} control`);
  return element;
}

function chooseCategory(value: string) {
  fireEvent.change(control<HTMLSelectElement>('Category', 'select'), { target: { value } });
}

function topicSelect(): HTMLSelectElement {
  return screen.getByRole<HTMLSelectElement>('combobox', { name: 'Faith & Culture Topic' });
}

function chooseTopic(value: string) {
  fireEvent.change(topicSelect(), { target: { value } });
}

async function fillCreate() {
  fireEvent.change(control<HTMLSelectElement>('Language', 'select'), { target: { value: 'en' } });
  await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 0)); });
  fireEvent.change(control<HTMLInputElement>('Title', 'input'), { target: { value: sourceArticle.title } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Content editor input' }), { target: { value: sourceContent } });
  chooseCategory('faith-culture');
}

async function saveDraft() {
  mocks.toastSuccess.mockClear();
  fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
  await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith(expect.stringMatching(/^Draft (saved|updated)$/)));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled());
}

async function advanceAutosave(milliseconds = 30_000) {
  await act(async () => { await vi.advanceTimersByTimeAsync(milliseconds); });
}

function ownershipConflict() {
  return Object.assign(new Error('Topic must be changed on the source article'), {
    response: { status: 409, data: { message: 'Topic must be changed on the source article' } },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  storedArticle = { ...sourceArticle };
  mocks.apiGet.mockResolvedValue({ data: ['en', 'hi', 'gu'] });
  mocks.getMediaStatus.mockResolvedValue({ ok: true, uploadEnabled: true });
  mocks.checkSlugAvailability.mockResolvedValue({ available: true });
  mocks.getArticle.mockImplementation(async () => ({ ...storedArticle }));
  mocks.createArticle.mockImplementation(async (payload) => {
    storedArticle = { _id: 'created-1', title: '', ...payload };
    return { article: { ...storedArticle } };
  });
  mocks.updateArticle.mockImplementation(async (id, payload) => {
    const article = { ...storedArticle, ...payload, _id: id };
    if (id === storedArticle._id) storedArticle = article;
    return { article };
  });
  mocks.publishArticle.mockResolvedValue({ article: { ...sourceArticle, status: 'published' } });
  mocks.retryArticleTranslation.mockResolvedValue({ ok: true });
  mocks.requeueArticleTranslations.mockResolvedValue({ ok: true });
  mocks.listArticlesByTranslationGroupId.mockResolvedValue(emptyGroup);
});

afterEach(() => {
  cleanup();
  queryClients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ArticleForm Faith & Culture topic selector', () => {
  it('is hidden for every non-Faith category without changing their options', () => {
    renderForm();
    const categories = control<HTMLSelectElement>('Category', 'select');
    const originalOptions = Array.from(categories.options).map((option) => option.value);
    expect(screen.queryByLabelText('Faith & Culture Topic')).not.toBeInTheDocument();
    for (const option of ARTICLE_CATEGORY_OPTIONS.filter((item) => !['faith-culture', 'breaking', 'inspiration-hub'].includes(item.key))) {
      chooseCategory(option.key);
      expect(screen.queryByLabelText('Faith & Culture Topic')).not.toBeInTheDocument();
    }
    expect(Array.from(categories.options).map((option) => option.value)).toEqual(originalOptions);
  });

  it('shows exactly seven approved code/label options plus an optional blank choice', () => {
    renderForm();
    chooseCategory('faith-culture');
    expect(topicSelect()).not.toBeRequired();
    expect(topicSelect()).toHaveValue('');
    expect(Array.from(topicSelect().options).map((option) => ({ value: option.value, label: option.text }))).toEqual([
      { value: '', label: 'Select topic' },
      ...approvedTopics,
    ]);
    expect(topicSelect()).toHaveClass('w-full', 'border', 'px-2', 'py-2', 'rounded');
  });

  it('allows a blank topic for Save Draft and automatic translation generation', async () => {
    renderForm();
    await fillCreate();
    await saveDraft();
    expect(mocks.createArticle.mock.calls[0][0]).not.toHaveProperty('topic');
    expect(storedArticle).not.toHaveProperty('topic');
    expect(mocks.requeueArticleTranslations).toHaveBeenCalledWith('created-1', { languages: ['hi', 'gu'] });
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it.each(approvedTopics)('saves $value on create without labels, tags, or alias fields', async ({ value }) => {
    renderForm();
    await fillCreate();
    chooseTopic(value);
    await saveDraft();
    const payload = mocks.createArticle.mock.calls[0][0];
    expect(payload).toMatchObject({ category: 'faith-culture', topic: value, status: 'draft', tags: [] });
    expect(payload).not.toHaveProperty('faithCultureTopic');
    expect(payload.track).toBeUndefined();
    expect(payload.trackName).toBeUndefined();
    expect(payload.subCategory).toBeUndefined();
    expect(payload.subcategory).toBeUndefined();
    expect(topicSelect()).toHaveValue(value);
  });

  it.each([false, true])('hydrates the canonical topic and starts clean (API load: %s)', async (loadFromApi) => {
    const { onDirtyChange } = renderForm(sourceArticle, loadFromApi);
    await waitFor(() => expect(topicSelect()).toHaveValue('living-heritage'));
    expect(within(topicSelect()).getByRole('option', { selected: true })).toHaveTextContent('Living Heritage & Traditions');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    expect(mocks.updateArticle).not.toHaveBeenCalled();
  });

  it('omits an unchanged topic on every update and preserves the stored value', async () => {
    renderForm(sourceArticle);
    fireEvent.change(control<HTMLInputElement>('Title', 'input'), { target: { value: 'An unrelated title edit' } });
    await saveDraft();
    expect(mocks.updateArticle).toHaveBeenCalled();
    for (const [, payload] of mocks.updateArticle.mock.calls) expect(payload).not.toHaveProperty('topic');
    expect(storedArticle.topic).toBe('living-heritage');
  });

  it.each([undefined, null])('sets a topic on an existing blank article (%s)', async (topic) => {
    renderForm({ ...sourceArticle, topic });
    expect(topicSelect()).toHaveValue('');
    chooseTopic('community-social-traditions');
    await saveDraft();
    expect(mocks.updateArticle.mock.calls[0][1]).toHaveProperty('topic', 'community-social-traditions');
    expect(storedArticle.topic).toBe('community-social-traditions');
  });

  it('saves a topic-only change as metadata, then omits it on the next unrelated save', async () => {
    const { onDirtyChange } = renderForm(sourceArticle);
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    chooseTopic('food-agricultural-heritage');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(control<HTMLInputElement>('Title', 'input')).toHaveValue(sourceArticle.title);
    expect(control<HTMLInputElement>('Slug', 'input:not([type="checkbox"])')).toHaveValue(sourceArticle.slug);
    expect(control<HTMLTextAreaElement>('Summary', 'textarea')).toHaveValue(sourceArticle.summary);
    expect(screen.getByRole('textbox', { name: 'Content editor input' })).toHaveValue(sourceArticle.content);
    await saveDraft();
    expect(mocks.updateArticle.mock.calls[0][1]).toMatchObject({
      topic: 'food-agricultural-heritage',
      title: sourceArticle.title,
      slug: sourceArticle.slug,
      summary: sourceArticle.summary,
      content: sourceArticle.content,
      tags: sourceArticle.tags,
    });
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    mocks.updateArticle.mockClear();
    fireEvent.change(control<HTMLInputElement>('Title', 'input'), { target: { value: 'A later title update' } });
    await saveDraft();
    for (const [, payload] of mocks.updateArticle.mock.calls) expect(payload).not.toHaveProperty('topic');
    expect(storedArticle.topic).toBe('food-agricultural-heritage');
  });

  it.each([false, true])('preserves an existing custom slug and hand-written summary on a topic-only save (API load: %s)', async (loadFromApi) => {
    const article = { ...sourceArticle, slug: 'custom-heritage-url', summary: 'A hand-written summary that must not be regenerated.' };
    const { onDirtyChange } = renderForm(article, loadFromApi);
    await waitFor(() => expect(topicSelect()).toHaveValue('living-heritage'));
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    chooseTopic('faith-spiritual-life');
    await saveDraft();
    expect(mocks.updateArticle.mock.calls[0][1]).toMatchObject({
      slug: article.slug, summary: article.summary, content: article.content, topic: 'faith-spiritual-life',
    });
  });

  it.each(['living-heritage', 'legacy-faith-topic'])('explicitly clears stored %s with null, not omission', async (topic) => {
    const { onDirtyChange } = renderForm({ ...sourceArticle, topic });
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    chooseTopic('');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await saveDraft();
    expect(mocks.updateArticle.mock.calls[0][1]).toHaveProperty('topic', null);
    expect(storedArticle.topic).toBeNull();
    expect(topicSelect()).toHaveValue('');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    mocks.updateArticle.mockClear();
    await saveDraft();
    for (const [, payload] of mocks.updateArticle.mock.calls) expect(payload).not.toHaveProperty('topic');
  });

  it.each(['Faith & Spiritual Life', 'legacy-faith-topic', 'LIVING-HERITAGE', ' living-heritage '])(
    'does not normalize, send, or overwrite unknown stored value %s', async (topic) => {
      renderForm({ ...sourceArticle, topic });
      expect(isFaithCultureTopic(topic)).toBe(false);
      expect(topicSelect()).toHaveValue(topic);
      expect(within(topicSelect()).getByRole('option', { selected: true })).toBeDisabled();
      expect(screen.getByText(/Saved topic:/)).toHaveTextContent(topic.trim());
      await saveDraft();
      for (const [, payload] of mocks.updateArticle.mock.calls) expect(payload).not.toHaveProperty('topic');
      expect(storedArticle.topic).toBe(topic);
    },
  );

  it('replaces an unknown topic only after an explicit approved selection', async () => {
    renderForm({ ...sourceArticle, topic: 'legacy-faith-topic' });
    chooseTopic('architecture-art-public-heritage');
    await saveDraft();
    expect(storedArticle.topic).toBe('architecture-art-public-heritage');
    expect(mocks.updateArticle.mock.calls[0][1]).toHaveProperty('topic', 'architecture-art-public-heritage');
  });

  it('drops unsaved Faith state on category changes and returns blank on create', async () => {
    renderForm();
    await fillCreate();
    chooseTopic('living-heritage');
    chooseCategory('national');
    expect(screen.queryByLabelText('Faith & Culture Topic')).not.toBeInTheDocument();
    await saveDraft();
    expect(mocks.createArticle.mock.calls[0][0]).not.toHaveProperty('topic');
    chooseCategory('faith-culture');
    expect(topicSelect()).toHaveValue('');
  });

  it('restores only a valid last-saved Faith topic, not an unsaved selection', async () => {
    renderForm(sourceArticle);
    chooseTopic('faith-spiritual-life');
    chooseCategory('national');
    chooseCategory('faith-culture');
    expect(topicSelect()).toHaveValue('living-heritage');
    chooseCategory('national');
    await saveDraft();
    for (const [, payload] of mocks.updateArticle.mock.calls) expect(payload).not.toHaveProperty('topic');
    chooseCategory('faith-culture');
    expect(topicSelect()).toHaveValue('');
  });

  it('does not revive stray topic metadata when switching a loaded non-Faith article into Faith', () => {
    renderForm({ ...sourceArticle, category: 'national' });
    chooseCategory('faith-culture');
    expect(topicSelect()).toHaveValue('');
  });

  it('keeps an unknown value omitted after a category round trip until explicitly changed', async () => {
    renderForm({ ...sourceArticle, topic: 'legacy-faith-topic' });
    chooseCategory('national');
    chooseCategory('faith-culture');
    expect(topicSelect()).toHaveValue('');
    await saveDraft();
    for (const [, payload] of mocks.updateArticle.mock.calls) expect(payload).not.toHaveProperty('topic');
    expect(storedArticle.topic).toBe('legacy-faith-topic');
  });

  it.each(['faith-spiritual-life', null])('reloads saved topic %s from the Edit API', async (topic) => {
    const firstRender = renderForm(sourceArticle, true);
    await waitFor(() => expect(topicSelect()).toHaveValue('living-heritage'));
    chooseTopic(topic || '');
    await saveDraft();
    await waitFor(() => expect(firstRender.onDirtyChange).toHaveBeenLastCalledWith(false));
    const saved = { ...storedArticle };
    firstRender.unmount();
    renderForm(saved, true);
    await waitFor(() => expect(topicSelect()).toHaveValue(topic || ''));
    expect(storedArticle.topic).toBe(topic);
  });

  it.each(['', 'folk-arts-festivals-textiles'])('keeps topic optional in the create save-then-publish flow (%s)', async (topic) => {
    renderForm();
    await fillCreate();
    if (topic) chooseTopic(topic);
    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(publish).toBeEnabled();
    fireEvent.click(publish);
    await waitFor(() => expect(mocks.publishArticle).toHaveBeenCalledWith('created-1', expect.any(String)));
    const payload = mocks.createArticle.mock.calls[0][0];
    expect(payload.status).toBe('draft');
    if (topic) expect(payload).toHaveProperty('topic', topic);
    else expect(payload).not.toHaveProperty('topic');
    expect(mocks.createArticle.mock.invocationCallOrder[0]).toBeLessThan(mocks.publishArticle.mock.invocationCallOrder[0]);
    expect(mocks.updateArticle).not.toHaveBeenCalled();
    expect(mocks.requeueArticleTranslations).not.toHaveBeenCalled();
  });

  it.each(['faith-spiritual-life', null])('saves edited topic %s before the separate publish status call', async (topic) => {
    renderForm(sourceArticle);
    chooseTopic(topic || '');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(mocks.publishArticle).toHaveBeenCalledWith('source-1', expect.any(String)));
    expect(mocks.updateArticle).toHaveBeenCalledTimes(1);
    expect(mocks.updateArticle.mock.calls[0][1]).toMatchObject({ status: 'draft', topic });
    expect(mocks.updateArticle.mock.invocationCallOrder[0]).toBeLessThan(mocks.publishArticle.mock.invocationCallOrder[0]);
  });

  it('resets the topic and saved snapshot when starting a new article after publish', async () => {
    renderForm();
    await fillCreate();
    chooseTopic('living-heritage');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    fireEvent.click(await screen.findByRole('button', { name: 'New Article' }));
    chooseCategory('faith-culture');
    expect(topicSelect()).toHaveValue('');
    expect(control<HTMLInputElement>('Title', 'input')).toHaveValue('');
  });

  it('allows blank-topic Generate and Regenerate Translations without changing their payload', async () => {
    renderForm({ ...sourceArticle, topic: undefined });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Translations' }));
    await waitFor(() => expect(mocks.requeueArticleTranslations).toHaveBeenCalledWith('source-1', { languages: ['hi', 'gu'] }));
    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Translations' }));
    await waitFor(() => expect(mocks.requeueArticleTranslations).toHaveBeenCalledTimes(2));
    expect(mocks.requeueArticleTranslations).toHaveBeenLastCalledWith('source-1', { languages: ['hi', 'gu'] });
  });
});

describe('Faith topic autosave and saved snapshots', () => {
  it.each(['living-heritage', 'legacy-faith-topic', undefined, null])('does not autosave just from hydrating topic %s', async (topic) => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { onDirtyChange } = renderForm({ ...sourceArticle, topic });
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    await advanceAutosave();
    expect(mocks.updateArticle).not.toHaveBeenCalled();
  });

  it.each([
    { topic: 'faith-spiritual-life', status: 'draft' as const },
    { topic: null, status: 'published' as const },
  ])('autosaves topic $topic at 30 seconds, stays clean, and preserves $status status', async ({ topic, status }) => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { onDirtyChange } = renderForm({ ...sourceArticle, status });
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    chooseTopic(topic || '');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await advanceAutosave(29_999);
    expect(mocks.updateArticle).not.toHaveBeenCalled();
    await advanceAutosave(1);
    await waitFor(() => expect(mocks.updateArticle).toHaveBeenCalledTimes(1));
    expect(mocks.updateArticle.mock.calls[0][1]).toMatchObject({ topic, status, content: sourceContent });
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    await advanceAutosave();
    expect(mocks.updateArticle).toHaveBeenCalledTimes(1);
    expect(mocks.requeueArticleTranslations).not.toHaveBeenCalled();
    expect(mocks.publishArticle).not.toHaveBeenCalled();
  });

  it('does not autosave-create before Save Draft, but retains and autosaves subsequent topic edits', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    renderForm();
    await fillCreate();
    chooseTopic('faith-spiritual-life');
    await advanceAutosave();
    expect(mocks.createArticle).not.toHaveBeenCalled();
    await saveDraft();
    expect(topicSelect()).toHaveValue('faith-spiritual-life');
    mocks.updateArticle.mockClear();
    chooseTopic('language-cultural-identity');
    await advanceAutosave();
    await waitFor(() => expect(mocks.updateArticle).toHaveBeenCalledWith('created-1', expect.objectContaining({ topic: 'language-cultural-identity' })));
    expect(mocks.createArticle).toHaveBeenCalledTimes(1);
  });

  it('omits Faith metadata when autosaving a category switch and does not restore it afterwards', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { onDirtyChange } = renderForm(sourceArticle);
    chooseTopic('faith-spiritual-life');
    chooseCategory('national');
    await advanceAutosave();
    await waitFor(() => expect(mocks.updateArticle).toHaveBeenCalledTimes(1));
    expect(mocks.updateArticle.mock.calls[0][1].category).toBe('national');
    expect(mocks.updateArticle.mock.calls[0][1]).not.toHaveProperty('topic');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    chooseCategory('faith-culture');
    expect(topicSelect()).toHaveValue('');
  });

  it('keeps a topic edit made during an in-flight save dirty until a follow-up autosave persists it', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let resolveSave!: (value: { article: Article }) => void;
    mocks.updateArticle.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    const { onDirtyChange } = renderForm(sourceArticle);
    chooseTopic('faith-spiritual-life');
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.updateArticle).toHaveBeenCalledTimes(1));
    chooseTopic('language-cultural-identity');
    await act(async () => { resolveSave({ article: { ...sourceArticle, topic: 'faith-spiritual-life' } }); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save Draft' })).toBeEnabled());
    expect(topicSelect()).toHaveValue('language-cultural-identity');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    mocks.updateArticle.mockClear();
    await advanceAutosave();
    await waitFor(() => expect(mocks.updateArticle.mock.calls[0][1]).toHaveProperty('topic', 'language-cultural-identity'));
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });
});

describe('Faith source ownership and linked drafts', () => {
  it.each([
    { sourceLanguage: 'gu' },
    { sourceLanguage: undefined, sourceArticle: { _id: 'canonical-1', lang: 'en' } },
  ])('shows the current topic but prevents child updates using explicit metadata %j', async (identity) => {
    renderForm({ ...sourceArticle, ...identity });
    expect(topicSelect()).toHaveValue('living-heritage');
    expect(topicSelect()).toBeDisabled();
    expect(screen.getByText('Faith & Culture Topic is managed from the source article.')).toBeInTheDocument();
    fireEvent.change(control<HTMLInputElement>('Title', 'input'), { target: { value: 'Updated translated title' } });
    await saveDraft();
    for (const [, payload] of mocks.updateArticle.mock.calls) expect(payload).not.toHaveProperty('topic');
  });

  it('uses explicit group source identity, including when it arrives after a local selection', async () => {
    let resolveGroup!: (value: ListResponse) => void;
    mocks.listArticlesByTranslationGroupId.mockImplementationOnce(() => new Promise((resolve) => { resolveGroup = resolve; }));
    const { onDirtyChange } = renderForm({ ...sourceArticle, sourceLanguage: undefined });
    expect(topicSelect()).toBeEnabled();
    chooseTopic('faith-spiritual-life');
    await act(async () => { resolveGroup({ ...emptyGroup, sourceArticle: { _id: 'canonical-1', lang: 'gu' } }); });
    await waitFor(() => expect(topicSelect()).toBeDisabled());
    expect(topicSelect()).toHaveValue('living-heritage');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
    await saveDraft();
    for (const [, payload] of mocks.updateArticle.mock.calls) expect(payload).not.toHaveProperty('topic');
  });

  it('keeps a proven canonical source editable even when another language workspace is selected', async () => {
    renderForm({ ...sourceArticle, sourceArticle: { _id: 'source-1', lang: 'en' } });
    expect(topicSelect()).toBeEnabled();
    fireEvent.change(control<HTMLSelectElement>('Language', 'select'), { target: { value: 'hi' } });
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 0)); });
    expect(topicSelect()).toBeEnabled();
  });

  it('does not invent source identity from language, translation rows, or the translations object', async () => {
    mocks.listArticlesByTranslationGroupId.mockResolvedValue({
      ...emptyGroup,
      rows: [{ ...sourceArticle, _id: 'different-language', lang: 'gu', language: 'gu', sourceLanguage: undefined }],
    });
    renderForm({ ...sourceArticle, sourceLanguage: undefined, translations: { hi: { _id: 'hi-1', title: 'Hindi child' } } });
    await waitFor(() => expect(mocks.listArticlesByTranslationGroupId).toHaveBeenCalled());
    expect(topicSelect()).toBeEnabled();
    expect(screen.queryByText('Faith & Culture Topic is managed from the source article.')).not.toBeInTheDocument();
  });

  it('shows unknown stored child topics without allowing editing or rewriting them', async () => {
    renderForm({ ...sourceArticle, topic: 'legacy-topic', sourceLanguage: 'gu' });
    expect(topicSelect()).toHaveValue('legacy-topic');
    expect(topicSelect()).toBeDisabled();
    expect(screen.getByText(/Saved topic:/)).toHaveTextContent('legacy-topic');
    await saveDraft();
    for (const [, payload] of mocks.updateArticle.mock.calls) expect(payload).not.toHaveProperty('topic');
  });

  it('does not revive a child topic after saving a switch away from Faith', async () => {
    renderForm({ ...sourceArticle, sourceLanguage: 'gu' });
    chooseCategory('national');
    await saveDraft();
    for (const [, payload] of mocks.updateArticle.mock.calls) expect(payload).not.toHaveProperty('topic');
    chooseCategory('faith-culture');
    expect(topicSelect()).toHaveValue('');
  });

  it.each(['Save Draft', 'Publish'])('surfaces a backend 409 through existing %s errors without claiming success', async (action) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.updateArticle.mockRejectedValueOnce(ownershipConflict());
    const { onDirtyChange } = renderForm({ ...sourceArticle, sourceLanguage: undefined });
    chooseTopic('');
    fireEvent.click(screen.getByRole('button', { name: action }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('This record has changed. Refresh and try again.'));
    expect(mocks.updateArticle.mock.calls[0][1]).toHaveProperty('topic', null);
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.publishArticle).not.toHaveBeenCalled();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('surfaces autosave 409 failures and leaves the topic change dirty for retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    mocks.updateArticle.mockRejectedValueOnce(ownershipConflict());
    const { onDirtyChange } = renderForm({ ...sourceArticle, sourceLanguage: undefined });
    chooseTopic('faith-spiritual-life');
    await advanceAutosave();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Retry' })).toHaveAttribute('title', 'This record has changed. Refresh and try again.'));
    expect(screen.getByText(/Autosave failed/)).toBeInTheDocument();
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    expect(topicSelect()).toHaveValue('faith-spiritual-life');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('Draft updated'));
    expect(storedArticle.topic).toBe('faith-spiritual-life');
  });

  it.each(['living-heritage', 'legacy-topic', null])('copies only approved topic metadata into a new linked translation (%s)', async (topic) => {
    renderForm({ ...sourceArticle, topic });
    fireEvent.click(screen.getByRole('button', { name: 'Create Hindi version' }));
    await waitFor(() => expect(mocks.createArticle).toHaveBeenCalled());
    const payload = mocks.createArticle.mock.calls[0][0];
    expect(payload).toMatchObject({ category: 'faith-culture', language: 'hi', translationGroupId: 'faith-group', status: 'draft' });
    if (topic === 'living-heritage') expect(payload).toHaveProperty('topic', topic);
    else expect(payload).not.toHaveProperty('topic');
  });

  it('saves topic on the source but omits it from secondary updates to existing linked children', async () => {
    mocks.listArticlesByTranslationGroupId.mockResolvedValue({
      ...emptyGroup,
      rows: [{ ...sourceArticle, _id: 'hi-1', lang: 'hi', language: 'hi' }],
      sourceLanguage: 'en',
    });
    renderForm(sourceArticle);
    await waitFor(() => expect(screen.getByTitle('Open this language variant')).toBeInTheDocument());
    chooseTopic('faith-spiritual-life');
    await saveDraft();
    expect(mocks.updateArticle.mock.calls[0]).toEqual(['source-1', expect.objectContaining({ topic: 'faith-spiritual-life' })]);
    const childSaves = mocks.updateArticle.mock.calls.filter(([id]) => id === 'hi-1');
    expect(childSaves.length).toBeGreaterThan(0);
    for (const [, payload] of childSaves) expect(payload).not.toHaveProperty('topic');
  });

  it('includes the stable topic when Save Draft creates a new linked language draft', async () => {
    renderForm(sourceArticle);
    chooseTopic('language-cultural-identity');
    fireEvent.change(control<HTMLSelectElement>('Language', 'select'), { target: { value: 'hi' } });
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 0)); });
    fireEvent.change(control<HTMLInputElement>('Title', 'input'), { target: { value: 'New Hindi draft' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Content editor input' }), { target: { value: 'New translated body.' } });
    fireEvent.change(control<HTMLSelectElement>('Language', 'select'), { target: { value: 'en' } });
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 0)); });
    await saveDraft();
    expect(mocks.createArticle).toHaveBeenCalledWith(expect.objectContaining({
      language: 'hi', category: 'faith-culture', topic: 'language-cultural-identity', translationGroupId: 'faith-group',
    }));
  });
});

describe('Faith category-control regressions', () => {
  it('preserves Youth Pulse Track vocabulary, state, and payload across Faith switching', async () => {
    renderForm({ ...sourceArticle, category: 'youth-pulse', topic: undefined, track: 'campus-life' });
    const youthSelect = control<HTMLSelectElement>('Youth Pulse Track', 'select');
    expect(youthSelect).toHaveValue('campus-buzz');
    expect(Array.from(youthSelect.options).filter((option) => option.value).map((option) => option.value)).toEqual([
      'campus-buzz', 'govt-exam-updates', 'career-boosters', 'young-achievers', 'student-voices',
    ]);
    fireEvent.change(youthSelect, { target: { value: 'student-voices' } });
    chooseCategory('faith-culture');
    expect(topicSelect()).toHaveValue('');
    chooseTopic('living-heritage');
    chooseCategory('youth-pulse');
    expect(control<HTMLSelectElement>('Youth Pulse Track', 'select')).toHaveValue('student-voices');
    await saveDraft();
    expect(mocks.updateArticle.mock.calls[0][1]).toMatchObject({
      category: 'youth-pulse', track: 'student-voices', trackName: 'Student Voices',
      subCategory: 'student-voices', subcategory: 'student-voices',
    });
    expect(mocks.updateArticle.mock.calls[0][1]).not.toHaveProperty('topic');
  });

  it('preserves Editorial Type state and payload across Faith switching', async () => {
    renderForm({ ...sourceArticle, category: 'editorial', topic: undefined, editorialType: 'special_story' });
    expect(control<HTMLSelectElement>('Editorial Type', 'select')).toHaveValue('special_story');
    chooseCategory('faith-culture');
    chooseTopic('living-heritage');
    expect(screen.queryByText('Editorial Type')).not.toBeInTheDocument();
    chooseCategory('editorial');
    expect(control<HTMLSelectElement>('Editorial Type', 'select')).toHaveValue('special_story');
    await saveDraft();
    expect(mocks.updateArticle.mock.calls[0][1]).toMatchObject({ category: 'editorial', editorialType: 'special_story' });
    expect(mocks.updateArticle.mock.calls[0][1]).not.toHaveProperty('topic');
  });

  it('preserves Pulse Dialogue fields and payload across Faith switching', async () => {
    const pulseDialogue = {
      contributorId: 'contributor-1', dialogueFormat: 'essay' as const, series: 'Ideas & Society', seriesSlug: 'ideas-society',
      contributorDisclosure: 'Saved disclosure', contributorDisclaimer: 'Saved disclaimer', editorNote: 'Saved note',
      contributor: { id: 'contributor-1', canonicalName: 'Guest Writer', status: 'active' as const },
    };
    renderForm({ ...sourceArticle, category: 'pulse-dialogue', topic: undefined, pulseDialogue });
    expect(screen.getByTestId('pulse-dialogue-details')).toBeInTheDocument();
    chooseCategory('faith-culture');
    chooseTopic('living-heritage');
    expect(screen.queryByTestId('pulse-dialogue-details')).not.toBeInTheDocument();
    chooseCategory('pulse-dialogue');
    expect(control<HTMLSelectElement>('Dialogue Format', 'select')).toHaveValue('essay');
    await waitFor(() => expect(screen.getByLabelText('Series / Column - optional')).toHaveValue('s1'));
    await saveDraft();
    expect(mocks.updateArticle.mock.calls[0][1]).toMatchObject({
      category: 'pulse-dialogue',
      pulseDialogue: {
        contributorId: 'contributor-1', dialogueFormat: 'essay', series: 'Ideas & Society', seriesSlug: 'ideas-society',
        contributorDisclosure: 'Saved disclosure', contributorDisclaimer: 'Saved disclaimer', editorNote: 'Saved note',
      },
    });
    expect(mocks.updateArticle.mock.calls[0][1]).not.toHaveProperty('topic');
  });
});

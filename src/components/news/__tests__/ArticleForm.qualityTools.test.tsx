import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticleForm } from '@/components/news/ArticleForm';
import { createArticle, publishArticle, requeueArticleTranslations, updateArticle } from '@/lib/api/articles';
import { ARTICLE_CATEGORY_OPTIONS } from '@/lib/articleCategories';
import type { AuthorByline } from '@/lib/authorByline';

const mocks = vi.hoisted(() => ({
  authUser: { id: 'editor-1', email: 'editor@newspulse.co.in', role: 'editor' },
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  getMediaStatus: vi.fn(),
  uploadCoverImage: vi.fn(),
  createArticle: vi.fn(),
  updateArticle: vi.fn(),
  getArticle: vi.fn(),
  publishArticle: vi.fn(),
  retryArticleTranslation: vi.fn(),
  requeueArticleTranslations: vi.fn(),
  listArticlesByTranslationGroupId: vi.fn(),
  checkSlugAvailability: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));

vi.mock('@/context/PublishFlagContext', () => ({
  usePublishFlag: () => ({ publishEnabled: true }),
}));

vi.mock('@/lib/api', () => ({
  default: { get: mocks.apiGet, post: mocks.apiPost },
}));

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
  listPulseDialogueContributors: vi.fn(async () => ({
    items: [{ id: 'contributor-1', canonicalName: 'Guest Writer', publicDesignation: 'Essayist', status: 'active' }],
    total: 1,
    page: 1,
    limit: 20,
  })),
  getPulseDialogueContributor: vi.fn(async () => ({ id: 'contributor-1', canonicalName: 'Guest Writer', publicDesignation: 'Essayist', status: 'active' })),
  createPulseDialogueContributor: vi.fn(),
  updatePulseDialogueContributor: vi.fn(),
}));

vi.mock('@/lib/slugAvailability', () => ({
  buildSlugSuggestions: vi.fn((slug: string) => [`${slug}-2`, `${slug}-3`]),
  checkSlugAvailability: mocks.checkSlugAvailability,
}));

vi.mock('react-hot-toast', () => {
  const toast = Object.assign(mocks.toastInfo, {
    success: mocks.toastSuccess,
    error: mocks.toastError,
  });
  return { default: toast };
});

vi.mock('@/lib/api/media', () => ({
  getMediaStatus: mocks.getMediaStatus,
  uploadCoverImage: mocks.uploadCoverImage,
}));

vi.mock('@/lib/api/language', () => ({ verifyLanguage: vi.fn(), readability: vi.fn() }));
vi.mock('@/components/editor/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Content editor input" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('@/components/articles/CoverImageUpload', () => ({ default: () => <div>Cover image upload</div> }));
vi.mock('@/components/media/MediaLibrarySelector', () => ({ default: () => null }));
vi.mock('@/components/preview/PreviewModal', () => ({
  default: ({ open, article }: { open: boolean; article: { authorByline?: AuthorByline } }) => open ? <div role="dialog" aria-label="Article Preview">Preview modal<output data-testid="preview-author">{JSON.stringify(article.authorByline)}</output></div> : null,
}));
vi.mock('@/components/ui/ConfirmModal', () => ({ default: () => null }));

function renderArticleForm(userRole: 'writer' | 'editor' | 'admin' | 'founder' = 'editor') {
  mocks.authUser = { ...mocks.authUser, role: userRole };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/admin/add-news']}><ArticleForm mode="create" userRole={userRole} /></MemoryRouter></QueryClientProvider>);
}

function controlNearLabel<T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(label: string, selector: string): T {
  const labelNode = screen.getByText(label);
  const control = labelNode.parentElement?.querySelector(selector) as T | null;
  if (!control) throw new Error(`Could not find ${label} control`);
  return control;
}

const savedAuthorByline: AuthorByline = {
  enabled: true,
  snapshot: { name: 'Shailesh Rathod', publicDesignation: 'Independent Writer', photoUrl: '/uploads/author.jpg', shortBio: 'Regional reporting.' },
};

function renderAuthorEdit(byline = savedAuthorByline, loadFromApi = false) {
  const article = {
    _id: 'article-1', title: 'Existing story', slug: 'existing-story', summary: 'Existing summary',
    content: 'Existing body content with enough text to pass the existing publish validation checks.',
    category: 'regional', status: 'draft' as const, language: 'en', lang: 'en', authorByline: byline,
  };
  if (loadFromApi) mocks.getArticle.mockResolvedValue(article);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
    <MemoryRouter initialEntries={['/admin/articles/article-1/edit']}>
      <ArticleForm mode="edit" id="article-1" userRole="admin" initialValues={loadFromApi ? undefined : article} />
    </MemoryRouter>
  </QueryClientProvider>);
}

async function fillAuthor() {
  const section = within(screen.getByRole('region', { name: 'Author Byline' }));
  fireEvent.click(section.getByRole('checkbox', { name: 'Author Byline' }));
  fireEvent.change(section.getByLabelText('Author Name *'), { target: { value: 'Shailesh Rathod' } });
}

async function fillPublishableSourceArticle() {
  const languageSelect = controlNearLabel<HTMLSelectElement>('Language', 'select');
  fireEvent.change(languageSelect, { target: { value: 'en' } });
  await waitFor(() => expect(languageSelect).toHaveValue('en'));
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  fireEvent.change(controlNearLabel<HTMLInputElement>('Title', 'input'), { target: { value: 'English source story' } });
  fireEvent.change(controlNearLabel<HTMLSelectElement>('Category', 'select'), { target: { value: 'national' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Content editor input' }), {
    target: { value: 'This is a complete English source article with enough body copy to pass publish validation.' },
  });
}

beforeEach(() => {
  mocks.authUser = { ...mocks.authUser, role: 'editor' };
  mocks.apiGet.mockResolvedValue({ data: ['en', 'hi', 'gu'] });
  mocks.getMediaStatus.mockResolvedValue({ ok: true, uploadEnabled: true });
  mocks.uploadCoverImage.mockResolvedValue({ url: '/uploads/uploaded-author.jpg' });
  mocks.checkSlugAvailability.mockResolvedValue({ available: true });
  mocks.createArticle.mockResolvedValue({ article: { _id: 'created-1', slug: 'english-source-story', status: 'draft' } });
  mocks.updateArticle.mockResolvedValue({ article: { _id: 'created-1', slug: 'english-source-story', status: 'draft' } });
  mocks.publishArticle.mockResolvedValue({ article: { _id: 'created-1', slug: 'english-source-story', status: 'published' } });
  mocks.getArticle.mockResolvedValue(null);
  mocks.retryArticleTranslation.mockResolvedValue({ ok: true });
  mocks.requeueArticleTranslations.mockResolvedValue({ ok: true });
  mocks.listArticlesByTranslationGroupId.mockResolvedValue({ rows: [], total: 0, page: 1, pages: 1 });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ArticleForm category choices', () => {
  function renderCategoryEdit(category: string, loadFromApi = false) {
    const article = {
      _id: 'article-1', title: 'Existing category story', slug: 'existing-category-story',
      content: 'Existing article content with enough text for the normal editorial workflow.',
      category, status: 'draft' as const, language: 'en', lang: 'en',
    };
    if (loadFromApi) mocks.getArticle.mockResolvedValue(article);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/articles/article-1/edit']}>
        <ArticleForm mode="edit" id="article-1" userRole="admin" initialValues={loadFromApi ? undefined : article} />
      </MemoryRouter>
    </QueryClientProvider>);
  }

  it('hides Breaking and Inspiration Hub on create while retaining every other canonical option', () => {
    renderArticleForm();
    const categorySelect = controlNearLabel<HTMLSelectElement>('Category', 'select');
    expect(within(categorySelect).queryByRole('option', { name: 'Breaking' })).not.toBeInTheDocument();
    expect(within(categorySelect).queryByRole('option', { name: 'Inspiration Hub' })).not.toBeInTheDocument();
    expect(Array.from(categorySelect.options).filter((option) => option.value).map((option) => ({ key: option.value, label: option.text }))).toEqual(
      ARTICLE_CATEGORY_OPTIONS.filter((option) => option.key !== 'breaking' && option.key !== 'inspiration-hub'),
    );
    expect(categorySelect.options).toHaveLength(15);
    expect(ARTICLE_CATEGORY_OPTIONS.map((option) => option.key)).toContain('breaking');
    expect(ARTICLE_CATEGORY_OPTIONS.map((option) => option.key)).toContain('inspiration-hub');
  });

  it.each([
    { category: 'breaking', label: 'Breaking', loadFromApi: false },
    { category: 'breaking', label: 'Breaking', loadFromApi: true },
    { category: 'inspiration-hub', label: 'Inspiration Hub', loadFromApi: false },
    { category: 'inspiration-hub', label: 'Inspiration Hub', loadFromApi: true },
  ])('preserves saved $category on unrelated edits (API load: $loadFromApi)', async ({ category, label, loadFromApi }) => {
    renderCategoryEdit(category, loadFromApi);
    const categorySelect = controlNearLabel<HTMLSelectElement>('Category', 'select');
    await waitFor(() => expect(categorySelect).toHaveValue(category));
    expect(within(categorySelect).getByRole('option', { name: label, selected: true })).toBeInTheDocument();
    const otherSpecialLabel = category === 'breaking' ? 'Inspiration Hub' : 'Breaking';
    expect(within(categorySelect).queryByRole('option', { name: otherSpecialLabel })).not.toBeInTheDocument();
    fireEvent.change(controlNearLabel<HTMLInputElement>('Title', 'input'), { target: { value: 'Unrelated title update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    expect(mocks.updateArticle.mock.calls[0][1].category).toBe(category);
  });

  it('does not offer either special category when editing a normal article', async () => {
    renderCategoryEdit('national');
    const categorySelect = controlNearLabel<HTMLSelectElement>('Category', 'select');
    expect(categorySelect).toHaveValue('national');
    expect(within(categorySelect).queryByRole('option', { name: 'Breaking' })).not.toBeInTheDocument();
    expect(within(categorySelect).queryByRole('option', { name: 'Inspiration Hub' })).not.toBeInTheDocument();
    fireEvent.change(controlNearLabel<HTMLInputElement>('Title', 'input'), { target: { value: 'Unrelated title update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    expect(mocks.updateArticle.mock.calls[0][1].category).toBe('national');
  });

  it.each(['breaking', 'inspiration-hub'])('allows explicitly changing %s to a normal category without offering special categories again', async (category) => {
    renderCategoryEdit(category);
    const categorySelect = controlNearLabel<HTMLSelectElement>('Category', 'select');
    fireEvent.change(categorySelect, { target: { value: 'regional' } });
    expect(categorySelect).toHaveValue('regional');
    expect(within(categorySelect).queryByRole('option', { name: 'Breaking' })).not.toBeInTheDocument();
    expect(within(categorySelect).queryByRole('option', { name: 'Inspiration Hub' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    expect(mocks.updateArticle.mock.calls[0][1].category).toBe('regional');
  });

  it.each(ARTICLE_CATEGORY_OPTIONS.filter((option) => !['breaking', 'inspiration-hub', 'pulse-dialogue'].includes(option.key)))(
    'keeps the $key category payload unchanged on create', async ({ key }) => {
      renderArticleForm('admin');
      await fillPublishableSourceArticle();
      fireEvent.change(controlNearLabel<HTMLSelectElement>('Category', 'select'), { target: { value: key } });
      fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
      await waitFor(() => expect(createArticle).toHaveBeenCalled());
      expect(mocks.createArticle.mock.calls[0][0].category).toBe(key);
    },
  );
});

describe('ArticleForm Gujarat location dropdowns', () => {
  function openLocations(label: 'District' | 'Big City') {
    const summary = screen.getByLabelText(label);
    if (!summary.closest('details')?.open) fireEvent.click(summary);
    return within(screen.getByRole('group', { name: `${label} options` }));
  }

  const savedLocations = {
    tags: ['local-news', 'district:ahmedabad', 'state:gujarat', 'district:surat', 'city:rajkot', 'city:vadodara'],
    state: 'gujarat', district: 'surat', city: 'vadodara',
  };

  function renderLocationEdit(locations = savedLocations) {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/articles/article-1/edit']}>
        <ArticleForm mode="edit" id="article-1" userRole="admin" initialValues={{
          _id: 'article-1', title: 'Existing regional story', slug: 'existing-regional-story', content: 'Existing regional story with enough content for normal editorial workflows.',
          category: 'regional', language: 'en', lang: 'en', status: 'draft', ...locations,
        }} />
      </MemoryRouter>
    </QueryClientProvider>);
  }

  it('renders compact District and Big City dropdowns without search or chip buttons', () => {
    renderArticleForm();
    expect(screen.getByLabelText('District').tagName).toBe('SUMMARY');
    expect(screen.getByLabelText('Big City').tagName).toBe('SUMMARY');
    expect(screen.getByText('Select district...')).toBeVisible();
    expect(screen.getByText('Select city...')).toBeVisible();
    expect(screen.queryByPlaceholderText(/Search districts \/ cities/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ahmedabad' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('District').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByLabelText('Big City').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByText('Other location fields (optional)')).toBeInTheDocument();
  });

  it('keeps the exact existing district and city datasets and stored slugs', () => {
    renderArticleForm();
    const districts = openLocations('District').getAllByRole('checkbox') as HTMLInputElement[];
    expect(districts.map((input) => input.value)).toEqual([
      'ahmedabad', 'amreli', 'anand', 'aravalli', 'banaskantha', 'bharuch', 'bhavnagar', 'botad', 'chhota-udaipur',
      'dahod', 'dang', 'devbhoomi-dwarka', 'gandhinagar', 'gir-somnath', 'jamnagar', 'junagadh', 'kheda', 'kutch',
      'mahisagar', 'mehsana', 'morbi', 'narmada', 'navsari', 'panchmahal', 'patan', 'porbandar', 'rajkot',
      'sabarkantha', 'surat', 'surendranagar', 'tapi', 'vadodara', 'vav-tharad', 'valsad',
    ]);
    expect(districts.find((input) => input.value === 'chhota-udaipur')).toHaveAccessibleName('Chhota Udaipur');
    expect(districts.find((input) => input.value === 'vav-tharad')).toHaveAccessibleName('Vav-Tharad');
    const cities = openLocations('Big City').getAllByRole('checkbox') as HTMLInputElement[];
    expect(cities.map((input) => input.value)).toEqual(['ahmedabad', 'surat', 'vadodara', 'rajkot', 'bhavnagar', 'jamnagar', 'junagadh', 'gandhinagar']);
    expect(cities.map((input) => input.parentElement?.textContent)).toEqual(['Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 'Jamnagar', 'Junagadh', 'Gandhinagar']);
  });

  it('sends the same multi-location tags and scalar/geo payload as the chip selector', async () => {
    renderArticleForm('admin');
    await fillPublishableSourceArticle();
    const districts = openLocations('District');
    fireEvent.click(districts.getByRole('checkbox', { name: 'Ahmedabad' }));
    fireEvent.click(districts.getByRole('checkbox', { name: 'Surat' }));
    const cities = openLocations('Big City');
    fireEvent.click(cities.getByRole('checkbox', { name: 'Rajkot' }));
    fireEvent.click(cities.getByRole('checkbox', { name: 'Vadodara' }));
    expect(districts.getByRole('checkbox', { name: 'Ahmedabad' })).toBeChecked();
    expect(districts.getByRole('checkbox', { name: 'Surat' })).toBeChecked();
    expect(cities.getByRole('checkbox', { name: 'Rajkot' })).toBeChecked();
    expect(cities.getByRole('checkbox', { name: 'Vadodara' })).toBeChecked();
    expect(screen.getByLabelText('District')).toHaveTextContent('Ahmedabad, Surat');
    expect(screen.getByLabelText('Big City')).toHaveTextContent('Rajkot, Vadodara');
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(createArticle).toHaveBeenCalled());
    const payload = mocks.createArticle.mock.calls[0][0];
    expect({ tags: payload.tags, state: payload.state, district: payload.district, city: payload.city, geo: payload.geo }).toEqual({
      tags: ['district:ahmedabad', 'state:gujarat', 'district:surat', 'city:rajkot', 'city:vadodara'],
      state: 'gujarat', district: 'surat', city: 'vadodara', geo: { state: 'gujarat', district: 'surat', city: 'vadodara' },
    });
  });

  it('restores multiple saved selections and preserves them on unrelated edits', async () => {
    renderLocationEdit();
    expect(openLocations('District').getByRole('checkbox', { name: 'Ahmedabad' })).toBeChecked();
    expect(openLocations('District').getByRole('checkbox', { name: 'Surat' })).toBeChecked();
    expect(openLocations('Big City').getByRole('checkbox', { name: 'Rajkot' })).toBeChecked();
    expect(openLocations('Big City').getByRole('checkbox', { name: 'Vadodara' })).toBeChecked();
    fireEvent.change(controlNearLabel<HTMLInputElement>('Title', 'input'), { target: { value: 'Unrelated title update' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    expect(mocks.updateArticle.mock.calls[0][1]).toEqual(expect.objectContaining({
      ...savedLocations, geo: { state: 'gujarat', district: 'surat', city: 'vadodara' },
    }));
  });

  it('keeps the existing fallback and clear behavior when deselecting locations', async () => {
    renderLocationEdit();
    const districts = openLocations('District');
    const cities = openLocations('Big City');
    fireEvent.click(districts.getByRole('checkbox', { name: 'Surat' }));
    fireEvent.click(cities.getByRole('checkbox', { name: 'Vadodara' }));
    expect(screen.getByPlaceholderText('District')).toHaveValue('ahmedabad');
    expect(screen.getByPlaceholderText('City')).toHaveValue('rajkot');
    fireEvent.click(districts.getByRole('checkbox', { name: 'Ahmedabad' }));
    fireEvent.click(cities.getByRole('checkbox', { name: 'Rajkot' }));
    expect(screen.getByLabelText('District')).toHaveTextContent('Select district...');
    expect(screen.getByLabelText('Big City')).toHaveTextContent('Select city...');
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    const payload = mocks.updateArticle.mock.calls[0][1];
    expect(payload.tags).toEqual(['local-news', 'state:gujarat']);
    expect(payload.state).toBe('gujarat');
    expect(payload.district).toBeUndefined();
    expect(payload.city).toBeUndefined();
    expect(payload.geo).toEqual({ state: 'gujarat', district: undefined, city: undefined });
  });

  it('preserves legacy values and Other location fields without synthesizing new tags', async () => {
    const existing = { tags: ['local-news', 'district:custom-district'], state: 'custom-state', district: 'custom-district', city: 'custom-city' };
    renderLocationEdit(existing);
    const other = screen.getByText('Other location fields (optional)');
    expect(other.closest('details')).not.toHaveAttribute('open');
    fireEvent.click(other);
    expect(screen.getByPlaceholderText('State')).toHaveValue('custom-state');
    expect(screen.getByPlaceholderText('District')).toHaveValue('custom-district');
    expect(screen.getByPlaceholderText('City')).toHaveValue('custom-city');
    fireEvent.change(screen.getByPlaceholderText('City'), { target: { value: 'updated-custom-city' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    expect(mocks.updateArticle.mock.calls[0][1]).toEqual(expect.objectContaining({
      ...existing, city: 'updated-custom-city', geo: { state: 'custom-state', district: 'custom-district', city: 'updated-custom-city' },
    }));
  });
});

describe('ArticleForm Quality Tools', () => {
  it('renders Add News quality tools without Article Assistant UI or API calls', async () => {
    renderArticleForm();

    expect(await screen.findByText('Quality Tools')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Language Guard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SEO Preview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Readability/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /PTI Compliance/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Run PTI Check' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeInTheDocument();
    expect(screen.queryByText('News Pulse Article Assistant')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suggest' })).not.toBeInTheDocument();
    expect(screen.queryByText('Draft Assistance')).not.toBeInTheDocument();
    expect(screen.queryByText('Start writing your article to use draft assistance.')).not.toBeInTheDocument();

    await waitFor(() => expect(mocks.getMediaStatus).toHaveBeenCalled());
    expect(mocks.apiPost.mock.calls.map(([path]) => path)).not.toContain('/assist/suggest');
    expect(mocks.apiPost.mock.calls.map(([path]) => path)).not.toContain('/assist/suggest/v2');
  });

  it('defaults new articles to Normal Spotlight Priority', async () => {
    renderArticleForm('admin');

    const spotlightPrioritySelect = await screen.findByDisplayValue('Normal') as HTMLSelectElement;
    expect(spotlightPrioritySelect).toHaveValue('normal');
  });

  it('sends Important Spotlight Priority in the draft payload', async () => {
    renderArticleForm('admin');
    await fillPublishableSourceArticle();

    const spotlightPrioritySelect = controlNearLabel<HTMLSelectElement>('Spotlight Priority', 'select');
    fireEvent.change(spotlightPrioritySelect, { target: { value: 'important' } });
    expect(spotlightPrioritySelect).toHaveValue('important');

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(createArticle).toHaveBeenCalledWith(expect.objectContaining({
      status: 'draft',
      spotlightPriority: 'important',
    })));
  });

  it('sends Top Priority Spotlight Priority in the draft payload', async () => {
    renderArticleForm('admin');
    await fillPublishableSourceArticle();

    const spotlightPrioritySelect = controlNearLabel<HTMLSelectElement>('Spotlight Priority', 'select');
    fireEvent.change(spotlightPrioritySelect, { target: { value: 'top' } });
    expect(spotlightPrioritySelect).toHaveValue('top');

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(createArticle).toHaveBeenCalledWith(expect.objectContaining({
      status: 'draft',
      spotlightPriority: 'top',
    })));
  });

  it('loads existing articles without Spotlight Priority as Normal', async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/articles/article-1/edit']}>
        <ArticleForm
          mode="edit"
          id="article-1"
          userRole="admin"
          initialValues={{
            _id: 'article-1',
            title: 'Existing story',
            slug: 'existing-story',
            summary: 'Existing summary',
            content: 'Existing body content',
            category: 'national',
            status: 'draft',
            language: 'en',
            lang: 'en',
          }}
        />
      </MemoryRouter>
    </QueryClientProvider>);

    const spotlightPrioritySelect = await screen.findByDisplayValue('Normal') as HTMLSelectElement;
    expect(spotlightPrioritySelect).toHaveValue('normal');
  });

  it('preserves Spotlight Priority when editing another field', async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/articles/article-1/edit']}>
        <ArticleForm
          mode="edit"
          id="article-1"
          userRole="admin"
          initialValues={{
            _id: 'article-1',
            title: 'Existing story',
            slug: 'existing-story',
            summary: 'Existing summary',
            content: 'Existing body content',
            category: 'national',
            status: 'draft',
            language: 'en',
            lang: 'en',
            spotlightPriority: 'top',
          }}
        />
      </MemoryRouter>
    </QueryClientProvider>);

    const spotlightPrioritySelect = await screen.findByDisplayValue('Top Priority') as HTMLSelectElement;
    expect(spotlightPrioritySelect).toHaveValue('top');
    fireEvent.change(controlNearLabel<HTMLInputElement>('Title', 'input'), { target: { value: 'Existing story updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(updateArticle).toHaveBeenCalledWith('article-1', expect.objectContaining({
      title: 'Existing story updated',
      spotlightPriority: 'top',
    })));
  });

  it('keeps Spotlight Priority read-only for writer role', async () => {
    renderArticleForm('writer');

    const spotlightPrioritySelect = await screen.findByDisplayValue('Normal') as HTMLSelectElement;
    expect(spotlightPrioritySelect).toBeDisabled();
  });

  it('keeps Preview opening from Add News', async () => {
    renderArticleForm('admin');
    await fillPublishableSourceArticle();

    const previewButton = screen.getByRole('button', { name: 'Preview' });
    await waitFor(() => expect(previewButton).not.toBeDisabled());
    fireEvent.click(previewButton);

    expect(await screen.findByRole('dialog', { name: 'Article Preview' })).toBeInTheDocument();
  });

  it('shows Pulse Dialogue controls only for pulse-dialogue and sends backend payload', async () => {
    renderArticleForm('admin');
    await fillPublishableSourceArticle();

    expect(screen.queryByTestId('pulse-dialogue-details')).not.toBeInTheDocument();

    const categorySelect = controlNearLabel<HTMLSelectElement>('Category', 'select');
    fireEvent.change(categorySelect, { target: { value: 'editorial' } });
    expect(await screen.findByText('Editorial Type')).toBeInTheDocument();
    expect(screen.queryByTestId('pulse-dialogue-details')).not.toBeInTheDocument();

    fireEvent.change(categorySelect, { target: { value: 'youth-pulse' } });
    expect(await screen.findByText('Youth Pulse Track')).toBeInTheDocument();
    expect(screen.queryByTestId('pulse-dialogue-details')).not.toBeInTheDocument();

    fireEvent.change(categorySelect, { target: { value: 'pulse-dialogue' } });
    expect(await screen.findByTestId('pulse-dialogue-details')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Author Byline' })).not.toBeInTheDocument();
    expect(screen.queryByText('Editorial Type')).not.toBeInTheDocument();
    expect(screen.queryByText('Youth Pulse Track')).not.toBeInTheDocument();

    fireEvent.change(controlNearLabel<HTMLSelectElement>('Dialogue Format', 'select'), { target: { value: 'essay' } });
    expect(screen.getByText('Search to find contributors.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search contributors'), { target: { value: 'guest' } });
    fireEvent.click(await screen.findByText('Guest Writer'));
    fireEvent.change(controlNearLabel<HTMLInputElement>('Series / Column', 'input'), { target: { value: 'Ideas & Society' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(createArticle).toHaveBeenCalledWith(expect.objectContaining({
      category: 'pulse-dialogue',
      pulseDialogue: expect.objectContaining({
        contributorId: 'contributor-1',
        dialogueFormat: 'essay',
        series: 'Ideas & Society',
        showAboutContributor: false,
      }),
    })));
    expect(mocks.createArticle.mock.calls[0][0]).not.toHaveProperty('authorByline');
  });

  it('preserves Pulse Dialogue metadata when editing another field', async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/articles/article-1/edit']}>
        <ArticleForm
          mode="edit"
          id="article-1"
          userRole="admin"
          initialValues={{
            _id: 'article-1',
            title: 'Existing Pulse story',
            slug: 'existing-pulse-story',
            summary: 'Existing summary',
            content: 'Existing body content',
            category: 'pulse-dialogue',
            status: 'draft',
            language: 'en',
            lang: 'en',
            pulseDialogue: {
              contributorId: 'contributor-1',
              dialogueFormat: 'essay',
              series: 'Ideas & Society',
              contributor: { id: 'contributor-1', canonicalName: 'Guest Writer', status: 'active' },
            },
          }}
        />
      </MemoryRouter>
    </QueryClientProvider>);

    expect(await screen.findByTestId('pulse-dialogue-details')).toBeInTheDocument();
    fireEvent.change(controlNearLabel<HTMLInputElement>('Title', 'input'), { target: { value: 'Existing Pulse story updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(updateArticle).toHaveBeenCalledWith('article-1', expect.objectContaining({
      title: 'Existing Pulse story updated',
      pulseDialogue: expect.objectContaining({
        contributorId: 'contributor-1',
        dialogueFormat: 'essay',
        series: 'Ideas & Society',
      }),
    })));
  });

  it.each([false, true])('keeps scheduled edits saving through the existing payload (reporter enabled: %s)', async (enabled) => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/articles/article-1/edit']}>
        <ArticleForm
          mode="edit"
          id="article-1"
          userRole="admin"
          initialValues={{
            _id: 'article-1',
            title: 'Existing story',
            slug: 'existing-story',
            summary: 'Existing summary',
            content: 'Existing body content',
            category: 'national',
            status: 'draft',
            language: 'en',
            lang: 'en',
            authorByline: enabled ? savedAuthorByline : undefined,
          }}
        />
      </MemoryRouter>
    </QueryClientProvider>);

    const scheduledLocalValue = '2026-10-01T09:30';
    const scheduledIsoValue = new Date(scheduledLocalValue).toISOString();
    const statusSelect = await screen.findByDisplayValue('Draft') as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: 'scheduled' } });
    fireEvent.change(controlNearLabel<HTMLInputElement>('Schedule (UTC)', 'input'), { target: { value: scheduledLocalValue } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(updateArticle).toHaveBeenCalledWith('article-1', expect.objectContaining({
      status: 'scheduled',
      scheduledAt: scheduledIsoValue,
      publishAt: scheduledIsoValue,
    })));
    expect(mocks.updateArticle.mock.calls[0][1]).not.toHaveProperty('authorByline');
  });

  it('publishes an English source article through the canonical publish service when Hindi and Gujarati are missing', async () => {
    renderArticleForm('admin');
    await fillPublishableSourceArticle();

    const publishButton = screen.getByRole('button', { name: 'Publish' });
    await waitFor(() => expect(publishButton).not.toBeDisabled());
    fireEvent.click(publishButton);

    await waitFor(() => expect(publishArticle).toHaveBeenCalledWith('created-1', expect.any(String)));
    expect(createArticle).toHaveBeenCalledWith(expect.objectContaining({
      status: 'draft',
      language: 'en',
      lang: 'en',
      category: 'national',
    }));
    expect(updateArticle).not.toHaveBeenCalled();
    expect(requeueArticleTranslations).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalledWith(expect.stringContaining('Complete the English, Hindi and Gujarati versions'));
  });

  it('keeps Save Draft successful when automatic translation generation fails', async () => {
    mocks.requeueArticleTranslations.mockRejectedValueOnce(new Error('Translation generation failed'));
    renderArticleForm('admin');
    await fillPublishableSourceArticle();

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(createArticle).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft' })));
    await waitFor(() => expect(requeueArticleTranslations).toHaveBeenCalledWith('created-1', { languages: ['hi', 'gu'] }));
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Draft saved');
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Translation generation failed'));
    expect(publishArticle).not.toHaveBeenCalled();
  });

  it('keeps Generate and Regenerate translation controls on the shared helper', async () => {
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/admin/articles/article-1/edit']}>
        <ArticleForm
          mode="edit"
          id="article-1"
          userRole="admin"
          initialValues={{
            _id: 'article-1',
            title: 'Existing English story',
            slug: 'existing-english-story',
            summary: 'Existing summary',
            content: 'Existing body content',
            category: 'national',
            status: 'draft',
            language: 'en',
            lang: 'en',
          }}
        />
      </MemoryRouter>
    </QueryClientProvider>);

    fireEvent.click(await screen.findByRole('button', { name: 'Generate Translations' }));
    await waitFor(() => expect(requeueArticleTranslations).toHaveBeenCalledWith('article-1', { languages: ['hi', 'gu'] }));

    fireEvent.click(screen.getByRole('button', { name: 'Regenerate Translations' }));
    await waitFor(() => expect(requeueArticleTranslations).toHaveBeenCalledTimes(2));
    expect(requeueArticleTranslations).toHaveBeenLastCalledWith('article-1', { languages: ['hi', 'gu'] });
    expect(publishArticle).not.toHaveBeenCalled();
  });

  it('keeps genuine required-field validation before publish', async () => {
    renderArticleForm('admin');
    fireEvent.change(controlNearLabel<HTMLInputElement>('Title', 'input'), { target: { value: 'English source story' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Content editor input' }), {
      target: { value: 'This is a complete article body but category has intentionally not been selected.' },
    });

    const publishButton = screen.getByRole('button', { name: 'Publish' });
    await waitFor(() => expect(publishButton).toBeDisabled());
    expect(publishButton.closest('span')).toHaveAttribute('title', expect.stringContaining('Category'));
    fireEvent.click(publishButton);

    expect(createArticle).not.toHaveBeenCalled();
    expect(publishArticle).not.toHaveBeenCalled();
  });

  it('shows backend publish errors from the canonical publish service', async () => {
    mocks.publishArticle.mockRejectedValueOnce(new Error('Backend publish failed'));
    renderArticleForm('admin');
    await fillPublishableSourceArticle();

    const publishButton = screen.getByRole('button', { name: 'Publish' });
    await waitFor(() => expect(publishButton).not.toBeDisabled());
    fireEvent.click(publishButton);

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Backend publish failed'));
  });
});

describe('ArticleForm Author Byline', () => {
  it('defaults off with unchanged normal article fields and no reporter query', async () => {
    renderArticleForm('admin');
    await fillPublishableSourceArticle();
    expect(screen.getByRole('checkbox', { name: 'Author Byline' })).not.toBeChecked();
    expect(screen.queryByRole('searchbox', { name: 'Search Reporter' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(createArticle).toHaveBeenCalledWith(expect.objectContaining({
      title: 'English source story', category: 'national', status: 'draft', language: 'en', lang: 'en',
      authorByline: { enabled: false },
    })));
    expect(mocks.apiGet.mock.calls.map(([path]) => path).join(' ')).not.toMatch(/reporter-options|staff|team|presence/);
  });

  it('shows editable author fields without reporter lookup or private staff data', async () => {
    renderArticleForm();
    await fillAuthor();
    const section = within(screen.getByRole('region', { name: 'Author Byline' }));
    expect(section.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByText('Reporter Byline')).not.toBeInTheDocument();
    expect(screen.queryByText('Search Reporter')).not.toBeInTheDocument();
    expect(section.getByLabelText('Author Name *')).toHaveValue('Shailesh Rathod');
    expect(section.getByLabelText('Author Name *')).toBeRequired();
    expect(section.getByLabelText('Author Name *')).toHaveAttribute('maxlength', '160');
    expect(section.getByLabelText('Public Designation / Role (optional)')).toHaveAttribute('maxlength', '160');
    expect(section.getByLabelText('Short Bio (optional)')).toHaveAttribute('maxlength', '600');
    expect(section.queryByRole('textbox', { name: /email|phone|permissions/i })).not.toBeInTheDocument();
    expect(mocks.apiGet.mock.calls.map(([path]) => path).join(' ')).not.toMatch(/reporter-options|staff|team|presence/);
  });

  it('turning off hides author fields and clears the local author state', async () => {
    renderArticleForm();
    await fillAuthor();
    const section = within(screen.getByRole('region', { name: 'Author Byline' }));
    fireEvent.change(section.getByLabelText('Short Bio (optional)'), { target: { value: 'Previous bio' } });
    fireEvent.click(section.getByRole('checkbox', { name: 'Author Byline' }));
    expect(section.queryByRole('textbox')).not.toBeInTheDocument();
    fireEvent.click(section.getByRole('checkbox', { name: 'Author Byline' }));
    expect(section.getByLabelText('Short Bio (optional)')).toHaveValue('');
    expect(section.getByLabelText('Author Name *')).toHaveValue('');
  });

  it('saves with only name when photo, designation, and bio are empty', async () => {
    renderArticleForm('admin');
    await fillPublishableSourceArticle();
    await fillAuthor();
    for (const label of ['Public Designation / Role (optional)', 'Short Bio (optional)']) {
      expect(screen.getByLabelText(label)).not.toBeRequired();
      expect(screen.getByLabelText(label)).toHaveValue('');
    }
    expect(screen.getByLabelText('Author photo file')).not.toBeRequired();
    expect(screen.getByRole('button', { name: 'Upload Photo' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Reporter Photo URL (optional)')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(createArticle).toHaveBeenCalled());
    expect(mocks.createArticle.mock.calls[0][0].authorByline).toEqual({ enabled: true, snapshot: { name: 'Shailesh Rathod' } });
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.uploadCoverImage).not.toHaveBeenCalled();
  });

  it('sends the full author snapshot on create with the stored upload path', async () => {
    renderArticleForm('admin');
    await fillPublishableSourceArticle();
    await fillAuthor();
    fireEvent.change(screen.getByLabelText('Public Designation / Role (optional)'), { target: { value: 'Independent Writer' } });
    const photo = new File(['photo'], 'reporter.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Author photo file'), { target: { files: [photo] } });
    await waitFor(() => expect(screen.getByAltText('Author photo preview')).toHaveAttribute('src', '/uploads/uploaded-author.jpg'));
    expect(mocks.uploadCoverImage).toHaveBeenCalledExactlyOnceWith(photo);
    fireEvent.change(screen.getByLabelText('Short Bio (optional)'), { target: { value: 'Regional reporting.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(createArticle).toHaveBeenCalled());
    expect(mocks.createArticle.mock.calls[0][0].authorByline).toEqual({
      enabled: true,
      snapshot: { name: 'Shailesh Rathod', publicDesignation: 'Independent Writer', photoUrl: '/uploads/uploaded-author.jpg', shortBio: 'Regional reporting.' },
    });
  });

  it.each([false, true])('restores the saved author and omits unchanged attribution on unrelated edits (API load: %s)', async (loadFromApi) => {
    renderAuthorEdit(savedAuthorByline, loadFromApi);
    expect(await screen.findByDisplayValue('Shailesh Rathod')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Author Byline' })).toBeChecked();
    expect(screen.getByLabelText('Public Designation / Role (optional)')).toHaveValue('Independent Writer');
    expect(screen.getByAltText('Author photo preview')).toHaveAttribute('src', '/uploads/author.jpg');
    expect(screen.getByRole('button', { name: 'Replace Photo' })).toBeInTheDocument();
    expect(screen.getByLabelText('Short Bio (optional)')).toHaveValue('Regional reporting.');
    fireEvent.change(controlNearLabel<HTMLInputElement>('Title', 'input'), { target: { value: 'Unrelated title edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    for (const [, payload] of mocks.updateArticle.mock.calls) expect(payload).not.toHaveProperty('authorByline');
    expect(mocks.uploadCoverImage).not.toHaveBeenCalled();
  });

  it.each([
    ['publicDesignation', 'Public Designation / Role (optional)', 'Reporter'],
    ['publicDesignation', 'Public Designation / Role (optional)', ''],
    ['shortBio', 'Short Bio (optional)', 'Updated regional reporting.'],
    ['shortBio', 'Short Bio (optional)', ''],
  ] as const)('refreshes the complete current snapshot when existing %s changes to %j', async (field, label, text) => {
    renderAuthorEdit();
    fireEvent.change(await screen.findByLabelText(label), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    const snapshot: Record<string, string> = { name: 'Shailesh Rathod', publicDesignation: 'Independent Writer', photoUrl: '/uploads/author.jpg', shortBio: 'Regional reporting.' };
    if (text) snapshot[field] = text;
    else delete snapshot[field];
    expect(mocks.updateArticle.mock.calls[0][1].authorByline).toStrictEqual({
      enabled: true, snapshot,
    });
    expect(mocks.uploadCoverImage).not.toHaveBeenCalled();
  });

  it('refreshes a replaced saved photo with all current optional fields', async () => {
    renderAuthorEdit();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Replace Photo' })).toBeEnabled());
    const photo = new File(['photo'], 'replacement.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Author photo file'), { target: { files: [photo] } });
    await waitFor(() => expect(screen.getByAltText('Author photo preview')).toHaveAttribute('src', '/uploads/uploaded-author.jpg'));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    expect(mocks.updateArticle.mock.calls[0][1].authorByline).toStrictEqual({
      enabled: true,
      snapshot: { name: 'Shailesh Rathod', publicDesignation: 'Independent Writer', photoUrl: '/uploads/uploaded-author.jpg', shortBio: 'Regional reporting.' },
    });
    expect(mocks.uploadCoverImage).toHaveBeenCalledExactlyOnceWith(photo);
  });

  it('does not refresh again after a successful snapshot update and an unrelated edit', async () => {
    renderAuthorEdit();
    fireEvent.change(await screen.findByLabelText('Short Bio (optional)'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalledWith('Draft updated'));
    expect(mocks.updateArticle.mock.calls[0][1].authorByline.snapshot).not.toHaveProperty('shortBio');
    mocks.updateArticle.mockClear();
    fireEvent.change(controlNearLabel<HTMLInputElement>('Title', 'input'), { target: { value: 'Unrelated edit after save' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    for (const [, payload] of mocks.updateArticle.mock.calls) expect(payload).not.toHaveProperty('authorByline');
  });

  it('editing the author name sends all current optional fields', async () => {
    renderAuthorEdit();
    fireEvent.change(await screen.findByLabelText('Author Name *'), { target: { value: 'Another Author' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    expect(mocks.updateArticle.mock.calls[0][1].authorByline).toStrictEqual({
      enabled: true, snapshot: { ...savedAuthorByline.snapshot, name: 'Another Author' },
    });
    expect(mocks.uploadCoverImage).not.toHaveBeenCalled();
  });

  it('turning off sends only enabled:false even after an upload failure', async () => {
    mocks.uploadCoverImage.mockRejectedValueOnce(new Error('Upload failed'));
    renderAuthorEdit();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Replace Photo' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Author photo file'), { target: { files: [new File(['photo'], 'reporter.png', { type: 'image/png' })] } });
    expect(await screen.findByText('Upload failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Author Byline' }));
    expect(screen.queryByLabelText('Author Name *')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    expect(mocks.updateArticle.mock.calls[0][1].authorByline).toEqual({ enabled: false });
  });

  it('requires a name when on and rejects temporary upload URLs without corrupting the form', async () => {
    renderArticleForm('admin');
    await fillPublishableSourceArticle();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Author Byline' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Author Name is required when Author Byline is on.'));
    expect(createArticle).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Author Name *'), { target: { value: 'Shailesh Rathod' } });
    mocks.uploadCoverImage.mockResolvedValueOnce({ url: 'blob:temporary' });
    fireEvent.change(screen.getByLabelText('Author photo file'), { target: { files: [new File(['photo'], 'reporter.png', { type: 'image/png' })] } });
    expect(await screen.findByText('Author photo must be an HTTP(S) URL or a local upload path.')).toBeInTheDocument();
    expect(screen.queryByAltText('Author photo preview')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(createArticle).toHaveBeenCalled());
    expect(mocks.createArticle.mock.calls[0][0].authorByline).toEqual({ enabled: true, snapshot: { name: 'Shailesh Rathod' } });
  });

  it('retains selection in preview and saves before dedicated publish on create', async () => {
    renderArticleForm('admin');
    await fillPublishableSourceArticle();
    await fillAuthor();
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(JSON.parse(screen.getByTestId('preview-author').textContent || '{}')).toEqual({
      enabled: true, snapshot: { name: 'Shailesh Rathod' },
    });
    expect(createArticle).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(publishArticle).toHaveBeenCalledWith('created-1', expect.any(String)));
    expect(mocks.createArticle.mock.calls[0][0].authorByline).toEqual({ enabled: true, snapshot: { name: 'Shailesh Rathod' } });
    expect(mocks.createArticle.mock.invocationCallOrder[0]).toBeLessThan(mocks.publishArticle.mock.invocationCallOrder[0]);
    expect(mocks.publishArticle.mock.calls[0]).toHaveLength(2);
  });

  it('saves the existing byline before dedicated publish on edit', async () => {
    renderAuthorEdit();
    await screen.findByDisplayValue('Shailesh Rathod');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await waitFor(() => expect(publishArticle).toHaveBeenCalledWith('article-1', expect.any(String)));
    expect(mocks.updateArticle.mock.calls[0][1]).not.toHaveProperty('authorByline');
    expect(mocks.updateArticle.mock.invocationCallOrder[0]).toBeLessThan(mocks.publishArticle.mock.invocationCallOrder[0]);
  });

  it('excludes reporter controls and metadata after switching to Pulse Dialogue', async () => {
    renderArticleForm('admin');
    await fillPublishableSourceArticle();
    await fillAuthor();
    fireEvent.change(controlNearLabel<HTMLSelectElement>('Category', 'select'), { target: { value: 'pulse-dialogue' } });
    expect(screen.queryByRole('checkbox', { name: 'Author Byline' })).not.toBeInTheDocument();
    expect(screen.getByTestId('pulse-dialogue-details')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(createArticle).toHaveBeenCalled());
    expect(mocks.createArticle.mock.calls[0][0]).not.toHaveProperty('authorByline');
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    expect(screen.getByTestId('preview-author')).toBeEmptyDOMElement();
  });

  it('Remove Photo clears the saved photo without deleting or uploading media', async () => {
    renderAuthorEdit();
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Photo' }));
    expect(screen.queryByAltText('Author photo preview')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload Photo' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    expect(mocks.updateArticle.mock.calls[0][1].authorByline).toStrictEqual({
      enabled: true,
      snapshot: { name: 'Shailesh Rathod', publicDesignation: 'Independent Writer', shortBio: 'Regional reporting.' },
    });
    expect(mocks.uploadCoverImage).not.toHaveBeenCalled();
  });

  it('preserves the old photo and other fields when replacement upload fails', async () => {
    mocks.uploadCoverImage.mockRejectedValueOnce(new Error('Image upload unavailable'));
    renderAuthorEdit();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Replace Photo' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Author photo file'), { target: { files: [new File(['photo'], 'reporter.webp', { type: 'image/webp' })] } });
    expect(await screen.findByText('Image upload unavailable')).toBeInTheDocument();
    expect(screen.getByAltText('Author photo preview')).toHaveAttribute('src', '/uploads/author.jpg');
    fireEvent.change(controlNearLabel<HTMLInputElement>('Title', 'input'), { target: { value: 'Unrelated title edit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    expect(mocks.updateArticle.mock.calls[0][1].title).toBe('Unrelated title edit');
    expect(mocks.updateArticle.mock.calls[0][1]).not.toHaveProperty('authorByline');
  });

  it('enforces existing image size and type restrictions before uploading', async () => {
    renderAuthorEdit();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Replace Photo' })).toBeEnabled());
    const fileInput = screen.getByLabelText('Author photo file');
    expect(fileInput).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
    const tooLarge = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' });
    for (const file of [tooLarge, new File(['<svg/>'], 'reporter.jpg', { type: 'image/svg+xml' })]) {
      fireEvent.change(fileInput, { target: { files: [file] } });
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(mocks.uploadCoverImage).not.toHaveBeenCalled();
      expect(screen.getByAltText('Author photo preview')).toHaveAttribute('src', '/uploads/author.jpg');
    }
  });

  it('respects upload availability without preventing removal of an existing photo', async () => {
    mocks.getMediaStatus.mockResolvedValue({ uploadEnabled: false, message: 'Upload unavailable.' });
    renderAuthorEdit();
    expect(await screen.findByRole('button', { name: 'Replace Photo' })).toBeDisabled();
    expect(screen.getByLabelText('Author photo file')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Photo' }));
    expect(screen.queryByAltText('Author photo preview')).not.toBeInTheDocument();
    expect(mocks.uploadCoverImage).not.toHaveBeenCalled();
  });

  it('preserves edits made during upload and saves only after upload completes', async () => {
    let finishUpload!: (result: { url: string }) => void;
    mocks.uploadCoverImage.mockReturnValueOnce(new Promise((resolve) => { finishUpload = resolve; }));
    renderAuthorEdit();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Replace Photo' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Author photo file'), { target: { files: [new File(['photo'], 'reporter.png', { type: 'image/png' })] } });
    expect(screen.getByRole('button', { name: 'Uploading Photo...' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Short Bio (optional)'), { target: { value: 'Updated during upload' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Please wait for the author photo upload to finish.'));
    expect(updateArticle).not.toHaveBeenCalled();
    await act(async () => finishUpload({ url: 'https://example.test/replacement.jpg' }));
    expect(screen.getByLabelText('Short Bio (optional)')).toHaveValue('Updated during upload');
    expect(screen.getByAltText('Author photo preview')).toHaveAttribute('src', 'https://example.test/replacement.jpg');
    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(updateArticle).toHaveBeenCalled());
    expect(mocks.updateArticle.mock.calls[0][1].authorByline).toStrictEqual({
      enabled: true,
      snapshot: { name: 'Shailesh Rathod', publicDesignation: 'Independent Writer', photoUrl: 'https://example.test/replacement.jpg', shortBio: 'Updated during upload' },
    });
    expect(mocks.uploadCoverImage).toHaveBeenCalledTimes(1);
  });

  it.each(['Remove Photo', 'Author Byline'])('ignores late upload completion after %s', async (action) => {
    let finishUpload!: (result: { url: string }) => void;
    mocks.uploadCoverImage.mockReturnValueOnce(new Promise((resolve) => { finishUpload = resolve; }));
    renderAuthorEdit();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Replace Photo' })).toBeEnabled());
    fireEvent.change(screen.getByLabelText('Author photo file'), { target: { files: [new File(['photo'], 'reporter.png', { type: 'image/png' })] } });
    const section = within(screen.getByRole('region', { name: 'Author Byline' }));
    fireEvent.click(section.getByRole(action === 'Author Byline' ? 'checkbox' : 'button', { name: action }));
    await act(async () => finishUpload({ url: 'https://example.test/late-photo.jpg' }));
    expect(screen.queryByAltText('Author photo preview')).not.toBeInTheDocument();
    expect(screen.queryByText('Uploading photo...')).not.toBeInTheDocument();
  });
});
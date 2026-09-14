import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticleForm } from '@/components/news/ArticleForm';
import { createArticle, publishArticle, requeueArticleTranslations, updateArticle } from '@/lib/api/articles';

const mocks = vi.hoisted(() => ({
  authUser: { id: 'editor-1', email: 'editor@newspulse.co.in', role: 'editor' },
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  getMediaStatus: vi.fn(),
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
  uploadCoverImage: vi.fn(),
}));

vi.mock('@/lib/api/language', () => ({ verifyLanguage: vi.fn(), readability: vi.fn() }));
vi.mock('@/components/editor/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Content editor input" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
vi.mock('@/components/articles/CoverImageUpload', () => ({ default: () => <div>Cover image upload</div> }));
vi.mock('@/components/media/MediaLibrarySelector', () => ({ default: () => null }));
vi.mock('@/components/preview/PreviewModal', () => ({ default: () => null }));
vi.mock('@/components/ui/ConfirmModal', () => ({ default: () => null }));

function renderArticleForm(userRole: 'writer' | 'editor' | 'admin' | 'founder' = 'editor') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/admin/add-news']}><ArticleForm mode="create" userRole={userRole} /></MemoryRouter></QueryClientProvider>);
}

function controlNearLabel<T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(label: string, selector: string): T {
  const labelNode = screen.getByText(label);
  const control = labelNode.parentElement?.querySelector(selector) as T | null;
  if (!control) throw new Error(`Could not find ${label} control`);
  return control;
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
  mocks.apiGet.mockResolvedValue({ data: ['en', 'hi', 'gu'] });
  mocks.getMediaStatus.mockResolvedValue({ ok: true, uploadEnabled: true });
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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticleForm } from '@/components/news/ArticleForm';

const mocks = vi.hoisted(() => ({
  authUser: { id: 'editor-1', email: 'editor@newspulse.co.in', role: 'editor' },
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  getMediaStatus: vi.fn(),
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
  createArticle: vi.fn(), updateArticle: vi.fn(), getArticle: vi.fn(), publishArticle: vi.fn(),
  retryArticleTranslation: vi.fn(), requeueArticleTranslations: vi.fn(), listArticlesByTranslationGroupId: vi.fn(),
}));

vi.mock('@/lib/api/media', () => ({
  getMediaStatus: mocks.getMediaStatus,
  uploadCoverImage: vi.fn(),
}));

vi.mock('@/lib/api/language', () => ({ verifyLanguage: vi.fn(), readability: vi.fn() }));
vi.mock('@/components/editor/RichTextEditor', () => ({ default: () => <div>Content editor</div> }));
vi.mock('@/components/articles/CoverImageUpload', () => ({ default: () => <div>Cover image upload</div> }));
vi.mock('@/components/media/MediaLibrarySelector', () => ({ default: () => null }));
vi.mock('@/components/preview/PreviewModal', () => ({ default: () => null }));
vi.mock('@/components/ui/ConfirmModal', () => ({ default: () => null }));

function renderArticleForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/admin/add-news']}><ArticleForm mode="create" userRole="editor" /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  mocks.apiGet.mockResolvedValue({ data: ['en', 'hi', 'gu'] });
  mocks.getMediaStatus.mockResolvedValue({ ok: true, uploadEnabled: true });
});

afterEach(() => vi.clearAllMocks());

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
});
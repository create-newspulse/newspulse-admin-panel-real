import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticleForm } from '@/components/news/ArticleForm';

const mocks = vi.hoisted(() => ({
  authUser: { id: 'editor-1', email: 'editor@newspulse.co.in', role: 'editor' },
  getAdminSettings: vi.fn(),
  apiGet: vi.fn(),
  getMediaStatus: vi.fn(),
}));

vi.mock('@context/AuthContext', () => ({
  useAuth: () => ({ user: mocks.authUser }),
}));

vi.mock('@/context/PublishFlagContext', () => ({
  usePublishFlag: () => ({ publishEnabled: true }),
}));

vi.mock('@/lib/settingsApi', () => ({
  default: {
    getAdminSettings: mocks.getAdminSettings,
  },
}));

vi.mock('@/lib/api', () => ({
  default: {
    get: mocks.apiGet,
  },
}));

vi.mock('@/lib/api/articles', () => ({
  createArticle: vi.fn(),
  updateArticle: vi.fn(),
  getArticle: vi.fn(),
  publishArticle: vi.fn(),
  retryArticleTranslation: vi.fn(),
  requeueArticleTranslations: vi.fn(),
  listArticlesByTranslationGroupId: vi.fn(),
}));

vi.mock('@/lib/api/media', () => ({
  getMediaStatus: mocks.getMediaStatus,
  uploadCoverImage: vi.fn(),
}));

vi.mock('@/lib/api/language', () => ({
  verifyLanguage: vi.fn(),
  readability: vi.fn(),
}));

vi.mock('@/lib/api/compliance', () => ({
  ptiCheck: vi.fn(),
}));

vi.mock('@/lib/api/assist', () => ({
  assistSuggestV2: vi.fn(),
}));

vi.mock('@/components/editor/RichTextEditor', () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Content editor" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock('@/components/articles/CoverImageUpload', () => ({
  default: () => <div>Cover image upload</div>,
}));

vi.mock('@/components/media/MediaLibrarySelector', () => ({
  default: () => null,
}));

vi.mock('@/components/preview/PreviewModal', () => ({
  default: () => null,
}));

vi.mock('@/components/ui/ConfirmModal', () => ({
  default: () => null,
}));

function renderArticleForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/add-news']}>
        <ArticleForm mode="create" userRole="editor" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function openAssistantWithDraft() {
  renderArticleForm();
  const textboxes = await screen.findAllByRole('textbox');
  fireEvent.change(textboxes[0], { target: { value: 'Local bridge repair begins' } });
  fireEvent.change(screen.getByLabelText('Content editor'), { target: { value: 'The city engineering team began urgent repair work after residents reported cracks.' } });
  fireEvent.click(screen.getByRole('button', { name: /News Pulse Article Assistant/i }));
  return screen.findByRole('button', { name: 'Suggest' });
}

beforeEach(() => {
  mocks.authUser = { id: 'editor-1', email: 'editor@newspulse.co.in', role: 'editor' };
  mocks.getAdminSettings.mockResolvedValue({ adminPanel: { articleAssistantForStaff: false } });
  mocks.apiGet.mockResolvedValue({ data: ['en', 'hi', 'gu'] });
  mocks.getMediaStatus.mockResolvedValue({ ok: true, uploadEnabled: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ArticleForm Article Assistant access', () => {
  it('lets Founder use the assistant when the staff setting is on', async () => {
    mocks.authUser = { id: 'founder-1', email: 'kiran@newspulse.co.in', role: 'founder' };
    mocks.getAdminSettings.mockResolvedValue({ adminPanel: { articleAssistantForStaff: true } });

    const suggestButton = await openAssistantWithDraft();

    await waitFor(() => expect(suggestButton).toBeEnabled());
    expect(screen.queryByText('Article Assistant for Staff is currently off.')).not.toBeInTheDocument();
  });

  it('lets staff use the assistant when the staff setting is on', async () => {
    mocks.getAdminSettings.mockResolvedValue({ adminPanel: { articleAssistantForStaff: true } });

    const suggestButton = await openAssistantWithDraft();

    await waitFor(() => expect(suggestButton).toBeEnabled());
    expect(screen.queryByText('Article Assistant for Staff is currently off.')).not.toBeInTheDocument();
  });

  it('gates only News Pulse Article Assistant for staff when the setting is off', async () => {
    renderArticleForm();

    expect(await screen.findByText('Quality Tools')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /News Pulse Article Assistant/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PTI Compliance/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Language Guard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /SEO Preview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Readability/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /News Pulse Article Assistant/i }));

    expect(await screen.findByText('Article Assistant for Staff is currently off.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suggest' })).toBeDisabled();
    expect(screen.queryByText('AI Assistant')).not.toBeInTheDocument();
  });

  it('lets Founder keep the assistant even when staff access is off', async () => {
    mocks.authUser = { id: 'founder-1', email: 'kiran@newspulse.co.in', role: 'founder' };

    const suggestButton = await openAssistantWithDraft();

    expect(screen.queryByText('Article Assistant for Staff is currently off.')).not.toBeInTheDocument();
    await waitFor(() => expect(suggestButton).toBeEnabled());
  });
});
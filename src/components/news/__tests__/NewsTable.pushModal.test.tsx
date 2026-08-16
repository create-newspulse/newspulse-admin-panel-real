import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ARTICLE_PUSH_SPAM_WARNING } from '@/lib/pushSendFeedback';
import { listArticles } from '@/lib/api/articles';
import { NewsTable } from '../NewsTable';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'founder' } }),
}));

vi.mock('@/context/PublishFlagContext', () => ({
  usePublishFlag: () => ({ publishEnabled: true }),
}));

vi.mock('@/lib/api/adminAnalytics', () => ({
  listAdminAnalyticsArticles: vi.fn(() => Promise.resolve({ rows: [] })),
}));

vi.mock('@/lib/api/articles', () => ({
  listArticles: vi.fn(),
  archiveArticle: vi.fn(),
  restoreArticle: vi.fn(),
  deleteArticle: vi.fn(),
  updateArticleStatus: vi.fn(),
  scheduleArticle: vi.fn(),
  unscheduleArticle: vi.fn(),
  hardDeleteArticle: vi.fn(),
  bulkHardDeleteArticles: vi.fn(),
  requeueArticleTranslations: vi.fn(),
}));

function renderNewsTable() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <NewsTable
          params={{ page: 1, limit: 20 }}
          search=""
          quickView="all"
          onCounts={vi.fn()}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('NewsTable article push modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listArticles).mockResolvedValue({
      rows: [
        {
          _id: 'article-1',
          title: 'Published story',
          slug: 'published-story',
          summary: 'Short summary',
          category: 'World',
          status: 'published',
          language: 'en',
        },
      ],
      total: 1,
      page: 1,
      pages: 1,
    } as any);
  });

  it('shows the anti-spam warning in the article push confirmation modal', async () => {
    renderNewsTable();

    const pushLabels = await screen.findAllByText('Push');
    const pushButton = pushLabels[0].closest('button');
    expect(pushButton).not.toBeNull();
    fireEvent.click(pushButton as HTMLButtonElement);

    expect(screen.getByText('Send Article Push?')).toBeInTheDocument();
    expect(screen.getByText(ARTICLE_PUSH_SPAM_WARNING)).toBeInTheDocument();
  });
});
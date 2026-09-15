import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import ArticlesAnalyticsPage from '@/pages/admin/analytics/ArticlesAnalyticsPage';
import CategoriesAnalyticsPage from '@/pages/admin/analytics/CategoriesAnalyticsPage';
import { listAdminAnalyticsArticles, listAdminAnalyticsCategories } from '@/lib/api/adminAnalytics';

vi.mock('@/lib/api/adminAnalytics', () => ({
  listAdminAnalyticsArticles: vi.fn(),
  listAdminAnalyticsCategories: vi.fn(),
}));

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(listAdminAnalyticsArticles).mockResolvedValue({
    rows: [{ articleId: 'a1', title: 'Real Article', category: 'breaking' } as any],
  });
  vi.mocked(listAdminAnalyticsCategories).mockResolvedValue({
    rows: [{ category: 'breaking', views: 100, uniqueReaders: 40, engagedReads: 20, avgReadTimeSec: 75, completionRate: 0.66, topArticles: [{ articleId: 'a1', title: 'Real Article', views: 100 }] }],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Readership analytics detail pages', () => {
  it('preserves Article Analytics columns, filters, range values, and open article links', async () => {
    renderWithQuery(<ArticlesAnalyticsPage />);

    expect(await screen.findByRole('heading', { name: 'Readership Analytics' })).toBeInTheDocument();
    expect(await screen.findByText('Real Article')).toBeInTheDocument();
    expect(screen.getByText('Article performance by views, readers, engagement, time, and completion.')).toBeInTheDocument();
    for (const heading of ['Article', 'Category', 'Views', 'Readers', 'Engaged', 'Avg Read', 'Completion']) {
      expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Category').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Language').length).toBeGreaterThan(0);
    expect(screen.getByRole('option', { name: 'Last 24h' })).toHaveValue('24h');
    expect(screen.getByRole('option', { name: 'Last 7 Days' })).toHaveValue('7d');
    expect(screen.getByRole('option', { name: 'Last 30 Days' })).toHaveValue('30d');
    expect(screen.getByRole('link', { name: 'Open article' })).toHaveAttribute('href', '/admin/articles/a1/edit');
    expect(listAdminAnalyticsArticles).toHaveBeenCalledWith({ range: '30d', page: 1, limit: 200 });
  });

  it('preserves Category Analytics columns, filters, range values, and top article links', async () => {
    renderWithQuery(<CategoriesAnalyticsPage />);

    expect(await screen.findByRole('heading', { name: 'Category Analytics' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Real Article' })).toBeInTheDocument();
    for (const heading of ['Category', 'Views', 'Readers', 'Engaged', 'Avg Read', 'Completion', 'Top Articles']) {
      expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument();
    }
    expect(screen.getAllByText('Status').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Language').length).toBeGreaterThan(0);
    expect(screen.getByRole('option', { name: 'Last 24h' })).toHaveValue('24h');
    expect(screen.getByRole('option', { name: 'Last 7 Days' })).toHaveValue('7d');
    expect(screen.getByRole('option', { name: 'Last 30 Days' })).toHaveValue('30d');
    expect(screen.getByRole('link', { name: 'Real Article' })).toHaveAttribute('href', '/admin/articles/a1/edit');
    expect(listAdminAnalyticsCategories).toHaveBeenCalledWith({ range: '30d' });
    expect(within(screen.getByText('Range: 30d').closest('section') as HTMLElement).queryByText('Ad Performance')).toBeNull();
  });
});
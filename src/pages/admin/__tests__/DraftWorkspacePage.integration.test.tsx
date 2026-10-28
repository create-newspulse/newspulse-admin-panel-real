import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DraftWorkspacePage from '../DraftWorkspacePage';
import DraftDeskPage from '../DraftDeskPage';
import ArticleEditPage from '@/pages/ArticleEditPage';
import type { OwnDraftDetail } from '@/lib/api/articles';

const mocks = vi.hoisted(() => ({
  access: { loading: false, canManageNews: false, canReadOwnDrafts: true, canPublish: false, isFounder: false,
    canSchedule: false, reason: 'Access denied.' },
  own: vi.fn(), list: vi.fn(), full: vi.fn(), update: vi.fn(), publish: vi.fn(), error: vi.fn(), success: vi.fn(),
}));
vi.mock('@/hooks/useEditorialAccess', () => ({ useEditorialAccess: () => mocks.access }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'intern' } }) }));
vi.mock('@/context/PublishFlagContext', () => ({ usePublishFlag: () => ({ publishEnabled: true }) }));
vi.mock('@/lib/api/articles', () => ({
  getOwnDraft: mocks.own, listOwnDrafts: mocks.list, getArticle: mocks.full, listArticles: vi.fn(),
  updateArticle: mocks.update, publishArticle: mocks.publish, deleteArticle: vi.fn(), restoreArticle: vi.fn(),
  hardDeleteArticle: vi.fn(),
}));
vi.mock('@/components/news/ArticleForm', () => ({ ArticleForm: () => <div>Full editor must not load</div> }));
vi.mock('@/components/analytics/ArticleAnalyticsPanel', () => ({ ArticleAnalyticsPanel: () => null }));
vi.mock('@/components/news/FiltersDrawer', () => ({
  FiltersDrawer: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: mocks.error, success: mocks.success }) }));

const draft: OwnDraftDetail = {
  _id: 'cms-own', id: 'cms-own', title: 'Own draft', status: 'draft', category: 'national',
  summary: 'Saved summary', description: 'Saved summary', content: 'Saved content', body: 'Saved content',
  language: 'gu', lang: 'gu', coverImageUrl: null, coverImage: { url: null, publicId: null, alt: null },
  tags: [], externalUrls: [], embeds: [], gallery: [], stateTags: [], stateNames: [], seo: {}, geo: {}, location: {},
};

async function open(path = '/draft-desk/cms-own?mode=edit') {
  render(<MemoryRouter initialEntries={[path]}>
    <Link to="/elsewhere">Leave workspace</Link>
    <Routes>
      <Route path="/draft-desk" element={<DraftDeskPage />} />
      <Route path="/draft-desk/:id" element={<DraftWorkspacePage />} />
      <Route path="/admin/articles/:id/edit" element={<ArticleEditPage />} />
      <Route path="/elsewhere" element={<div>Other page</div>} />
    </Routes>
  </MemoryRouter>);
  await act(async () => {});
}
async function tick(ms = 600) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
function edit(name: string, value: string) {
  fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  Object.assign(mocks.access, { canManageNews: false, canReadOwnDrafts: true, canPublish: false });
  mocks.own.mockResolvedValue(draft);
  mocks.list.mockResolvedValue({ items: [draft], total: 1, page: 1, pages: 1 });
  mocks.update.mockResolvedValue({ ok: true, article: draft });
  mocks.publish.mockResolvedValue({ ok: true, committed: true, article: { ...draft, status: 'published' } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Limited staff own-draft integration', () => {
  it('lists own drafts and opens the restricted workspace, not a full editor', async () => {
    await open('/draft-desk');
    expect(screen.getByText('Draft Desk - My Drafts')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit draft' }));
    await act(async () => {});
    expect(mocks.own).toHaveBeenCalledWith('cms-own');
    expect(mocks.full).not.toHaveBeenCalled();
    expect(screen.queryByText('Full editor must not load')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete draft' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Language' })).toHaveAttribute('readonly');
  });

  it('redirects a limited staff full-editor deep link without performing an unauthorized read', async () => {
    await open('/admin/articles/cms-own/edit');
    expect(mocks.own).toHaveBeenCalledWith('cms-own');
    expect(mocks.full).not.toHaveBeenCalled();
  });

  it.each([403, 404, 503])('shows an explicit detail error for HTTP %s without a fallback', async (status) => {
    mocks.own.mockRejectedValue({ response: { status, data: {} } });
    await open();
    expect(screen.getByRole('alert')).toHaveTextContent(status === 403 ? 'Access denied' : status === 404 ? 'not available' : 'unavailable');
    expect(mocks.full).not.toHaveBeenCalled();
    expect(mocks.own).toHaveBeenCalledTimes(1);
  });

  it('distinguishes an empty own list, access denied and a failed request', async () => {
    mocks.list.mockResolvedValue({ items: [], total: 0, page: 1, pages: 0 });
    await open('/draft-desk');
    expect(screen.getByText('No eligible own drafts found.')).toBeInTheDocument();
    cleanup();
    mocks.list.mockRejectedValue({ response: { status: 403 } });
    await open('/draft-desk');
    expect(screen.getByRole('alert')).toHaveTextContent('Access denied');
    expect(screen.queryByText('No eligible own drafts found.')).not.toBeInTheDocument();
    cleanup();
    mocks.list.mockRejectedValue({ response: { status: 503 } });
    await open('/draft-desk');
    expect(screen.getByRole('alert')).toHaveTextContent('unavailable');
  });

  it('does not read drafts when effective workspace access is denied', async () => {
    mocks.access.canReadOwnDrafts = false;
    await open();
    expect(screen.getByRole('alert')).toHaveTextContent('Access denied');
    expect(mocks.own).not.toHaveBeenCalled();
  });
});

describe('Draft Workspace serialized autosave', () => {
  it('merges rapid field edits into one minimal patch at the 600ms debounce boundary', async () => {
    await open();
    edit('Title', 'Latest title');
    await tick(200);
    edit('Summary', 'Latest summary');
    edit('Content', 'Latest content');
    await tick(599);
    expect(mocks.update).not.toHaveBeenCalled();
    await tick(1);
    expect(mocks.update.mock.calls).toEqual([['cms-own', { title: 'Latest title', summary: 'Latest summary', content: 'Latest content' }]]);
    expect(mocks.full).not.toHaveBeenCalled();
  });

  it('serializes overlapping saves and retains edits made while a save is in flight', async () => {
    let finish!: (value: unknown) => void;
    mocks.update.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await open();
    edit('Title', 'First title');
    await tick();
    edit('Title', 'Newest title');
    edit('Content', 'Newest content');
    await tick(1200);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    await act(async () => { finish({ ok: true, article: { ...draft, title: 'First title' } }); });
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Newest title');
    await tick();
    expect(mocks.update.mock.calls[1]).toEqual(['cms-own', { title: 'Newest title', content: 'Newest content' }]);
  });

  it.each([403, 409])('keeps unsaved text and pauses retries after HTTP %s until explicit recovery', async (status) => {
    mocks.update.mockRejectedValueOnce({ response: { status, data: {} } });
    await open();
    edit('Title', 'Unsaved title');
    await tick();
    edit('Content', 'New text after denial');
    await tick(12000);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('alert')).toHaveTextContent('Automatic retries are paused');
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state without discarding edits' }));
    await act(async () => {});
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Unsaved title');
    expect(mocks.update).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Resume saving unsaved changes' }));
    await act(async () => {});
    expect(mocks.update.mock.calls[1]).toEqual(['cms-own', { title: 'Unsaved title', content: 'New text after denial' }]);
  });

  it('warns for a committed save follow-up without replaying saved fields', async () => {
    mocks.update.mockResolvedValueOnce({ ok: true, committed: true, revalidation: { ok: false }, article: draft });
    await open();
    edit('Title', 'Committed title');
    await tick();
    expect(screen.getByRole('alert')).toHaveTextContent('The change was saved');
    edit('Content', 'Pending content');
    await tick(12000);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state without discarding edits' }));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Resume saving unsaved changes' }));
    await act(async () => {});
    expect(mocks.update.mock.calls[1]).toEqual(['cms-own', { content: 'Pending content' }]);
  });

  it('guards route navigation and unload while changes are pending', async () => {
    await open();
    edit('Content', 'Keep this text');
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByText('Leave workspace'));
    expect(confirm).toHaveBeenCalledOnce();
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('Keep this text');
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByText('Leave workspace'));
    expect(screen.getByText('Other page')).toBeInTheDocument();
    await tick();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('uses the CMS ID for authorized publication and retains a committed-publication warning', async () => {
    mocks.access.canPublish = true;
    mocks.publish.mockResolvedValue({ ok: true, committed: true, postCommitWarnings: [{ code: 'FOLLOW_UP' }] });
    await open();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    expect(mocks.publish.mock.calls).toEqual([['cms-own']]);
    expect(screen.getByText(/Publication committed/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('do not repeat');
    expect(screen.queryByRole('button', { name: 'Publish' })).not.toBeInTheDocument();
  });
});

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
  publishEnabled: true,
  own: vi.fn(), list: vi.fn(), full: vi.fn(), update: vi.fn(), publish: vi.fn(), remove: vi.fn(), error: vi.fn(), success: vi.fn(),
}));
vi.mock('@/hooks/useEditorialAccess', () => ({ useEditorialAccess: () => mocks.access }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'intern' } }) }));
vi.mock('@/context/PublishFlagContext', () => ({ usePublishFlag: () => ({ publishEnabled: mocks.publishEnabled }) }));
vi.mock('@/lib/api/articles', () => ({
  getOwnDraft: mocks.own, listOwnDrafts: mocks.list, getArticle: mocks.full, listArticles: vi.fn(),
  updateArticle: mocks.update, publishArticle: mocks.publish,   deleteArticle: mocks.remove, restoreArticle: vi.fn(),
  hardDeleteArticle: vi.fn(),
}));
vi.mock('@/components/news/ArticleForm', () => ({ ArticleForm: () => <div>Full editor must not load</div> }));
vi.mock('@/components/analytics/ArticleAnalyticsPanel', () => ({ ArticleAnalyticsPanel: () => null }));
vi.mock('@/components/news/FiltersDrawer', () => ({
  FiltersDrawer: ({ open, children, onClose }: { open: boolean; children: React.ReactNode; onClose: () => void }) =>
    open ? <div><button onClick={onClose}>Close drawer</button>{children}</div> : null,
}));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { error: mocks.error, success: mocks.success }) }));

const draft: OwnDraftDetail = {
  _id: 'cms-own', id: 'cms-own', title: 'Own draft', status: 'draft', category: 'national',
  summary: 'Saved summary', description: 'Saved summary', content: 'Saved content', body: 'Saved content',
  language: 'gu', lang: 'gu', coverImageUrl: null, coverImage: { url: null, publicId: null, alt: null },
  tags: [], externalUrls: [], embeds: [], gallery: [], stateTags: [], stateNames: [], seo: {}, geo: {}, location: {},
};

function WorkspaceHarness({ path = '/draft-desk/cms-own?mode=edit' }: { path?: string }) {
  return <MemoryRouter initialEntries={[path]}>
    <Link to="/elsewhere">Leave workspace</Link>
    <Routes>
      <Route path="/draft-desk" element={<DraftDeskPage />} />
      <Route path="/draft-desk/:id" element={<DraftWorkspacePage />} />
      <Route path="/admin/articles/:id/edit" element={<ArticleEditPage />} />
      <Route path="/elsewhere" element={<div>Other page</div>} />
    </Routes>
  </MemoryRouter>;
}
async function open(path = '/draft-desk/cms-own?mode=edit') {
  const view = render(<WorkspaceHarness path={path} />);
  await act(async () => {});
  return view;
}
async function tick(ms = 600) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
function edit(name: string, value: string) {
  fireEvent.change(screen.getByRole('textbox', { name }), { target: { value } });
}

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  Object.assign(mocks.access, { canManageNews: false, canReadOwnDrafts: true, canPublish: false });
  mocks.publishEnabled = true;
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

describe('Draft Workspace publication lifecycle', () => {
  beforeEach(() => {
    mocks.access.canPublish = true;
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('locks every editing control while publication is pending and after it succeeds', async () => {
    const publication = deferred();
    mocks.publish.mockReturnValueOnce(publication.promise);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});

    expect(mocks.publish).toHaveBeenCalledExactlyOnceWith('cms-own');
    for (const name of ['Title', 'Summary', 'Content', 'Category', 'Tags', 'Image', 'Language']) {
      expect(screen.getByRole('textbox', { name })).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: 'Edit draft' })).toBeDisabled();
    expect(screen.getByText(/Publishing story/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close drawer' }));
    fireEvent.click(screen.getByText('Leave workspace'));
    expect(screen.queryByText('Other page')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeInTheDocument();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);

    await act(async () => { publication.resolve({ ok: true, committed: true, article: { ...draft, status: 'published' } }); });
    expect(screen.getByText(/Publication committed/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('rejects programmatic editor changes during publication instead of stranding unsaved edits', async () => {
    const publication = deferred();
    mocks.publish.mockReturnValueOnce(publication.promise);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});

    for (const name of ['Title', 'Summary', 'Content', 'Category', 'Tags', 'Image']) {
      edit(name, `Late ${name} callback`);
    }
    await tick(1200);
    await act(async () => { publication.resolve({ ok: true, committed: true, article: { ...draft, status: 'published' } }); });
    edit('Title', 'Late callback after publication');
    await tick(12000);

    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(draft.title);
    expect(screen.getByRole('textbox', { name: 'Summary' })).toHaveValue(draft.summary);
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue(draft.content);
    expect(screen.getByRole('textbox', { name: 'Category' })).toHaveValue(draft.category);
    expect(screen.getByRole('textbox', { name: 'Tags' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Image' })).toHaveValue('');
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.error).toHaveBeenCalledWith('Editing is locked for publication. No changes were applied.');
  });

  it('locks callbacks synchronously at Publish initiation and ignores duplicate clicks', async () => {
    await open();
    const publish = screen.getByRole('button', { name: 'Publish' });
    act(() => {
      fireEvent.click(publish);
      edit('Title', 'Callback before React renders the lock');
      fireEvent.click(publish);
    });
    await act(async () => {});
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(draft.title);
    expect(mocks.publish).toHaveBeenCalledExactlyOnceWith('cms-own');
    expect(mocks.update).not.toHaveBeenCalled();
    expect(window.confirm).toHaveBeenCalledTimes(1);
  });

  it.each(['gu', 'hi', 'en'])('flushes a debounced %s edit before publishing without changing identity or lifecycle fields', async language => {
    const edition = { ...draft, _id: `cms-${language}`, id: `cms-${language}`, slug: `stable-${language}`, language, lang: language };
    mocks.own.mockResolvedValue(edition);
    const save = deferred();
    mocks.update.mockReturnValueOnce(save.promise);
    await open(`/draft-desk/${edition._id}?mode=edit`);
    edit('Title', `Accepted ${language} title`);
    edit('Content', `Accepted ${language} content`);
    await tick(599);
    expect(mocks.update).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    expect(screen.getByText(/Saving changes before publishing/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Content' })).toBeDisabled();
    expect(mocks.update.mock.calls).toEqual([[edition._id, {
      title: `Accepted ${language} title`, content: `Accepted ${language} content`,
    }]]);
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
    await tick(1200);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    await act(async () => { save.resolve({ ok: true, article: edition }); });
    expect(mocks.publish).toHaveBeenCalledExactlyOnceWith(edition._id);
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue(`Accepted ${language} title`);
    expect(screen.getByRole('textbox', { name: 'Language' })).toHaveValue(language);
    expect(mocks.full).not.toHaveBeenCalled();
  });

  it('waits for the active autosave and then saves the newer pending patch before publication', async () => {
    const first = deferred();
    const second = deferred();
    mocks.update.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await open();
    edit('Title', 'First title');
    await tick();
    edit('Title', 'Newest accepted title');
    edit('Content', 'Newest accepted content');
    await tick(1200);
    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(publish).not.toBeDisabled();
    fireEvent.click(publish);
    await act(async () => {});
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.publish).not.toHaveBeenCalled();

    await act(async () => { first.resolve({ ok: true, article: { ...draft, title: 'First title' } }); });
    expect(mocks.update.mock.calls[1]).toEqual(['cms-own', { title: 'Newest accepted title', content: 'Newest accepted content' }]);
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Newest accepted title');
    edit('Title', 'Blocked while the last patch saves');
    await tick(1200);
    expect(mocks.update).toHaveBeenCalledTimes(2);
    await act(async () => { second.resolve({ ok: true, article: draft }); });
    expect(mocks.publish).toHaveBeenCalledExactlyOnceWith('cms-own');
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Newest accepted title');
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument();
  });

  it.each([401, 403, 409, 503])('stops publication on autosave HTTP %s and recovers the newest accepted edits', async status => {
    const save = deferred();
    mocks.update.mockReturnValueOnce(save.promise);
    await open();
    edit('Title', 'First title');
    await tick();
    edit('Title', 'Newest title before Publish');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    await act(async () => { save.reject({ response: { status, data: {} } }); });
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('Automatic retries are paused');
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Newest title before Publish');
    expect(screen.getByRole('textbox', { name: 'Title' })).not.toBeDisabled();
    edit('Content', 'Recovery content');
    await tick(12000);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state without discarding edits' }));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Resume saving unsaved changes' }));
    await act(async () => {});
    expect(mocks.update.mock.calls[1]).toEqual(['cms-own', { title: 'Newest title before Publish', content: 'Recovery content' }]);
    expect(mocks.publish).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });

  it.each([401, 403, 409, 503, 'network'])('keeps an unconfirmed %s publication failure locked until verified draft recovery', async status => {
    mocks.publish.mockRejectedValueOnce(status === 'network'
      ? { code: 'ERR_NETWORK', message: 'Network Error' }
      : { response: { status, data: {} } });
    await open();
    edit('Title', 'Saved before publication');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    expect(screen.getByRole('alert')).toHaveTextContent('Draft changes were saved. Publication was not confirmed.');
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled();
    edit('Title', 'Callback during unconfirmed publication');
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Saved before publication');
    await tick(12000);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state without discarding edits' }));
    await act(async () => {});
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Resume saving unsaved changes' }));
    await act(async () => {});
    expect(screen.getByRole('textbox', { name: 'Title' })).not.toBeDisabled();
    expect(mocks.update).toHaveBeenCalledTimes(1);
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    edit('Content', 'Accepted after recovery');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    expect(mocks.update.mock.calls[1]).toEqual(['cms-own', { content: 'Accepted after recovery' }]);
    expect(mocks.publish).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Publication committed/)).toBeInTheDocument();
  });

  it('stops on a committed autosave warning and resumes only the remaining patch', async () => {
    const save = deferred();
    mocks.update.mockReturnValueOnce(save.promise);
    await open();
    edit('Title', 'Committed title');
    await tick();
    edit('Content', 'Still pending content');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => { save.resolve({ ok: true, committed: true, revalidation: { ok: false }, article: draft }); });
    expect(screen.getByRole('alert')).toHaveTextContent('The change was saved');
    expect(screen.getByRole('textbox', { name: 'Content' })).toHaveValue('Still pending content');
    expect(mocks.publish).not.toHaveBeenCalled();
    await tick(12000);
    expect(mocks.update).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state without discarding edits' }));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Resume saving unsaved changes' }));
    await act(async () => {});
    expect(mocks.update.mock.calls).toEqual([
      ['cms-own', { title: 'Committed title' }],
      ['cms-own', { content: 'Still pending content' }],
    ]);
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it('unlocks editing after cancelled confirmation without discarding the saved patch', async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    await open();
    edit('Title', 'Saved before cancellation');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    expect(mocks.update.mock.calls).toEqual([['cms-own', { title: 'Saved before cancellation' }]]);
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Title' })).not.toBeDisabled();
    edit('Content', 'Continue editing');
    await tick();
    expect(mocks.update.mock.calls[1]).toEqual(['cms-own', { content: 'Continue editing' }]);
  });

  it.each(['permission', 'flag'])('rechecks the latest publishing %s after awaiting the save', async changed => {
    const save = deferred();
    mocks.update.mockReturnValueOnce(save.promise);
    const view = await open();
    edit('Title', 'Accepted title');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    if (changed === 'permission') mocks.access.canPublish = false;
    else mocks.publishEnabled = false;
    view.rerender(<WorkspaceHarness />);
    await act(async () => { save.resolve({ ok: true, article: draft }); });
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(mocks.error).toHaveBeenCalledWith('Publishing access changed. Publication was not attempted.');
    expect(screen.getByRole('textbox', { name: 'Title' })).not.toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Accepted title');
  });

  it.each(['permission', 'flag'])('does not initiate publication without the existing %s', async missing => {
    if (missing === 'permission') mocks.access.canPublish = false;
    else mocks.publishEnabled = false;
    await open();
    const button = screen.queryByRole('button', { name: 'Publish' });
    if (missing === 'permission') expect(button).not.toBeInTheDocument();
    else expect(button).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it.each([403, 404, 503])('does not unlock or fall back when publication recovery reads return HTTP %s', async status => {
    mocks.publish.mockRejectedValueOnce({ response: { status: 503, data: {} } });
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    mocks.own.mockRejectedValueOnce({ response: { status, data: {} } });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state without discarding edits' }));
    await act(async () => {});
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Resume saving unsaved changes' })).not.toBeInTheDocument();
    expect(mocks.full).not.toHaveBeenCalled();
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('recognizes an already committed publication on authoritative recovery without republishing', async () => {
    mocks.access.canManageNews = true;
    const source = { ...draft, sourceNewsId: 'canonical-cms', slug: 'stable-slug', translationGroupId: 'stable-group' };
    mocks.full.mockResolvedValueOnce(source).mockResolvedValueOnce({
      ...source, status: 'published', publishedAt: '2026-01-01T00:00:00.000Z',
    });
    mocks.publish.mockRejectedValueOnce({ response: { status: 503, data: {} } });
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state without discarding edits' }));
    await act(async () => {});
    expect(screen.getByText(/Publication committed/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Resume saving unsaved changes' })).not.toBeInTheDocument();
    expect(mocks.publish.mock.calls).toEqual([['canonical-cms']]);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('keeps a changed non-draft lifecycle locked after an unconfirmed publication', async () => {
    mocks.access.canManageNews = true;
    mocks.full.mockResolvedValueOnce(draft).mockResolvedValueOnce({ ...draft, status: 'scheduled' });
    mocks.publish.mockRejectedValueOnce({ response: { status: 409, data: {} } });
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state without discarding edits' }));
    await act(async () => {});
    expect(mocks.error).toHaveBeenCalledWith('This story is no longer a draft. Review its latest status before continuing.');
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Resume saving unsaved changes' })).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('blocks competing full-workspace controls synchronously without removing existing post-publication actions', async () => {
    mocks.access.canManageNews = true;
    mocks.full.mockResolvedValue(draft);
    const save = deferred();
    const publication = deferred();
    mocks.update.mockReturnValueOnce(save.promise);
    mocks.publish.mockReturnValueOnce(publication.promise);
    await open();
    edit('Title', 'Accepted before publication');
    const publish = screen.getByRole('button', { name: 'Publish' });
    const remove = screen.getByRole('button', { name: 'Delete draft' });
    const manage = screen.getByRole('button', { name: 'Open in Manage News' });
    act(() => {
      fireEvent.click(publish);
      fireEvent.click(remove);
      fireEvent.click(manage);
    });
    await act(async () => {});
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled();
    expect(remove).toBeDisabled();
    expect(manage).toBeDisabled();
    await act(async () => { save.resolve({ ok: true, article: draft }); });
    expect(remove).toBeDisabled();
    expect(manage).toBeDisabled();
    await act(async () => { publication.resolve({ ok: true, committed: true, article: { ...draft, status: 'published' } }); });
    expect(remove).not.toBeDisabled();
    expect(manage).not.toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit draft' })).toBeDisabled();
  });

  it('rejects a stale Resume action while a newer publication recovery read is pending', async () => {
    mocks.access.canManageNews = true;
    mocks.full.mockResolvedValue(draft);
    mocks.publish.mockRejectedValueOnce({ response: { status: 503, data: {} } });
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', { name: 'Refresh latest state without discarding edits' }));
    await act(async () => {});
    const resume = screen.getByRole('button', { name: 'Resume saving unsaved changes' });
    const refresh = screen.getByRole('button', { name: 'Refresh latest state without discarding edits' });
    const recovery = deferred();
    mocks.full.mockReturnValueOnce(recovery.promise);
    act(() => { fireEvent.click(refresh); fireEvent.click(resume); });
    expect(screen.getByRole('textbox', { name: 'Title' })).toBeDisabled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.publish).toHaveBeenCalledTimes(1);
    await act(async () => { recovery.resolve({ ...draft, status: 'published' }); });
    expect(screen.getByText(/Publication committed/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resume saving unsaved changes' })).not.toBeInTheDocument();
  });

  it.each(['save', 'publish'])('ignores a late %s result from an unmounted workspace', async step => {
    const request = deferred();
    if (step === 'save') mocks.update.mockReturnValueOnce(request.promise);
    else mocks.publish.mockReturnValueOnce(request.promise);
    const previous = await open();
    if (step === 'save') edit('Title', 'Previous workspace edit');
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    previous.unmount();
    mocks.own.mockResolvedValueOnce({ ...draft, _id: 'cms-next', id: 'cms-next', title: 'Next workspace' });
    await open('/draft-desk/cms-next?mode=edit');
    await act(async () => { request.resolve({ ok: true, committed: true, article: { ...draft, status: 'published' } }); });
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Next workspace');
    expect(screen.getByRole('textbox', { name: 'Title' })).not.toBeDisabled();
    expect(mocks.publish).toHaveBeenCalledTimes(step === 'save' ? 0 : 1);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.queryByText(/Publication committed/)).not.toBeInTheDocument();
  });

  it('deduplicates recovery reads and ignores an older workspace recovery result', async () => {
    mocks.publish.mockRejectedValueOnce({ response: { status: 503, data: {} } });
    const previous = await open();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    await act(async () => {});
    const recovery = deferred();
    mocks.own.mockReturnValueOnce(recovery.promise);
    const refresh = screen.getByRole('button', { name: 'Refresh latest state without discarding edits' });
    act(() => { fireEvent.click(refresh); fireEvent.click(refresh); });
    expect(mocks.own).toHaveBeenCalledTimes(2);
    previous.unmount();
    mocks.own.mockResolvedValueOnce({ ...draft, _id: 'cms-next', id: 'cms-next', title: 'Next workspace' });
    await open('/draft-desk/cms-next?mode=edit');
    await act(async () => { recovery.resolve(draft); });
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveValue('Next workspace');
    expect(screen.queryByRole('button', { name: 'Resume saving unsaved changes' })).not.toBeInTheDocument();
    expect(mocks.publish).toHaveBeenCalledTimes(1);
  });
});

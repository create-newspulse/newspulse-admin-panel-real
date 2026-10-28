import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter, Link, MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUnsavedChanges } from '../useUnsavedChanges';

const error = vi.hoisted(() => vi.fn());
vi.mock('react-hot-toast', () => ({ default: { error } }));

function Editor({ dirty = true, saving = false }: { dirty?: boolean; saving?: boolean }) {
  useUnsavedChanges(dirty, saving);
  const navigate = useNavigate();
  return <div>
    <span>Editor text remains</span>
    <Link to="/next">Link navigation</Link>
    <button onClick={() => navigate('/next', { replace: true })}>Replace navigation</button>
    <button onClick={() => navigate(-1)}>Back navigation</button>
  </div>;
}
afterEach(() => {
  cleanup();
  window.history.replaceState({ idx: 0 }, '', '/');
  vi.restoreAllMocks();
  error.mockClear();
});

describe('Unsaved editor navigation guard', () => {
  it.each(['Link navigation', 'Replace navigation', 'Back navigation'])('protects %s and permits an explicit discard', (label) => {
    render(<MemoryRouter initialEntries={['/next', '/edit']} initialIndex={1}><Routes>
      <Route path="/edit" element={<Editor />} />
      <Route path="/next" element={<div>Next page</div>} />
    </Routes></MemoryRouter>);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByText(label));
    expect(screen.getByText('Editor text remains')).toBeInTheDocument();
    expect(confirm).toHaveBeenCalledOnce();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByText(label));
    expect(screen.getByText('Next page')).toBeInTheDocument();
  });

  it('blocks leaving an in-flight save without claiming the request was cancelled', () => {
    render(<MemoryRouter><Editor saving /></MemoryRouter>);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByText('Link navigation'));
    expect(confirm).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('save is in progress'));
    expect(screen.getByText('Editor text remains')).toBeInTheDocument();
  });

  it('restores a cancelled native browser Back before Router can unmount the editor', async () => {
    window.history.replaceState({ idx: 0 }, '', '/next');
    window.history.pushState({ idx: 1 }, '', '/edit');
    render(<BrowserRouter><Routes>
      <Route path="/edit" element={<Editor />} />
      <Route path="/next" element={<div>Next page</div>} />
    </Routes></BrowserRouter>);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    window.history.back();
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    await waitFor(() => expect(window.location.pathname).toBe('/edit'));
    expect(screen.getByText('Editor text remains')).toBeInTheDocument();
    confirm.mockReturnValue(true);
    window.history.back();
    await screen.findByText('Next page');
  });

  it('protects tab close only while edits or saves are pending', () => {
    const mounted = render(<MemoryRouter><Editor /></MemoryRouter>);
    const dirtyUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirtyUnload);
    expect(dirtyUnload.defaultPrevented).toBe(true);
    mounted.rerender(<MemoryRouter><Editor dirty={false} /></MemoryRouter>);
    const cleanUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);
  });

  it('also restores a cancelled native Forward without discarding editor text', async () => {
    window.history.replaceState({ idx: 0 }, '', '/edit');
    window.history.pushState({ idx: 1 }, '', '/next');
    window.history.back();
    await waitFor(() => expect(window.location.pathname).toBe('/edit'));
    render(<BrowserRouter><Routes>
      <Route path="/edit" element={<Editor />} />
      <Route path="/next" element={<div>Next page</div>} />
    </Routes></BrowserRouter>);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    window.history.forward();
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    await waitFor(() => expect(window.location.pathname).toBe('/edit'));
    expect(screen.getByText('Editor text remains')).toBeInTheDocument();
  });
});

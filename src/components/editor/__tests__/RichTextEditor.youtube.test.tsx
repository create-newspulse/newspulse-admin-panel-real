import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { NewsPulseYouTube } from '@/components/editor/NewsPulseYouTube';

const mocks = vi.hoisted(() => ({
  uploadInlineImage: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/lib/api/media', () => ({
  uploadInlineImage: mocks.uploadInlineImage,
}));

vi.mock('react-hot-toast', () => ({
  default: { error: mocks.toastError },
}));

vi.mock('@/components/media/MediaLibrarySelector', () => ({
  default: () => null,
}));

const WATCH_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const SHORT_URL = 'https://youtu.be/dQw4w9WgXcQ';
const SHORTS_URL = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
const NO_COOKIE_URL = 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ';

type ClipboardDataInput = {
  html?: string;
  text?: string;
};

function clipboardData(overrides: ClipboardDataInput) {
  const html = overrides.html || '';
  const text = overrides.text || '';
  return {
    files: [],
    items: [],
    types: html ? ['text/html', 'text/plain'] : ['text/plain'],
    getData: (type: string) => {
      if (type === 'text/html') return html;
      if (type === 'text/plain') return text;
      return '';
    },
    ...overrides,
  };
}

function renderEditor(initialValue = '<p>Start</p>') {
  let latestHtml = initialValue;
  const onChange = vi.fn((html: string) => {
    latestHtml = html;
  });
  const result = render(<RichTextEditor value={initialValue} onChange={onChange} />);
  const editorElement = result.container.querySelector('.ProseMirror') as HTMLElement | null;
  if (!editorElement) throw new Error('Editor element not found');
  fireEvent.focus(editorElement);
  return { ...result, editorElement, onChange, getHtml: () => latestHtml };
}

function serializeContent(content: string): string {
  const editor = new Editor({
    extensions: [StarterKit, Image, NewsPulseYouTube],
    content,
  });
  const html = editor.getHTML();
  editor.destroy();
  return html;
}

function expectCanonicalYouTubeMarkup(html: string, url: string) {
  expect(html).toContain('data-np-block="youtube"');
  expect(html).toContain('data-np-video-id="dQw4w9WgXcQ"');
  expect(html).toContain(`data-np-url="${url.replace(/&/g, '&amp;')}"`);
  expect(html).not.toContain('<iframe');
  expect(html).not.toContain('<script');
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('RichTextEditor controlled YouTube authoring', () => {
  it('inserts a controlled node from a watch URL toolbar action', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(WATCH_URL);
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'YouTube' }));

    await waitFor(() => expectCanonicalYouTubeMarkup(getHtml(), WATCH_URL));
  });

  it('inserts a controlled node from a youtu.be URL paste', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: SHORT_URL }) });

    await waitFor(() => expectCanonicalYouTubeMarkup(getHtml(), SHORT_URL));
  });

  it('inserts a controlled node from a Shorts URL paste', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: SHORTS_URL }) });

    await waitFor(() => expectCanonicalYouTubeMarkup(getHtml(), SHORTS_URL));
  });

  it('inserts a controlled node from a youtube-nocookie embed URL paste', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: NO_COOKIE_URL }) });

    await waitFor(() => expectCanonicalYouTubeMarkup(getHtml(), NO_COOKIE_URL));
  });

  it.each([
    ['malformed video id', 'https://www.youtube.com/watch?v=bad-id'],
    ['lookalike domain', 'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ'],
    ['javascript URL', 'javascript:alert(1)'],
  ])('rejects %s from the toolbar', async (_label, url) => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(url);
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'YouTube' }));

    expect(mocks.toastError).toHaveBeenCalledWith('Enter a valid YouTube URL.');
    expect(getHtml()).not.toContain('data-np-block="youtube"');
  });

  it('leaves an ordinary URL paste as normal editor content', async () => {
    const { editorElement, getHtml } = renderEditor('<p></p>');

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: 'https://example.com/story' }) });

    await waitFor(() => expect(getHtml()).toContain('https://example.com/story'));
    expect(getHtml()).not.toContain('data-np-block="youtube"');
  });

  it('extracts a safe YouTube iframe paste without persisting iframe or script HTML', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, {
      clipboardData: clipboardData({
        html: '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe><script>alert(1)</script>',
        text: '',
      }),
    });

    await waitFor(() => expectCanonicalYouTubeMarkup(getHtml(), 'https://www.youtube.com/embed/dQw4w9WgXcQ'));
  });

  it('rejects arbitrary iframe HTML without persisting the iframe', async () => {
    const { editorElement, getHtml } = renderEditor('<p></p>');

    fireEvent.paste(editorElement, {
      clipboardData: clipboardData({
        html: '<p>Video</p><iframe src="https://example.com/embed/dQw4w9WgXcQ"></iframe>',
        text: 'Video',
      }),
    });

    await waitFor(() => expect(getHtml()).toContain('Video'));
    expect(getHtml()).not.toContain('<iframe');
    expect(getHtml()).not.toContain('data-np-block="youtube"');
    expect(mocks.toastError).toHaveBeenCalledWith('Only supported YouTube URLs can be inserted as video blocks.');
  });

  it('reopens canonical markup and serializes the same canonical marker', () => {
    const html = serializeContent('<div data-np-block="youtube" data-np-video-id="dQw4w9WgXcQ" data-np-url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></div>');

    expect(html).toBe('<div data-np-block="youtube" data-np-video-id="dQw4w9WgXcQ" data-np-url="https://www.youtube.com/watch?v=dQw4w9WgXcQ"></div>');
    expectCanonicalYouTubeMarkup(html, WATCH_URL);
  });

  it('removes a controlled YouTube block from the editor', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(WATCH_URL);
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'YouTube' }));
    await waitFor(() => expect(getHtml()).toContain('data-np-block="youtube"'));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(getHtml()).not.toContain('data-np-block="youtube"'));
  });
});
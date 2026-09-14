import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { NewsPulseX } from '@/components/editor/NewsPulseX';

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

const X_URL = 'https://x.com/newspulse/status/1234567890123456789';
const WWW_X_URL = 'https://www.x.com/newspulse/status/1234567890123456789';
const TWITTER_URL = 'https://twitter.com/newspulse/status/9876543210987654321';
const SHARE_URL = 'https://www.twitter.com/newspulse/status/1234567890123456789?s=20&t=shareToken';

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
    extensions: [StarterKit, Image, NewsPulseX],
    content,
  });
  const html = editor.getHTML();
  editor.destroy();
  return html;
}

function expectCanonicalXMarkup(html: string, url: string, postId = '1234567890123456789') {
  expect(html).toContain('data-np-block="x"');
  expect(html).toContain(`data-np-post-id="${postId}"`);
  expect(html).toContain(`data-np-url="${url.replace(/&/g, '&amp;')}"`);
  expect(html).not.toContain('<script');
  expect(html).not.toContain('widgets.js');
  expect(html).not.toContain('<blockquote');
  expect(html).not.toContain('<iframe');
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('RichTextEditor controlled X/Twitter authoring', () => {
  it('inserts a controlled node from an x.com status URL toolbar action', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(X_URL);
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'X / Twitter' }));

    await waitFor(() => expectCanonicalXMarkup(getHtml(), X_URL));
    expect(screen.getByText('X Post')).toBeInTheDocument();
    expect(screen.getByText('@newspulse')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open post' })).toHaveAttribute('href', X_URL);
    expect(screen.getByRole('button', { name: 'Change URL' })).toBeInTheDocument();
  });

  it('inserts a controlled node from a www.x.com status URL paste', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: WWW_X_URL }) });

    await waitFor(() => expectCanonicalXMarkup(getHtml(), WWW_X_URL));
  });

  it('inserts a controlled node from a twitter.com status URL paste', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: TWITTER_URL }) });

    await waitFor(() => expectCanonicalXMarkup(getHtml(), TWITTER_URL, '9876543210987654321'));
  });

  it('inserts a controlled node from a share-query status URL paste', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: SHARE_URL }) });

    await waitFor(() => expectCanonicalXMarkup(getHtml(), SHARE_URL));
  });

  it.each([
    ['malformed status id', 'https://x.com/newspulse/status/not-numeric'],
    ['lookalike domain', 'https://x.com.evil.example/newspulse/status/1234567890123456789'],
    ['non-status URL', 'https://x.com/newspulse/posts/1234567890123456789'],
    ['javascript URL', 'javascript:alert(1)'],
    ['data URL', 'data:text/html,<p>tweet</p>'],
  ])('rejects %s from the toolbar', async (_label, url) => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(url);
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'X / Twitter' }));

    expect(mocks.toastError).toHaveBeenCalledWith('Enter a valid X/Twitter status URL.');
    expect(getHtml()).not.toContain('data-np-block="x"');
  });

  it('leaves an ordinary URL paste as normal editor content', async () => {
    const { editorElement, getHtml } = renderEditor('<p></p>');

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: 'https://example.com/story' }) });

    await waitFor(() => expect(getHtml()).toContain('https://example.com/story'));
    expect(getHtml()).not.toContain('data-np-block="x"');
  });

  it('does not hijack an X status URL inside normal prose', async () => {
    const { editorElement, getHtml } = renderEditor('<p></p>');

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: `Read this ${X_URL} today` }) });

    await waitFor(() => expect(getHtml()).toContain('Read this'));
    expect(getHtml()).toContain(X_URL);
    expect(getHtml()).not.toContain('data-np-block="x"');
  });

  it('reopens canonical markup and serializes the same canonical marker', () => {
    const html = serializeContent('<div data-np-block="x" data-np-post-id="1234567890123456789" data-np-url="https://x.com/newspulse/status/1234567890123456789"></div>');

    expect(html).toBe('<div data-np-block="x" data-np-post-id="1234567890123456789" data-np-url="https://x.com/newspulse/status/1234567890123456789"></div>');
    expectCanonicalXMarkup(html, X_URL);
  });

  it('rejects canonical markup when the post ID does not match the URL', () => {
    const html = serializeContent('<div data-np-block="x" data-np-post-id="111" data-np-url="https://x.com/newspulse/status/1234567890123456789"></div>');

    expect(html).not.toContain('data-np-block="x"');
    expect(html).not.toContain('data-np-post-id="111"');
  });

  it('serializes the same X post URL and ID across translated content variants', () => {
    const controlled = '<div data-np-block="x" data-np-post-id="1234567890123456789" data-np-url="https://x.com/newspulse/status/1234567890123456789"></div>';
    const english = serializeContent(`<p>English</p>${controlled}`);
    const hindi = serializeContent(`<p>Hindi</p>${controlled}`);
    const gujarati = serializeContent(`<p>Gujarati</p>${controlled}`);

    [english, hindi, gujarati].forEach((html) => {
      expect(html).toContain('data-np-post-id="1234567890123456789"');
      expect(html).toContain('data-np-url="https://x.com/newspulse/status/1234567890123456789"');
      expect(html).not.toContain('data-np-media-id');
      expect(html).not.toContain('<script');
    });
  });

  it('converts official embed HTML without persisting blockquote or script HTML', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, {
      clipboardData: clipboardData({
        html: '<blockquote class="twitter-tweet"><p>Post text</p><a href="https://twitter.com/newspulse/status/1234567890123456789?s=20">September 15, 2026</a></blockquote><script async src="https://platform.twitter.com/widgets.js"></script>',
        text: '',
      }),
    });

    await waitFor(() => expectCanonicalXMarkup(getHtml(), 'https://twitter.com/newspulse/status/1234567890123456789?s=20'));
  });

  it('does not convert official-looking embed HTML without a valid post URL', async () => {
    const { editorElement, getHtml } = renderEditor('<p></p>');

    fireEvent.paste(editorElement, {
      clipboardData: clipboardData({
        html: '<blockquote class="twitter-tweet"><p>Post text</p><a href="https://twitter.example.com/newspulse/status/1234567890123456789">September 15, 2026</a></blockquote><script async src="https://platform.twitter.com/widgets.js"></script>',
        text: 'Post text',
      }),
    });

    await waitFor(() => expect(getHtml()).toContain('Post text'));
    expect(getHtml()).not.toContain('data-np-block="x"');
    expect(getHtml()).not.toContain('<script');
    expect(getHtml()).not.toContain('<blockquote');
  });

  it('removes a controlled X block from the editor', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(X_URL);
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'X / Twitter' }));
    await waitFor(() => expect(getHtml()).toContain('data-np-block="x"'));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(getHtml()).not.toContain('data-np-block="x"'));
  });
});
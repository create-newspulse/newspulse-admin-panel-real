import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { NewsPulseInstagram } from '@/components/editor/NewsPulseInstagram';

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

const POST_URL = 'https://www.instagram.com/p/C8xY_z1AbCd/';
const REEL_URL = 'https://instagram.com/reel/C8xY-z1AbCd/';
const TV_URL = 'https://www.instagram.com/tv/C8xY_z1AbCd/';
const SHARE_URL = 'https://www.instagram.com/p/C8xY_z1AbCd/?utm_source=ig_web_copy_link&igsh=abc123';
const CANONICAL_POST_URL = 'https://www.instagram.com/p/C8xY_z1AbCd/';
const CANONICAL_REEL_URL = 'https://www.instagram.com/reel/C8xY-z1AbCd/';
const CANONICAL_TV_URL = 'https://www.instagram.com/tv/C8xY_z1AbCd/';

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
    extensions: [StarterKit, Image, NewsPulseInstagram],
    content,
  });
  const html = editor.getHTML();
  editor.destroy();
  return html;
}

function expectCanonicalInstagramMarkup(html: string, url: string, shortcode = 'C8xY_z1AbCd') {
  expect(html).toContain('data-np-block="instagram"');
  expect(html).toContain(`data-np-shortcode="${shortcode}"`);
  expect(html).toContain(`data-np-url="${url.replace(/&/g, '&amp;')}"`);
  expect(html).not.toContain('<script');
  expect(html).not.toContain('embed.js');
  expect(html).not.toContain('<blockquote');
  expect(html).not.toContain('<iframe');
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('RichTextEditor controlled Instagram authoring', () => {
  it('inserts a controlled node from a /p/ URL toolbar action', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(POST_URL);
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }));

    await waitFor(() => expectCanonicalInstagramMarkup(getHtml(), CANONICAL_POST_URL));
  expect(screen.getAllByText('Instagram').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Post/Reel')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open on Instagram' })).toHaveAttribute('href', CANONICAL_POST_URL);
    expect(screen.getByRole('button', { name: 'Change URL' })).toBeInTheDocument();
  });

  it('inserts a controlled node from a /reel/ URL paste', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: REEL_URL }) });

    await waitFor(() => expectCanonicalInstagramMarkup(getHtml(), CANONICAL_REEL_URL, 'C8xY-z1AbCd'));
  });

  it('inserts a controlled node from a legacy /tv/ URL paste', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: TV_URL }) });

    await waitFor(() => expectCanonicalInstagramMarkup(getHtml(), CANONICAL_TV_URL));
  });

  it('accepts a share-query URL and serializes the canonical URL', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: SHARE_URL }) });

    await waitFor(() => expectCanonicalInstagramMarkup(getHtml(), CANONICAL_POST_URL));
    expect(getHtml()).not.toContain('utm_source');
    expect(getHtml()).not.toContain('igsh');
  });

  it.each([
    ['malformed shortcode', 'https://www.instagram.com/p/bad!code/'],
    ['lookalike domain', 'https://www.instagram.com.evil.example/p/C8xY_z1AbCd/'],
    ['javascript URL', 'javascript:alert(1)'],
    ['data URL', 'data:text/html,<p>post</p>'],
    ['profile URL', 'https://www.instagram.com/newspulse/'],
    ['story URL', 'https://www.instagram.com/stories/newspulse/1234567890123456789/'],
    ['explore URL', 'https://www.instagram.com/explore/tags/news/'],
    ['arbitrary path', 'https://www.instagram.com/reels/C8xY_z1AbCd/'],
    ['http URL', 'http://www.instagram.com/p/C8xY_z1AbCd/'],
  ])('rejects %s from the toolbar', async (_label, url) => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(url);
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }));

    expect(mocks.toastError).toHaveBeenCalledWith('Enter a valid Instagram post or reel URL.');
    expect(getHtml()).not.toContain('data-np-block="instagram"');
  });

  it('leaves an ordinary URL paste as normal editor content', async () => {
    const { editorElement, getHtml } = renderEditor('<p></p>');

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: 'https://example.com/story' }) });

    await waitFor(() => expect(getHtml()).toContain('https://example.com/story'));
    expect(getHtml()).not.toContain('data-np-block="instagram"');
  });

  it('does not hijack an Instagram URL inside normal prose', async () => {
    const { editorElement, getHtml } = renderEditor('<p></p>');

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: `Read this ${POST_URL} today` }) });

    await waitFor(() => expect(getHtml()).toContain('Read this'));
    expect(getHtml()).toContain(POST_URL);
    expect(getHtml()).not.toContain('data-np-block="instagram"');
  });

  it('reopens canonical markup and serializes the same canonical marker', () => {
    const html = serializeContent('<div data-np-block="instagram" data-np-shortcode="C8xY_z1AbCd" data-np-url="https://www.instagram.com/p/C8xY_z1AbCd/"></div>');

    expect(html).toBe('<div data-np-block="instagram" data-np-shortcode="C8xY_z1AbCd" data-np-url="https://www.instagram.com/p/C8xY_z1AbCd/"></div>');
    expectCanonicalInstagramMarkup(html, CANONICAL_POST_URL);
  });

  it('rejects canonical markup when the shortcode does not match the URL', () => {
    const html = serializeContent('<div data-np-block="instagram" data-np-shortcode="WrongCode" data-np-url="https://www.instagram.com/p/C8xY_z1AbCd/"></div>');

    expect(html).not.toContain('data-np-block="instagram"');
    expect(html).not.toContain('data-np-shortcode="WrongCode"');
  });

  it('serializes the same Instagram URL and shortcode across translated content variants', () => {
    const controlled = '<div data-np-block="instagram" data-np-shortcode="C8xY_z1AbCd" data-np-url="https://www.instagram.com/p/C8xY_z1AbCd/"></div>';
    const english = serializeContent(`<p>English</p>${controlled}`);
    const hindi = serializeContent(`<p>Hindi</p>${controlled}`);
    const gujarati = serializeContent(`<p>Gujarati</p>${controlled}`);

    [english, hindi, gujarati].forEach((html) => {
      expect(html).toContain('data-np-shortcode="C8xY_z1AbCd"');
      expect(html).toContain('data-np-url="https://www.instagram.com/p/C8xY_z1AbCd/"');
      expect(html).not.toContain('data-np-media-id');
      expect(html).not.toContain('<script');
    });
  });

  it('converts official embed HTML without persisting blockquote or script HTML', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, {
      clipboardData: clipboardData({
        html: '<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/C8xY_z1AbCd/?utm_source=ig_embed&amp;igsh=abc123"><a href="https://www.instagram.com/p/C8xY_z1AbCd/?utm_source=ig_web_copy_link">Instagram</a></blockquote><script async src="//www.instagram.com/embed.js"></script>',
        text: '',
      }),
    });

    await waitFor(() => expectCanonicalInstagramMarkup(getHtml(), CANONICAL_POST_URL));
  });

  it('does not convert official-looking embed HTML without a valid content URL', async () => {
    const { editorElement, getHtml } = renderEditor('<p></p>');

    fireEvent.paste(editorElement, {
      clipboardData: clipboardData({
        html: '<blockquote class="instagram-media"><p>Post text</p><a href="https://instagram.example.com/p/C8xY_z1AbCd/">Instagram</a></blockquote><script async src="//www.instagram.com/embed.js"></script>',
        text: 'Post text',
      }),
    });

    await waitFor(() => expect(getHtml()).toContain('Post text'));
    expect(getHtml()).not.toContain('data-np-block="instagram"');
    expect(getHtml()).not.toContain('<script');
    expect(getHtml()).not.toContain('<blockquote');
  });

  it('removes a controlled Instagram block from the editor', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(POST_URL);
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Instagram' }));
    await waitFor(() => expect(getHtml()).toContain('data-np-block="instagram"'));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(getHtml()).not.toContain('data-np-block="instagram"'));
  });
});
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { NewsPulseFacebook } from '@/components/editor/NewsPulseFacebook';

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

const POSTS_URL = 'https://facebook.com/newspulse/posts/1234567890123456';
const CANONICAL_POSTS_URL = 'https://www.facebook.com/newspulse/posts/1234567890123456';
const POSTS_SHARE_URL = 'https://www.facebook.com/newspulse/posts/1234567890123456?__cft__[0]=abc&ref=share';
const PERMALINK_URL = 'https://www.facebook.com/permalink.php?story_fbid=987654321098765&id=1234567890';
const CANONICAL_PERMALINK_URL = 'https://www.facebook.com/permalink.php?story_fbid=987654321098765&id=1234567890';
const REEL_URL = 'https://www.facebook.com/reel/1098765432109876?mibextid=abc123';
const CANONICAL_REEL_URL = 'https://www.facebook.com/reel/1098765432109876';
const SHARE_REEL_URL = 'https://www.facebook.com/share/r/19jB1vmypX/';
const SHARE_REEL_ERROR = 'Unable to resolve this Facebook share link. Open the post and try copying the direct Facebook link.';

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
    extensions: [StarterKit, Image, NewsPulseFacebook],
    content,
  });
  const html = editor.getHTML();
  editor.destroy();
  return html;
}

function expectCanonicalFacebookMarkup(html: string, url: string) {
  expect(html).toContain('data-np-block="facebook"');
  expect(html).toContain(`data-np-url="${url.replace(/&/g, '&amp;')}"`);
  expect(html).not.toContain('<script');
  expect(html).not.toContain('<iframe');
  expect(html).not.toContain('sdk.js');
  expect(html).not.toContain('plugins/post.php');
  expect(html).not.toContain('fb-post');
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('RichTextEditor controlled Facebook authoring', () => {
  it('inserts a controlled node from a /posts/ URL toolbar action', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(POSTS_URL);
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));

    await waitFor(() => expectCanonicalFacebookMarkup(getHtml(), CANONICAL_POSTS_URL));
    expect(screen.getByText('Facebook Post')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open post' })).toHaveAttribute('href', CANONICAL_POSTS_URL);
    expect(screen.getByRole('button', { name: 'Change URL' })).toBeInTheDocument();
  });

  it('inserts a controlled node from a permalink.php URL paste', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: PERMALINK_URL }) });

    await waitFor(() => expectCanonicalFacebookMarkup(getHtml(), CANONICAL_PERMALINK_URL));
  });

  it('inserts a controlled node from a canonical /reel/ URL toolbar action', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(REEL_URL);
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));

    await waitFor(() => expectCanonicalFacebookMarkup(getHtml(), CANONICAL_REEL_URL));
    expect(screen.getByRole('link', { name: 'Open post' })).toHaveAttribute('href', CANONICAL_REEL_URL);
  });

  it('handles share query params without persisting them for /posts/ URLs', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: POSTS_SHARE_URL }) });

    await waitFor(() => expectCanonicalFacebookMarkup(getHtml(), CANONICAL_POSTS_URL));
    expect(getHtml()).not.toContain('__cft__');
    expect(getHtml()).not.toContain('ref=share');
  });

  it('resolves a Facebook /share/r/ Copy Link URL before inserting the controlled marker', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ canonicalUrl: CANONICAL_REEL_URL }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: SHARE_REEL_URL }) });

    await waitFor(() => expectCanonicalFacebookMarkup(getHtml(), CANONICAL_REEL_URL));
    expect(getHtml()).not.toContain('/share/r/');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/admin-api/admin/articles/media/facebook/resolve', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ url: SHARE_REEL_URL }),
    }));
  });

  it('shows a safe error when a Facebook /share/r/ URL cannot be resolved', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ error: 'not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.spyOn(window, 'prompt').mockReturnValueOnce(SHARE_REEL_URL);
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(SHARE_REEL_ERROR));
    expect(getHtml()).not.toContain('data-np-block="facebook"');
    expect(getHtml()).not.toContain('/share/r/');
  });

  it('rejects a resolved Facebook share URL when the backend returns an unsupported path', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ canonicalUrl: 'https://www.facebook.com/watch/1234567890' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: SHARE_REEL_URL }) });

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(SHARE_REEL_ERROR));
    expect(getHtml()).not.toContain('data-np-block="facebook"');
  });

  it.each([
    ['malformed permalink without story_fbid', 'https://www.facebook.com/permalink.php?id=1234567890'],
    ['malformed permalink without id', 'https://www.facebook.com/permalink.php?story_fbid=987654321098765'],
    ['lookalike domain', 'https://www.facebook.com.evil.example/newspulse/posts/1234567890123456'],
    ['javascript URL', 'javascript:alert(1)'],
    ['data URL', 'data:text/html,<p>post</p>'],
    ['non-HTTPS URL', 'http://www.facebook.com/newspulse/posts/1234567890123456'],
    ['profile URL', 'https://www.facebook.com/newspulse'],
    ['story URL', 'https://www.facebook.com/stories/newspulse/1234567890123456'],
    ['marketplace URL', 'https://www.facebook.com/marketplace/item/1234567890123456'],
    ['unsupported group URL', 'https://www.facebook.com/groups/newspulse/posts/1234567890123456'],
    ['unsupported path', 'https://www.facebook.com/newspulse/videos/1234567890123456'],
    ['mobile host URL', 'https://m.facebook.com/newspulse/posts/1234567890123456'],
  ])('rejects %s from the toolbar', async (_label, url) => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(url);
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));

    expect(mocks.toastError).toHaveBeenCalledWith('Enter a valid Facebook post URL.');
    expect(getHtml()).not.toContain('data-np-block="facebook"');
  });

  it('does not hijack a Facebook URL inside normal prose', async () => {
    const { editorElement, getHtml } = renderEditor('<p></p>');

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: `Read this ${POSTS_URL} today` }) });

    await waitFor(() => expect(getHtml()).toContain('Read this'));
    expect(getHtml()).toContain(POSTS_URL);
    expect(getHtml()).not.toContain('data-np-block="facebook"');
  });

  it('reopens canonical markup and serializes the same canonical marker', () => {
    const html = serializeContent('<div data-np-block="facebook" data-np-url="https://www.facebook.com/newspulse/posts/1234567890123456"></div>');

    expect(html).toBe('<div data-np-block="facebook" data-np-url="https://www.facebook.com/newspulse/posts/1234567890123456"></div>');
    expectCanonicalFacebookMarkup(html, CANONICAL_POSTS_URL);
  });

  it('serializes canonical permalink marker HTML', () => {
    const html = serializeContent('<div data-np-block="facebook" data-np-url="https://www.facebook.com/permalink.php?story_fbid=987654321098765&amp;id=1234567890"></div>');

    expect(html).toBe('<div data-np-block="facebook" data-np-url="https://www.facebook.com/permalink.php?story_fbid=987654321098765&amp;id=1234567890"></div>');
    expectCanonicalFacebookMarkup(html, CANONICAL_PERMALINK_URL);
  });

  it('serializes canonical Reel marker HTML without changing the stored contract', () => {
    const html = serializeContent('<div data-np-block="facebook" data-np-url="https://www.facebook.com/reel/1098765432109876"></div>');

    expect(html).toBe('<div data-np-block="facebook" data-np-url="https://www.facebook.com/reel/1098765432109876"></div>');
    expectCanonicalFacebookMarkup(html, CANONICAL_REEL_URL);
  });

  it('rejects invalid canonical markers when reopening draft content', () => {
    const html = serializeContent('<div data-np-block="facebook" data-np-url="https://www.facebook.com/login"></div>');

    expect(html).not.toContain('data-np-block="facebook"');
    expect(html).not.toContain('https://www.facebook.com/login');
  });

  it('serializes the same Facebook URL across translated content variants', () => {
    const controlled = '<div data-np-block="facebook" data-np-url="https://www.facebook.com/newspulse/posts/1234567890123456"></div>';
    const english = serializeContent(`<p>English</p>${controlled}`);
    const hindi = serializeContent(`<p>Hindi</p>${controlled}`);
    const gujarati = serializeContent(`<p>Gujarati</p>${controlled}`);

    [english, hindi, gujarati].forEach((html) => {
      expect(html).toContain('data-np-url="https://www.facebook.com/newspulse/posts/1234567890123456"');
      expect(html).not.toContain('data-np-media-id');
      expect(html).not.toContain('<script');
      expect(html).not.toContain('<iframe');
    });
  });

  it('converts official iframe embed HTML without persisting iframe or SDK HTML', async () => {
    const { editorElement, getHtml } = renderEditor();
    const pluginUrl = 'https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2Fnewspulse%2Fposts%2F1234567890123456&show_text=true';

    fireEvent.paste(editorElement, {
      clipboardData: clipboardData({
        html: `<iframe src="${pluginUrl}"></iframe><script async defer crossorigin="anonymous" src="https://connect.facebook.net/en_US/sdk.js#xfbml=1"></script>`,
        text: '',
      }),
    });

    await waitFor(() => expectCanonicalFacebookMarkup(getHtml(), CANONICAL_POSTS_URL));
  });

  it('converts official SDK embed HTML only when a safe post URL exists', async () => {
    const { editorElement, getHtml } = renderEditor();

    fireEvent.paste(editorElement, {
      clipboardData: clipboardData({
        html: '<div class="fb-post" data-href="https://www.facebook.com/newspulse/posts/1234567890123456?ref=embed"></div><script async defer crossorigin="anonymous" src="https://connect.facebook.net/en_US/sdk.js#xfbml=1"></script>',
        text: '',
      }),
    });

    await waitFor(() => expectCanonicalFacebookMarkup(getHtml(), CANONICAL_POSTS_URL));
  });

  it('does not convert official-looking embed HTML without a valid post URL', async () => {
    const { editorElement, getHtml } = renderEditor('<p></p>');

    fireEvent.paste(editorElement, {
      clipboardData: clipboardData({
        html: '<div class="fb-post" data-href="https://facebook.example.com/newspulse/posts/1234567890123456">Post text</div><script async defer src="https://connect.facebook.net/en_US/sdk.js"></script>',
        text: 'Post text',
      }),
    });

    await waitFor(() => expect(getHtml()).toContain('Post text'));
    expect(getHtml()).not.toContain('data-np-block="facebook"');
    expect(getHtml()).not.toContain('<script');
    expect(getHtml()).not.toContain('<iframe');
    expect(getHtml()).not.toContain('fb-post');
  });

  it('updates an existing Facebook block through Change URL', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(PERMALINK_URL);
    const { getHtml } = renderEditor('<div data-np-block="facebook" data-np-url="https://www.facebook.com/newspulse/posts/1234567890123456"></div>');

    fireEvent.click(screen.getByRole('button', { name: 'Change URL' }));

    await waitFor(() => expectCanonicalFacebookMarkup(getHtml(), CANONICAL_PERMALINK_URL));
    expect(getHtml()).not.toContain(CANONICAL_POSTS_URL);
  });

  it('removes a controlled Facebook block from the editor', async () => {
    vi.spyOn(window, 'prompt').mockReturnValueOnce(POSTS_URL);
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Facebook' }));
    await waitFor(() => expect(getHtml()).toContain('data-np-block="facebook"'));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(getHtml()).not.toContain('data-np-block="facebook"'));
  });
});
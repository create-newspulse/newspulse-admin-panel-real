import { cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { InlineImageUploadPlaceholder, NewsPulseInlineImage } from '@/components/editor/NewsPulseInlineImage';

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
  default: ({ open, onSelect }: any) => open ? (
    <button
      type="button"
      onClick={() => onSelect({
        id: 'library-media-1',
        url: 'https://cdn.newspulse.co.in/library/library-image.webp',
        thumbnailUrl: 'https://cdn.newspulse.co.in/library/library-image.webp',
        previewUrls: [],
        filename: 'library-image.webp',
        mediaType: 'image',
        uploadedBy: 'Editor',
        source: 'Media Library',
        usageCount: 0,
        tags: [],
      })}
    >
      Choose Library Image
    </button>
  ) : null,
}));

function createImageFile(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type });
}

function renderEditor(initialValue = '<p>Start</p>') {
  let latestHtml = initialValue;
  const onChange = vi.fn((html: string) => {
    latestHtml = html;
  });
  const pending = vi.fn();
  const result = render(<RichTextEditor value={initialValue} onChange={onChange} onPendingUploadChange={pending} />);
  const editorElement = result.container.querySelector('.ProseMirror') as HTMLElement | null;
  if (!editorElement) throw new Error('Editor element not found');
  fireEvent.focus(editorElement);
  return { ...result, editorElement, onChange, pending, getHtml: () => latestHtml };
}

type ClipboardDataInput = {
  html?: string;
  text?: string;
  files?: File[];
};

function clipboardData(overrides: ClipboardDataInput) {
  const html = overrides.html || '';
  const text = overrides.text || '';
  const files = overrides.files || [];
  return {
    files,
    items: files.map((file) => ({ kind: 'file', type: file.type, getAsFile: () => file })),
    types: html ? ['text/html', 'text/plain'] : ['text/plain'],
    getData: (type: string) => {
      if (type === 'text/html') return html;
      if (type === 'text/plain') return text;
      return '';
    },
    ...overrides,
  };
}

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

async function waitForInlineImage(getHtml: () => string): Promise<HTMLElement> {
  await waitFor(() => expect(getHtml()).toContain('data-np-block="inline-image"'));
  const figure = parseHtml(getHtml()).querySelector('figure[data-np-block="inline-image"]') as HTMLElement | null;
  if (!figure) throw new Error(getHtml());
  return figure;
}

function serializeContent(content: string): string {
  const editor = new Editor({
    extensions: [StarterKit, Image, NewsPulseInlineImage, InlineImageUploadPlaceholder],
    content,
  });
  const html = editor.getHTML();
  editor.destroy();
  return html;
}

beforeEach(() => {
  mocks.uploadInlineImage.mockImplementation(async (file: File) => ({
    mediaId: `media-${file.name}`,
    url: `https://cdn.newspulse.co.in/inline/${file.name}`,
    width: 1200,
    height: 800,
  }));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('RichTextEditor inline image authoring', () => {
  it('uploads a pasted JPEG once and serializes permanent media metadata', async () => {
    const { editorElement, getHtml, pending } = renderEditor();
    const file = createImageFile('paste.jpg', 'image/jpeg');

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ files: [file] }) });

    const figure = await waitForInlineImage(getHtml);
    expect(mocks.uploadInlineImage).toHaveBeenCalledTimes(1);
    expect(mocks.uploadInlineImage).toHaveBeenCalledWith(file);
    expect(figure.getAttribute('data-np-media-id')).toBe('media-paste.jpg');
    expect(figure.getAttribute('data-np-width')).toBe('1200');
    expect(figure.getAttribute('data-np-height')).toBe('800');
    expect(figure.querySelector('img')?.getAttribute('src')).toBe('https://cdn.newspulse.co.in/inline/paste.jpg');
    expect(getHtml()).not.toContain('blob:');
    expect(getHtml()).not.toContain('data:image');
    expect(pending).toHaveBeenCalledWith(true);
    expect(pending).toHaveBeenLastCalledWith(false);
  });

  it('does not turn internal upload source into visible credit', async () => {
    mocks.uploadInlineImage.mockResolvedValueOnce({
      mediaId: 'media-source',
      url: 'https://cdn.newspulse.co.in/inline/source.webp',
      width: 1200,
      height: 800,
      source: 'article-inline',
      provider: 'cloudinary',
    });
    const { editorElement, getHtml } = renderEditor();
    const file = createImageFile('source.webp', 'image/webp');

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ files: [file] }) });

    const figure = await waitForInlineImage(getHtml);
    expect(figure.querySelector('[data-np-credit="true"]')).toBeNull();
    expect(getHtml()).not.toContain('Credit: article-inline');
    expect(getHtml()).not.toContain('article-inline');
    expect(getHtml()).not.toContain('cloudinary');
  });

  it('uploads a pasted PNG and inserts the permanent URL', async () => {
    const { editorElement, getHtml } = renderEditor();
    const file = createImageFile('paste.png', 'image/png');

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ files: [file] }) });

    const figure = await waitForInlineImage(getHtml);
    expect(mocks.uploadInlineImage).toHaveBeenCalledTimes(1);
    expect(figure.getAttribute('data-np-block')).toBe('inline-image');
    expect(figure.querySelector('img')?.getAttribute('src')).toBe('https://cdn.newspulse.co.in/inline/paste.png');
  });

  it('uploads a dropped image at the editor drop position', async () => {
    const { editorElement, getHtml } = renderEditor('<p>Drop here</p>');
    const file = createImageFile('drop.webp', 'image/webp');

    const event = createEvent.drop(editorElement, { clientX: 8, clientY: 8 });
    Object.defineProperty(event, 'dataTransfer', { value: { files: [file] } });
    fireEvent(editorElement, event);

    const figure = await waitForInlineImage(getHtml);
    expect(mocks.uploadInlineImage).toHaveBeenCalledTimes(1);
    expect(figure.getAttribute('data-np-block')).toBe('inline-image');
    expect(figure.getAttribute('data-np-media-id')).toBe('media-drop.webp');
  });

  it('uploads a chosen local image from the toolbar', async () => {
    const { container, getHtml } = renderEditor();
    const file = createImageFile('local.jpg', 'image/jpeg');

    fireEvent.click(screen.getByRole('button', { name: 'Upload Image' }));
    const input = container.querySelector('input[aria-label="Upload inline image"]') as HTMLInputElement | null;
    if (!input) throw new Error('Upload input not found');
    fireEvent.change(input, { target: { files: [file] } });

    const figure = await waitForInlineImage(getHtml);
    expect(mocks.uploadInlineImage).toHaveBeenCalledTimes(1);
    expect(figure.getAttribute('data-np-block')).toBe('inline-image');
    expect(figure.querySelector('img')?.getAttribute('src')).toBe('https://cdn.newspulse.co.in/inline/local.jpg');
  });

  it('removes the upload placeholder when upload fails and leaves no broken image', async () => {
    mocks.uploadInlineImage.mockRejectedValueOnce(new Error('Upload service unavailable'));
    const { editorElement, getHtml } = renderEditor('<p>Before text</p>');
    const file = createImageFile('bad.jpg', 'image/jpeg');

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ files: [file] }) });

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Upload service unavailable'));
    await waitFor(() => expect(getHtml()).not.toContain('data-np-inline-image-uploading'));
    expect(getHtml()).toContain('Before text');
    expect(getHtml()).not.toContain('<img');
    expect(getHtml()).not.toContain('bad.jpg');
  });

  it('keeps normal text paste working', async () => {
    const { editorElement, getHtml } = renderEditor('<p></p>');

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ text: 'Plain pasted text' }) });

    await waitFor(() => expect(getHtml()).toContain('Plain pasted text'));
    expect(mocks.uploadInlineImage).not.toHaveBeenCalled();
  });

  it('keeps formatted HTML text paste working', async () => {
    const { editorElement, getHtml } = renderEditor('<p></p>');

    fireEvent.paste(editorElement, {
      clipboardData: clipboardData({
        html: '<p><strong>Formatted</strong> pasted text</p>',
        text: 'Formatted pasted text',
      }),
    });

    await waitFor(() => expect(getHtml()).toContain('<strong>Formatted</strong> pasted text'));
    expect(mocks.uploadInlineImage).not.toHaveBeenCalled();
  });

  it('does not hotlink pasted website image URLs', async () => {
    const { editorElement, getHtml } = renderEditor('<p></p>');

    fireEvent.paste(editorElement, {
      clipboardData: clipboardData({
        html: '<p>Caption text <img src="https://foreign.example/photo.jpg" alt="Foreign"></p>',
        text: 'Caption text',
      }),
    });

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(expect.stringContaining('Website image URLs are not imported')));
    expect(getHtml()).toContain('Caption text');
    expect(getHtml()).not.toContain('foreign.example/photo.jpg');
    expect(getHtml()).not.toContain('data-np-block="inline-image"');
  });

  it('inserts Media Library images as controlled inline image nodes', async () => {
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Media Library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose Library Image' }));

    const figure = await waitForInlineImage(getHtml);
    expect(mocks.uploadInlineImage).not.toHaveBeenCalled();
    expect(figure.getAttribute('data-np-block')).toBe('inline-image');
    expect(figure.getAttribute('data-np-media-id')).toBe('library-media-1');
    expect(figure.querySelector('img')?.getAttribute('src')).toBe('https://cdn.newspulse.co.in/library/library-image.webp');
  });

  it('renders user-entered ANI credit in serialized markup', async () => {
    const promptSpy = vi.spyOn(window, 'prompt');
    promptSpy.mockReturnValueOnce('Flooding near the riverfront').mockReturnValueOnce('ANI');
    const { editorElement, getHtml } = renderEditor();
    const file = createImageFile('caption.jpg', 'image/jpeg');

    fireEvent.paste(editorElement, { clipboardData: clipboardData({ files: [file] }) });
    await waitForInlineImage(getHtml);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit caption' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit credit' }));

    await waitFor(() => expect(getHtml()).toContain('Flooding near the riverfront'));
    expect(getHtml()).toContain('Credit: ANI');
    const figure = parseHtml(getHtml()).querySelector('figure[data-np-block="inline-image"]') as HTMLElement;
    expect(figure.querySelector('[data-np-caption="true"]')?.textContent).toBe('Flooding near the riverfront');
    expect(figure.querySelector('[data-np-credit="true"]')?.textContent).toBe('Credit: ANI');
  });

  it('save and reload preserves user-entered PTI credit in a controlled inline image block', () => {
    const html = serializeContent('<figure data-np-block="inline-image" data-np-media-id="media-42" data-np-width="900" data-np-height="600"><img src="https://cdn.newspulse.co.in/inline/reload.jpg" alt="Reloaded" width="900" height="600"><figcaption data-np-caption="true">Scene</figcaption><div data-np-credit="true">Credit: PTI</div></figure>');

    expect(html).toContain('data-np-block="inline-image"');
    expect(html).toContain('data-np-media-id="media-42"');
    expect(html).toContain('data-np-width="900"');
    expect(html).toContain('data-np-height="600"');
    expect(html).toContain('Scene');
    expect(html).toContain('Credit: PTI');
    expect(html).toContain('width="900"');
    expect(html).toContain('height="600"');
  });

  it('serializes image-only controlled markup without blank caption or credit blocks', () => {
    const html = serializeContent('<figure data-np-block="inline-image" data-np-media-id="image-only"><img src="https://cdn.newspulse.co.in/inline/image-only.jpg" alt="Image only"></figure>');

    expect(html).toContain('data-np-block="inline-image"');
    expect(html).toContain('data-np-media-id="image-only"');
    expect(html).toContain('src="https://cdn.newspulse.co.in/inline/image-only.jpg"');
    expect(html).not.toContain('data-np-caption="true"');
    expect(html).not.toContain('data-np-credit="true"');
  });

  it('serializes caption-only controlled markup without a credit block', () => {
    const html = serializeContent('<figure data-np-block="inline-image" data-np-media-id="caption-only"><img src="https://cdn.newspulse.co.in/inline/caption-only.jpg" alt="Caption only"><figcaption data-np-caption="true">Riverfront scene</figcaption></figure>');

    expect(html).toContain('data-np-block="inline-image"');
    expect(html).toContain('Riverfront scene');
    expect(html).toContain('data-np-caption="true"');
    expect(html).not.toContain('data-np-credit="true"');
  });

  it('serializes credit-only controlled markup without a caption block', () => {
    const html = serializeContent('<figure data-np-block="inline-image" data-np-media-id="credit-only"><img src="https://cdn.newspulse.co.in/inline/credit-only.jpg" alt="Credit only"><div data-np-credit="true">Credit: ANI</div></figure>');

    expect(html).toContain('data-np-block="inline-image"');
    expect(html).toContain('Credit: ANI');
    expect(html).toContain('data-np-credit="true"');
    expect(html).not.toContain('data-np-caption="true"');
  });

  it('parses old Phase 1A markers and reserializes the canonical contract', () => {
    const html = serializeContent('<figure data-np-inline-image="true" data-media-id="old-media" data-caption="Old caption" data-credit="News Pulse" data-width="640" data-height="360"><img src="https://cdn.newspulse.co.in/inline/old.jpg" alt="Old" data-media-id="old-media" width="640" height="360"><figcaption data-np-caption="true">Old caption</figcaption><div data-np-credit="true">Credit: News Pulse</div></figure>');

    expect(html).toContain('data-np-block="inline-image"');
    expect(html).toContain('data-np-media-id="old-media"');
    expect(html).toContain('data-np-width="640"');
    expect(html).toContain('data-np-height="360"');
    expect(html).toContain('Old caption');
    expect(html).toContain('Credit: News Pulse');
    expect(html).not.toContain('data-np-inline-image="true"');
    expect(html).not.toContain('data-media-id="old-media"');
  });

  it('draft language switching with existing controlled media does not re-upload', () => {
    const controlled = '<figure data-np-block="inline-image" data-np-media-id="shared-media"><img src="https://cdn.newspulse.co.in/inline/shared.jpg" alt="Shared"><figcaption data-np-caption="true">Shared image</figcaption></figure>';
    const english = serializeContent(`<p>English</p>${controlled}`);
    const hindi = serializeContent(`<p>Hindi</p>${controlled}`);

    expect(english).toContain('data-np-media-id="shared-media"');
    expect(hindi).toContain('data-np-media-id="shared-media"');
    expect(mocks.uploadInlineImage).not.toHaveBeenCalled();
  });

  it('keeps existing legacy img articles editable without converting them', () => {
    const html = serializeContent('<p>Legacy story</p><img src="https://legacy.example/old.jpg" alt="Old image"><p>Done</p>');

    expect(html).toContain('<img src="https://legacy.example/old.jpg" alt="Old image">');
    expect(html).not.toContain('data-np-block="inline-image"');
  });
});
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { NewsPulseGallery } from '@/components/editor/NewsPulseGallery';
import { NewsPulseInlineImage } from '@/components/editor/NewsPulseInlineImage';

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

function mediaAsset(id: string) {
  return {
    id,
    url: `https://cdn.newspulse.co.in/library/${id}.webp`,
    thumbnailUrl: `https://cdn.newspulse.co.in/library/${id}.webp`,
    previewUrls: [],
    filename: `${id}.webp`,
    mediaType: 'image',
    uploadedBy: 'Editor',
    source: 'Media Library',
    usageCount: 0,
    tags: [],
  };
}

vi.mock('@/components/media/MediaLibrarySelector', () => ({
  default: ({ open, multiple, onSelect, onSelectMultiple }: any) => open ? (
    <div>
      <button type="button" onClick={() => onSelect(mediaAsset('library-media-1'))}>Choose Library Image</button>
      {multiple ? (
        <>
          <button type="button" onClick={() => onSelectMultiple([mediaAsset('gallery-media-1')])}>Choose One Gallery Image</button>
          <button type="button" onClick={() => onSelectMultiple([mediaAsset('gallery-media-1'), mediaAsset('gallery-media-2')])}>Choose Two Gallery Images</button>
          <button type="button" onClick={() => onSelectMultiple(Array.from({ length: 20 }, (_item, index) => mediaAsset(`gallery-media-${index + 1}`)))}>Choose Twenty Gallery Images</button>
          <button type="button" onClick={() => onSelectMultiple(Array.from({ length: 21 }, (_item, index) => mediaAsset(`gallery-media-${index + 1}`)))}>Choose Twenty One Gallery Images</button>
          <button type="button" onClick={() => onSelectMultiple([mediaAsset('gallery-media-1'), mediaAsset('gallery-media-1')])}>Choose Duplicate Gallery Images</button>
        </>
      ) : null}
    </div>
  ) : null,
}));

function createImageFile(name: string, type = 'image/jpeg'): File {
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

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html');
}

function galleryFigures(html: string): HTMLElement[] {
  return Array.from(parseHtml(html).querySelectorAll('div[data-np-block="gallery"] figure[data-np-block="inline-image"]')) as HTMLElement[];
}

function serializeContent(content: string): string {
  const editor = new Editor({
    extensions: [StarterKit, Image, NewsPulseInlineImage, NewsPulseGallery],
    content,
  });
  const html = editor.getHTML();
  editor.destroy();
  return html;
}

async function chooseGalleryImages(buttonName: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Gallery' }));
  fireEvent.click(screen.getByRole('button', { name: 'Choose from Media Library' }));
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
}

async function insertTwoLibraryImages(getHtml: () => string) {
  await chooseGalleryImages('Choose Two Gallery Images');
  fireEvent.click(screen.getByRole('button', { name: 'Insert Gallery' }));
  await waitFor(() => expect(galleryFigures(getHtml())).toHaveLength(2));
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

describe('RichTextEditor controlled gallery authoring', () => {
  it('shows the Gallery toolbar action', () => {
    renderEditor();

    expect(screen.getByRole('button', { name: 'Gallery' })).toBeInTheDocument();
  });

  it('keeps existing Media Library single-select behavior unchanged', async () => {
    const { getHtml } = renderEditor();

    fireEvent.click(screen.getByRole('button', { name: 'Media Library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose Library Image' }));

    await waitFor(() => expect(getHtml()).toContain('data-np-block="inline-image"'));
    expect(getHtml()).toContain('data-np-media-id="library-media-1"');
    expect(getHtml()).not.toContain('data-np-block="gallery"');
  });

  it('selects 2 existing Media Library images and inserts a gallery', async () => {
    const { getHtml } = renderEditor();

    await insertTwoLibraryImages(getHtml);

    expect(mocks.uploadInlineImage).not.toHaveBeenCalled();
    expect(getHtml()).toContain('data-np-block="gallery"');
    expect(getHtml()).toContain('data-np-media-id="gallery-media-1"');
    expect(getHtml()).toContain('data-np-media-id="gallery-media-2"');
  });

  it('uploads multiple local images once each before gallery insert', async () => {
    const { getHtml, pending } = renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Gallery' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload images' }));
    const input = screen.getByLabelText('Upload gallery images') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [createImageFile('one.jpg'), createImageFile('two.webp', 'image/webp')] } });

    await waitFor(() => expect(mocks.uploadInlineImage).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Insert Gallery' })).not.toBeDisabled());
    fireEvent.click(screen.getByRole('button', { name: 'Insert Gallery' }));

    await waitFor(() => expect(galleryFigures(getHtml())).toHaveLength(2));
    expect(galleryFigures(getHtml())[0].querySelector('img')?.getAttribute('src')).toBe('https://cdn.newspulse.co.in/inline/one.jpg');
    expect(pending).toHaveBeenCalledWith(true);
    expect(pending).toHaveBeenLastCalledWith(false);
  });

  it('does not allow inserting a one-image gallery', async () => {
    const { getHtml } = renderEditor();

    await chooseGalleryImages('Choose One Gallery Image');

    expect(screen.getByRole('button', { name: 'Insert Gallery' })).toBeDisabled();
    expect(getHtml()).not.toContain('data-np-block="gallery"');
  });

  it('allows 20 images and rejects a 21st image', async () => {
    const { getHtml } = renderEditor();

    await chooseGalleryImages('Choose Twenty One Gallery Images');
    fireEvent.click(screen.getByRole('button', { name: 'Insert Gallery' }));

    await waitFor(() => expect(galleryFigures(getHtml())).toHaveLength(20));
    expect(mocks.toastError).toHaveBeenCalledWith('Duplicate images or gallery limit exceeded.');
    expect(getHtml()).not.toContain('gallery-media-21');
  });

  it('rejects duplicate media IDs in one gallery', async () => {
    const { getHtml } = renderEditor();

    await chooseGalleryImages('Choose Duplicate Gallery Images');

    expect(screen.getByRole('button', { name: 'Insert Gallery' })).toBeDisabled();
    expect(mocks.toastError).toHaveBeenCalledWith('Duplicate images or gallery limit exceeded.');
    expect(getHtml()).not.toContain('data-np-block="gallery"');
  });

  it('preserves reordered image order', async () => {
    const { getHtml } = renderEditor();
    await chooseGalleryImages('Choose Two Gallery Images');

    fireEvent.click(screen.getAllByRole('button', { name: 'Move down' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Insert Gallery' }));

    await waitFor(() => expect(galleryFigures(getHtml())[0].getAttribute('data-np-media-id')).toBe('gallery-media-2'));
    expect(galleryFigures(getHtml())[1].getAttribute('data-np-media-id')).toBe('gallery-media-1');
  });

  it('removes gallery items before insert', async () => {
    const { getHtml } = renderEditor();
    await chooseGalleryImages('Choose Two Gallery Images');

    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' })[0]);

    expect(screen.getByRole('button', { name: 'Insert Gallery' })).toBeDisabled();
    expect(getHtml()).not.toContain('data-np-block="gallery"');
  });

  it('preserves caption and credit in canonical markup', async () => {
    const { getHtml } = renderEditor();
    await chooseGalleryImages('Choose Two Gallery Images');

    fireEvent.change(screen.getByLabelText('Caption for gallery-media-1.webp'), { target: { value: 'Caption one' } });
    fireEvent.change(screen.getByLabelText('Credit for gallery-media-1.webp'), { target: { value: 'PTI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Insert Gallery' }));

    await waitFor(() => expect(getHtml()).toContain('Caption one'));
    expect(getHtml()).toContain('Credit: PTI');
    expect(getHtml()).toContain('data-np-caption="true"');
    expect(getHtml()).toContain('data-np-credit="true"');
  });

  it('serializes canonical gallery markup and reopens without upload', () => {
    const controlled = '<div data-np-block="gallery"><figure data-np-block="inline-image" data-np-media-id="media-1" data-np-width="900" data-np-height="600"><img src="https://cdn.newspulse.co.in/inline/one.jpg" alt="One" width="900" height="600"><figcaption data-np-caption="true">Caption one</figcaption><div data-np-credit="true">Credit: PTI</div></figure><figure data-np-block="inline-image" data-np-media-id="media-2"><img src="https://cdn.newspulse.co.in/inline/two.jpg" alt="Two"></figure></div>';

    const html = serializeContent(controlled);

    expect(html).toContain('data-np-block="gallery"');
    expect(galleryFigures(html)).toHaveLength(2);
    expect(galleryFigures(html)[0].getAttribute('data-np-media-id')).toBe('media-1');
    expect(html).toContain('Caption one');
    expect(html).toContain('Credit: PTI');
    expect(html).not.toContain('{&quot;');
    expect(mocks.uploadInlineImage).not.toHaveBeenCalled();
  });

  it('keeps gallery upload pending state active until uploads finish', async () => {
    let resolveUpload: (value: any) => void = () => undefined;
    mocks.uploadInlineImage.mockReturnValueOnce(new Promise((resolve) => { resolveUpload = resolve; }));
    const { pending } = renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Gallery' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload images' }));

    fireEvent.change(screen.getByLabelText('Upload gallery images'), { target: { files: [createImageFile('slow.jpg')] } });

    await waitFor(() => expect(pending).toHaveBeenCalledWith(true));
    expect(screen.getByRole('button', { name: 'Insert Gallery' })).toBeDisabled();
    resolveUpload({ mediaId: 'media-slow.jpg', url: 'https://cdn.newspulse.co.in/inline/slow.jpg' });
    await waitFor(() => expect(pending).toHaveBeenLastCalledWith(false));
  });

  it('marks a failed upload without destroying successful gallery items', async () => {
    mocks.uploadInlineImage
      .mockResolvedValueOnce({ mediaId: 'media-good.jpg', url: 'https://cdn.newspulse.co.in/inline/good.jpg' })
      .mockRejectedValueOnce(new Error('Upload failed for bad.jpg'));
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Gallery' }));
    fireEvent.click(screen.getByRole('button', { name: 'Upload images' }));

    fireEvent.change(screen.getByLabelText('Upload gallery images'), { target: { files: [createImageFile('good.jpg'), createImageFile('bad.jpg')] } });

    await waitFor(() => expect(screen.getByText('good.jpg')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('Upload failed for bad.jpg')).toBeInTheDocument());
    expect(screen.getByText('bad.jpg')).toBeInTheDocument();
  });

  it('removes an inserted gallery block from the editor', async () => {
    const { getHtml } = renderEditor();
    await insertTwoLibraryImages(getHtml);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Gallery' }));

    await waitFor(() => expect(getHtml()).not.toContain('data-np-block="gallery"'));
  });
});
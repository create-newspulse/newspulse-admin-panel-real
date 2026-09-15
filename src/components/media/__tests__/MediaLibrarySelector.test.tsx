import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MediaLibrarySelector from '@/components/media/MediaLibrarySelector';

const assets = [
  {
    id: 'asset-1',
    url: 'https://cdn.newspulse.co.in/library/asset-1.webp',
    thumbnailUrl: 'https://cdn.newspulse.co.in/library/asset-1.webp',
    previewUrls: [],
    filename: 'asset-1.webp',
    mediaType: 'image',
    uploadedBy: 'Editor',
    source: 'Media Library',
    usageCount: 0,
    tags: [],
  },
  {
    id: 'asset-2',
    url: 'https://cdn.newspulse.co.in/library/asset-2.webp',
    thumbnailUrl: 'https://cdn.newspulse.co.in/library/asset-2.webp',
    previewUrls: [],
    filename: 'asset-2.webp',
    mediaType: 'image',
    uploadedBy: 'Editor',
    source: 'Media Library',
    usageCount: 0,
    tags: [],
  },
];

vi.mock('@/lib/mediaLibrary', () => ({
  fetchMediaLibraryAssets: vi.fn(async () => assets),
  formatMediaFileSize: () => 'Unknown size',
  formatMediaUploadedDate: () => 'Unknown date',
  getMediaLibraryPreviewUrls: (asset: any) => [asset.thumbnailUrl],
  isValidMediaLibraryImageAsset: () => true,
  isValidMediaLibraryVideoAsset: () => true,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('MediaLibrarySelector selection modes', () => {
  it('keeps single-select behavior by default', async () => {
    const onSelect = vi.fn();
    render(<MediaLibrarySelector open mode="image" title="Pick Image" actionLabel="Insert" onClose={vi.fn()} onSelect={onSelect} />);

    fireEvent.click(await screen.findByRole('button', { name: /asset-1.webp/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect.mock.calls[0][0].id).toBe('asset-1');
  });

  it('supports optional multiple selection without changing the default API', async () => {
    const onSelect = vi.fn();
    const onSelectMultiple = vi.fn();
    render(<MediaLibrarySelector open mode="image" title="Pick Images" actionLabel="Add" onClose={vi.fn()} onSelect={onSelect} multiple onSelectMultiple={onSelectMultiple} />);

    fireEvent.click(await screen.findByRole('button', { name: /asset-1.webp/i }));
    fireEvent.click(screen.getByRole('button', { name: /asset-2.webp/i }));
    await waitFor(() => expect(screen.getByText('2 selected')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(onSelect).not.toHaveBeenCalled();
    expect(onSelectMultiple).toHaveBeenCalledTimes(1);
    expect(onSelectMultiple.mock.calls[0][0].map((asset: any) => asset.id)).toEqual(['asset-1', 'asset-2']);
  });
});
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PulseDialogueDetailsSection from '@/components/news/PulseDialogueDetailsSection';
import { EMPTY_PULSE_DIALOGUE_VALUE, type PulseDialogueFormValue } from '@/lib/pulseDialogue';
import { uploadCoverImage } from '@/lib/api/media';
import {
  createPulseDialogueContributor,
  getPulseDialogueContributor,
  listPulseDialogueContributors,
  updatePulseDialogueContributor,
} from '@/lib/api/pulseDialogue';

vi.mock('@/lib/api/pulseDialogue', () => ({
  listPulseDialogueContributors: vi.fn(),
  getPulseDialogueContributor: vi.fn(),
  createPulseDialogueContributor: vi.fn(),
  updatePulseDialogueContributor: vi.fn(),
}));

vi.mock('@/components/media/MediaLibrarySelector', () => ({
  default: ({ open, onSelect }: { open: boolean; onSelect: (asset: any) => void }) => open ? (
    <button type="button" onClick={() => onSelect({ id: 'asset-1', url: 'https://cdn.newspulse.test/writer.webp', filename: 'writer.webp' })}>Mock Media Asset</button>
  ) : null,
}));

vi.mock('@/lib/api/media', () => ({
  uploadCoverImage: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const mockedList = vi.mocked(listPulseDialogueContributors);
const mockedGet = vi.mocked(getPulseDialogueContributor);
const mockedCreate = vi.mocked(createPulseDialogueContributor);
const mockedUpdate = vi.mocked(updatePulseDialogueContributor);
const mockedUploadCoverImage = vi.mocked(uploadCoverImage);

function renderSection(props?: Partial<Parameters<typeof PulseDialogueDetailsSection>[0]>) {
  let currentValue: PulseDialogueFormValue = props?.value || { ...EMPTY_PULSE_DIALOGUE_VALUE };
  const onChange = vi.fn((next: PulseDialogueFormValue) => {
    currentValue = next;
  });
  const onSelectedContributorChange = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PulseDialogueDetailsSection
        value={currentValue}
        onChange={onChange}
        selectedContributor={props?.selectedContributor || null}
        onSelectedContributorChange={props?.onSelectedContributorChange || onSelectedContributorChange}
        canManageContributors={props?.canManageContributors ?? true}
      />
    </QueryClientProvider>
  );
  return { onChange, onSelectedContributorChange };
}

beforeEach(() => {
  mockedList.mockResolvedValue({
    items: [
      { id: 'c1', _id: 'c1', canonicalName: 'Active Writer', publicDesignation: 'Columnist', status: 'active' },
      { id: 'c2', _id: 'c2', canonicalName: 'Inactive Writer', publicDesignation: 'Essayist', status: 'inactive' },
    ],
    total: 2,
    page: 1,
    limit: 20,
  });
  mockedGet.mockResolvedValue({ id: 'c1', _id: 'c1', canonicalName: 'Active Writer', status: 'active' });
  mockedCreate.mockResolvedValue({ id: 'c3', _id: 'c3', canonicalName: 'Created Writer', status: 'active' });
  mockedUpdate.mockResolvedValue({ id: 'c1', _id: 'c1', canonicalName: 'Updated Writer', status: 'active' });
  mockedUploadCoverImage.mockResolvedValue({ url: 'https://cdn.newspulse.test/writer.webp', publicId: 'asset-1' });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PulseDialogueDetailsSection', () => {
  it('lists, searches, and selects contributors without exposing status controls', async () => {
    const { onChange } = renderSection({ selectedContributor: { id: 'c2', _id: 'c2', canonicalName: 'Inactive Writer', status: 'inactive' } });

    expect(await screen.findByText('Active Writer')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Active Writer'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ contributorId: 'c1' }));

    fireEvent.change(screen.getByLabelText('Search contributors'), { target: { value: 'active' } });
    await waitFor(() => expect(mockedList).toHaveBeenLastCalledWith({ q: 'active', limit: 20 }));
    expect(screen.queryByText(/^Status:/i)).not.toBeInTheDocument();
  });

  it('creates a contributor with simplified defaults and direct photo upload', async () => {
    const { onChange } = renderSection();

    fireEvent.click(await screen.findByText('Create Contributor'));

    expect(screen.getByLabelText(/Contributor Name/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Hindi Display Name/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Gujarati Display Name/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Contributor Type/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Status$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Choose from Media Library')).not.toBeInTheDocument();
    expect(screen.getByText('Additional / Internal Details').closest('details')).not.toHaveAttribute('open');

    fireEvent.change(screen.getByLabelText(/Contributor Name/), { target: { value: 'Created Writer' } });
    const uploadInput = screen.getByLabelText('Upload Photo');
    const firstPhoto = new File(['photo'], 'writer.webp', { type: 'image/webp' });
    fireEvent.change(uploadInput, { target: { files: [firstPhoto] } });

    await waitFor(() => expect(mockedUploadCoverImage).toHaveBeenCalledWith(firstPhoto));
    expect(await screen.findByAltText('Photo Preview')).toBeInTheDocument();
    expect(screen.getByLabelText('Replace Photo')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Remove Photo'));
    expect(screen.getByLabelText('Photo Preview')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Upload Photo'), { target: { files: [firstPhoto] } });
    await screen.findByAltText('Photo Preview');
    fireEvent.click(screen.getByText('Save Contributor'));

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({
      canonicalName: 'Created Writer',
      status: 'active',
      contributorType: 'guest_contributor',
      displayNameHi: null,
      displayNameGu: null,
      photo: expect.objectContaining({ url: 'https://cdn.newspulse.test/writer.webp' }),
    })));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ contributorId: 'c3' }));
  });

  it('edits the selected contributor while preserving hidden existing values', async () => {
    renderSection({
      selectedContributor: {
        id: 'c1',
        _id: 'c1',
        canonicalName: 'Active Writer',
        displayNameHi: 'पुराना नाम',
        displayNameGu: 'જૂનું નામ',
        contributorType: 'columnist',
        status: 'inactive',
      },
    });

    fireEvent.click(await screen.findByText('Edit Contributor'));
    fireEvent.change(screen.getByLabelText(/Contributor Name/), { target: { value: 'Updated Writer' } });
    fireEvent.click(screen.getByText('Save Contributor'));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith('c1', expect.objectContaining({
      canonicalName: 'Updated Writer',
      displayNameHi: 'पुराना नाम',
      displayNameGu: 'જૂનું નામ',
      contributorType: 'columnist',
      status: 'inactive',
    })));
  });
});
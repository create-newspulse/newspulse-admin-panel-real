import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PulseDialogueDetailsSection from '@/components/news/PulseDialogueDetailsSection';
import { buildPulseDialoguePayload, normalizePulseDialogueFormValue, EMPTY_PULSE_DIALOGUE_VALUE } from '@/lib/pulseDialogue';
import { uploadCoverImage } from '@/lib/api/media';
import toast from 'react-hot-toast';
import {
  createPulseDialogueContributor,
  getPulseDialogueContributor,
  getPulseDialogueContributorCapabilities,
  listPulseDialogueContributors,
  updatePulseDialogueContributor,
  changePulseDialogueContributorSlug,
  listPulseDialogueSeries,
  getPulseDialogueSeries,
  createPulseDialogueSeries,
  updatePulseDialogueSeries,
} from '@/lib/api/pulseDialogue';

vi.mock('@/lib/api/pulseDialogue', () => ({
  listPulseDialogueContributors: vi.fn(),
  getPulseDialogueContributor: vi.fn(),
  getPulseDialogueContributorCapabilities: vi.fn(),
  createPulseDialogueContributor: vi.fn(),
  updatePulseDialogueContributor: vi.fn(),
  changePulseDialogueContributorSlug: vi.fn(),
  listPulseDialogueSeries: vi.fn(async () => ({ items: [], total: 0, page: 1, limit: 20 })),
  getPulseDialogueSeries: vi.fn(),
  createPulseDialogueSeries: vi.fn(),
  updatePulseDialogueSeries: vi.fn(),
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
  const onChange = vi.fn();
  const onSelectedContributorChange = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  function Harness() {
    const [currentValue, setCurrentValue] = useState(props?.value || { ...EMPTY_PULSE_DIALOGUE_VALUE });
    return (
      <PulseDialogueDetailsSection
        value={currentValue}
        onChange={(next) => { setCurrentValue(next); onChange(next); }}
        selectedContributor={props?.selectedContributor || null}
        onSelectedContributorChange={props?.onSelectedContributorChange || onSelectedContributorChange}
        canManageContributors={props?.canManageContributors ?? true}
      />
    );
  }
  render(
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>
  );
  return { onChange, onSelectedContributorChange };
}

beforeEach(() => {
  vi.mocked(getPulseDialogueContributorCapabilities).mockReset().mockResolvedValue({ slugRename: false });
  vi.mocked(listPulseDialogueSeries).mockResolvedValue({ items: [{ id: 's1', title: 'Ideas', slug: 'ideas', description: 'A column', ownerContributorId: 'c1', profileVisible: false }], total: 1, page: 1, limit: 20 });
  vi.mocked(getPulseDialogueSeries).mockResolvedValue({ id: 's1', title: 'Ideas', slug: 'ideas', description: 'A column', ownerContributorId: 'c1', profileVisible: false });
  vi.mocked(createPulseDialogueSeries).mockResolvedValue({ id: 's2', title: 'New Column', slug: 'new-column', profileVisible: true });
  vi.mocked(updatePulseDialogueSeries).mockResolvedValue({ id: 's1', title: 'New Ideas', slug: 'ideas', profileVisible: true });
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
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('PulseDialogueDetailsSection', () => {
  it('searches and selects contributors without dumping or duplicating the selected contributor', async () => {
    const { onChange } = renderSection({
      value: { ...EMPTY_PULSE_DIALOGUE_VALUE, contributorId: 'c2' },
      selectedContributor: { id: 'c2', _id: 'c2', canonicalName: 'Inactive Writer', status: 'inactive' },
    });

    const searchPrompt = screen.getByText('Search to find contributors.');
    const results = searchPrompt.parentElement as HTMLElement;
    expect(mockedList).not.toHaveBeenCalled();
    expect(screen.getByText('Inactive Writer')).toBeInTheDocument();
    expect(within(results).queryByText('Inactive Writer')).not.toBeInTheDocument();


    fireEvent.change(screen.getByLabelText('Search contributors'), { target: { value: 'active' } });
    await waitFor(() => expect(mockedList).toHaveBeenLastCalledWith({ q: 'active', limit: 20 }));
    expect(await within(results).findByText('Active Writer')).toBeInTheDocument();
    expect(within(results).queryByText('Inactive Writer')).not.toBeInTheDocument();

    fireEvent.click(within(results).getByText('Active Writer'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ contributorId: 'c1' }));
    expect(screen.queryByText(/^Status:/i)).not.toBeInTheDocument();
  });

  it('clears the selected contributor with Change Selection', () => {
    const { onChange, onSelectedContributorChange } = renderSection({
      value: { ...EMPTY_PULSE_DIALOGUE_VALUE, contributorId: 'c2' },
      selectedContributor: { id: 'c2', _id: 'c2', canonicalName: 'Inactive Writer', status: 'inactive' },
    });

    fireEvent.click(screen.getByText('Change Selection'));

    expect(onSelectedContributorChange).toHaveBeenCalledWith(null);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ contributorId: '' }));
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
    mockedGet.mockResolvedValueOnce({ id: 'c1', canonicalName: 'Active Writer', displayNameHi: 'पुराना नाम', displayNameGu: 'જૂનું નામ', contributorType: 'columnist', status: 'inactive' });
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
    fireEvent.change(await screen.findByLabelText(/Contributor Name/), { target: { value: 'Updated Writer' } });
    fireEvent.click(screen.getByText('Save Contributor'));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith('c1', expect.objectContaining({
      canonicalName: 'Updated Writer',
      displayNameHi: 'पुराना नाम',
      displayNameGu: 'જૂનું નામ',
      contributorType: 'columnist',
      status: 'inactive',
    })));
  });

  it.each(['active', 'inactive', 'hidden'] as const)('restores public fields and saves %s without a slug', async (status) => {
    mockedGet.mockResolvedValueOnce({ id: 'c1', canonicalName: 'Current Writer', slug: 'current-writer', profileVisible: false, status: 'inactive', photo: { url: 'https://cdn.newspulse.test/writer.webp' }, publicDesignation: 'Essayist', shortBio: 'Public biography' });
    renderSection({ selectedContributor: { id: 'c1', canonicalName: 'Article snapshot' } });
    fireEvent.click(screen.getByText('Edit Contributor'));
    expect(await screen.findByLabelText('Contributor Name')).toHaveValue('Current Writer');
    expect(screen.getByLabelText('Public Profile')).not.toBeChecked();
    expect(screen.getByLabelText('Contributor Status')).toHaveValue('inactive');
    expect(screen.getByLabelText('Public Designation')).toHaveValue('Essayist');
    expect(screen.getByLabelText('Short Bio')).toHaveValue('Public biography');
    expect(screen.getByAltText('Photo Preview')).toHaveAttribute('src', 'https://cdn.newspulse.test/writer.webp');
    expect(screen.getByTestId('contributor-public-url')).toHaveTextContent('/pulse-dialogue/contributors/current-writer');
    expect(screen.queryByLabelText('New public URL slug')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Contributor Status'), { target: { value: status } });
    fireEvent.change(screen.getByLabelText('Contributor Name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByText('Save Contributor'));
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith('c1', expect.objectContaining({ status, profileVisible: false, canonicalName: 'Renamed' })));
    expect(mockedUpdate.mock.calls[0][1]).not.toHaveProperty('slug');
    expect(changePulseDialogueContributorSlug).not.toHaveBeenCalled();
  });

  it.each([false, true])('defaults new contributor visibility OFF and saves explicit enable: %s', async (enable) => {
    renderSection();
    fireEvent.click(screen.getByText('Create Contributor'));
    expect(screen.getByLabelText('Public Profile')).not.toBeChecked();
    if (enable) fireEvent.click(screen.getByLabelText('Public Profile'));
    fireEvent.change(screen.getByLabelText('Contributor Name'), { target: { value: 'New Writer' } });
    fireEvent.click(screen.getByText('Save Contributor'));
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledWith(expect.objectContaining({ profileVisible: enable, photo: null, publicDesignation: null, shortBio: null })));
    expect(mockedCreate.mock.calls[0][0]).not.toHaveProperty('slug');
  });

  it.each([
    { label: 'true', fields: { profileVisible: true }, expected: true },
    { label: 'false', fields: { profileVisible: false }, expected: false },
    { label: 'missing', fields: {}, expected: false },
    { label: 'undefined', fields: { profileVisible: undefined }, expected: false },
    { label: 'null', fields: { profileVisible: null }, expected: false },
  ])('restores $label visibility without writing on open or enabling an OFF profile on unrelated save', async ({ fields, expected }) => {
    const contributor = { id: 'c1', canonicalName: 'Existing Writer', status: 'active' };
    Object.assign(contributor, fields);
    mockedGet.mockResolvedValueOnce(contributor);
    const { onChange } = renderSection({ selectedContributor: contributor });
    fireEvent.click(screen.getByText('Edit Contributor'));
    const visibility = await screen.findByLabelText('Public Profile');
    if (expected) expect(visibility).toBeChecked();
    else expect(visibility).not.toBeChecked();
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(changePulseDialogueContributorSlug).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Contributor Name'), { target: { value: 'Renamed Writer' } });
    fireEvent.click(screen.getByText('Save Contributor'));
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledExactlyOnceWith('c1', expect.objectContaining({ canonicalName: 'Renamed Writer', profileVisible: expected })));
  });

  it.each([true, false])('saves an explicit contributor visibility change to %s', async (profileVisible) => {
    const contributor = { id: 'c1', canonicalName: 'Existing Writer', profileVisible: !profileVisible };
    mockedGet.mockResolvedValueOnce(contributor);
    renderSection({ selectedContributor: contributor });
    fireEvent.click(screen.getByText('Edit Contributor'));
    fireEvent.click(await screen.findByLabelText('Public Profile'));
    fireEvent.click(screen.getByText('Save Contributor'));
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledExactlyOnceWith('c1', expect.objectContaining({ profileVisible })));
  });

  it.each([400, 409])('keeps current slug on %s then updates it after an explicit successful change', async (status) => {
    vi.mocked(getPulseDialogueContributorCapabilities).mockResolvedValue({ slugRename: true });
    mockedGet.mockResolvedValueOnce({ id: 'c1', canonicalName: 'Writer', slug: 'writer' });
    vi.mocked(changePulseDialogueContributorSlug).mockRejectedValueOnce({ response: { status } }).mockResolvedValueOnce({ id: 'c1', slug: 'canonical-writer' });
    const { onChange } = renderSection({ selectedContributor: { id: 'c1', canonicalName: 'Writer' } });
    fireEvent.click(screen.getByText('Edit Contributor'));
    await waitFor(() => expect(screen.getByText('Change Public URL')).toBeEnabled());
    fireEvent.click(screen.getByText('Change Public URL'));
    expect(screen.getByText(/Old URLs remain supported/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('New public URL slug'), { target: { value: 'canonical-writer' } });
    fireEvent.click(screen.getByText('Confirm URL Change'));
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 409 ? /already used or reserved/ : /Invalid public URL/);
    expect(screen.getByTestId('contributor-public-url')).toHaveTextContent('/pulse-dialogue/contributors/writer');
    fireEvent.click(screen.getByText('Confirm URL Change'));
    await waitFor(() => expect(screen.getByTestId('contributor-public-url')).toHaveTextContent('/pulse-dialogue/contributors/canonical-writer'));
    expect(changePulseDialogueContributorSlug).toHaveBeenLastCalledWith('c1', 'canonical-writer');
    expect(mockedUpdate).not.toHaveBeenCalled();
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith('Public URL updated');
  });

  it.each([
    { label: 'false', result: { slugRename: false } },
    { label: 'failed', error: new Error('Unavailable') },
    { label: 'timeout', error: { code: 'ECONNABORTED' } },
    { label: 'missing', result: {} },
    { label: 'malformed', result: { slugRename: 'true' } },
    { label: 'empty', result: null },
  ])('disables URL changes for $label capability while preserving the URL and profile editing', async ({ result, error }) => {
    const capability = vi.mocked(getPulseDialogueContributorCapabilities);
    if (error) capability.mockRejectedValue(error);
    else capability.mockResolvedValue(result as unknown as Awaited<ReturnType<typeof getPulseDialogueContributorCapabilities>>);
    mockedGet.mockResolvedValueOnce({ id: 'c1', canonicalName: 'Writer', slug: 'writer', profileVisible: false });
    renderSection({ selectedContributor: { id: 'c1', canonicalName: 'Writer' } });
    expect(capability).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Edit Contributor'));
    const changeButton = await screen.findByRole('button', { name: 'Change Public URL' });
    await waitFor(() => expect(capability).toHaveBeenCalledTimes(1));
    expect(changeButton).toBeDisabled();
    expect(changeButton).toHaveAccessibleDescription('Public URL changes are temporarily unavailable.');
    expect(screen.getByTestId('contributor-public-url')).toHaveTextContent('/pulse-dialogue/contributors/writer');
    fireEvent.click(changeButton);
    expect(screen.queryByLabelText('New public URL slug')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm URL Change')).not.toBeInTheDocument();
    expect(changePulseDialogueContributorSlug).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Contributor Name'), { target: { value: 'Updated Writer' } });
    fireEvent.click(screen.getByLabelText('Public Profile'));
    fireEvent.click(screen.getByText('Save Contributor'));
    await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith('c1', expect.objectContaining({ canonicalName: 'Updated Writer', profileVisible: true })));
    expect(mockedUpdate.mock.calls[0][1]).not.toHaveProperty('slug');
    expect(changePulseDialogueContributorSlug).not.toHaveBeenCalled();
  });

  it('keeps pending capability disabled and rechecks on reopening without retaining a stale grant', async () => {
    const capability = vi.mocked(getPulseDialogueContributorCapabilities);
    let resolveCapability!: (value: { slugRename: boolean }) => void;
    capability.mockImplementationOnce(() => new Promise((resolve) => { resolveCapability = resolve; }));
    mockedGet.mockResolvedValue({ id: 'c1', canonicalName: 'Writer', slug: 'writer' });
    renderSection({ selectedContributor: { id: 'c1', canonicalName: 'Writer' } });
    fireEvent.click(screen.getByText('Edit Contributor'));
    expect(await screen.findByText('Change Public URL')).toBeDisabled();
    resolveCapability({ slugRename: true });
    await waitFor(() => expect(screen.getByText('Change Public URL')).toBeEnabled());
    fireEvent.click(screen.getByText('Close'));
    capability.mockImplementationOnce(() => new Promise((resolve) => { resolveCapability = resolve; }));
    fireEvent.click(screen.getByText('Edit Contributor'));
    expect(await screen.findByText('Change Public URL')).toBeDisabled();
    await waitFor(() => expect(capability).toHaveBeenCalledTimes(2));
    resolveCapability({ slugRename: false });
    await waitFor(() => expect(screen.getByText('Change Public URL')).toBeDisabled());
    fireEvent.click(screen.getByText('Change Public URL'));
    expect(changePulseDialogueContributorSlug).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Close'));
    capability.mockResolvedValueOnce({ slugRename: true });
    fireEvent.click(screen.getByText('Edit Contributor'));
    await waitFor(() => expect(screen.getByText('Change Public URL')).toBeEnabled());
    expect(capability).toHaveBeenCalledTimes(3);
  });

  it('automatically enables a later grant and closes slug editing when a refresh fails', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const capability = vi.mocked(getPulseDialogueContributorCapabilities);
    mockedGet.mockResolvedValue({ id: 'c1', canonicalName: 'Writer', slug: 'writer' });
    renderSection({ selectedContributor: { id: 'c1', canonicalName: 'Writer' } });
    fireEvent.click(screen.getByText('Edit Contributor'));
    expect(await screen.findByText('Change Public URL')).toBeDisabled();
    capability.mockResolvedValueOnce({ slugRename: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(60 * 1000); });
    await waitFor(() => expect(screen.getByText('Change Public URL')).toBeEnabled());
    fireEvent.click(screen.getByText('Change Public URL'));
    fireEvent.change(screen.getByLabelText('New public URL slug'), { target: { value: 'new-writer' } });
    expect(screen.getByText('Confirm URL Change')).toBeEnabled();
    capability.mockRejectedValueOnce(new Error('Unavailable'));
    await act(async () => { await vi.advanceTimersByTimeAsync(60 * 1000); });
    await waitFor(() => expect(screen.getByText('Change Public URL')).toBeDisabled());
    expect(screen.queryByLabelText('New public URL slug')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm URL Change')).not.toBeInTheDocument();
    expect(screen.getByTestId('contributor-public-url')).toHaveTextContent('/pulse-dialogue/contributors/writer');
    fireEvent.click(screen.getByText('Change Public URL'));
    expect(changePulseDialogueContributorSlug).not.toHaveBeenCalled();
    expect(screen.getByText('Save Contributor')).toBeEnabled();
  });

  it('keeps management actions permission-gated', () => {
    renderSection({ canManageContributors: false, selectedContributor: { id: 'c1', canonicalName: 'Writer' } });
    expect(screen.queryByText('Create Contributor')).not.toBeInTheDocument();
    expect(screen.queryByText('Edit Contributor')).not.toBeInTheDocument();
    expect(screen.queryByText('Change Public URL')).not.toBeInTheDocument();
    expect(getPulseDialogueContributorCapabilities).not.toHaveBeenCalled();
    expect(screen.queryByText('Manage Series / Columns')).not.toBeInTheDocument();
  });

  it.each([false, true])('creates Series with optional slug and owner (provided: %s)', async (provided) => {
    const { onChange } = renderSection();
    fireEvent.click(screen.getByText('Manage Series / Columns'));
    const dialog = await screen.findByRole('dialog', { name: 'Series / Column Management' });
    expect(await within(dialog).findByText('Ideas')).toBeInTheDocument();
    expect(listPulseDialogueSeries).toHaveBeenCalledWith({ page: 1, limit: 20 });
    fireEvent.click(within(dialog).getByText('New Series'));
    expect(screen.getByText('Save Series')).toBeDisabled();
    expect(screen.getByLabelText('Series Slug')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Public Visibility')).toBeChecked();
    fireEvent.change(screen.getByLabelText('Series Title'), { target: { value: 'New Column' } });
    if (provided) {
      fireEvent.change(screen.getByLabelText('Series Slug'), { target: { value: 'new-column' } });
      fireEvent.change(screen.getByLabelText('Series Description'), { target: { value: 'Public description' } });
      fireEvent.change(screen.getByLabelText('Search owner contributors'), { target: { value: 'active' } });
      fireEvent.click(await within(dialog).findByRole('button', { name: 'Active Writer' }));
      fireEvent.click(screen.getByLabelText('Public Visibility'));
    }
    fireEvent.click(screen.getByText('Save Series'));
    await waitFor(() => expect(createPulseDialogueSeries).toHaveBeenCalledWith({
      title: 'New Column',
      description: provided ? 'Public description' : null,
      ownerContributorId: provided ? 'c1' : null,
      profileVisible: !provided,
      ...(provided ? { slug: 'new-column' } : {}),
    }));
    expect(onChange).not.toHaveBeenCalled();
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('restores Series for edit, keeps slug read-only, and clears owner and description', async () => {
    const { onChange } = renderSection();
    fireEvent.click(screen.getByText('Manage Series / Columns'));
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Series Ideas' }));
    expect(await screen.findByLabelText('Series Title')).toHaveValue('Ideas');
    expect(getPulseDialogueSeries).toHaveBeenCalledWith('s1');
    expect(screen.getByLabelText('Series Slug')).toHaveValue('ideas');
    expect(screen.getByLabelText('Series Slug')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Series Description')).toHaveValue('A column');
    expect(screen.getByLabelText('Public Visibility')).not.toBeChecked();
    expect(await screen.findByText('Owner: Active Writer')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Clear Owner'));
    fireEvent.change(screen.getByLabelText('Series Description'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Series Title'), { target: { value: 'New Ideas' } });
    fireEvent.click(screen.getByLabelText('Public Visibility'));
    fireEvent.click(screen.getByText('Save Series'));
    await waitFor(() => expect(updatePulseDialogueSeries).toHaveBeenCalledWith('s1', { title: 'New Ideas', description: null, ownerContributorId: null, profileVisible: true }));
    expect(updatePulseDialogueSeries).not.toHaveBeenCalledWith('s1', expect.objectContaining({ slug: expect.anything() }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('selects a canonical Series and explicitly clears both fields without changing Phase 1 metadata', async () => {
    const initial = { ...EMPTY_PULSE_DIALOGUE_VALUE, contributorId: 'c1', contributorDisclosure: 'Disclosure', contributorDisclaimer: 'Disclaimer', editorNote: 'Note', dialogueFormat: 'essay' as const };
    const { onChange } = renderSection({ value: initial, selectedContributor: { id: 'c1', canonicalName: 'Writer' } });
    await screen.findByRole('option', { name: 'Ideas' });
    fireEvent.change(screen.getByLabelText('Series / Column - optional'), { target: { value: 's1' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...initial, series: 'Ideas', seriesSlug: 'ideas' });
    expect(buildPulseDialoguePayload(onChange.mock.calls.at(-1)![0])).toMatchObject({ contributorId: 'c1', series: 'Ideas', seriesSlug: 'ideas', contributorDisclosure: 'Disclosure', contributorDisclaimer: 'Disclaimer', editorNote: 'Note' });
    fireEvent.change(screen.getByLabelText('Series / Column - optional'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...initial, series: null, seriesSlug: null });
    expect(buildPulseDialoguePayload(onChange.mock.calls.at(-1)![0])).toMatchObject({ contributorId: 'c1', series: null, seriesSlug: null, contributorDisclosure: 'Disclosure', contributorDisclaimer: 'Disclaimer', editorNote: 'Note' });
  });

  it('restores an existing Series outside the loaded list without changing its metadata', async () => {
    const initial = normalizePulseDialogueFormValue({ contributorId: 'c1', series: 'Archived Ideas', seriesSlug: 'archived-ideas' });
    const { onChange } = renderSection({ value: initial, selectedContributor: { id: 'c1', canonicalName: 'Writer' } });
    expect(screen.getByRole('option', { name: 'Archived Ideas (current)' })).toBeInTheDocument();
    await screen.findByRole('option', { name: 'Ideas' });
    expect(onChange).not.toHaveBeenCalled();
    expect(buildPulseDialoguePayload(initial)).toMatchObject({ contributorId: 'c1', series: 'Archived Ideas', seriesSlug: 'archived-ideas' });
  });

  it('does not invent a legacy slug, leak private fields, or send a clear without a contributor', () => {
    const legacy = normalizePulseDialogueFormValue({ contributorId: 'c1', series: 'Legacy title', internalEmail: 'private@example.test', internalNotes: 'private', slugHistory: ['old'] });
    expect(buildPulseDialoguePayload(legacy)).toEqual({ contributorId: 'c1', series: 'Legacy title', showAboutContributor: false });
    expect(buildPulseDialoguePayload(EMPTY_PULSE_DIALOGUE_VALUE)).not.toHaveProperty('series');
    expect(buildPulseDialoguePayload({ ...EMPTY_PULSE_DIALOGUE_VALUE, series: null, seriesSlug: null })).not.toHaveProperty('series');
    expect(buildPulseDialoguePayload(normalizePulseDialogueFormValue({ contributorId: 'c1', series: null, seriesSlug: null }))).toMatchObject({ contributorId: 'c1', series: null, seriesSlug: null });
  });

  it('keeps a current assignment when Series loading fails and allows retry', async () => {
    vi.mocked(listPulseDialogueSeries).mockRejectedValueOnce(new Error('Unavailable'));
    const initial = { ...EMPTY_PULSE_DIALOGUE_VALUE, contributorId: 'c1', series: 'Ideas', seriesSlug: 'ideas' };
    const { onChange } = renderSection({ value: initial, selectedContributor: { id: 'c1', canonicalName: 'Writer' } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Series could not be loaded');
    expect(screen.getByRole('option', { name: 'Ideas (current)' })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Retry Series'));
    expect(await screen.findByRole('option', { name: 'Ideas' })).toBeInTheDocument();
  });
});
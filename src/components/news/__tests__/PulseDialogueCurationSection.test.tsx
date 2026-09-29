import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PulseDialogueCurationSection, { PulseDialogueCurationEditor } from '@/components/news/PulseDialogueCurationSection';
import { adminApiClient } from '@/lib/adminApiClient';
import type { PulseDialogueCuration } from '@/lib/api/pulseDialogueCuration';

vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: { get: vi.fn(), put: vi.fn() } }));
const client = vi.mocked(adminApiClient, { deep: true });
const base = 'admin/pulse-dialogue/curation';
const id = (number: number) => String(number).padStart(24, '0');
const articles = Array.from({ length: 8 }, (_, index) => ({ id: id(index + 1), title: `Dialogue ${index + 1}`, slug: `dialogue-${index + 1}`, status: 'published', missing: false }));
const voices = Array.from({ length: 8 }, (_, index) => ({ id: id(index + 11), name: `Voice ${index + 1}`, slug: `voice-${index + 1}`, status: 'active', profileVisible: true, missing: false, publicDesignation: 'Columnist' }));
let configuration: PulseDialogueCuration;

beforeEach(() => {
  vi.resetAllMocks();
  configuration = { featuredDialogue: [articles[1], articles[0]], featuredVoices: [voices[1], voices[0]], updatedAt: null };
  client.get.mockImplementation(async (path, options) => {
    if (path === base) return { data: { ok: true, configuration: structuredClone(configuration) } };
    if (path === 'articles') return { data: { rows: articles.map((article) => ({ ...article, _id: article.id, category: 'pulse-dialogue', pulseDialogue: { dialogueFormat: 'essay', bylineSnapshot: { name: 'Guest Writer' } } })), page: options?.params?.page || 1, pages: 2, total: 21 } };
    if (path === 'admin/pulse-dialogue/contributors') return { data: { items: voices.map((voice) => ({ ...voice, _id: voice.id, canonicalName: voice.name })), page: options?.params?.page || 1, limit: 20, total: 21 } };
    throw new Error(`Unexpected API: ${path}`);
  });
  client.put.mockImplementation(async (path, payload) => {
    if (path === `${base}/featured-dialogue`) configuration.featuredDialogue = (payload as { articleIds: string[] }).articleIds.map((articleId) => articles.find((article) => article.id === articleId)!);
    else if (path === `${base}/featured-voices`) configuration.featuredVoices = (payload as { contributorIds: string[] }).contributorIds.map((contributorId) => voices.find((voice) => voice.id === contributorId)!);
    else throw new Error(`Unexpected API: ${path}`);
    return { data: { ok: true, configuration: structuredClone(configuration) } };
  });
});

afterEach(cleanup);

async function openEditor() {
  render(<PulseDialogueCurationEditor />);
  await screen.findByRole('region', { name: 'Featured Dialogue' });
}

const cases = [
  { title: 'Featured Dialogue', noun: 'Article', prefix: 'Dialogue', key: 'featuredDialogue', path: 'featured-dialogue', field: 'articleIds', items: articles },
  { title: 'Featured Voices', noun: 'Contributor', prefix: 'Voice', key: 'featuredVoices', path: 'featured-voices', field: 'contributorIds', items: voices },
] as const;

describe('Pulse Dialogue curation UI', () => {
  it('loads only when the separate management section is opened and retains state when collapsed', async () => {
    const { container } = render(<PulseDialogueCurationSection />);
    expect(client.get).not.toHaveBeenCalled();
    const details = container.querySelector('details')!;
    details.open = true;
    fireEvent(details, new Event('toggle'));
    await screen.findByText('Dialogue 2');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Dialogue 2' }));
    details.open = false;
    fireEvent(details, new Event('toggle'));
    details.open = true;
    fireEvent(details, new Event('toggle'));
    expect(screen.queryByText('Dialogue 2')).not.toBeInTheDocument();
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it('renders both lists in stored order from the exact GET endpoint', async () => {
    await openEditor();
    expect(client.get).toHaveBeenCalledExactlyOnceWith(base, { headers: { 'Cache-Control': 'no-store' } });
    for (const entry of cases) {
      const rows = within(screen.getByRole('list', { name: `Selected ${entry.title}` })).getAllByRole('listitem');
      expect(rows[0]).toHaveTextContent(`${entry.prefix} 2`);
      expect(rows[1]).toHaveTextContent(`${entry.prefix} 1`);
    }
    expect(client.put).not.toHaveBeenCalled();
  });

  describe.each(cases)('$title', (entry) => {
    it('removes, reorders both directions, and sends exact ordered IDs only on Save', async () => {
      await openEditor();
      const section = within(screen.getByRole('region', { name: entry.title }));
      expect(section.getByRole('button', { name: `Move Up ${entry.prefix} 2` })).toBeDisabled();
      expect(section.getByRole('button', { name: `Move Down ${entry.prefix} 1` })).toBeDisabled();
      fireEvent.click(section.getByRole('button', { name: `Move Up ${entry.prefix} 1` }));
      expect(section.getAllByRole('listitem')[0]).toHaveTextContent(`${entry.prefix} 1`);
      fireEvent.click(section.getByRole('button', { name: `Move Down ${entry.prefix} 1` }));
      expect(section.getAllByRole('listitem')[0]).toHaveTextContent(`${entry.prefix} 2`);
      fireEvent.click(section.getByRole('button', { name: `Remove ${entry.prefix} 2` }));
      expect(section.queryByText(`${entry.prefix} 2`)).not.toBeInTheDocument();
      fireEvent.click(section.getByRole('button', { name: `Add ${entry.noun}` }));
      const select = await section.findByRole('combobox');
      await waitFor(() => expect(select).not.toBeDisabled());
      fireEvent.change(select, { target: { value: entry.items[2].id } });
      fireEvent.click(section.getByRole('button', { name: `Add selected ${entry.noun.toLowerCase()}` }));
      fireEvent.click(section.getByRole('button', { name: `Move Up ${entry.prefix} 3` }));
      expect(client.put).not.toHaveBeenCalled();
      fireEvent.click(section.getByRole('button', { name: `Save ${entry.title}` }));
      await section.findByText(`${entry.title} saved.`);
      expect(client.put).toHaveBeenCalledExactlyOnceWith(`${base}/${entry.path}`, { [entry.field]: [entry.items[2].id, entry.items[0].id] });
    });

    it('prevents duplicate candidates and enforces maximum six even with an open picker', async () => {
      Object.assign(configuration, { [entry.key]: entry.items.slice(0, 5) });
      await openEditor();
      const section = within(screen.getByRole('region', { name: entry.title }));
      fireEvent.click(section.getByRole('button', { name: `Add ${entry.noun}` }));
      const select = section.getByRole('combobox');
      await waitFor(() => expect(select).not.toBeDisabled());
      expect(section.getByRole('option', { name: new RegExp(`${entry.prefix} 1 \\|`) })).toBeDisabled();
      fireEvent.change(select, { target: { value: entry.items[0].id } });
      const add = section.getByRole('button', { name: `Add selected ${entry.noun.toLowerCase()}` });
      expect(add).toBeDisabled();
      fireEvent.click(add);
      expect(section.getAllByRole('listitem')).toHaveLength(5);
      fireEvent.change(select, { target: { value: entry.items[5].id } });
      fireEvent.click(add);
      expect(section.getAllByRole('listitem')).toHaveLength(6);
      expect(add).toBeDisabled();
      expect(select).toBeDisabled();
      expect(section.getByRole('button', { name: `Add ${entry.noun}` })).toBeDisabled();
    });

    it('clears the list with an explicit empty-array save', async () => {
      await openEditor();
      const section = within(screen.getByRole('region', { name: entry.title }));
      fireEvent.click(section.getByRole('button', { name: `Remove ${entry.prefix} 1` }));
      fireEvent.click(section.getByRole('button', { name: `Remove ${entry.prefix} 2` }));
      fireEvent.click(section.getByRole('button', { name: `Save ${entry.title}` }));
      await section.findByText(`${entry.title} saved.`);
      expect(client.put).toHaveBeenCalledExactlyOnceWith(`${base}/${entry.path}`, { [entry.field]: [] });
    });

    it.each([
      { response: { status: 400, data: { message: 'Selection is not eligible' } } },
      new Error('Network Error'),
    ])('preserves local selection and supports retry after save failure: %j', async (failure) => {
      client.put.mockRejectedValueOnce(failure);
      await openEditor();
      const section = within(screen.getByRole('region', { name: entry.title }));
      fireEvent.click(section.getByRole('button', { name: `Move Up ${entry.prefix} 1` }));
      fireEvent.click(section.getByRole('button', { name: `Save ${entry.title}` }));
      expect(await section.findByRole('alert')).toHaveTextContent('response' in failure ? 'Selection is not eligible' : 'Network Error');
      expect(section.getAllByRole('listitem')[0]).toHaveTextContent(`${entry.prefix} 1`);
      fireEvent.click(section.getByRole('button', { name: `Save ${entry.title}` }));
      await section.findByText(`${entry.title} saved.`);
      expect(client.put).toHaveBeenLastCalledWith(`${base}/${entry.path}`, { [entry.field]: [entry.items[0].id, entry.items[1].id] });
    });

    it('supports candidate pagination through the existing authenticated API', async () => {
      await openEditor();
      const section = within(screen.getByRole('region', { name: entry.title }));
      fireEvent.click(section.getByRole('button', { name: `Add ${entry.noun}` }));
      await section.findByText('Page 1 of 2');
      fireEvent.click(section.getByRole('button', { name: `Next ${entry.noun} page` }));
      await waitFor(() => expect(client.get).toHaveBeenLastCalledWith(entry.noun === 'Article' ? 'articles' : 'admin/pulse-dialogue/contributors', { params: entry.noun === 'Article' ? { category: 'pulse-dialogue', page: 2, limit: 20 } : { page: 2, limit: 20 } }));
    });
  });

  it('keeps missing, unpublished, inactive and hidden references in their original positions', async () => {
    configuration.featuredDialogue = [articles[0], { ...articles[1], status: 'draft' }, { id: id(90), title: null, slug: null, status: null, missing: true }];
    configuration.featuredVoices = [voices[0], { ...voices[1], status: 'inactive' }, { ...voices[2], profileVisible: false }, { id: id(91), name: null, slug: null, status: null, profileVisible: false, missing: true }];
    await openEditor();
    expect(screen.getAllByText('Unavailable publicly')).toHaveLength(5);
    const dialogue = within(screen.getByRole('region', { name: 'Featured Dialogue' })).getAllByRole('listitem');
    expect(dialogue).toHaveLength(3);
    expect(dialogue[1]).toHaveTextContent('Dialogue 2');
    expect(dialogue[2]).toHaveTextContent(id(90));
    const voiceRows = within(screen.getByRole('region', { name: 'Featured Voices' })).getAllByRole('listitem');
    expect(voiceRows).toHaveLength(4);
    expect(voiceRows[3]).toHaveTextContent(id(91));
    expect(client.put).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Move Down Dialogue 1' }));
    client.put.mockResolvedValueOnce({ data: { ok: true, configuration } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Featured Dialogue' }));
    await waitFor(() => expect(client.put).toHaveBeenCalledWith(`${base}/featured-dialogue`, { articleIds: [id(2), id(1), id(90)] }));
  });

  it('does not overwrite the other list draft with a complete PUT response and freezes only the saving list', async () => {
    let resolveSave!: (response: any) => void;
    client.put.mockImplementationOnce(() => new Promise((resolve) => { resolveSave = resolve; }));
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Move Up Voice 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Up Dialogue 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Featured Dialogue' }));
    expect(screen.getByRole('button', { name: 'Saving Featured Dialogue...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove Dialogue 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove Voice 1' })).not.toBeDisabled();
    await act(async () => resolveSave({ data: { ok: true, configuration: { ...configuration, featuredDialogue: [articles[0], articles[1]] } } }));
    expect(within(screen.getByRole('list', { name: 'Selected Featured Voices' })).getAllByRole('listitem')[0]).toHaveTextContent('Voice 1');
    expect(screen.getByRole('button', { name: 'Save Featured Voices' })).not.toBeDisabled();
  });

  it('handles GET 403 safely with no candidate or save controls', async () => {
    client.get.mockRejectedValueOnce({ response: { status: 403 } });
    render(<PulseDialogueCurationEditor />);
    await screen.findByText('Access Denied');
    expect(screen.queryByRole('button', { name: 'Add Article' })).not.toBeInTheDocument();
    expect(client.put).not.toHaveBeenCalled();
    expect(client.get).toHaveBeenCalledTimes(1);
  });

  it('retains local edits on PUT 403 and retries access without resetting drafts', async () => {
    client.put.mockRejectedValueOnce({ response: { status: 403 } });
    await openEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Remove Voice 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move Up Dialogue 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Featured Dialogue' }));
    await screen.findByText('Access Denied');
    expect(screen.getByRole('button', { name: 'Remove Dialogue 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save Featured Voices' })).toBeDisabled();
    expect(screen.queryByText('Voice 2')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry curation access' }));
    await waitFor(() => expect(screen.queryByText('Access Denied')).not.toBeInTheDocument());
    expect(screen.queryByText('Voice 2')).not.toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Selected Featured Dialogue' })).getAllByRole('listitem')[0]).toHaveTextContent('Dialogue 1');
  });

  it.each([new Error('Network Error'), { response: { status: 404, data: { message: 'Not deployed' } } }])('does not turn a failed GET into an empty editable configuration: %j', async (failure) => {
    client.get.mockRejectedValueOnce(failure);
    render(<PulseDialogueCurationEditor />);
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: 'Save Featured Dialogue' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry curation access' }));
    await screen.findByText('Dialogue 2');
  });

  it('restricts article candidates to Pulse Dialogue News IDs and uses only the contributor system', async () => {
    await openEditor();
    client.get.mockResolvedValueOnce({ data: { rows: [
      { _id: id(1), title: 'Valid News', category: 'pulse-dialogue', status: 'published' },
      { _id: id(2), title: 'Other category', category: 'sports' },
      { _id: 'slug-not-news-id', title: 'Invalid ID', category: 'pulse-dialogue' },
    ] } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Article' }));
    await screen.findByRole('option', { name: /Valid News/ });
    expect(screen.queryByRole('option', { name: /Other category|Invalid ID/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add Contributor' }));
    await screen.findByRole('option', { name: /Voice 3/ });
    expect(client.get.mock.calls.map(([path]) => path)).toEqual([base, 'articles', 'admin/pulse-dialogue/contributors']);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(client.put).not.toHaveBeenCalled();
  });

  it('surfaces candidate failure, supports retry, and handles candidate 403', async () => {
    await openEditor();
    client.get.mockRejectedValueOnce(new Error('Network Error'));
    fireEvent.click(screen.getByRole('button', { name: 'Add Article' }));
    await screen.findByText('Network Error');
    expect(screen.getByRole('button', { name: 'Add selected article' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Retry candidates' }));
    await screen.findByRole('option', { name: /Dialogue 3/ });
    client.get.mockRejectedValueOnce({ response: { status: 403 } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Contributor' }));
    await screen.findByText('Access Denied');
    expect(screen.getByRole('button', { name: 'Add selected article' })).toBeDisabled();
  });
});
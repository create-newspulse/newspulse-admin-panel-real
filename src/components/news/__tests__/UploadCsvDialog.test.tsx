import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BulkUploadResult } from '@/types/api';
import { UploadCsvDialog } from '../UploadCsvDialog';

const mocks = vi.hoisted(() => ({
  role: 'founder',
  publishEnabled: true,
  isAuthenticated: true,
  isReady: true,
  isLoading: false,
  isRestoring: false,
  post: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      role: mocks.role,
      moduleAccess: ['manage_news'],
      specialRights: ['news_publish', 'news_edit'],
      newsPublishGrantRecorded: true,
    },
    isAuthenticated: mocks.isAuthenticated,
    isReady: mocks.isReady,
    isLoading: mocks.isLoading,
    isRestoring: mocks.isRestoring,
  }),
}));
vi.mock('@/context/PublishFlagContext', () => ({
  usePublishFlag: () => ({ publishEnabled: mocks.publishEnabled }),
}));
vi.mock('@/lib/adminApiClient', () => ({ adminApiClient: { post: mocks.post } }));

const result: BulkUploadResult = { created: 1, updated: 0, skipped: 0 };
const clients: QueryClient[] = [];

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 2, retryDelay: 0 } },
  });
  clients.push(client);
  const onDone = vi.fn();
  const content = () => (
    <QueryClientProvider client={client}>
      <UploadCsvDialog onDone={onDone} />
    </QueryClientProvider>
  );
  const view = render(content());
  return { ...view, client, onDone, rerenderDialog: () => view.rerender(content()) };
}

function selectCsv(contents: string | File): File {
  const file = typeof contents === 'string'
    ? new File([contents], 'synthetic.csv', { type: 'text/csv' })
    : contents;
  fireEvent.change(screen.getByLabelText('CSV file'), { target: { files: [file] } });
  return file;
}

function upload(contents: string | File): File {
  const file = selectCsv(contents);
  fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
  return file;
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string'
      ? resolve(reader.result)
      : reject(new Error('Expected uploaded UTF-8 text'));
    reader.onerror = () => reject(new Error('Unable to inspect uploaded file'));
    reader.readAsText(file);
  });
}

async function uploadedText(original: File): Promise<string> {
  await waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1));
  const [path, body] = mocks.post.mock.calls[0];
  expect(path).toBe('articles/bulk-upload');
  if (!(body instanceof FormData)) throw new Error('Expected the existing multipart contract');
  expect([...body.keys()]).toEqual(['file']);
  const file = body.get('file');
  if (!(file instanceof File)) throw new Error('Expected a multipart File');
  expect(file).not.toBe(original);
  expect(file.name).toBe(original.name);
  expect(file.type).toBe('text/csv');
  const text = readFile(file);
  await act(async () => { await text; });
  return text;
}

beforeEach(() => {
  Object.assign(mocks, {
    role: 'founder',
    publishEnabled: true,
    isAuthenticated: true,
    isReady: true,
    isLoading: false,
    isRestoring: false,
  });
  mocks.post.mockReset().mockResolvedValue({ data: result });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('sanitized multipart CSV uploads', () => {
  it.each([
    { name: 'staff with the Publish News grant', role: 'editor', enabled: true },
    { name: 'staff with publishing off', role: 'editor', enabled: false },
    { name: 'Founder with publishing off', role: 'founder', enabled: false },
  ])('sanitizes publication and scheduling fields for $name', async ({ role, enabled }) => {
    mocks.role = role;
    mocks.publishEnabled = enabled;
    renderDialog();
    const time = '2099-01-01T00:00:00Z';
    const original = upload([
      'title," STATUS ",SCHEDULEDAT,PublishAt,PublishedAt,language,custom',
      `English, PUBLISHED ,${time},${time},${time},en,0001`,
      `Hindi,scheduled,${time},${time},${time},hi,0002`,
      `Gujarati,schedule,${time},${time},${time},gu,0003`,
      `Draft,draft,${time},${time},${time},en,0004`,
      `Archive,archived,${time},${time},${time},en,0005`,
    ].join('\n'));

    expect(await uploadedText(original)).toBe([
      'title,status,scheduledAt,publishAt,publishedAt,language,custom',
      'English,draft,,,,en,0001',
      'Hindi,draft,,,,hi,0002',
      'Gujarati,draft,,,,gu,0003',
      'Draft,draft,,,,en,0004',
      'Archive,archived,,,,en,0005',
      '',
    ].join('\r\n'));
  });

  it('preserves enabled Founder publication, scheduling, every column and multilingual rich content', async () => {
    renderDialog();
    const gu = '\u0a97\u0ac1\u0a9c\u0ab0\u0abe\u0aa4\u0ac0';
    const hi = '\u0939\u093f\u0928\u094d\u0926\u0940';
    const time = '2099-01-01T00:00:00Z';
    const header = 'title,summary,content,category,tags,imageUrl,sourceName,sourceUrl,language,status,scheduledAt,publishAt,publishedAt,customColumn,trailing';
    const english = [
      '"Title, ""quoted"""', `${gu} / ${hi}`, '"<p title=""Example, quoted"">Line 1\r\n\r\nLine 2</p>"',
      'national', 'tag1;tag2', 'https://example.test/a.png', '"Agency, Example"', 'https://example.test/story',
      'en', ' PUBLISHED ', '', '', '2026-01-02T03:04:05.000Z', '000001', '',
    ];
    const hindi = [
      hi, '', 'Plain content', 'national', '', '', 'Agency', '', 'hi', ' schedule ',
      time, time, '', '"  keep spaces  "', '',
    ];
    const gujarati = [
      gu, '', `"${gu}\n${hi}"`, 'national', '', '', 'Agency', '', 'gu', 'draft', '', '', '', '', '',
    ];
    const original = upload('\uFEFF' + [header, english.join(','), hindi.join(','), gujarati.join(','), '', ''].join('\n'));

    expect(await uploadedText(original)).toBe([
      header,
      [...english.slice(0, 9), 'published', ...english.slice(10)].join(','),
      [...hindi.slice(0, 9), 'scheduled', ...hindi.slice(10)].join(','),
      gujarati.join(','),
      '',
    ].join('\r\n'));
  });

  it('preserves omitted status while removing restricted date-only lifecycle controls', async () => {
    mocks.role = 'editor';
    renderDialog();
    const original = upload('title,summary,publishAt,publishedAt\nTitle,"body, summary",2099-01-01T00:00:00Z,2026-01-01T00:00:00Z');
    expect(await uploadedText(original)).toBe(
      'title,summary,publishAt,publishedAt\r\nTitle,"body, summary",,\r\n',
    );
  });

  it.each(['founder', 'editor'])('does not invent lifecycle fields or change article IDs for %s update imports', async role => {
    mocks.role = role;
    renderDialog();
    const header = '_id,translationGroupId,language,title';
    const row = 'cms-en,synthetic-group,en,Updated synthetic title';
    const original = upload(`${header}\n${row}`);
    expect(await uploadedText(original)).toBe(`${header}\r\n${row}\r\n`);
  });

  it.each([
    ['malformed later row', 'title,status\nSafe,draft\n"Unsafe,published'],
    ['duplicate lifecycle header', 'title,status, STATUS \nTitle,draft,published'],
    ['inconsistent row width', 'title,status\nTitle,published,extra'],
    ['unsupported status', 'title,status\nTitle,live'],
    ['header-only input', 'title,status\n'],
    ['NUL character', 'title,status\nTi\0tle,draft'],
  ])('fails closed for %s without sending the original file', async (_label, csv) => {
    renderDialog();
    upload(csv);
    expect(await screen.findByRole('alert')).toHaveTextContent('Preflight failed:');
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('fails closed on invalid UTF-8 instead of replacing corrupted content', async () => {
    renderDialog();
    upload(new File([new Uint8Array([0xff, 0xfe, 0x41])], 'invalid.csv', { type: 'text/csv' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('CSV must be valid UTF-8 text');
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('fails closed if the source cannot be read', async () => {
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function (this: FileReader) {
      this.dispatchEvent(new ProgressEvent('error'));
    });
    renderDialog();
    upload('title,status\nTitle,published');
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to read the CSV file. No upload was sent.');
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('does not fall back to the original file if sanitized file construction fails', async () => {
    const original = new File(['title,status\nTitle,published'], 'synthetic.csv', { type: 'text/csv' });
    vi.stubGlobal('File', vi.fn(function () { throw new Error('Synthetic file construction failure'); }));
    renderDialog();
    upload(original);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to prepare the sanitized CSV file');
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it.each(['publish flag', 'Founder role', 'session'])('uses current %s after reading, not stale eligibility', async change => {
    let reader!: FileReader;
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function (this: FileReader) {
      reader = this;
    });
    const { rerenderDialog } = renderDialog();
    const csv = 'title,status,scheduledAt\nTitle,published,2099-01-01T00:00:00Z';
    const original = upload(csv);
    await waitFor(() => expect(reader).toBeDefined());
    if (change === 'publish flag') mocks.publishEnabled = false;
    if (change === 'Founder role') mocks.role = 'editor';
    if (change === 'session') mocks.isAuthenticated = false;
    rerenderDialog();
    act(() => {
      Object.defineProperty(reader, 'result', { value: new TextEncoder().encode(csv).buffer });
      reader.dispatchEvent(new ProgressEvent('load'));
    });
    if (change === 'session') {
      expect(await screen.findByRole('alert')).toHaveTextContent('Your session is not ready');
      expect(mocks.post).not.toHaveBeenCalled();
    } else {
      expect(await uploadedText(original)).toBe('title,status,scheduledAt\r\nTitle,draft,\r\n');
    }
  });

  it.each([
    { isAuthenticated: false },
    { isReady: false },
    { isLoading: true },
    { isRestoring: true },
  ])('requires verified authentication and readiness: %j', flags => {
    Object.assign(mocks, flags);
    renderDialog();
    selectCsv('title,status\nTitle,published');
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('cancels reading when the dialog unmounts without uploading', async () => {
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(() => {});
    const abort = vi.spyOn(FileReader.prototype, 'abort').mockImplementation(function (this: FileReader) {
      this.dispatchEvent(new ProgressEvent('abort'));
    });
    const view = renderDialog();
    upload('title,status\nTitle,published');
    await waitFor(() => expect(FileReader.prototype.readAsArrayBuffer).toHaveBeenCalledTimes(1));
    await act(async () => view.unmount());
    expect(abort).toHaveBeenCalledTimes(1);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('locks the selected file and close action while pending and does not replay a completed upload', async () => {
    let complete!: (value: { data: BulkUploadResult }) => void;
    mocks.post.mockImplementation(() => new Promise(resolve => { complete = resolve; }));
    const { onDone } = renderDialog();
    const original = selectCsv('title,status\nTitle,draft');
    const button = screen.getByRole('button', { name: 'Upload' });
    fireEvent.click(button);
    fireEvent.click(button);
    await uploadedText(original);
    expect(screen.getByLabelText('CSV file')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Uploading\u2026' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => complete({ data: result }));
    expect(await screen.findByText(/created: 1, updated: 0, skipped: 0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Upload' }));
    expect(mocks.post).toHaveBeenCalledTimes(1);
    selectCsv(new File(['title,status\nAnother,draft'], 'another.csv', { type: 'text/csv' }));
    expect(screen.getByRole('button', { name: 'Upload' })).toBeEnabled();
  });

  it.each([
    [401, 'Your session has expired. Please sign in again.'],
    [403, 'Access denied. You do not have permission for this action.'],
    [409, 'The Backend reported an article conflict. Review the latest story before trying again.'],
  ])('surfaces HTTP %s without mutation retries or a success claim', async (status, message) => {
    mocks.post.mockRejectedValue({ response: { status, data: { message: 'Synthetic Backend-only detail' } } });
    renderDialog();
    upload('title,status\nTitle,draft');
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText(/created:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Synthetic Backend-only detail')).not.toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it.each(['Backend follow-up', 'list refresh'])('reports committed %s warnings without repeating the upload', async failure => {
    const { client } = renderDialog();
    if (failure === 'Backend follow-up') {
      mocks.post.mockResolvedValue({ data: { ...result, revalidation: { ok: false } } });
    } else {
      vi.spyOn(client, 'invalidateQueries').mockRejectedValue(new Error('Synthetic refresh failure'));
    }
    upload('title,status\nTitle,draft');
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not repeat/);
    expect(await screen.findByText(/created: 1, updated: 0, skipped: 0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it('keeps partial-result counts and row errors visible without replaying successful rows', async () => {
    mocks.post.mockResolvedValue({
      data: { created: 1, updated: 0, skipped: 1, errors: [{ row: 2, message: 'Synthetic row validation failure' }] },
    });
    renderDialog();
    upload('title,status\nFirst,draft\nSecond,draft');
    expect(await screen.findByText(/created: 1, updated: 0, skipped: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Synthetic row validation failure/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload' })).toBeDisabled();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });
});

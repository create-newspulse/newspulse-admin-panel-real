import { describe, it, expect } from 'vitest';
import { BulkCsvValidationError, sanitizeBulkCsv, sanitizeBulkRows } from '@/lib/bulkUploadGuard';

describe('bulkUploadGuard', () => {
  it('downgrades published when disabled', () => {
    const { rows, changed } = sanitizeBulkRows([{ title:'A', status:'published' }], { publishEnabled: false, isFounder: false });
    expect(rows[0].status).toBe('draft');
    expect(changed).toBe(1);
  });
  it('downgrades scheduled when disabled', () => {
    const { rows } = sanitizeBulkRows([{ title:'A', status:'scheduled', scheduledAt:'2025-01-01T00:00:00Z' }], { publishEnabled: false, isFounder: false });
    expect(rows[0].status).toBe('draft');
    expect(rows[0].scheduledAt).toBeUndefined();
  });
  it('keeps published if founder and enabled', () => {
    const { rows, changed } = sanitizeBulkRows([{ status:'published' }], { publishEnabled: true, isFounder: true });
    expect(rows[0].status).toBe('published');
    expect(changed).toBe(0);
  });
  it('maps schedule to scheduled for founder', () => {
    const { rows } = sanitizeBulkRows([{ status:'schedule' }], { publishEnabled: true, isFounder: true });
    expect(rows[0].status).toBe('scheduled');
  });
  it('downgrades published if not founder even when enabled', () => {
    const { rows } = sanitizeBulkRows([{ status:'published' }], { publishEnabled: true, isFounder: false });
    expect(rows[0].status).toBe('draft');
  });

  it.each([' PUBLISHED ', ' Schedule ', '\tSCHEDULED\t'])('normalizes and downgrades %s', status => {
    const source = { title: 'Synthetic story', status, scheduledAt: '2099-01-01T00:00:00Z' };
    const { rows, changed } = sanitizeBulkRows([source], { publishEnabled: true });
    expect(rows).toEqual([{ title: 'Synthetic story', status: 'draft' }]);
    expect(changed).toBe(1);
    expect(source).toEqual({ title: 'Synthetic story', status, scheduledAt: '2099-01-01T00:00:00Z' });
  });

  it.each(['draft', 'archived', 'deleted'])('clears protected timestamps even on a %s row', status => {
    const { rows, changed } = sanitizeBulkRows([{
      status,
      scheduledAt: '2099-01-01T00:00:00Z',
      publishAt: '2099-01-01T00:00:00Z',
      publishedAt: '2026-01-01T00:00:00Z',
    }], { publishEnabled: true, isFounder: false });
    expect(rows).toEqual([{ status }]);
    expect(changed).toBe(1);
  });
});

describe('CSV validation and serialization', () => {
  const restricted = { publishEnabled: false, isFounder: false };

  it.each(['\n', '\r\n', '\r'])('supports record separators %j, BOM and blank records', separator => {
    const input = '\uFEFF' + [
      '', 'title,status,custom', '', '"A, ""quoted"" title",published,', '',
    ].join(separator);
    expect(sanitizeBulkCsv(input, restricted)).toEqual({
      csv: 'title,status,custom\r\n"A, ""quoted"" title",draft,\r\n',
      changed: 1,
      rowCount: 1,
    });
  });

  it('preserves an omitted status column without dropping other columns', () => {
    expect(sanitizeBulkCsv('title,summary,scheduledAt\nHello,,2099-01-01T00:00:00Z', restricted)).toEqual({
      csv: 'title,summary,scheduledAt\r\nHello,,\r\n',
      changed: 1,
      rowCount: 1,
    });
  });

  it('preserves an empty status and normalizes lifecycle header spelling', () => {
    expect(sanitizeBulkCsv('title," STATUS "," PUBLISHEDAT "\nHello, ,2026-01-01T00:00:00Z', restricted)).toEqual({
      csv: 'title,status,publishedAt\r\nHello,,\r\n',
      changed: 1,
      rowCount: 1,
    });
  });

  it('preserves embedded line breaks, whitespace and string values without coercion', () => {
    const input = 'title,content,status,custom,trailing\n"  Title  ","<p>First\n\nSecond\r\nThird\rFourth</p>", DRAFT ,000001,';
    expect(sanitizeBulkCsv(input, restricted).csv).toBe(
      'title,content,status,custom,trailing\r\n"  Title  ","<p>First\n\nSecond\r\nThird\rFourth</p>",draft,000001,\r\n',
    );
  });

  it.each([
    ['empty input', ''],
    ['header only', '\uFEFFtitle,status\r\n'],
    ['empty header', 'title,,status\nTitle,,published'],
    ['duplicate status headers', 'title,status, STATUS \nTitle,draft,published'],
    ['duplicate date headers', 'title,scheduledAt,SCHEDULEDAT\nTitle,,'],
    ['extra field', 'title,status\nTitle,published,extra'],
    ['missing field', 'title,status\nTitle'],
    ['quote inside an unquoted field', 'title,status\nTi"tle,published'],
    ['unclosed quote', 'title,status\n"Title,published'],
    ['text after a closing quote', 'title,status\n"Title"oops,published'],
    ['unsupported status', 'title,status\nTitle,live'],
    ['NUL character', 'title,status\nTi\0tle,draft'],
    ['malformed later row', 'title,status\nSafe,draft\n"Unsafe,published'],
  ])('rejects %s instead of producing an upload', (_label, csv) => {
    expect(() => sanitizeBulkCsv(csv, restricted)).toThrow(BulkCsvValidationError);
  });
});

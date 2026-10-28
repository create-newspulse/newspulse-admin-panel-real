// Bulk upload guard: sanitize CSV-imported rows to prevent unintended publish
// and scheduling when runtime publish flag is disabled or role insufficient.

export interface BulkRow {
  title?: string; summary?: string; content?: string; category?: string; tags?: string;
  imageUrl?: string; sourceName?: string; sourceUrl?: string; language?: string;
  status?: string; scheduledAt?: string; publishAt?: string; publishedAt?: string;
}

export interface BulkGuardContext {
  publishEnabled: boolean;
  isFounder?: boolean;
}

export interface BulkSanitizeResult { rows: BulkRow[]; changed: number; }

const timestampFields = ['scheduledAt', 'publishAt', 'publishedAt'] as const;
const lifecycleFields = ['status', ...timestampFields] as const;
const csvStatuses = ['draft', 'published', 'schedule', 'scheduled', 'archived', 'deleted'];

export function sanitizeBulkRows(rows: BulkRow[], ctx: BulkGuardContext): BulkSanitizeResult {
  let changed = 0;
  const out = rows.map(r => {
    const copy: BulkRow = { ...r };
    const st = (copy.status || '').trim().toLowerCase();
    const publishLike = st === 'published' || st === 'schedule' || st === 'scheduled';
    if (copy.status !== undefined) copy.status = st === 'schedule' ? 'scheduled' : st;
    if (!ctx.publishEnabled || !ctx.isFounder) {
      if (publishLike || timestampFields.some(field => Boolean(copy[field]))) changed++;
      if (publishLike) copy.status = 'draft';
      for (const field of timestampFields) delete copy[field];
    }
    return copy;
  });
  return { rows: out, changed };
}

export class BulkCsvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkCsvValidationError';
  }
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  let started = false;
  const finishRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = '';
    closedQuote = false;
    started = false;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      if (field.length > 0 || closedQuote) {
        throw new BulkCsvValidationError('Malformed CSV: quotes must enclose the entire field.');
      }
      quoted = true;
      started = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
      closedQuote = false;
      started = true;
    } else if (char === '\r' || char === '\n') {
      if (started || row.length > 0) finishRow();
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else {
      if (closedQuote) {
        throw new BulkCsvValidationError('Malformed CSV: unexpected text after a closing quote.');
      }
      field += char;
      started = true;
    }
  }
  if (quoted) throw new BulkCsvValidationError('Malformed CSV: an enclosing quote is missing.');
  if (started || row.length > 0) finishRow();
  return rows;
}

function serializeCsvField(value: string): string {
  return /[",\r\n]|^\s|\s$/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function sanitizeBulkCsv(text: string, ctx: BulkGuardContext): {
  csv: string; changed: number; rowCount: number;
} {
  if (text.includes('\0')) {
    throw new BulkCsvValidationError('CSV must be UTF-8 text without NUL characters.');
  }
  const [rawHeader, ...dataRows] = parseCsv(text.replace(/^\uFEFF/, ''));
  if (!rawHeader || dataRows.length === 0) {
    throw new BulkCsvValidationError('CSV must contain a header and at least one data row.');
  }

  const seen = new Set<string>();
  const header = rawHeader.map(name => {
    const key = name.trim().toLowerCase();
    if (!key || seen.has(key)) {
      throw new BulkCsvValidationError('CSV headers must be nonempty and unique, ignoring case and surrounding spaces.');
    }
    seen.add(key);
    return lifecycleFields.find(field => field.toLowerCase() === key) ?? name;
  });
  dataRows.forEach((row, index) => {
    if (row.length !== header.length) {
      throw new BulkCsvValidationError(`CSV data row ${index + 1} must have ${header.length} fields. Check commas and quoting.`);
    }
  });

  const columns = lifecycleFields.map(field => ({ field, index: header.indexOf(field) }));
  const controls = dataRows.map((row, index) => {
    const control: BulkRow = {};
    for (const column of columns) {
      if (column.index >= 0) control[column.field] = row[column.index];
    }
    const status = control.status?.trim().toLowerCase();
    if (status && !csvStatuses.includes(status)) {
      throw new BulkCsvValidationError(`CSV data row ${index + 1} has an unsupported status.`);
    }
    return control;
  });
  const sanitized = sanitizeBulkRows(controls, ctx);
  const output = dataRows.map((row, index) => {
    const copy = [...row];
    // Rewrite only lifecycle cells; retain every other column and value verbatim.
    for (const column of columns) {
      if (column.index >= 0) copy[column.index] = sanitized.rows[index][column.field] ?? '';
    }
    return copy;
  });
  return {
    csv: [header, ...output].map(row => row.map(serializeCsvField).join(',')).join('\r\n') + '\r\n',
    changed: sanitized.changed,
    rowCount: dataRows.length,
  };
}

// Bulk upload guard: sanitize CSV-imported rows to prevent unintended publish
// and scheduling when runtime publish flag is disabled or role insufficient.

export interface BulkRow {
  title?: string; summary?: string; content?: string; category?: string; tags?: string;
  imageUrl?: string; sourceName?: string; sourceUrl?: string; language?: string;
  status?: string; scheduledAt?: string;
}

export interface BulkGuardContext {
  publishEnabled: boolean;
  isFounder?: boolean;
}

export interface BulkSanitizeResult { rows: BulkRow[]; changed: number; }

export function sanitizeBulkRows(rows: BulkRow[], ctx: BulkGuardContext): BulkSanitizeResult {
  let changed = 0;
  const out = rows.map(r => {
    const copy: BulkRow = { ...r };
    // Normalize status casing
    const st = (copy.status || '').toLowerCase();
    const publishLike = st === 'published' || st === 'schedule' || st === 'scheduled';
    if (publishLike) {
      if (!ctx.publishEnabled || !ctx.isFounder) {
        copy.status = 'draft';
        if (copy.scheduledAt) delete copy.scheduledAt;
        changed++;
      } else if (st === 'schedule') {
        // Map 'schedule' to 'scheduled'
        copy.status = 'scheduled';
      }
    }
    return copy;
  });
  return { rows: out, changed };
}

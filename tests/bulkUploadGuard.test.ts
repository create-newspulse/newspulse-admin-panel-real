import { describe, it, expect } from 'vitest';
import { sanitizeBulkRows } from '@/lib/bulkUploadGuard';

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
});

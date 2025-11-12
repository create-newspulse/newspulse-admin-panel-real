import { describe, it, expect } from 'vitest';
import * as path from 'path';

// Dynamically import the CommonJS router module to access buildFilter
// eslint-disable-next-line @typescript-eslint/no-var-requires
const articlesModule = require(path.join(process.cwd(), 'admin-backend', 'backend', 'routes', 'articles.js'));

const buildFilter = articlesModule.buildFilter;

describe('buildFilter', () => {
  it('applies text search', () => {
    const f = buildFilter({ q: 'economy' });
    expect(f.$text).toEqual({ $search: 'economy' });
  });
  it('handles category list', () => {
    const f = buildFilter({ category: 'Breaking,Business' });
    expect(f.category.$in).toContain('Breaking');
    expect(f.category.$in).toContain('Business');
  });
  it('adds createdAt range', () => {
    const f = buildFilter({ from: '2024-01-01', to: '2024-01-31' });
    expect(f.createdAt.$gte).toBeInstanceOf(Date);
    expect(f.createdAt.$lte).toBeInstanceOf(Date);
  });
  it('empty query returns empty filter object', () => {
    const f = buildFilter({});
    expect(Object.keys(f).length).toBe(0);
  });
});

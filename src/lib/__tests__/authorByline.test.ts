import { describe, expect, it } from 'vitest';
import { buildAuthorBylinePayload, restoreAuthorByline, validateAuthorPhotoUrl } from '@/lib/authorByline';

const saved = {
  enabled: true,
  snapshot: { name: 'Shailesh Rathod', publicDesignation: 'Independent Writer', photoUrl: '/uploads/author.jpg', shortBio: 'Public author biography.' },
};

describe('author byline contract', () => {
  it('defaults off and disables without stale snapshot fields', () => {
    expect(restoreAuthorByline()).toEqual({ enabled: false });
    expect(buildAuthorBylinePayload({ ...saved, enabled: false }, saved)).toEqual({ enabled: false });
  });

  it('requires only name and omits empty optional fields for creation', () => {
    expect(() => buildAuthorBylinePayload({ enabled: true })).toThrow('Author Name is required');
    expect(buildAuthorBylinePayload({ enabled: true, snapshot: { name: ' Shailesh Rathod ', shortBio: '', photoUrl: '', publicDesignation: ' ' } }))
      .toEqual({ enabled: true, snapshot: { name: 'Shailesh Rathod' } });
    expect(buildAuthorBylinePayload(saved)).toEqual(saved);
  });

  it('restores existing author fields and omits unchanged or reverted updates', () => {
    expect(restoreAuthorByline(saved)).toEqual(saved);
    expect(buildAuthorBylinePayload(saved, saved)).toBeUndefined();
    expect(buildAuthorBylinePayload({ ...saved, snapshot: { ...saved.snapshot, name: ' Shailesh Rathod ' } }, saved)).toBeUndefined();
    expect(buildAuthorBylinePayload({ enabled: false }, null)).toBeUndefined();
  });

  it.each(['name', 'publicDesignation', 'shortBio', 'photoUrl'] as const)('replaces the complete snapshot when %s changes', (field) => {
    const snapshot = { ...saved.snapshot, [field]: field === 'photoUrl' ? '/uploads/replaced.jpg' : 'Updated text' };
    expect(buildAuthorBylinePayload({ enabled: true, snapshot }, saved)).toEqual({ enabled: true, snapshot });
  });

  it.each(['publicDesignation', 'shortBio', 'photoUrl'] as const)('omits cleared %s from the complete replacement', (field) => {
    const snapshot: Record<string, string> = { ...saved.snapshot };
    delete snapshot[field];
    expect(buildAuthorBylinePayload({ ...saved, snapshot: { ...saved.snapshot, [field]: '' } }, saved)).toEqual({ enabled: true, snapshot });
  });

  it('clears all optional fields with a name-only replacement', () => {
    expect(buildAuthorBylinePayload({ enabled: true, snapshot: { name: saved.snapshot.name } }, saved))
      .toEqual({ enabled: true, snapshot: { name: saved.snapshot.name } });
  });

  it.each([{ name: 'x'.repeat(161) }, { publicDesignation: 'x'.repeat(161) }, { shortBio: 'x'.repeat(601) }])('enforces field limits: %j', (fields) => {
    expect(() => buildAuthorBylinePayload({ enabled: true, snapshot: { name: 'Author', ...fields } })).toThrow();
  });

  it.each(['/uploads/author.jpg', 'https://example.test/author.jpg', 'http://localhost:5000/uploads/author.jpg'])('accepts stored image URL/path %s', (url) => {
    expect(() => validateAuthorPhotoUrl(url)).not.toThrow();
  });

  it.each(['//external.test/author.jpg', '/\\external.test/photo.jpg', 'javascript:alert(1)', 'data:image/png;base64,test', 'blob:temporary', 'not a url'])('rejects unsafe or temporary photo reference %s', (url) => {
    expect(() => validateAuthorPhotoUrl(url)).toThrow();
  });
});
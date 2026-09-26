export type AuthorByline = {
  enabled: boolean;
  snapshot?: {
    name?: string;
    publicDesignation?: string;
    photoUrl?: string;
    shortBio?: string;
  };
};

export type AuthorBylineRequest =
  | { enabled: false }
  | { enabled: true; snapshot: { name: string; publicDesignation?: string; photoUrl?: string; shortBio?: string } };

export function restoreAuthorByline(value?: AuthorByline | null): AuthorByline {
  if (!value?.enabled) return { enabled: false };
  return {
    enabled: true,
    snapshot: {
      name: value.snapshot?.name || '',
      publicDesignation: value.snapshot?.publicDesignation,
      photoUrl: value.snapshot?.photoUrl,
      shortBio: value.snapshot?.shortBio,
    },
  };
}

function currentSnapshot(value?: AuthorByline['snapshot']) {
  const publicDesignation = value?.publicDesignation?.trim();
  const photoUrl = value?.photoUrl?.trim();
  const shortBio = value?.shortBio?.trim();
  return {
    name: value?.name?.trim() || '',
    ...(publicDesignation ? { publicDesignation } : {}),
    ...(photoUrl ? { photoUrl } : {}),
    ...(shortBio ? { shortBio } : {}),
  };
}

export function validateAuthorPhotoUrl(photoUrl: string): void {
  if (!photoUrl) return;
  if (photoUrl.length > 2048) throw new Error('Author photo URL must be 2048 characters or fewer.');
  const localPath = photoUrl.startsWith('/') && !photoUrl.startsWith('//');
  let valid = localPath;
  if (!localPath) {
    try { valid = ['http:', 'https:'].includes(new URL(photoUrl).protocol); } catch {}
  }
  if (!valid || /[\\\u0000-\u001f\u007f]/.test(photoUrl)) {
    throw new Error('Author photo must be an HTTP(S) URL or a local upload path.');
  }
}

export function buildAuthorBylinePayload(value: AuthorByline, saved?: AuthorByline | null): AuthorBylineRequest | undefined {
  const snapshot = currentSnapshot(value.snapshot);
  if (saved !== undefined && Boolean(saved?.enabled) === value.enabled) {
    if (!value.enabled || JSON.stringify(snapshot) === JSON.stringify(currentSnapshot(saved?.snapshot))) return undefined;
  }
  if (!value.enabled) return { enabled: false };
  if (!snapshot.name) throw new Error('Author Name is required when Author Byline is on.');
  if (snapshot.name.length > 160) throw new Error('Author name must be 160 characters or fewer.');
  if ((snapshot.publicDesignation?.length || 0) > 160) throw new Error('Public designation must be 160 characters or fewer.');
  if ((snapshot.shortBio?.length || 0) > 600) throw new Error('Short bio must be 600 characters or fewer.');
  validateAuthorPhotoUrl(snapshot.photoUrl || '');
  return { enabled: true, snapshot };
}
export type SponsoredContentPlacement = 'homepage_sponsored_feature';

export type SponsoredFeatureCoverImageAsset = {
  url: string;
  publicId?: string | null;
  alt?: string | null;
};

export type SponsoredLinkedArticleRecord = {
  id: string;
  title?: string | null;
  slug?: string | null;
  language?: string | null;
  publicUrl?: string | null;
};

export type SponsoredFeatureInventoryRecord = {
  id: string;
  type: 'sponsored_feature';
  placement: SponsoredContentPlacement;
  placementKey?: string | null;
  sponsorName: string;
  internalCampaignName: string;
  headline: string;
  shortSummary: string;
  ctaText: string;
  destinationUrl: string;
  coverImage: string;
  coverImageAsset?: SponsoredFeatureCoverImageAsset | null;
  optionalLinkedSponsoredArticleId?: string | null;
  linkedSponsoredArticleTitle?: string | null;
  linkedSponsoredArticleUrl?: string | null;
  linkedSponsoredArticleSlug?: string | null;
  linkedSponsoredArticleLanguage?: string | null;
  linkedArticle?: SponsoredLinkedArticleRecord | null;
  publicClickTarget?: string | null;
  isActive: boolean;
  comboCampaignIsActive?: boolean;
  startAt?: string | null;
  endAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  legacyAdId?: string | null;
  labelText?: string | null;
  priority?: number | null;
};

export const SPONSORED_CONTENT_STORAGE_KEY = 'np:ads-manager:sponsored-content:v1';

export function normalizeSponsoredContentPlacement(value: unknown): SponsoredContentPlacement | '' {
  const raw = String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (!raw) return '';
  if (raw === 'homepage_sponsored_feature') return 'homepage_sponsored_feature';
  if (raw === 'home_page_sponsored_feature') return 'homepage_sponsored_feature';
  return '';
}

export function createSponsoredFeatureId() {
  return `sponsored_feature_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCoverImageAsset(value: unknown): SponsoredFeatureCoverImageAsset | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const url = String(value).trim();
    return url ? { url, publicId: null, alt: null } : null;
  }
  if (typeof value !== 'object' || Array.isArray(value)) return null;

  const payload = value as Record<string, unknown>;
  const url = String(payload.url ?? payload.src ?? '').trim();
  if (!url) return null;

  return {
    url,
    publicId: String(payload.publicId ?? '').trim() || null,
    alt: String(payload.alt ?? '').trim() || null,
  };
}

function normalizeLanguage(value: unknown): 'en' | 'hi' | 'gu' {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'hi' || raw === 'hindi' || raw === 'in') return 'hi';
  if (raw === 'gu' || raw === 'gujarati') return 'gu';
  return 'en';
}

function buildPublicNewsUrl(id: unknown, slug?: unknown, language?: unknown): string | null {
  const rawId = String(id ?? '').trim();
  const rawSlug = String(slug ?? '').trim();
  const token = rawSlug || rawId;
  if (!token) return null;
  const prefix = normalizeLanguage(language) === 'en' ? '' : `/${normalizeLanguage(language)}`;
  return `${prefix}/news/${encodeURIComponent(token)}`;
}

export function normalizeSponsoredFeatureRecord(raw: unknown): SponsoredFeatureInventoryRecord | null {
  if (!raw || typeof raw !== 'object') return null;

  const payload = raw as Record<string, unknown>;
  const id = String(payload.id ?? '').trim();
  if (!id) return null;

  const coverImageAsset = normalizeCoverImageAsset(payload.coverImage ?? payload.imageUrl);
  const linkedArticlePayload = payload.linkedArticle && typeof payload.linkedArticle === 'object' && !Array.isArray(payload.linkedArticle)
    ? payload.linkedArticle as Record<string, unknown>
    : null;
  const linkedArticleId = String(
    payload.optionalLinkedSponsoredArticleId
    ?? payload.linkedSponsoredArticleId
    ?? payload.linkedArticleId
    ?? linkedArticlePayload?.id
    ?? ''
  ).trim() || null;
  const linkedArticleSlug = String(linkedArticlePayload?.slug ?? payload.linkedSponsoredArticleSlug ?? '').trim() || null;
  const linkedArticleLanguage = String(linkedArticlePayload?.language ?? '').trim() || null;
  const linkedArticlePublicUrl = buildPublicNewsUrl(linkedArticleId, linkedArticleSlug, linkedArticleLanguage);
  const linkedArticleTitle = String(
    payload.linkedSponsoredArticleTitle
    ?? linkedArticlePayload?.title
    ?? ''
  ).trim() || null;
  const linkedArticleUrl = String(
    payload.linkedSponsoredArticleUrl
    ?? payload.linkedArticleUrl
    ?? linkedArticlePublicUrl
    ?? ''
  ).trim() || null;
  const destinationUrl = String(payload.destinationUrl ?? '').trim();
  const comboCampaignIsActive = payload.comboCampaignIsActive === undefined
    ? !((payload.comboCampaign && typeof payload.comboCampaign === 'object' && (payload.comboCampaign as Record<string, unknown>).isActive === false)
      || (payload.commercialState && typeof payload.commercialState === 'object'
        && (payload.commercialState as Record<string, unknown>).comboCampaign
        && typeof ((payload.commercialState as Record<string, unknown>).comboCampaign) === 'object'
        && ((((payload.commercialState as Record<string, unknown>).comboCampaign) as Record<string, unknown>).isEnabled === false)))
    : Boolean(payload.comboCampaignIsActive);
  const publicClickTarget = comboCampaignIsActive && linkedArticlePublicUrl
    ? linkedArticlePublicUrl
    : (destinationUrl || linkedArticleUrl || null);

  return {
    id,
    type: 'sponsored_feature',
    placement: normalizeSponsoredContentPlacement(payload.placement) || 'homepage_sponsored_feature',
    placementKey: String(payload.placementKey ?? '').trim() || null,
    sponsorName: String(payload.sponsorName ?? '').trim(),
    internalCampaignName: String(payload.internalCampaignName ?? payload.internalTitle ?? '').trim(),
    headline: String(payload.headline ?? '').trim(),
    shortSummary: String(payload.shortSummary ?? payload.summary ?? '').trim(),
    ctaText: String(payload.ctaText ?? '').trim(),
    destinationUrl,
    coverImage: coverImageAsset?.url || '',
    coverImageAsset,
    optionalLinkedSponsoredArticleId: linkedArticleId,
    linkedSponsoredArticleTitle: linkedArticleTitle,
    linkedSponsoredArticleUrl: linkedArticleUrl,
    linkedSponsoredArticleSlug: linkedArticleSlug,
    linkedSponsoredArticleLanguage: linkedArticleLanguage,
    linkedArticle: linkedArticleId
      ? {
          id: linkedArticleId,
          title: linkedArticleTitle,
          slug: linkedArticleSlug,
          language: linkedArticleLanguage,
          publicUrl: linkedArticlePublicUrl,
        }
      : null,
    publicClickTarget,
    isActive: Boolean(payload.isActive),
    comboCampaignIsActive,
    startAt: String(payload.startAt ?? '').trim() || null,
    endAt: String(payload.endAt ?? '').trim() || null,
    createdAt: String(payload.createdAt ?? '').trim() || null,
    updatedAt: String(payload.updatedAt ?? '').trim() || null,
    legacyAdId: String(payload.legacyAdId ?? '').trim() || null,
    labelText: String(payload.labelText ?? '').trim() || null,
    priority: Number.isFinite(Number(payload.priority)) ? Number(payload.priority) : null,
  };
}

export function sortSponsoredFeatureInventory(records: SponsoredFeatureInventoryRecord[]): SponsoredFeatureInventoryRecord[] {
  return [...records].sort((left, right) => {
    const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
    const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

export function readSponsoredFeatureInventory(storage?: Pick<Storage, 'getItem'> | null): SponsoredFeatureInventoryRecord[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(SPONSORED_CONTENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortSponsoredFeatureInventory(
      parsed
        .map((item) => normalizeSponsoredFeatureRecord(item))
        .filter((item): item is SponsoredFeatureInventoryRecord => Boolean(item))
    );
  } catch {
    return [];
  }
}

export function writeSponsoredFeatureInventory(
  records: SponsoredFeatureInventoryRecord[],
  storage?: Pick<Storage, 'setItem'> | null,
) {
  if (!storage) return;
  storage.setItem(SPONSORED_CONTENT_STORAGE_KEY, JSON.stringify(sortSponsoredFeatureInventory(records)));
}
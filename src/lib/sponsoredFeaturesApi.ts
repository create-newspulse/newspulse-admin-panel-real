import { listArticles, updateArticlePartial, type Article } from '@/lib/api/articles';
import { adminApiClient } from '@/lib/adminApiClient';
import {
  normalizeSponsoredFeatureRecord,
  sortSponsoredFeatureInventory,
  type SponsoredFeatureInventoryRecord,
} from '@/lib/sponsoredContentInventory';

export type SponsoredArticleOption = {
  id: string;
  title: string;
  slug?: string;
  status?: string;
  language?: string;
  publicUrl?: string;
  sponsorDisclosure?: string;
  sponsorCtaText?: string;
  sponsorCtaUrl?: string;
  sponsorFeatureLinkedId?: string | null;
};

export type SponsoredFeatureInput = {
  sponsorName: string;
  headline: string;
  shortSummary: string;
  ctaText: string;
  coverImage: string;
  destinationUrl: string;
  linkedSponsoredArticleId?: string | null;
  linkedSponsoredArticleTitle?: string | null;
  linkedSponsoredArticleUrl?: string | null;
  isActive: boolean;
  comboCampaignIsActive?: boolean;
  startAt?: string | null;
  endAt?: string | null;
  internalCampaignName?: string | null;
};

const SPONSORED_FEATURES_PATH = 'admin/sponsored-features';
const HOMEPAGE_SPONSORED_FEATURE_KEY = 'HOMEPAGE_SPONSORED_FEATURE';

function normalizeArticleLanguage(article: Article): 'en' | 'hi' | 'gu' {
  const raw = String(article.language || article.lang || '').trim().toLowerCase();
  if (raw === 'hi' || raw === 'hindi' || raw === 'in') return 'hi';
  if (raw === 'gu' || raw === 'gujarati') return 'gu';
  return 'en';
}

function buildPublicArticleUrl(article: Pick<Article, '_id' | 'slug' | 'language' | 'lang'>): string | undefined {
  const token = String(article.slug || article._id || '').trim();
  if (!token) return undefined;
  const language = normalizeArticleLanguage(article);
  const prefix = language === 'en' ? '' : `/${language}`;
  return `${prefix}/news/${encodeURIComponent(token)}`;
}

function getErrorMessage(error: any, fallback: string): string {
  return String(
    error?.response?.data?.message
    || error?.response?.data?.error
    || error?.message
    || fallback
  ).trim() || fallback;
}

function normalizeStatus(article: Article): string | undefined {
  const raw = String(article.status || article.state || article.publishStatus || '').trim();
  return raw || undefined;
}

function isSponsoredArticleRecord(article: Article): boolean {
  if (!article) return false;
  if (article.isSponsored === true || article.sponsored === true) return true;

  const tags = Array.isArray((article as any).tags) ? (article as any).tags : [];
  return tags.some((tag: unknown) => {
    const normalized = String(tag || '').trim().toLowerCase();
    return normalized === 'sponsored' || normalized === 'sponsored-article';
  });
}

function isPublishedArticleRecord(article: Article): boolean {
  const normalized = String(article.status || article.state || article.publishStatus || '').trim().toLowerCase();
  return article.isPublished === true || normalized === 'published' || normalized === 'live' || normalized === 'public';
}

function normalizeSponsoredFeatureList(items: unknown): SponsoredFeatureInventoryRecord[] {
  if (!Array.isArray(items)) return [];
  return sortSponsoredFeatureInventory(
    items
      .map((item) => normalizeSponsoredFeatureRecord(item))
      .filter((item): item is SponsoredFeatureInventoryRecord => Boolean(item))
  );
}

export async function listSponsoredFeatures(): Promise<SponsoredFeatureInventoryRecord[]> {
  const res = await adminApiClient.get(SPONSORED_FEATURES_PATH, {
    params: { placementKey: HOMEPAGE_SPONSORED_FEATURE_KEY },
  });
  return normalizeSponsoredFeatureList(res?.data?.items);
}

function buildSponsoredFeaturePayload(input: SponsoredFeatureInput) {
  const sponsorName = String(input.sponsorName || '').trim();
  const headline = String(input.headline || '').trim();
  const internalTitle = String(input.internalCampaignName || '').trim() || headline || sponsorName;
  const summary = String(input.shortSummary || '').trim();
  const ctaText = String(input.ctaText || '').trim();
  const coverImageUrl = String(input.coverImage || '').trim();
  const destinationUrl = String(input.destinationUrl || '').trim();
  const linkedArticleId = String(input.linkedSponsoredArticleId || '').trim();
  const linkedArticleUrl = String(input.linkedSponsoredArticleUrl || '').trim();

  return {
    placementKey: HOMEPAGE_SPONSORED_FEATURE_KEY,
    sponsorName,
    internalTitle,
    headline,
    summary,
    ctaText,
    destinationUrl: destinationUrl || null,
    coverImage: {
      url: coverImageUrl,
      publicId: null,
      alt: headline || sponsorName || null,
    },
    isActive: Boolean(input.isActive),
    comboCampaign: {
      isActive: input.comboCampaignIsActive !== false,
    },
    linkedArticleId: linkedArticleId || null,
    linkedArticleUrl: linkedArticleUrl || null,
    startAt: String(input.startAt || '').trim() || null,
    endAt: String(input.endAt || '').trim() || null,
    labelText: 'Sponsored Feature',
    priority: 0,
  };
}

async function setOtherSponsoredFeaturesInactive(activeId: string) {
  if (!activeId) return;
  const current = await listSponsoredFeatures();
  const activeOthers = current.filter((feature) => feature.isActive && feature.id !== activeId);
  for (const feature of activeOthers) {
    await adminApiClient.patch(`${SPONSORED_FEATURES_PATH}/${encodeURIComponent(feature.id)}/toggle`, { isActive: false });
  }
}

export async function saveSponsoredFeature(
  input: SponsoredFeatureInput,
  existingId?: string | null,
): Promise<SponsoredFeatureInventoryRecord[]> {
  const payload = buildSponsoredFeaturePayload(input);
  try {
    const res = existingId
      ? await adminApiClient.put(`${SPONSORED_FEATURES_PATH}/${encodeURIComponent(existingId)}`, payload)
      : await adminApiClient.post(SPONSORED_FEATURES_PATH, payload);
    const featureId = String(res?.data?.feature?.id || '').trim();
    if (payload.isActive && featureId) {
      await setOtherSponsoredFeaturesInactive(featureId);
    }
    return await listSponsoredFeatures();
  } catch (error: any) {
    throw new Error(getErrorMessage(error, existingId ? 'Failed to update Sponsored Feature' : 'Failed to create Sponsored Feature'));
  }
}

export async function deleteSponsoredFeature(id: string): Promise<SponsoredFeatureInventoryRecord[]> {
  try {
    await adminApiClient.delete(`${SPONSORED_FEATURES_PATH}/${encodeURIComponent(id)}`);
    return await listSponsoredFeatures();
  } catch (error: any) {
    throw new Error(getErrorMessage(error, 'Failed to delete Sponsored Feature'));
  }
}

export async function setSponsoredFeatureActive(
  id: string,
  isActive: boolean,
): Promise<SponsoredFeatureInventoryRecord[]> {
  try {
    await adminApiClient.patch(`${SPONSORED_FEATURES_PATH}/${encodeURIComponent(id)}/toggle`, { isActive });
    if (isActive) {
      await setOtherSponsoredFeaturesInactive(id);
    }
    return await listSponsoredFeatures();
  } catch (error: any) {
    throw new Error(getErrorMessage(error, 'Failed to update Sponsored Feature status'));
  }
}

export async function setSponsoredFeatureComboActive(
  id: string,
  isActive: boolean,
): Promise<SponsoredFeatureInventoryRecord[]> {
  try {
    await adminApiClient.patch(`${SPONSORED_FEATURES_PATH}/${encodeURIComponent(id)}/combo-toggle`, { isActive });
    return await listSponsoredFeatures();
  } catch (error: any) {
    throw new Error(getErrorMessage(error, 'Failed to update Combo Campaign status'));
  }
}

export async function setSponsoredArticleVisibility(
  articleId: string,
  isVisible: boolean,
): Promise<SponsoredArticleOption[]> {
  const id = String(articleId || '').trim();
  if (!id) throw new Error('Sponsored Article id is required');

  try {
    await updateArticlePartial(id, {
      status: isVisible ? 'published' : 'draft',
      ...(isVisible ? { publishedAt: new Date().toISOString() } : { publishedAt: null, publishAt: null, scheduledAt: null }),
      isSponsored: true,
      isSponsoredArticle: true,
    } as any);
    return await listSponsoredArticleInventory();
  } catch (error: any) {
    throw new Error(getErrorMessage(error, isVisible ? 'Failed to turn Sponsored Article on' : 'Failed to turn Sponsored Article off'));
  }
}

export async function listSponsoredArticleInventory(): Promise<SponsoredArticleOption[]> {
  const result = await listArticles({ page: 1, limit: 250, sort: '-updatedAt', status: 'all' });
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  return rows
    .filter((article) => isSponsoredArticleRecord(article))
    .map((article) => ({
      id: String(article._id || '').trim(),
      title: String(article.title || 'Untitled').trim() || 'Untitled',
      slug: String(article.slug || '').trim() || undefined,
      status: normalizeStatus(article),
      language: normalizeArticleLanguage(article),
      publicUrl: buildPublicArticleUrl(article),
      sponsorDisclosure: String(article.sponsorDisclosure || '').trim() || undefined,
      sponsorCtaText: String(article.sponsorCtaText || '').trim() || undefined,
      sponsorCtaUrl: String(article.sponsorCtaUrl || '').trim() || undefined,
      sponsorFeatureLinkedId: String(article.sponsorFeatureLinkedId || '').trim() || null,
    }))
    .filter((article) => article.id);
}

export async function listEligibleSponsoredArticles(): Promise<SponsoredArticleOption[]> {
  const inventory = await listSponsoredArticleInventory();
  return inventory.filter((article) => isPublishedArticleRecord(article as Article));
}
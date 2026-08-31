import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createArticle, updateArticle, getArticle, publishArticle, retryArticleTranslation, requeueArticleTranslations, listArticlesByTranslationGroupId, type Article } from '@/lib/api/articles';
import apiClient from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@context/AuthContext';
import { verifyLanguage, readability } from '@/lib/api/language';
import TagInput from '@/components/ui/TagInput';
import Accordion, { type AccordionItem } from '@/components/ui/Accordion';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { uniqueSlug } from '@/lib/slug';
import { readingTimeSec } from '@/lib/readtime';
import RichTextEditor from '@/components/editor/RichTextEditor';
import { usePublishFlag } from '@/context/PublishFlagContext';
import { normalizeError } from '@/lib/error';
import PreviewModal from '@/components/preview/PreviewModal';
import { buildSlugSuggestions, checkSlugAvailability } from '@/lib/slugAvailability';
import CoverImageUpload from '@/components/articles/CoverImageUpload';
import MediaLibrarySelector, { type MediaLibraryAsset } from '@/components/media/MediaLibrarySelector';
import { getMediaStatus, uploadCoverImage } from '@/lib/api/media';
import { ARTICLE_CATEGORY_OPTIONS, isAllowedArticleCategoryKey, normalizeArticleCategoryKey } from '@/lib/articleCategories';
import { generateArticleSlug } from '@/lib/articleSlug';
import { stripHtmlToText } from '@/lib/richText';
import { YOUTH_PULSE_TRACK_OPTIONS, YOUTH_PULSE_TRACK_LABELS, normalizeYouthPulseTrack, type YouthPulseTrack } from '@/lib/youthPulseTracks';

type LangCode = 'en' | 'hi' | 'gu';
type EditorialType = 'editorial' | 'special_story';
const DEFAULT_CREATE_LANGUAGE: LangCode = 'gu';
const ARTICLE_LANGUAGE_CODES = ['en', 'hi', 'gu'] as const;
const ARTICLE_LANGUAGE_LABELS: Record<LangCode, string> = {
  en: 'English',
  hi: 'Hindi',
  gu: 'Gujarati',
};

type ArticleLanguageDraft = {
  title: string;
  slug: string;
  summary: string;
  content: string;
};

type ArticleLanguageReviewFields = {
  imageAltText: string;
  seoTitle: string;
  metaDescription: string;
};

const EMPTY_LANGUAGE_DRAFT: ArticleLanguageDraft = {
  title: '',
  slug: '',
  summary: '',
  content: '',
};

const EMPTY_LANGUAGE_REVIEW_FIELDS: ArticleLanguageReviewFields = {
  imageAltText: '',
  seoTitle: '',
  metaDescription: '',
};

function hasAnyLanguageDraftContent(draft: ArticleLanguageDraft | null | undefined): boolean {
  if (!draft) return false;
  return !!(draft.title.trim() || draft.slug.trim() || draft.summary.trim() || draft.content.trim());
}

function isLanguageDraftComplete(draft: ArticleLanguageDraft | null | undefined): boolean {
  if (!draft) return false;
  return !!(draft.title.trim() && draft.summary.trim() && draft.content.trim());
}

function getArticleDraftFromRecord(record: any): ArticleLanguageDraft {
  return {
    title: String(record?.title || ''),
    slug: String(record?.slug || ''),
    summary: String(record?.summary || record?.description || ''),
    content: String(record?.content ?? record?.body ?? ''),
  };
}

function getArticleReviewFieldsFromRecord(record: any): ArticleLanguageReviewFields {
  return {
    imageAltText: String(record?.imageAltText ?? record?.imageAlt ?? record?.altText ?? record?.coverImageAlt ?? ''),
    seoTitle: String(record?.seoTitle ?? record?.metaTitle ?? ''),
    metaDescription: String(record?.metaDescription ?? record?.seoDescription ?? ''),
  };
}

function createTranslationGroupId(seed: string): string {
  const base = generateArticleSlug({ title: seed || 'article' }) || 'article';
  return `${base}-${Date.now().toString(36)}`;
}

function normalizeEditorialType(input: any): EditorialType {
  const v = String(input || '').trim().toLowerCase();
  return v === 'special_story' ? 'special_story' : 'editorial';
}

function isArticleEditorDebugEnabled(): boolean {
  try {
    const w: any = window as any;
    if (w && w.__np_debug_article_editor) return true;
  } catch {}
  try {
    return localStorage.getItem('np_debug_article_editor') === '1';
  } catch {
    return false;
  }
}

function logArticleEditorDebug(label: string, payload: Record<string, any>): void {
  if (!isArticleEditorDebugEnabled()) return;
  console.log(`[ArticleForm] ${label}`, payload);
}

function getRelatedArticleIds(input: any): string[] {
  const values = [
    input?.linkedArticleId,
    input?.articleId,
    input?.id,
    input?._id,
  ];
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function normalizeLang(input: any): LangCode {
  const v = String(input || '').trim().toLowerCase();
  if (v === 'en' || v === 'hi' || v === 'gu') return v;
  return 'en';
}

function getVariantStatus(input: any): string {
  if (!input) return '';
  const raw = String(input?.status ?? input?.state ?? input?.publishStatus ?? '').trim().toLowerCase();
  if (raw) return raw;
  if (input?.isPublished || String(input?.publishedAt ?? input?.publishAt ?? '').trim()) return 'published';
  return '';
}

function isLangCode(input: any): input is LangCode {
  return input === 'en' || input === 'hi' || input === 'gu';
}

function extractSourceLanguage(...inputs: any[]): LangCode | null {
  for (const input of inputs) {
    const raw = String(
      input?.sourceLanguage
      ?? input?.originalLanguage
      ?? input?.baseLanguage
      ?? input?.sourceLang
      ?? input?.originalLang
      ?? input?.baseLang
      ?? ''
    ).trim().toLowerCase();
    if (isLangCode(raw)) return raw;
  }
  return null;
}

function extractSourceArticle(...inputs: any[]): any | null {
  for (const input of inputs) {
    const candidate = input?.sourceArticle ?? input?.originalArticle ?? input?.baseArticle ?? null;
    if (candidate && typeof candidate === 'object') return candidate;
  }
  return null;
}

function extractTranslationMetadataMap(...inputs: any[]): Partial<Record<LangCode, any>> {
  const map: Partial<Record<LangCode, any>> = {};
  for (const input of inputs) {
    const translations = input?.translations;
    if (!translations || typeof translations !== 'object') continue;
    for (const key of Object.keys(translations)) {
      const code = String(key || '').trim().toLowerCase();
      if (code === 'status' || !isLangCode(code)) continue;
      const raw = (translations as any)[code];
      if (!raw) continue;
      const entity = (raw && typeof raw === 'object')
        ? (raw.article ?? raw.articleData ?? raw.item ?? raw.variant ?? raw)
        : {};
      const entityId = String(
        (entity as any)?._id
        ?? (entity as any)?.id
        ?? (entity as any)?.articleId
        ?? (raw as any)?._id
        ?? (raw as any)?.id
        ?? (raw as any)?.articleId
        ?? ''
      ).trim();

      if (!entityId) continue;

      map[code] = {
        ...(map[code] || {}),
        ...(entity && typeof entity === 'object' ? entity : {}),
        lang: code,
        language: code,
        status: (entity as any)?.status ?? (raw as any)?.status,
        state: (entity as any)?.state ?? (raw as any)?.state,
        publishStatus: (entity as any)?.publishStatus ?? (raw as any)?.publishStatus,
        isPublished: (entity as any)?.isPublished ?? (raw as any)?.isPublished,
        publishedAt: (entity as any)?.publishedAt ?? (raw as any)?.publishedAt,
        publishAt: (entity as any)?.publishAt ?? (raw as any)?.publishAt,
        title: (entity as any)?.title ?? (raw as any)?.title,
        content: (entity as any)?.content ?? (raw as any)?.content,
        body: (entity as any)?.body ?? (raw as any)?.body,
        _id: (entity as any)?._id ?? (raw as any)?._id ?? entityId,
        id: (entity as any)?.id ?? (raw as any)?.id ?? entityId,
        __presenceFromMetadata: true,
      };
    }
  }
  return map;
}

type TranslationBadgeTone = 'ok' | 'warn' | 'muted';

type TranslationSyncState = 'source' | 'synced' | 'needs-refresh' | 'regenerating' | 'failed';

type TranslationSyncEntry = {
  state: TranslationSyncState;
  detail?: string;
};

function getTranslationBadges(v: any | null): Array<{ text: string; tone: TranslationBadgeTone }> {
  if (!v) return [{ text: 'Missing', tone: 'warn' }];

  const badges: Array<{ text: string; tone: TranslationBadgeTone }> = [];
  if (v?.__isSource) badges.push({ text: 'Source', tone: 'muted' });

  const variantStatus = getVariantStatus(v);
  if (variantStatus === 'published') badges.push({ text: 'Published', tone: 'ok' });
  else if (variantStatus === 'scheduled') badges.push({ text: 'Ready', tone: 'muted' });
  else badges.push({ text: 'Ready', tone: 'ok' });

  return badges;
}

function getTranslationSyncTone(state: TranslationSyncState): TranslationBadgeTone {
  if (state === 'source') return 'muted';
  if (state === 'synced') return 'ok';
  if (state === 'failed') return 'warn';
  return 'muted';
}

function getTranslationSyncLabel(state: TranslationSyncState): string {
  if (state === 'source') return 'Source';
  if (state === 'synced') return 'Synced';
  if (state === 'needs-refresh') return 'Needs Refresh';
  if (state === 'regenerating') return 'Regenerating';
  return 'Failed';
}

function extractTranslationStatus(article: any): string | null {
  if (!article) return null;
  const raw =
    article.translationStatus ??
    article.translation_status ??
    article.translationState ??
    article.translation_state ??
    article.translation?.status ??
    article.translations?.status;

  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  if (typeof raw === 'object' && typeof raw.status === 'string') return raw.status;
  return String(raw);
}

type ScriptKind = 'latin' | 'devanagari' | 'gujarati';
const RE_LATIN = /\p{Script=Latin}/u;
const RE_DEVANAGARI = /\p{Script=Devanagari}/u;
const RE_GUJARATI = /\p{Script=Gujarati}/u;

function expectedScriptForLang(lang: LangCode): ScriptKind {
  if (lang === 'hi') return 'devanagari';
  if (lang === 'gu') return 'gujarati';
  return 'latin';
}

function formatScriptKind(k: ScriptKind): string {
  if (k === 'devanagari') return 'Devanagari';
  if (k === 'gujarati') return 'Gujarati';
  return 'Latin';
}

function analyzeScripts(text: string): { latin: number; devanagari: number; gujarati: number; total: number } {
  const raw = String(text || '');
  let latin = 0;
  let devanagari = 0;
  let gujarati = 0;

  for (const ch of raw) {
    if (RE_GUJARATI.test(ch)) { gujarati += 1; continue; }
    if (RE_DEVANAGARI.test(ch)) { devanagari += 1; continue; }
    if (RE_LATIN.test(ch)) { latin += 1; continue; }
  }

  const total = latin + devanagari + gujarati;
  return { latin, devanagari, gujarati, total };
}

function mixedScriptWarning(lang: LangCode, label: 'Title' | 'Summary', text: string): string | null {
  const stats = analyzeScripts(text);
  // Keep this lightweight and avoid noise on short strings.
  if (stats.total < 12) return null;

  const expected = expectedScriptForLang(lang);
  const expectedCount = expected === 'latin' ? stats.latin : expected === 'devanagari' ? stats.devanagari : stats.gujarati;
  const expectedShare = expectedCount / stats.total;
  if (expectedShare >= 0.6) return null;

  const candidates: Array<{ kind: ScriptKind; count: number }> = [
    { kind: 'latin', count: stats.latin },
    { kind: 'devanagari', count: stats.devanagari },
    { kind: 'gujarati', count: stats.gujarati },
  ];
  candidates.sort((a, b) => b.count - a.count);
  const dominant = candidates[0];
  const dominantShare = dominant.count / stats.total;

  if (dominant.kind !== expected && dominantShare >= 0.6) {
    return `${label} looks mostly ${formatScriptKind(dominant.kind)}, but Language is set to ${lang}.`;
  }

  const present = candidates.filter((c) => (c.count / stats.total) >= 0.2).map((c) => formatScriptKind(c.kind));
  if (present.length >= 2 && expectedShare < 0.4) {
    return `${label} mixes ${present.join(' + ')} scripts; consider adjusting Language or text.`;
  }

  return null;
}

function toDateTimeLocalValue(input: any): string {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toIsoDateTime(input: string): string | undefined {
  const raw = String(input || '').trim();
  if (!raw) return undefined;
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return undefined;
  return date.toISOString();
}

const GUJARAT_DISTRICTS: ReadonlyArray<{ label: string; slug: string }> = [
  { label: 'Ahmedabad', slug: 'ahmedabad' },
  { label: 'Amreli', slug: 'amreli' },
  { label: 'Anand', slug: 'anand' },
  { label: 'Aravalli', slug: 'aravalli' },
  { label: 'Banaskantha', slug: 'banaskantha' },
  { label: 'Bharuch', slug: 'bharuch' },
  { label: 'Bhavnagar', slug: 'bhavnagar' },
  { label: 'Botad', slug: 'botad' },
  { label: 'Chhota Udaipur', slug: 'chhota-udaipur' },
  { label: 'Dahod', slug: 'dahod' },
  { label: 'Dang', slug: 'dang' },
  { label: 'Devbhoomi Dwarka', slug: 'devbhoomi-dwarka' },
  { label: 'Gandhinagar', slug: 'gandhinagar' },
  { label: 'Gir Somnath', slug: 'gir-somnath' },
  { label: 'Jamnagar', slug: 'jamnagar' },
  { label: 'Junagadh', slug: 'junagadh' },
  { label: 'Kheda', slug: 'kheda' },
  { label: 'Kutch', slug: 'kutch' },
  { label: 'Mahisagar', slug: 'mahisagar' },
  { label: 'Mehsana', slug: 'mehsana' },
  { label: 'Morbi', slug: 'morbi' },
  { label: 'Narmada', slug: 'narmada' },
  { label: 'Navsari', slug: 'navsari' },
  { label: 'Panchmahal', slug: 'panchmahal' },
  { label: 'Patan', slug: 'patan' },
  { label: 'Porbandar', slug: 'porbandar' },
  { label: 'Rajkot', slug: 'rajkot' },
  { label: 'Sabarkantha', slug: 'sabarkantha' },
  { label: 'Surat', slug: 'surat' },
  { label: 'Surendranagar', slug: 'surendranagar' },
  { label: 'Tapi', slug: 'tapi' },
  { label: 'Vadodara', slug: 'vadodara' },
  { label: 'Vav-Tharad', slug: 'vav-tharad' },
  { label: 'Valsad', slug: 'valsad' },
];

// Key cities (Mahanagarpalika / major metros)
const GUJARAT_CITIES: ReadonlyArray<{ label: string; slug: string }> = [
  { label: 'Ahmedabad', slug: 'ahmedabad' },
  { label: 'Surat', slug: 'surat' },
  { label: 'Vadodara', slug: 'vadodara' },
  { label: 'Rajkot', slug: 'rajkot' },
  { label: 'Bhavnagar', slug: 'bhavnagar' },
  { label: 'Jamnagar', slug: 'jamnagar' },
  { label: 'Junagadh', slug: 'junagadh' },
  { label: 'Gandhinagar', slug: 'gandhinagar' },
];

interface ArticleFormProps {
  mode: 'create' | 'edit';
  id?: string | null; // edit id (preferred)
  articleId?: string; // legacy prop alias
  initialValues?: Partial<Article>; // pre-fetched data (edit)
  onSubmit?: (payload: Record<string, any>) => Promise<any>; // override create/update
  onDone?: () => void;
  userRole?: 'writer'|'editor'|'admin'|'founder';
  onDirtyChange?: (dirty: boolean) => void;
  defaultSponsored?: boolean;
}

export const ArticleForm: React.FC<ArticleFormProps> = ({
  id,
  articleId,
  mode,
  initialValues,
  onSubmit,
  onDone = ()=>{},
  userRole='writer',
  onDirtyChange,
  defaultSponsored = false,
}) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  // resolve edit id
  const initialEditId = id || articleId || null;
  const [effectiveId, setEffectiveId] = useState<string | null>(initialEditId);
  // After creating a draft in-place (Add Article), we intentionally avoid refetching
  // the server copy because it can overwrite the in-progress form values.
  const [suppressServerHydration, setSuppressServerHydration] = useState(false);
  useEffect(() => {
    setEffectiveId(initialEditId);
    setSuppressServerHydration(false);
  }, [initialEditId]);
  const computedMode: 'create'|'edit' = effectiveId ? 'edit' : 'create';
  const qc = useQueryClient();
  // Skip internal fetch if caller provided initialValues
  const { data } = useQuery({
    queryKey: ['articles','one',effectiveId],
    queryFn: ()=> effectiveId ? getArticle(effectiveId) : Promise.resolve(null),
    enabled: !!effectiveId && !initialValues && !suppressServerHydration,
  });
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [summary, setSummary] = useState('');
  const [autoSummary, setAutoSummary] = useState(true);
  const [content, setContent] = useState('');
  const [languageDrafts, setLanguageDrafts] = useState<Record<LangCode, ArticleLanguageDraft>>({
    en: { ...EMPTY_LANGUAGE_DRAFT },
    hi: { ...EMPTY_LANGUAGE_DRAFT },
    gu: { ...EMPTY_LANGUAGE_DRAFT },
  });
  const [languageReviewFields, setLanguageReviewFields] = useState<Record<LangCode, ArticleLanguageReviewFields>>({
    en: { ...EMPTY_LANGUAGE_REVIEW_FIELDS },
    hi: { ...EMPTY_LANGUAGE_REVIEW_FIELDS },
    gu: { ...EMPTY_LANGUAGE_REVIEW_FIELDS },
  });
  const [translationTargets, setTranslationTargets] = useState<LangCode[]>(() => ARTICLE_LANGUAGE_CODES.filter((code) => code !== DEFAULT_CREATE_LANGUAGE));
  const [generateTranslationsAfterSave, setGenerateTranslationsAfterSave] = useState(true);
  const [translationJobStatus, setTranslationJobStatus] = useState<'waiting' | 'translating' | 'ready' | 'partial' | 'failed' | 'outdated'>('waiting');
  const contentPlain = useMemo(() => stripHtmlToText(content), [content]);
  // Always store ONLY a string identifier for the category in state (slug preferred, else _id).
  const [category, setCategory] = useState<string>('');
  const [editorialType, setEditorialType] = useState<EditorialType>('editorial');
  const [youthPulseTrack, setYouthPulseTrack] = useState<YouthPulseTrack | ''>('');
  const [language, setLanguage] = useState<LangCode>(() => (initialEditId ? 'en' : DEFAULT_CREATE_LANGUAGE));
  const [translationGroupId, setTranslationGroupId] = useState<string>('');
  const [translationStatus, setTranslationStatus] = useState<string | null>(null);
  const [status, setStatus] = useState<'draft'|'scheduled'|'published'>('draft');
  const [statusExplicitlyChanged, setStatusExplicitlyChanged] = useState(false);
  // Keep original status to ensure Save Draft never downgrades/changes live states
  const originalStatusRef = useRef<'draft'|'scheduled'|'published'|'unknown'>('unknown');
  const [tags, setTags] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [langIssues, setLangIssues] = useState<Record<string, any[]>>({});
  const [readabilityGrade, setReadabilityGrade] = useState<number|undefined>();
  const [readingSeconds, setReadingSeconds] = useState<number|undefined>();
  const [founderOverride, setFounderOverride] = useState(false);
  const autoSaveRef = useRef<number | null>(null);
  const { publishEnabled } = usePublishFlag();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLanguage, setPreviewLanguage] = useState<LangCode>(DEFAULT_CREATE_LANGUAGE);
  const [qualityToolsCollapsed, setQualityToolsCollapsed] = useState(false);
  const [locationTagsCollapsed, setLocationTagsCollapsed] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<null | {
    viewUrl: string;
    slug: string;
    id?: string | null;
    syncResults?: Partial<Record<LangCode, string>>;
  }>(null);
  const [translationSyncOverrides, setTranslationSyncOverrides] = useState<Partial<Record<LangCode, TranslationSyncEntry>>>({});

  // Cover image (backend-supported field: imageUrl)
  const [coverImage, setCoverImage] = useState<{ url: string; publicId?: string } | null>(null);
  // Upload-only: selecting a file uploads it and stores a remote URL.
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [coverUploadOk, setCoverUploadOk] = useState(false);
  const [coverUploadError, setCoverUploadError] = useState<string | null>(null);
  const [coverMediaLibraryOpen, setCoverMediaLibraryOpen] = useState(false);

  const mediaStatusQuery = useQuery({
    queryKey: ['media', 'status'],
    queryFn: () => getMediaStatus(),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const coverUploadEnabled = mediaStatusQuery.data?.uploadEnabled === true;
  const coverUploadStatusText = (() => {
    if (mediaStatusQuery.isLoading) return 'Checking upload availability…';
    if (coverUploadEnabled) return null;

    const s = mediaStatusQuery.data;
    const reason = String(s?.reason || '').trim();
    const message = String(s?.message || '').trim();

    // 1) Explicit Cloudinary misconfig (most actionable)
    if (reason === 'cloudinary_not_configured') {
      return message || 'Cloudinary not configured.';
    }

    // 2) Status endpoint truly missing/invalid response
    if (reason === 'media_status_endpoint_unavailable') {
      return 'Media status endpoint unavailable.';
    }

    // 3) Request failed (network/auth/etc)
    if (reason === 'media_status_request_failed') {
      return 'Status check failed.';
    }

    // Fallback: show backend-provided message when present.
    return message || 'Upload unavailable.';
  })();

  const coverUploadStatusDetail = (() => {
    if (mediaStatusQuery.isLoading) return null;
    if (coverUploadEnabled) return null;

    const s = mediaStatusQuery.data;
    const reason = String(s?.reason || '').trim();
    const message = String(s?.message || '').trim();
    const detail = String((s as any)?.detail || '').trim();

    if (reason === 'cloudinary_not_configured') {
      return detail || null;
    }

    if (reason === 'media_status_endpoint_unavailable') {
      return detail || 'Could not verify upload service.';
    }

    if (reason === 'media_status_request_failed') {
      return message || 'Could not verify upload service.';
    }

    return detail || null;
  })();

  const coverImageUrl = String(coverImage?.url || '').trim();
  const coverImagePublicId = String(coverImage?.publicId || '').trim();

  const countWords = (input: string): number => {
    const raw = String(input || '');
    if (!raw.trim()) return 0;

    // Remove HTML tags (embeds/images/iframes), keep visible text.
    const noHtml = raw.replace(/<[^>]*>/g, ' ');

    // Remove common markdown image/link URL portions while keeping label text.
    const keepMdLabel = noHtml
      // ![alt](url) -> alt
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, ' $1 ')
      // [label](url) -> label
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, ' $1 ');

    const cleaned = keepMdLabel
      .replace(/https?:\/\/\S+/g, ' ') // raw URLs
      .replace(/[^\p{L}\p{N}]+/gu, ' ') // keep letters/numbers across languages
      .trim();

    if (!cleaned) return 0;
    return cleaned.split(/\s+/).filter(Boolean).length;
  };

  // Content editing is handled by TipTap RichTextEditor (HTML stored in `content`).

  const wordCount = useMemo(() => countWords(content), [content]);

  const mixedScriptWarnings = useMemo(() => {
    const w1 = mixedScriptWarning(language, 'Title', title);
    const w2 = mixedScriptWarning(language, 'Summary', summary);
    return [w1, w2].filter(Boolean) as string[];
  }, [language, title, summary]);

  // Admin publish contract fields
  const [isBreaking, setIsBreaking] = useState(false);
  const [spotlightEnabled, setSpotlightEnabled] = useState(false);
  const [spotlightPinned, setSpotlightPinned] = useState(false);
  const [spotlightPriority, setSpotlightPriority] = useState('');
  const [spotlightExpiryTime, setSpotlightExpiryTime] = useState('');
  const [locationSearch, setLocationSearch] = useState('');
  // ISO string (or empty). Set automatically when publishing if empty.
  const [publishedAt, setPublishedAt] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [isSponsoredArticle, setIsSponsoredArticle] = useState(Boolean(defaultSponsored));
  const [sponsorBrandName, setSponsorBrandName] = useState('');
  const [sponsorDisclosure, setSponsorDisclosure] = useState('');
  const [sponsorCtaText, setSponsorCtaText] = useState('');
  const [sponsorCtaUrl, setSponsorCtaUrl] = useState('');

  type Snapshot = {
    title: string;
    slug: string;
    summary: string;
    content: string;
    category: string;
    editorialType: EditorialType | '';
    youthPulseTrack: string;
    language: string;
    translationGroupId: string;
    status: 'draft' | 'scheduled' | 'published';
    tags: string[];
    coverImage: string;
    coverImagePublicId: string;
    isBreaking: boolean;
    spotlightEnabled: boolean;
    spotlightPinned: boolean;
    spotlightPriority: string;
    spotlightExpiryTime: string;
    publishedAt: string;
    state: string;
    district: string;
    city: string;
    isSponsoredArticle: boolean;
    sponsorBrandName: string;
    sponsorDisclosure: string;
    sponsorCtaText: string;
    sponsorCtaUrl: string;
  };

  // Used for dirty-state + publish reset.
  const EMPTY_SNAPSHOT: Snapshot = {
    title: '',
    slug: '',
    summary: '',
    content: '',
    category: '',
    editorialType: '',
    youthPulseTrack: '',
    language: DEFAULT_CREATE_LANGUAGE,
    translationGroupId: '',
    status: 'draft',
    tags: [],
    coverImage: '',
    coverImagePublicId: '',
    isBreaking: false,
    spotlightEnabled: false,
    spotlightPinned: false,
    spotlightPriority: '',
    spotlightExpiryTime: '',
    publishedAt: '',
    state: '',
    district: '',
    city: '',
    isSponsoredArticle: Boolean(defaultSponsored),
    sponsorBrandName: '',
    sponsorDisclosure: '',
    sponsorCtaText: '',
    sponsorCtaUrl: '',
  };

  function resetToNewArticle() {
    setEffectiveId(null);
    setSuppressServerHydration(false);
    originalStatusRef.current = 'unknown';
    setTitle('');
    setSlug('');
    setAutoSlug(true);
    setSummary('');
    setAutoSummary(true);
    setContent('');
    setLanguageDrafts({
      en: { ...EMPTY_LANGUAGE_DRAFT },
      hi: { ...EMPTY_LANGUAGE_DRAFT },
      gu: { ...EMPTY_LANGUAGE_DRAFT },
    });
    setLanguageReviewFields({
      en: { ...EMPTY_LANGUAGE_REVIEW_FIELDS },
      hi: { ...EMPTY_LANGUAGE_REVIEW_FIELDS },
      gu: { ...EMPTY_LANGUAGE_REVIEW_FIELDS },
    });
    setTranslationTargets(ARTICLE_LANGUAGE_CODES.filter((code) => code !== DEFAULT_CREATE_LANGUAGE));
    setGenerateTranslationsAfterSave(true);
    setTranslationJobStatus('waiting');
    setCategory('');
    setEditorialType('editorial');
    setYouthPulseTrack('');
    setLanguage(DEFAULT_CREATE_LANGUAGE);
    setTranslationGroupId('');
    setStatus('draft');
    setTags([]);
    setScheduledAt('');
    setIsBreaking(false);
    setSpotlightEnabled(false);
    setSpotlightPinned(false);
    setSpotlightPriority('');
    setSpotlightExpiryTime('');
    setPublishedAt('');
    setState('');
    setDistrict('');
    setCity('');
    setIsSponsoredArticle(Boolean(defaultSponsored));
    setSponsorBrandName('');
    setSponsorDisclosure('');
    setSponsorCtaText('');
    setSponsorCtaUrl('');
    setLangIssues({});
    setReadabilityGrade(undefined);
    setReadingSeconds(undefined);
    setFounderOverride(false);
    setSlugCheck({ status: 'idle' });
    setCoverImage(null);
    setCoverImageFile(null);
    setCoverUploadOk(false);
    setCoverUploadError(null);
    setLastSavedSnapshot(EMPTY_SNAPSHOT);
    setLastSavedAt(null);
    setPublishSuccess(null);
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('id');
      window.history.replaceState(null, '', `${u.pathname}${u.search}${u.hash}`);
    } catch {}
  }

  function buildSnapshot(next?: Partial<Snapshot>): Snapshot {
    return {
      title: (next?.title ?? title ?? '').toString(),
      slug: (next?.slug ?? slug ?? '').toString(),
      summary: (next?.summary ?? summary ?? '').toString(),
      content: (next?.content ?? content ?? '').toString(),
      category: (next?.category ?? category ?? '').toString(),
      editorialType: (next?.editorialType ?? (category === 'editorial' ? editorialType : '') ?? '').toString() as Snapshot['editorialType'],
      youthPulseTrack: (next?.youthPulseTrack ?? youthPulseTrack ?? '').toString(),
      language: (next?.language ?? language ?? '').toString(),
      translationGroupId: (next?.translationGroupId ?? translationGroupId ?? '').toString(),
      status: (next?.status ?? status) as Snapshot['status'],
      tags: Array.isArray(next?.tags) ? (next?.tags as string[]) : tags,
      coverImage: (next?.coverImage ?? coverImageUrl ?? '').toString(),
      coverImagePublicId: (next?.coverImagePublicId ?? coverImagePublicId ?? '').toString(),
      isBreaking: (typeof next?.isBreaking === 'boolean') ? next.isBreaking : isBreaking,
      spotlightEnabled: (typeof next?.spotlightEnabled === 'boolean') ? next.spotlightEnabled : spotlightEnabled,
      spotlightPinned: (typeof next?.spotlightPinned === 'boolean') ? next.spotlightPinned : spotlightPinned,
      spotlightPriority: (next?.spotlightPriority ?? spotlightPriority ?? '').toString(),
      spotlightExpiryTime: (next?.spotlightExpiryTime ?? spotlightExpiryTime ?? '').toString(),
      publishedAt: (next?.publishedAt ?? publishedAt ?? '').toString(),
      state: (next?.state ?? state ?? '').toString(),
      district: (next?.district ?? district ?? '').toString(),
      city: (next?.city ?? city ?? '').toString(),
      isSponsoredArticle: (typeof next?.isSponsoredArticle === 'boolean') ? next.isSponsoredArticle : isSponsoredArticle,
      sponsorBrandName: (next?.sponsorBrandName ?? sponsorBrandName ?? '').toString(),
      sponsorDisclosure: (next?.sponsorDisclosure ?? sponsorDisclosure ?? '').toString(),
      sponsorCtaText: (next?.sponsorCtaText ?? sponsorCtaText ?? '').toString(),
      sponsorCtaUrl: (next?.sponsorCtaUrl ?? sponsorCtaUrl ?? '').toString(),
    };
  }

  function applyLanguageDraft(code: LangCode, draft: ArticleLanguageDraft) {
    setLanguage(code);
    setTitle(draft.title || '');
    setSlug(draft.slug || '');
    setSummary(draft.summary || '');
    setContent(draft.content || '');
    setAutoSlug(!draft.slug);
    setAutoSummary(!draft.summary);
  }

  function selectLanguageWorkspace(code: LangCode) {
    if (code === language) return;
    const currentDraft = { title, slug, summary, content };
    setLanguageDrafts((prev) => {
      const next = { ...prev, [language]: currentDraft };
      const existingVariant = translationVariants[code];
      const nextDraft = hasAnyLanguageDraftContent(next[code])
        ? next[code]
        : (existingVariant ? getArticleDraftFromRecord(existingVariant) : { ...EMPTY_LANGUAGE_DRAFT });
      window.setTimeout(() => applyLanguageDraft(code, nextDraft), 0);
      return next;
    });
  }

  function getDraftForLanguage(code: LangCode): ArticleLanguageDraft {
    if (code === language) return { title, slug, summary, content };
    const draft = languageDrafts[code];
    if (hasAnyLanguageDraftContent(draft)) return draft;
    const variant = translationVariants[code];
    return variant ? getArticleDraftFromRecord(variant) : { ...EMPTY_LANGUAGE_DRAFT };
  }

  function openPreviewForLanguage(code: LangCode) {
    setLanguageDrafts((prev) => ({ ...prev, [language]: { title, slug, summary, content } }));
    setPreviewLanguage(code);
    setPreviewOpen(true);
  }

  function snapshotHash(s: Snapshot): string {
    // Stable JSON: fixed key order + normalized values.
    const normalized: Snapshot = {
      title: (s.title || ''),
      slug: (s.slug || ''),
      summary: (s.summary || ''),
      content: (s.content || ''),
      category: (s.category || ''),
      editorialType: s.category === 'editorial' ? (s.editorialType || 'editorial') : '',
      youthPulseTrack: (s.youthPulseTrack || ''),
      language: (s.language || ''),
      translationGroupId: (s.translationGroupId || ''),
      status: (s.status || 'draft'),
      tags: (Array.isArray(s.tags) ? s.tags : []).map((t) => String(t || '').trim()).filter(Boolean),
      coverImage: (s.coverImage || ''),
      coverImagePublicId: (s.coverImagePublicId || ''),
      isBreaking: !!s.isBreaking,
      spotlightEnabled: !!s.spotlightEnabled,
      spotlightPinned: !!s.spotlightPinned,
      spotlightPriority: (s.spotlightPriority || ''),
      spotlightExpiryTime: (s.spotlightExpiryTime || ''),
      publishedAt: (s.publishedAt || ''),
      state: (s.state || ''),
      district: (s.district || ''),
      city: (s.city || ''),
      isSponsoredArticle: !!s.isSponsoredArticle,
      sponsorBrandName: (s.sponsorBrandName || ''),
      sponsorDisclosure: (s.sponsorDisclosure || ''),
      sponsorCtaText: (s.sponsorCtaText || ''),
      sponsorCtaUrl: (s.sponsorCtaUrl || ''),
    };
    return JSON.stringify(normalized);
  }

  // NOTE: Cover image upload is implemented via /media/upload (or legacy /uploads/cover).

  // Slug availability
  const [slugCheck, setSlugCheck] = useState<{
    status: 'idle' | 'checking' | 'available' | 'taken' | 'error';
    checkedSlug?: string;
    message?: string;
    suggestions?: string[];
  }>({ status: 'idle' });
  const slugCheckSeqRef = useRef(0);

  // Categories are a fixed key/label list (ARTICLE_CATEGORY_OPTIONS)
  // to guarantee we send clean, filterable category keys to backend.
  const createCategoryDefault = useMemo(() => {
    return normalizeArticleCategoryKey(searchParams.get('category') || '');
  }, [searchParams]);

  const appliedCreateDefaultsRef = useRef(false);

  useEffect(() => {
    if (appliedCreateDefaultsRef.current) return;
    if (computedMode !== 'create') return;
    appliedCreateDefaultsRef.current = true;
    if (createCategoryDefault === 'editorial') {
      setCategory('editorial');
      setEditorialType('editorial');
    }
  }, [computedMode, createCategoryDefault]);

  const languagesQuery = useQuery({
    queryKey: ['meta', 'languages'],
    queryFn: async () => {
      // Preferred: GET /meta/languages
      try {
        const res = await apiClient.get('/meta/languages');
        const raw = res?.data as any;
        const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : (Array.isArray(raw?.languages) ? raw.languages : []));
        const list = (arr || []).map((l: any) => (typeof l === 'string' ? l : (l?.code || l?.value || l?.id || ''))).map((s: string) => String(s || '').trim()).filter(Boolean);
        const seen = new Set<string>();
        return list.filter((x: string) => (seen.has(x) ? false : (seen.add(x), true)));
      } catch (e: any) {
        const status = e?.response?.status;
        if (status && status !== 404) throw e;
      }

      // Fallback: GET /admin/meta
      try {
        const res2 = await apiClient.get('/admin/meta');
        const raw2 = res2?.data as any;
        const candidate = raw2?.data && typeof raw2.data === 'object' ? raw2.data : raw2;
        const arr2 = Array.isArray(candidate?.languages) ? candidate.languages : (Array.isArray(candidate?.supportedLanguages) ? candidate.supportedLanguages : []);
        const list2 = (arr2 || []).map((l: any) => (typeof l === 'string' ? l : (l?.code || l?.value || l?.id || ''))).map((s: string) => String(s || '').trim()).filter(Boolean);
        const seen2 = new Set<string>();
        return list2.filter((x: string) => (seen2.has(x) ? false : (seen2.add(x), true)));
      } catch (e2: any) {
        const status2 = e2?.response?.status;
        if (status2 && status2 !== 404) throw e2;
      }

      // Safe fallback list
      return ['en', 'hi', 'gu'] as string[];
    },
    staleTime: 10 * 60 * 1000,
  });

  // lastSavedSnapshot drives the "Unsaved changes" indicator.
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState<Snapshot>(() => EMPTY_SNAPSHOT);
  const lastSavedHash = useMemo(() => snapshotHash(lastSavedSnapshot), [lastSavedSnapshot]);
  const lastSavedHashRef = useRef<string>(lastSavedHash);
  useEffect(() => { lastSavedHashRef.current = lastSavedHash; }, [lastSavedHash]);

  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [autosaveFailed, setAutosaveFailed] = useState(false);
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const saveKindRef = useRef<'manual'|'autosave'|'publish'>('manual');
  const pendingSaveRef = useRef(false);
  const dirtyRef = useRef(false);
  const [confirmState, setConfirmState] = useState<null | {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
  }>(null);

  function ensureValidSlug(current: string, titleText: string): string {
    return generateArticleSlug({ title: titleText, slug: current });
  }

  function normalizeTagKey(t: string): string {
    return String(t || '').trim().toLowerCase();
  }

  function dedupeTags(list: string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of (Array.isArray(list) ? list : [])) {
      const cleaned = String(raw || '').trim();
      if (!cleaned) continue;
      const key = normalizeTagKey(cleaned);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(cleaned);
    }
    return out;
  }

  function hasTag(tag: string): boolean {
    const key = normalizeTagKey(tag);
    return (tags || []).some((t) => normalizeTagKey(t) === key);
  }

  function setTagsSafe(next: string[]) {
    setTags(dedupeTags(next));
  }

  const breakingChecked = useMemo(() => {
    return isBreaking || hasTag('breaking') || String(category || '').trim() === 'breaking';
  }, [isBreaking, category, tags]);

  function toggleGujaratLocationTag(tag: string) {
    const rawTag = String(tag || '').trim();
    if (!rawTag) return;

    const key = normalizeTagKey(rawTag);
    const prev = Array.isArray(tags) ? tags : [];
    const had = prev.some((t) => normalizeTagKey(t) === key);

    let next = had
      ? prev.filter((t) => normalizeTagKey(t) !== key)
      : dedupeTags([...prev, rawTag]);

    const isDistrict = key.startsWith('district:');
    const isCityTag = key.startsWith('city:');
    const selectingLocation = !had && (isDistrict || isCityTag);

    if (selectingLocation) {
      const hasState = next.some((t) => normalizeTagKey(t) === 'state:gujarat');
      if (!hasState) next = dedupeTags([...next, 'state:gujarat']);
      setState('gujarat');
    }

    const nextDistrictSlugs = new Set<string>();
    const nextCitySlugs = new Set<string>();
    for (const t of next) {
      const k = normalizeTagKey(t);
      if (k.startsWith('district:')) nextDistrictSlugs.add(k.slice('district:'.length));
      if (k.startsWith('city:')) nextCitySlugs.add(k.slice('city:'.length));
    }

    const currentDistrictKey = String(district || '').trim().toLowerCase();
    const currentCityKey = String(city || '').trim().toLowerCase();

    if (!had && isDistrict) {
      setDistrict(key.slice('district:'.length));
    } else if (had && isDistrict) {
      const removed = key.slice('district:'.length);
      if (currentDistrictKey === removed) {
        setDistrict(nextDistrictSlugs.has(currentDistrictKey) ? currentDistrictKey : (nextDistrictSlugs.values().next().value || ''));
      }
    }

    if (!had && isCityTag) {
      setCity(key.slice('city:'.length));
    } else if (had && isCityTag) {
      const removed = key.slice('city:'.length);
      if (currentCityKey === removed) {
        setCity(nextCitySlugs.has(currentCityKey) ? currentCityKey : (nextCitySlugs.values().next().value || ''));
      }
    }

    setTags(next);
  }

  const selectedDistrictSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const t of (tags || [])) {
      const key = normalizeTagKey(t);
      if (key.startsWith('district:')) set.add(key.slice('district:'.length));
    }
    return set;
  }, [tags]);

  const selectedCitySlugs = useMemo(() => {
    const set = new Set<string>();
    for (const t of (tags || [])) {
      const key = normalizeTagKey(t);
      if (key.startsWith('city:')) set.add(key.slice('city:'.length));
    }
    return set;
  }, [tags]);

  const locationSearchKey = useMemo(() => String(locationSearch || '').trim().toLowerCase(), [locationSearch]);
  const filteredDistricts = useMemo(() => {
    if (!locationSearchKey) return GUJARAT_DISTRICTS;
    return GUJARAT_DISTRICTS.filter((d) => d.label.toLowerCase().includes(locationSearchKey) || d.slug.includes(locationSearchKey));
  }, [locationSearchKey]);
  const filteredCities = useMemo(() => {
    if (!locationSearchKey) return GUJARAT_CITIES;
    return GUJARAT_CITIES.filter((c) => c.label.toLowerCase().includes(locationSearchKey) || c.slug.includes(locationSearchKey));
  }, [locationSearchKey]);

  // populate from initialValues first (edit mode)
  useEffect(()=> {
    const src = (computedMode === 'edit') ? (initialValues || data) : null;
    // If we just created a draft and stored its id, do not hydrate from server
    // because it can reset/clear fields (requirement: keep form exactly as-is).
    if (src && !initialValues && suppressServerHydration) return;
    if (src) {
      const dbg = isArticleEditorDebugEnabled();
      if (dbg) {
        console.log('[ArticleForm] hydrate src', {
          id: (src as any)?._id || (src as any)?.id,
          status: (src as any)?.status,
          state: (src as any)?.state,
          publishStatus: (src as any)?.publishStatus,
          isPublished: (src as any)?.isPublished,
          publishedAt: (src as any)?.publishedAt || (src as any)?.publishAt,
          scheduledAt: (src as any)?.scheduledAt || (src as any)?.publishAt,
          language: (src as any)?.language,
          lang: (src as any)?.lang,
          translationGroupId: (src as any)?.translationGroupId,
        });
      }

      setTitle(src.title || '');
      setSlug(src.slug || '');
      setSummary((src as any).summary || '');
      setContent((src as any).content ?? (src as any).body ?? '');
      // Backward compat: category might be stored as a string OR object.
      // Normalize to string slug/_id only; never store the object.
      const incomingCategory: any = (src as any).category;
      const categorySlug =
        (typeof incomingCategory === 'object' && incomingCategory)
          ? (incomingCategory.slug ?? incomingCategory._id ?? '')
          : (typeof incomingCategory === 'string'
            ? incomingCategory
            : '');

      const normalizedCategory = normalizeArticleCategoryKey(categorySlug);
      setCategory(normalizedCategory || '');
      setEditorialType(normalizedCategory === 'editorial' ? normalizeEditorialType((src as any).editorialType) : 'editorial');
      setYouthPulseTrack(normalizeYouthPulseTrack(
        String((src as any).track ?? (src as any).subCategory ?? (src as any).subcategory ?? (src as any).trackName ?? '')
      ));
      setLanguage(normalizeLang((src as any).lang ?? (src as any).language ?? 'en'));
      setTranslationGroupId(String((src as any).translationGroupId || ''));
      setTranslationStatus(extractTranslationStatus(src));
      const rawStatus = ((src as any).status ?? (src as any).state ?? (src as any).publishStatus) as any;
      const incomingStatus = (((rawStatus as any) || ((src as any).isPublished ? 'published' : undefined) || 'draft') as any) as 'draft'|'scheduled'|'published';
      setStatus(incomingStatus);
      originalStatusRef.current = incomingStatus;
      setStatusExplicitlyChanged(false);
      const incomingTags = Array.isArray((src as any).tags) ? (src as any).tags : [];
      const normalizedTags = dedupeTags(incomingTags as any);
      setTags(normalizedTags);
      const incomingScheduledAt = (src as any).scheduledAt || (src as any).publishAt || '';
      setScheduledAt(incomingScheduledAt ? new Date(incomingScheduledAt).toISOString().slice(0,16) : '');

      const incomingCategoryKey = String(categorySlug || '').trim();
      const hasBreakingTag0 = (normalizedTags || []).some((t) => normalizeTagKey(t) === 'breaking');
      setIsBreaking(!!(src as any).isBreaking || hasBreakingTag0 || incomingCategoryKey === 'breaking');
      setSpotlightEnabled(!!(src as any).spotlightEnabled);
      setSpotlightPinned(!!(src as any).spotlightPinned);
      setSpotlightPriority(
        (src as any).spotlightPriority == null || (src as any).spotlightPriority === ''
          ? ''
          : String((src as any).spotlightPriority)
      );
      setSpotlightExpiryTime(toDateTimeLocalValue(
        (src as any).spotlightExpiryTime
        || (src as any).spotlightExpiresAt
        || (src as any).spotlightExpiry
        || ''
      ));
      const incomingPublishedAt = (src as any).publishedAt || (src as any).publishAt || '';
      setPublishedAt(incomingPublishedAt ? new Date(incomingPublishedAt).toISOString() : '');
      setState(String((src as any).state || ''));
      setDistrict(String((src as any).district || ''));
      setCity(String((src as any).city || ''));
      const incomingSponsored = Boolean(
        (src as any).isSponsored
        ?? (src as any).sponsored
        ?? (src as any).sponsoredArticle?.enabled
        ?? normalizedTags.some((tag) => ['sponsored', 'sponsored-article'].includes(normalizeTagKey(tag)))
      );
      setIsSponsoredArticle(incomingSponsored);
      setSponsorBrandName(String(
        (src as any).sponsorBrandName
        ?? (src as any).sponsorName
        ?? (src as any).brandName
        ?? (src as any).sponsoredArticle?.sponsorBrandName
        ?? ''
      ));
      setSponsorDisclosure(String(
        (src as any).sponsorDisclosure
        ?? (src as any).sponsoredArticle?.sponsorDisclosure
        ?? ''
      ));
      setSponsorCtaText(String(
        (src as any).sponsorCtaText
        ?? (src as any).ctaText
        ?? (src as any).sponsoredArticle?.ctaText
        ?? ''
      ));
      setSponsorCtaUrl(String(
        (src as any).sponsorCtaUrl
        ?? (src as any).ctaUrl
        ?? (src as any).sponsoredArticle?.ctaUrl
        ?? ''
      ));

      // Cover image (support both coverImageUrl and imageUrl across environments)
      const incomingCoverField: any = (src as any).coverImage;
      const incomingCoverUrl = (() => {
        if (incomingCoverField && typeof incomingCoverField === 'object') {
          return (
            incomingCoverField.url ||
            incomingCoverField.secureUrl ||
            incomingCoverField.secure_url ||
            ''
          );
        }
        return (
          (src as any).coverImageUrl ||
          (src as any).imageUrl ||
          (typeof incomingCoverField === 'string' ? incomingCoverField : '') ||
          (src as any).featuredImage ||
          (src as any).mediaUrl ||
          ''
        );
      })();

      const incomingCoverPid = (() => {
        if (incomingCoverField && typeof incomingCoverField === 'object') {
          return incomingCoverField.publicId || incomingCoverField.public_id || '';
        }
        return '';
      })();

      const nextCoverUrl = String(incomingCoverUrl || '').trim();
      const nextCoverPid = String(incomingCoverPid || '').trim();
      setCoverImage(nextCoverUrl ? { url: nextCoverUrl, publicId: nextCoverPid || undefined } : null);
      setCoverImageFile(null);
      setCoverUploadOk(false);
      setCoverUploadError(null);

      // Seed "last saved" hash for edit mode.
      try {
        const s = buildSnapshot({
          title: src.title || '',
          slug: src.slug || '',
          summary: (src as any).summary || '',
          content: (src as any).content ?? (src as any).body ?? '',
          category: (typeof (src as any).category === 'object' && (src as any).category)
            ? String(((src as any).category.slug ?? (src as any).category._id ?? '') || '')
            : (typeof (src as any).category === 'string' ? (src as any).category : ''),
          editorialType: normalizedCategory === 'editorial' ? normalizeEditorialType((src as any).editorialType) : '',
          language: normalizeLang((src as any).lang ?? (src as any).language ?? 'en'),
          translationGroupId: String((src as any).translationGroupId || ''),
          status: ((((src as any).status as any) || 'draft') as any),
          tags: Array.isArray((src as any).tags) ? (src as any).tags : [],
          coverImage: String(incomingCoverUrl || ''),
          coverImagePublicId: String(incomingCoverPid || ''),
          isBreaking: !!(src as any).isBreaking,
          spotlightEnabled: !!(src as any).spotlightEnabled,
          spotlightPinned: !!(src as any).spotlightPinned,
          spotlightPriority: (src as any).spotlightPriority == null ? '' : String((src as any).spotlightPriority),
          spotlightExpiryTime: toDateTimeLocalValue(
            (src as any).spotlightExpiryTime
            || (src as any).spotlightExpiresAt
            || (src as any).spotlightExpiry
            || ''
          ),
          publishedAt: incomingPublishedAt ? new Date(incomingPublishedAt).toISOString() : '',
          state: String((src as any).state || ''),
          district: String((src as any).district || ''),
          city: String((src as any).city || ''),
          isSponsoredArticle: incomingSponsored,
          sponsorBrandName: String(
            (src as any).sponsorBrandName
            ?? (src as any).sponsorName
            ?? (src as any).brandName
            ?? ''
          ),
          sponsorDisclosure: String((src as any).sponsorDisclosure || ''),
          sponsorCtaText: String((src as any).sponsorCtaText ?? (src as any).ctaText ?? ''),
          sponsorCtaUrl: String((src as any).sponsorCtaUrl ?? (src as any).ctaUrl ?? ''),
        });
        setLastSavedSnapshot(s);
        setLastSavedAt(Date.now());
      } catch { /* ignore */ }

      // Ensure we have an effective id for subsequent PUT updates.
      const sid: string | null = (src as any)?._id || (src as any)?.id || null;
      if (sid && sid !== effectiveId) setEffectiveId(String(sid));
    }
  }, [initialValues, data, computedMode]);

  const retryTranslationMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveId) throw new Error('Missing article id');
      return retryArticleTranslation(effectiveId);
    },
    onSuccess: (res: any) => {
      // Best-effort: update local status if backend returns it; otherwise rely on refetch.
      const raw = res as any;
      const article = raw?.article || raw?.data?.article || raw?.data || raw;
      const next = extractTranslationStatus(article);
      setTranslationStatus(next || 'pending');
      qc.invalidateQueries({ queryKey: ['articles','one',effectiveId] });
    },
    onError: (err: any) => {
      toast.error(normalizeError(err, 'Retry translation failed').message);
    },
  });

  const automaticTranslationMutation = useMutation({
    mutationFn: async ({ id, languages }: { id: string; languages: LangCode[] }) => {
      if (!id) throw new Error('Missing article id');
      if (!languages.length) throw new Error('Select at least one translation target');
      return requeueArticleTranslations(id, { languages });
    },
    onMutate: ({ languages }) => {
      setTranslationJobStatus('translating');
      setTranslationSyncOverrides((prev) => {
        const next: Partial<Record<LangCode, TranslationSyncEntry>> = { ...prev };
        for (const code of languages) next[code] = { state: 'regenerating', detail: 'Translation queued' };
        return next;
      });
    },
    onSuccess: (_res, vars) => {
      setTranslationStatus('translating');
      setTranslationJobStatus('translating');
      toast.success(`Translation job queued for ${vars.languages.map((code) => code.toUpperCase()).join('+')}`);
    },
    onError: (err: any) => {
      setTranslationJobStatus('failed');
      toast.error(normalizeError(err, 'Translation job could not be queued').message);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['articles'] });
      if (translationGroupIdTrimmed) qc.invalidateQueries({ queryKey: ['articles', 'translationGroup', translationGroupIdTrimmed] });
    },
  });

  function triggerAutomaticTranslationJob(articleId: string | null | undefined, reason: 'generate' | 'regenerate' | 'save-draft') {
    const idToTranslate = String(articleId || effectiveId || '').trim();
    const languages = translationTargets.filter((code) => code !== language && languageOptions.includes(code));
    if (!idToTranslate) {
      if (reason !== 'save-draft') toast.error('Save the source article before generating translations.');
      return;
    }
    if (!languages.length) {
      if (reason !== 'save-draft') toast.error('Select at least one translation target.');
      return;
    }
    automaticTranslationMutation.mutate({ id: idToTranslate, languages });
  }

  const translationGroupIdTrimmed = useMemo(() => String(translationGroupId || '').trim(), [translationGroupId]);
  const currentArticleRecord = useMemo(() => {
    return (computedMode === 'edit') ? (initialValues || data || null) : null;
  }, [computedMode, initialValues, data]);

  const translationGroupQuery = useQuery({
    queryKey: ['articles', 'translationGroup', translationGroupIdTrimmed],
    queryFn: async () => listArticlesByTranslationGroupId(translationGroupIdTrimmed, { limit: 50 }),
    enabled: !!translationGroupIdTrimmed,
    staleTime: 60 * 1000,
    retry: false,
  });

  const translationGroupPayload = useMemo(() => {
    return (translationGroupQuery.data as any) || null;
  }, [translationGroupQuery.data]);

  const translationSourceArticle = useMemo(() => {
    return extractSourceArticle(translationGroupPayload, currentArticleRecord);
  }, [translationGroupPayload, currentArticleRecord]);

  const translationSourceLanguage = useMemo<LangCode | null>(() => {
    const explicit = extractSourceLanguage(translationGroupPayload, currentArticleRecord, translationSourceArticle);
    if (explicit) return explicit;

    if (currentArticleRecord && (currentArticleRecord as any)?.translations && typeof (currentArticleRecord as any)?.translations === 'object') {
      return normalizeLang((currentArticleRecord as any)?.lang ?? (currentArticleRecord as any)?.language ?? language);
    }

    if (translationSourceArticle) {
      return normalizeLang((translationSourceArticle as any)?.lang ?? (translationSourceArticle as any)?.language ?? 'en');
    }

    return null;
  }, [translationGroupPayload, currentArticleRecord, translationSourceArticle, language]);

  const currentArticleLanguage = useMemo<LangCode>(() => {
    if (currentArticleRecord) {
      return normalizeLang((currentArticleRecord as any)?.lang ?? (currentArticleRecord as any)?.language ?? language);
    }
    return normalizeLang(language);
  }, [currentArticleRecord, language]);

  const translationVariants = useMemo(() => {
    const rows: any[] = (translationGroupQuery.data as any)?.rows || [];
    const currentArticle = currentArticleRecord;
    const groupPayload = translationGroupPayload;
    const sourceArticle = translationSourceArticle;
    const inferredSourceLanguage = translationSourceLanguage;
    const map: Record<LangCode, any | null> = { en: null, hi: null, gu: null };

    const applyVariant = (code: LangCode, next: any, mode: 'fill' | 'override' = 'fill') => {
      if (!next) return;
      const existing = map[code];

      if (mode === 'override') {
        map[code] = {
          ...(existing || {}),
          ...(next || {}),
          lang: code,
          language: code,
          __isSource: !!((existing as any)?.__isSource || next?.__isSource),
          __presenceFromMetadata: !!((existing as any)?.__presenceFromMetadata || next?.__presenceFromMetadata),
        };
        return;
      }

      if (!existing) {
        map[code] = {
          ...(next || {}),
          lang: code,
          language: code,
        };
        return;
      }

      map[code] = {
        ...(next || {}),
        ...(existing || {}),
        _id: (existing as any)?._id || next?._id,
        id: (existing as any)?.id || next?.id,
        title: (existing as any)?.title || next?.title,
        content: (existing as any)?.content || next?.content,
        body: (existing as any)?.body || next?.body,
        status: (existing as any)?.status || next?.status,
        state: (existing as any)?.state || next?.state,
        publishStatus: (existing as any)?.publishStatus || next?.publishStatus,
        isPublished: (existing as any)?.isPublished ?? next?.isPublished,
        publishedAt: (existing as any)?.publishedAt || next?.publishedAt,
        publishAt: (existing as any)?.publishAt || next?.publishAt,
        lang: code,
        language: code,
        __isSource: !!((existing as any)?.__isSource || next?.__isSource),
        __presenceFromMetadata: !!((existing as any)?.__presenceFromMetadata || next?.__presenceFromMetadata),
      };
    };

    const metadataMap = extractTranslationMetadataMap(groupPayload, sourceArticle, currentArticle);
    for (const code of Object.keys(metadataMap) as LangCode[]) {
      applyVariant(code, {
        ...(metadataMap[code] || {}),
        __isSource: inferredSourceLanguage === code,
      }, 'fill');
    }

    if (sourceArticle) {
      const sourceCode = normalizeLang((sourceArticle as any)?.lang ?? (sourceArticle as any)?.language ?? inferredSourceLanguage ?? 'en');
      applyVariant(sourceCode, {
        ...(sourceArticle as any),
        lang: sourceCode,
        language: sourceCode,
        __isSource: true,
      }, 'fill');
    }

    for (const r of rows) {
      const raw = String((r as any)?.lang ?? (r as any)?.language ?? '').trim().toLowerCase();
      const code = (raw === 'en' || raw === 'hi' || raw === 'gu') ? raw : '';
      if (code) {
        const existingId = String((map[code] as any)?._id || (map[code] as any)?.id || '').trim();
        const rowId = String((r as any)?._id || (r as any)?.id || '').trim();
        const shouldOverride = !map[code] || !existingId || (!!effectiveId && rowId === String(effectiveId));
        applyVariant(code, {
          ...(r as any),
          __isSource: inferredSourceLanguage === code || !!(map[code] as any)?.__isSource,
        }, shouldOverride ? 'override' : 'fill');
      }
    }

    if (translationGroupIdTrimmed && currentArticle) {
      const currentCode = currentArticleLanguage;
      applyVariant(currentCode, {
        ...(currentArticle as any),
        _id: String(effectiveId || (currentArticle as any)?._id || (currentArticle as any)?.id || '').trim() || undefined,
        id: String(effectiveId || (currentArticle as any)?.id || (currentArticle as any)?._id || '').trim() || undefined,
        title: String(title || (currentArticle as any)?.title || ''),
        content: String(content || (currentArticle as any)?.content || (currentArticle as any)?.body || ''),
        body: String(content || (currentArticle as any)?.body || (currentArticle as any)?.content || ''),
        lang: currentCode,
        language: currentCode,
        status: status || (currentArticle as any)?.status,
        state: state || (currentArticle as any)?.state,
        publishStatus: (currentArticle as any)?.publishStatus,
        isPublished: getVariantStatus({
          ...(currentArticle as any),
          status,
          state,
          publishedAt,
        }) === 'published',
        publishedAt: publishedAt || (currentArticle as any)?.publishedAt || (currentArticle as any)?.publishAt,
        publishAt: publishedAt || (currentArticle as any)?.publishAt || (currentArticle as any)?.publishedAt,
        translationGroupId: translationGroupIdTrimmed,
        __isSource: inferredSourceLanguage === currentCode,
      }, 'override');
    }

    return map;
  }, [translationGroupIdTrimmed, translationGroupQuery.data, translationGroupPayload, currentArticleRecord, translationSourceArticle, translationSourceLanguage, currentArticleLanguage, effectiveId, language, title, content, status, state, publishedAt]);

  const linkedVersionCodes = useMemo(() => {
    return (['en', 'hi', 'gu'] as const).filter((code) => !!translationVariants[code]);
  }, [translationVariants]);

  useEffect(() => {
    setLanguageDrafts((prev) => {
      const next = { ...prev };
      for (const code of ARTICLE_LANGUAGE_CODES) {
        const variant = translationVariants[code];
        if (variant && !hasAnyLanguageDraftContent(next[code])) {
          next[code] = getArticleDraftFromRecord(variant);
        }
      }
      next[language] = { title, slug, summary, content };
      return next;
    });
    setLanguageReviewFields((prev) => {
      const next = { ...prev };
      for (const code of ARTICLE_LANGUAGE_CODES) {
        const variant = translationVariants[code];
        if (!variant) continue;
        const current = next[code] || { ...EMPTY_LANGUAGE_REVIEW_FIELDS };
        if (!current.imageAltText && !current.seoTitle && !current.metaDescription) {
          next[code] = getArticleReviewFieldsFromRecord(variant);
        }
      }
      return next;
    });
  }, [translationVariants, language, title, slug, summary, content]);

  const translationCompletion = useMemo<Record<LangCode, boolean>>(() => {
    const result = {} as Record<LangCode, boolean>;
    for (const code of ARTICLE_LANGUAGE_CODES) {
      const draft = code === language ? { title, slug, summary, content } : languageDrafts[code];
      const variant = translationVariants[code];
      result[code] = isLanguageDraftComplete(draft) || isLanguageDraftComplete(variant ? getArticleDraftFromRecord(variant) : null);
    }
    return result;
  }, [language, languageDrafts, translationVariants, title, slug, summary, content]);

  const allTranslationsComplete = useMemo(() => {
    return ARTICLE_LANGUAGE_CODES.every((code) => translationCompletion[code]);
  }, [translationCompletion]);

  const isMasterArticle = useMemo(() => {
    return !!translationGroupIdTrimmed && !!translationSourceLanguage && translationSourceLanguage === currentArticleLanguage;
  }, [translationGroupIdTrimmed, translationSourceLanguage, currentArticleLanguage]);

  const translationSyncStatuses = useMemo<Record<LangCode, TranslationSyncEntry>>(() => {
    const base = { en: null, hi: null, gu: null } as Record<LangCode, TranslationSyncEntry | null>;

    for (const code of ['en', 'hi', 'gu'] as const) {
      if (translationSyncOverrides[code]) {
        base[code] = translationSyncOverrides[code] || null;
        continue;
      }

      if (translationSourceLanguage === code && translationVariants[code]) {
        base[code] = { state: 'source', detail: 'Master article' };
        continue;
      }

      if (translationVariants[code]) {
        base[code] = { state: 'synced', detail: 'Linked version ready' };
        continue;
      }

      base[code] = { state: 'needs-refresh', detail: 'No linked version yet' };
    }

    return base as Record<LangCode, TranslationSyncEntry>;
  }, [translationSyncOverrides, translationSourceLanguage, translationVariants]);

  useEffect(() => {
    setTranslationSyncOverrides({});
  }, [effectiveId, translationGroupIdTrimmed, translationSourceLanguage]);

  const groupStatus = useMemo(() => {
    const variants = Object.values(translationVariants).filter(Boolean) as any[];
    if (variants.some((v) => getVariantStatus(v) === 'published')) return 'Published';
    if (variants.some((v) => getVariantStatus(v) === 'scheduled')) return 'Scheduled';
    if (variants.length > 0) return 'Draft';
    return null;
  }, [translationVariants]);

  const existingSlugs = useMemo(()=> new Set<string>([]), []);
  useEffect(()=> { if (autoSlug) { uniqueSlug(title, existingSlugs).then(setSlug); } }, [title, autoSlug, existingSlugs]);
  useEffect(()=> { setReadingSeconds(readingTimeSec(content)); }, [content]);

  const languageOptions = useMemo(() => {
    // Hard rule for Option A+ multilingual publishing.
    return ['en', 'hi', 'gu'] as string[];
  }, []);

  useEffect(() => {
    setTranslationTargets(ARTICLE_LANGUAGE_CODES.filter((code) => code !== language && languageOptions.includes(code)));
  }, [language, languageOptions]);

  const languageLabel = (code: string) => {
    const c = (code || '').toLowerCase();
    if (c === 'en') return 'English';
    if (c === 'hi') return 'Hindi';
    if (c === 'gu') return 'Gujarati';
    return (code || '').toUpperCase();
  };

  const categoryValidForPublish = useMemo(() => {
    const v = String(category || '').trim();
    if (!v) return false;
    return isAllowedArticleCategoryKey(v);
  }, [category]);

  const languageValidForPublish = useMemo(() => {
    return !!language && languageOptions.includes(language);
  }, [language, languageOptions]);

  async function runSlugAvailabilityCheck(slugToCheck: string): Promise<boolean> {
    const s = (slugToCheck || '').trim();
    if (!s) {
      setSlugCheck({ status: 'idle' });
      return false;
    }

    const seq = ++slugCheckSeqRef.current;
    setSlugCheck({ status: 'checking', checkedSlug: s });

    try {
      const res = await checkSlugAvailability({ slug: s, excludeId: effectiveId || undefined });
      if (slugCheckSeqRef.current !== seq) return false;

      if (res.available) {
        setSlugCheck({ status: 'available', checkedSlug: s });
        return true;
      }

      setSlugCheck({
        status: 'taken',
        checkedSlug: s,
        message: res.reason || 'Slug already exists',
        suggestions: buildSlugSuggestions(s, 3),
      });
      return false;
    } catch (err: any) {
      if (slugCheckSeqRef.current !== seq) return false;
      const n = normalizeError(err, 'Failed to check slug');
      // If backend doesn't support slug-check endpoint (404), treat as "no validation available"
      // and do not show a red error under Slug.
      if (n.status === 404) {
        setSlugCheck({ status: 'idle' });
        return true;
      }
      setSlugCheck({ status: 'error', checkedSlug: s, message: n.message, suggestions: buildSlugSuggestions(s, 3) });
      return false;
    }
  }

  function generateSummary(titleText: string, contentText: string): string {
    const t = (titleText || '').trim();
    const c = stripHtmlToText(contentText || '').trim();
    // If there's no content yet, synthesize a 2–3 line summary from the title in chosen language
    if (!c && t) {
      const base = t.replace(/\s+/g, ' ');
      if (language === 'gu') {
        // Gujarati localized template
        const s1 = `આ લેખ ${base} વિષયને આવરી લે છે.`;
        const s2 = `તેમાં મુખ્ય તથ્યો, પરિસ્થિતિ અને આગળ શું ધ્યાનમાં રાખવું તે જણાવે છે.`;
        const s3 = `આનો અર્થ અને મહત્વ સમજવા માટે આગળ વાંચો.`;
        const combinedGu = `${s1} ${s2} ${s3}`;
        return combinedGu.length > 300 ? combinedGu.slice(0, 297) + '…' : combinedGu;
      } else if (language === 'hi') {
        // Hindi template (simple neutral tone)
        const s1 = `यह लेख ${base} विषय को कवर करता है.`;
        const s2 = `इसमें मुख्य तथ्य, संदर्भ और आगे क्या देखना है बताया गया है.`;
        const s3 = `इसके अर्थ और महत्व को समझने के लिए आगे पढ़ें.`;
        const combinedHi = `${s1} ${s2} ${s3}`;
        return combinedHi.length > 300 ? combinedHi.slice(0, 297) + '…' : combinedHi;
      } else {
        const s1 = `This story covers ${base}.`;
        const s2 = `It outlines key facts, context, and what to look for next.`;
        const s3 = `Read on to understand what it means and why it matters.`;
        const combined = `${s1} ${s2} ${s3}`;
        return combined.length > 300 ? combined.slice(0, 297) + '…' : combined;
      }
    }
    const tLow = t.toLowerCase();
    const sentences = (c || t).replace(/\n+/g,' ').split(/(?<=[.?!])\s+/).filter(Boolean);
    const filtered = sentences.filter(s => s.toLowerCase().trim() !== tLow);
    const take = filtered.slice(0,2).join(' ');
    const words = take.split(/\s+/).filter(Boolean);
    const targetCount = Math.min(Math.max(25, words.length), 45);
    const summary = words.slice(0,targetCount).join(' ');
    return summary.length > 300 ? summary.slice(0,297) + '…' : summary;
  }

  useEffect(()=> {
    if (autoSummary) setSummary(generateSummary(title, content));
  }, [title, content, autoSummary]);

  function trimSummaryTo160(){ setSummary(s => (s.length <= 160 ? s : s.slice(0,160).replace(/\s+\S*$/, '') + '…')); }

  const lastSubmitRef = useRef<null | {
    statusToSend: 'draft'|'scheduled'|'published';
    safeSlug: string;
    wasNew: boolean;
  }>(null);

  const mutation = useMutation({
    // desiredStatusOverride lets callers force a specific status (e.g., Publish)
    mutationFn: async (desiredStatusOverride?: 'draft'|'scheduled'|'published') => {
      // Ensure we never send an empty/invalid slug on publish/save.
      const safeSlug = ensureValidSlug(slug, title);
      const currentLanguageDrafts: Record<LangCode, ArticleLanguageDraft> = {
        ...languageDrafts,
        [language]: { title, slug, summary, content },
      };
      const saveAllLanguageDrafts = saveKindRef.current === 'manual' && desiredStatusOverride !== 'published';
      const translationGroupIdForSave = (translationGroupId || '').trim()
        || (saveAllLanguageDrafts ? createTranslationGroupId(title || slug || summary || 'article') : '');

      type PublicArticleStatus = 'draft' | 'scheduled' | 'published';
      const trimOrUndef = (v: string) => {
        const t = (v || '').trim();
        return t ? t : undefined;
      };

      const buildPublicPayload = (opts: { status: PublicArticleStatus; publishedAt?: string; language?: LangCode; draft?: ArticleLanguageDraft }): {
        title: string;
        slug: string;
        summary: string;
        description: string;
        content: string;
        category?: string;
        postType?: string;
        editorialType?: EditorialType;
        track?: string;
        trackName?: string;
        subCategory?: string;
        subcategory?: string;
        isFounder?: boolean;
        status: PublicArticleStatus;
        language: 'en'|'hi'|'gu';
        lang: 'en'|'hi'|'gu';
        translationGroupId?: string;
        imageAltText?: string;
        imageAlt?: string;
        seoTitle?: string;
        metaTitle?: string;
        metaDescription?: string;
        publishedAt?: string;
        publishAt?: string;
        scheduledAt?: string;
        isBreaking: boolean;
        spotlightEnabled: boolean;
        spotlightPinned: boolean;
        spotlightPriority?: number;
        spotlightExpiryTime?: string;
        spotlightExpiresAt?: string;
        state?: string;
        district?: string;
        city?: string;
        geo?: {
          state?: string;
          district?: string;
          city?: string;
        };
        imageUrl?: string;
        coverImageUrl?: string;
        coverImage?: { url: string; publicId?: string };
        tags: string[];
        isSponsored?: boolean;
        sponsored?: boolean;
        sponsorBrandName?: string;
        sponsorName?: string;
        sponsorDisclosure?: string;
        sponsorCtaText?: string;
        sponsorCtaUrl?: string;
        ctaText?: string;
        ctaUrl?: string;
        sponsoredArticle?: {
          enabled: boolean;
          sponsorBrandName?: string;
          sponsorDisclosure?: string;
          ctaText?: string;
          ctaUrl?: string;
        };
      } => {
        const draft = opts.draft || { title, slug, summary, content };
        const draftSlug = ensureValidSlug(draft.slug, draft.title);
        const langToSend = opts.language || language;
        const reviewFields = languageReviewFields[langToSend] || EMPTY_LANGUAGE_REVIEW_FIELDS;
        const imageAltToSend = trimOrUndef(reviewFields.imageAltText);
        const seoTitleToSend = trimOrUndef(reviewFields.seoTitle);
        const metaDescriptionToSend = trimOrUndef(reviewFields.metaDescription);
        const categoryKeyRaw = (category || '').trim();
        const categoryKey = normalizeArticleCategoryKey(categoryKeyRaw);
        const publishedAtToSend = opts.status === 'published'
          ? (opts.publishedAt || new Date().toISOString())
          : undefined;

        const scheduledAtToSend = opts.status === 'scheduled'
          ? (() => {
            const raw = String(scheduledAt || '').trim();
            if (!raw) return undefined;
            const d = new Date(raw);
            return Number.isFinite(d.getTime()) ? d.toISOString() : undefined;
          })()
          : undefined;

        const isViralVideo = String(categoryKey) === 'viral-videos';
        const isFounderEditorial = categoryKey === 'editorial' && userRole === 'founder' && opts.status === 'published';

        const coverUrl = trimOrUndef(coverImageUrl);
        const coverPid = trimOrUndef(coverImagePublicId);
        const youthTrack = categoryKey === 'youth-pulse' ? normalizeYouthPulseTrack(youthPulseTrack) : '';
        const spotlightPriorityNumber = (() => {
          const raw = String(spotlightPriority || '').trim();
          if (!raw) return undefined;
          const parsed = Number(raw);
          return Number.isFinite(parsed) ? parsed : undefined;
        })();
        const spotlightExpiryIso = toIsoDateTime(spotlightExpiryTime);

        const geoState = trimOrUndef(state);
        const geoDistrict = trimOrUndef(district);
        const geoCity = trimOrUndef(city);
        const geo = (geoState || geoDistrict || geoCity)
          ? { state: geoState, district: geoDistrict, city: geoCity }
          : undefined;
        const normalizedTags = (() => {
          const baseTags = Array.isArray(tags) ? tags : [];
          if (!isSponsoredArticle) {
            return baseTags.filter((tag) => {
              const key = normalizeTagKey(tag);
              return key !== 'sponsored' && key !== 'sponsored-article';
            });
          }
          return dedupeTags([...baseTags, 'sponsored', 'sponsored-article']);
        })();
        const sponsorBrand = trimOrUndef(sponsorBrandName);
        const sponsorDisclosureText = trimOrUndef(sponsorDisclosure);
        const sponsorCtaLabel = trimOrUndef(sponsorCtaText);
        const sponsorCtaLink = trimOrUndef(sponsorCtaUrl);
        return {
          title: draft.title,
          slug: draftSlug,
          summary: draft.summary,
          description: draft.summary,
          content: draft.content,
          category: categoryKey || undefined,
          editorialType: categoryKey === 'editorial' ? editorialType : undefined,
          track: youthTrack || undefined,
          trackName: youthTrack ? YOUTH_PULSE_TRACK_LABELS[youthTrack] : undefined,
          subCategory: youthTrack || undefined,
          subcategory: youthTrack || undefined,
          postType: isViralVideo ? 'video' : undefined,
          isFounder: isFounderEditorial ? true : undefined,
          status: opts.status,
          language: (langToSend as any) as 'en'|'hi'|'gu',
          lang: (langToSend as any) as 'en'|'hi'|'gu',
          translationGroupId: translationGroupIdForSave || undefined,
          imageAltText: imageAltToSend,
          imageAlt: imageAltToSend,
          seoTitle: seoTitleToSend,
          metaTitle: seoTitleToSend,
          metaDescription: metaDescriptionToSend,
          publishedAt: publishedAtToSend,
          publishAt: scheduledAtToSend,
          scheduledAt: scheduledAtToSend,
          isBreaking,
          spotlightEnabled,
          spotlightPinned: spotlightEnabled ? spotlightPinned : false,
          spotlightPriority: spotlightPriorityNumber,
          spotlightExpiryTime: spotlightExpiryIso,
          spotlightExpiresAt: spotlightExpiryIso,
          state: trimOrUndef(state),
          district: trimOrUndef(district),
          city: trimOrUndef(city),
          geo,
          imageUrl: coverUrl,
          coverImageUrl: coverUrl,
          coverImage: coverUrl ? { url: coverUrl, publicId: coverPid } : undefined,
          tags: normalizedTags,
          isSponsored: isSponsoredArticle ? true : undefined,
          sponsored: isSponsoredArticle ? true : undefined,
          sponsorBrandName: sponsorBrand,
          sponsorName: sponsorBrand,
          sponsorDisclosure: sponsorDisclosureText,
          sponsorCtaText: sponsorCtaLabel,
          sponsorCtaUrl: sponsorCtaLink,
          ctaText: sponsorCtaLabel,
          ctaUrl: sponsorCtaLink,
          sponsoredArticle: isSponsoredArticle
            ? {
                enabled: true,
                sponsorBrandName: sponsorBrand,
                sponsorDisclosure: sponsorDisclosureText,
                ctaText: sponsorCtaLabel,
                ctaUrl: sponsorCtaLink,
              }
            : undefined,
        };
      };

      const categoryKeyRaw = (category || '').trim();
      const categoryKey = normalizeArticleCategoryKey(categoryKeyRaw);
      const categoryAllowed = !categoryKeyRaw || !!categoryKey;

      const publishedAtIso = (() => {
        const v = (publishedAt || '').trim();
        if (!v) return '';
        const d = new Date(v);
        return Number.isFinite(d.getTime()) ? d.toISOString() : '';
      })();

      // Production CMS contract:
      // Publish should create (draft) first if needed, then publish via endpoint.
      if (!onSubmit && desiredStatusOverride === 'published') {
        const publishAtToSend = publishedAtIso || new Date().toISOString();

        if (!title.trim()) throw new Error('Title required to publish');
        if (!categoryKey) throw new Error('Category required to publish');
        if (!content.trim()) throw new Error('Content required to publish');
        if (!categoryAllowed) throw new Error('Category is not allowed');

        const draftPayload = buildPublicPayload({ status: 'draft' });
        const publishPayload = buildPublicPayload({ status: 'published', publishedAt: publishAtToSend });

        let idToPublish: string | null = effectiveId ? String(effectiveId) : null;
        if (!idToPublish) {
          const created: any = await createArticle(draftPayload as any);
          const createdPayload = created?.article || created?.data?.article || created?.data || created;
          idToPublish = createdPayload?._id || createdPayload?.id || created?._id || created?.id || null;
          if (!idToPublish) throw new Error('Failed to create draft before publish (missing id).');
        }

        try {
          // Preferred: send full payload via update (ensures backend receives clean fields)
          const updated: any = await updateArticle(idToPublish, publishPayload as any);
          return { ...(updated as any), __npCreatedId: idToPublish };
        } catch {
          // Fallback: minimal publish contract via admin proxy
          const published: any = await publishArticle(idToPublish, publishAtToSend, { summary });
          return { data: { ...(published as any), __npCreatedId: idToPublish } };
        }
      }

      // Compute safe status to send:
      // - Autosave NEVER changes status (hard rule)
      // - New items => draft
      // - Existing items => preserve backend status unless the user explicitly changes it AND this is a manual save
      // - If override provided (e.g., publish), use it explicitly
      let statusToSend: PublicArticleStatus;
      if (saveKindRef.current === 'autosave') {
        const orig = originalStatusRef.current === 'unknown' ? (status || 'draft') : originalStatusRef.current;
        statusToSend = orig as PublicArticleStatus;
      } else if (desiredStatusOverride) {
        statusToSend = desiredStatusOverride;
      } else if (computedMode === 'create') {
        statusToSend = 'draft';
      } else {
        const orig = originalStatusRef.current === 'unknown' ? (status || 'draft') : originalStatusRef.current;
        // Only allow status changes if user explicitly modified the status control.
        statusToSend = statusExplicitlyChanged ? status : (orig as PublicArticleStatus);
      }

      lastSubmitRef.current = { statusToSend, safeSlug, wasNew: !effectiveId };

      logArticleEditorDebug('submit', {
        kind: saveKindRef.current,
        targetArticleId: effectiveId,
        route: effectiveId ? `/admin-api/articles/${encodeURIComponent(effectiveId)}` : '/admin-api/articles',
        desiredStatusOverride,
        originalStatus: originalStatusRef.current,
        statusState: status,
        statusExplicitlyChanged,
        statusToSend,
        scheduledAt,
        publishedAt,
        language,
        translationGroupId,
      });

      const publishingViaSave = statusToSend === 'published';
      const publishAtToSend = publishingViaSave ? (publishedAtIso || new Date().toISOString()) : undefined;
      const body = buildPublicPayload({ status: statusToSend, publishedAt: publishAtToSend });

      logArticleEditorDebug('payload', {
        targetArticleId: effectiveId,
        route: effectiveId ? `/admin-api/articles/${encodeURIComponent(effectiveId)}` : '/admin-api/articles',
        slug: body.slug,
        status: body.status,
        publishedAt: (body as any).publishedAt,
        publishAt: (body as any).publishAt,
        scheduledAt: (body as any).scheduledAt,
        language: body.language,
        lang: body.lang,
        translationGroupId: body.translationGroupId,
        imageUrl: body.imageUrl,
        coverImageUrl: body.coverImageUrl,
        coverImage: body.coverImage,
        relatedArticleIds: getRelatedArticleIds(body),
        payloadKeys: Object.keys(body).sort(),
      });
      if (!title.trim()) throw new Error('Title required');
      if (isSponsoredArticle && !String(sponsorBrandName || '').trim()) {
        throw new Error('Sponsor / Brand Name required for Sponsored Article');
      }
      if (isSponsoredArticle && !String(sponsorDisclosure || '').trim()) {
        throw new Error('Sponsor Disclosure required for Sponsored Article');
      }
      if ((String(sponsorCtaText || '').trim() && !String(sponsorCtaUrl || '').trim()) || (!String(sponsorCtaText || '').trim() && String(sponsorCtaUrl || '').trim())) {
        throw new Error('CTA Text and CTA URL should be filled together');
      }
      if ((statusToSend === 'published' || desiredStatusOverride === 'published') && !categoryKey) {
        throw new Error('Category required to publish');
      }
      if ((statusToSend === 'published' || desiredStatusOverride === 'published') && !content.trim()) {
        throw new Error('Content required to publish');
      }
      if ((statusToSend === 'published' || desiredStatusOverride === 'published') && !categoryAllowed) {
        throw new Error('Category is not allowed');
      }
      if (onSubmit) return onSubmit(body);

      const savedResult = computedMode === 'create'
        ? await createArticle(body as any)
        : await updateArticle(effectiveId!, body as any);

      if (!saveAllLanguageDrafts || !translationGroupIdForSave) return savedResult;

      const savedRaw: any = savedResult as any;
      const savedArticle = (savedRaw?.article) || (savedRaw?.data?.article) || (savedRaw?.data && typeof savedRaw.data === 'object' ? savedRaw.data : savedRaw);
      const activeSavedId = savedArticle?._id || savedArticle?.id || savedRaw?._id || savedRaw?.id || effectiveId;
      const linkedDraftIds: Partial<Record<LangCode, string>> = {};

      for (const code of ARTICLE_LANGUAGE_CODES) {
        const draft = currentLanguageDrafts[code];
        if (!hasAnyLanguageDraftContent(draft) || !draft.title.trim()) continue;

        const variant = translationVariants[code];
        const variantId = String((variant as any)?._id || (variant as any)?.id || '').trim();
        const targetId = code === language ? String(activeSavedId || '').trim() : variantId;
        const draftPayload = buildPublicPayload({ status: 'draft', language: code, draft });

        if (targetId) {
          await updateArticle(targetId, draftPayload as any);
          linkedDraftIds[code] = targetId;
        } else {
          const created: any = await createArticle(draftPayload as any);
          const createdArticle = created?.article || created?.data?.article || created?.data || created;
          const createdId = String(createdArticle?._id || createdArticle?.id || '').trim();
          if (createdId) linkedDraftIds[code] = createdId;
        }
      }

      return { ...(savedResult as any), __npLinkedDraftIds: linkedDraftIds, translationGroupId: translationGroupIdForSave };
    },
    onSuccess: async (result: any) => {
      const raw = result as any;
      const saved = (raw?.article) || (raw?.data?.article) || (raw?.data && typeof raw.data === 'object' ? raw.data : raw);

      logArticleEditorDebug('saved', {
        id: saved?._id || saved?.id,
        status: saved?.status,
        state: saved?.state,
        publishStatus: saved?.publishStatus,
        scheduledAt: saved?.scheduledAt || saved?.publishAt,
        publishedAt: saved?.publishedAt,
        language: saved?.language,
        lang: saved?.lang,
        slug: saved?.slug,
        imageUrl: saved?.imageUrl,
        coverImageUrl: saved?.coverImageUrl,
        coverImage: saved?.coverImage,
        relatedArticleIds: getRelatedArticleIds(saved),
      });
      setTranslationStatus(extractTranslationStatus(saved));
      const savedGroupId = String(saved?.translationGroupId || raw?.translationGroupId || '');
      const savedId: string | null =
        (effectiveId ||
          raw?.__npCreatedId ||
          raw?.data?.__npCreatedId ||
          saved?._id ||
          saved?.id ||
          raw?._id ||
          null);
      const safeSlug = lastSubmitRef.current?.safeSlug || ensureValidSlug(slug, title);
      const statusToSend = lastSubmitRef.current?.statusToSend || status;
      const wasNew = lastSubmitRef.current?.wasNew ?? (!effectiveId);
      let syncResults: Partial<Record<LangCode, string>> | undefined;

      // Persist id after create so subsequent saves update (PUT) instead of creating duplicates.
      if (!effectiveId && savedId) {
        setEffectiveId(String(savedId));
        // Critical: keep the current in-memory form values; don't refetch and overwrite.
        setSuppressServerHydration(true);

        if (mode === 'create') {
          try {
            const u = new URL(window.location.href);
            u.searchParams.set('id', String(savedId));
            window.history.replaceState(null, '', `${u.pathname}${u.search}${u.hash}`);
          } catch {}
        }
      }

      // Keep local state aligned with what we just saved.
      if (safeSlug && safeSlug !== slug) {
        setSlug(safeSlug);
        setAutoSlug(false);
      }
      if (statusToSend && statusToSend !== status) {
        setStatus(statusToSend);
        originalStatusRef.current = statusToSend;
      }

      if (savedGroupId && savedGroupId !== translationGroupId) {
        setTranslationGroupId(savedGroupId);
      }

      if (saveKindRef.current === 'publish' && savedId) {
        logArticleEditorDebug('publish target confirmation', {
          targetArticleId: String(savedId),
          route: `/admin-api/articles/${encodeURIComponent(String(savedId))}`,
          slug: safeSlug,
          language,
          translationGroupId: savedGroupId || translationGroupId || undefined,
          relatedArticleIds: getRelatedArticleIds(saved),
          note: 'Publish is scoped to the current article only. Linked variants are not auto-published.',
        });
      }

      if (saveKindRef.current === 'publish' && savedGroupId && isMasterArticle) {
        setTranslationSyncOverrides((prev) => {
          const next: Partial<Record<LangCode, TranslationSyncEntry>> = { ...prev };
          for (const code of ['en', 'hi', 'gu'] as const) {
            const variant = translationVariants[code];
            const variantId = String((variant as any)?._id || (variant as any)?.id || '').trim();
            if (!variant || !variantId || variantId === String(savedId)) continue;
            next[code] = { state: 'needs-refresh', detail: 'Publish separately when ready' };
          }
          return next;
        });
        qc.invalidateQueries({ queryKey: ['articles', 'translationGroup', savedGroupId] });
      }

      setLastSavedSnapshot(buildSnapshot({
        slug: safeSlug,
        status: statusToSend,
        translationGroupId: savedGroupId || translationGroupId,
        coverImage: coverImageUrl,
        coverImagePublicId,
        isBreaking,
        publishedAt,
        state,
        district,
        city,
        isSponsoredArticle,
        sponsorBrandName,
        sponsorDisclosure,
        sponsorCtaText,
        sponsorCtaUrl,
      }));
      setLastSavedAt(Date.now());

      // Successful save clears autosave error state.
      if (saveKindRef.current === 'autosave') {
        setAutosaveFailed(false);
        setAutosaveError(null);
      }

      qc.invalidateQueries({ queryKey: ['articles'] });

      // Avoid noisy toasts for autosave.
      if (saveKindRef.current === 'publish') {
        const publicOrigin = ((import.meta.env as any).VITE_PUBLIC_SITE_ORIGIN || 'https://www.newspulse.co.in').toString().replace(/\/+$/, '');
        const publicPath = `/story/${encodeURIComponent(safeSlug)}`;
        const viewUrl = `${publicOrigin}${publicPath}`;

        setPublishSuccess({
          viewUrl,
          slug: safeSlug,
          id: savedId,
          syncResults,
        });
        return;
      } else if (saveKindRef.current !== 'autosave') {
        // Manual "Save Draft" behavior:
        // - New: Draft saved
        // - Existing: Draft updated
        toast.success(wasNew ? 'Draft saved' : 'Draft updated');
        if (generateTranslationsAfterSave) triggerAutomaticTranslationJob(savedId, 'save-draft');
      }

      // If user typed while saving, queue a single follow-up save (no rapid retries).
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        // Only queue if still dirty.
        const dirty = snapshotHash(buildSnapshot()) !== lastSavedHashRef.current;
        if (dirty) {
          saveKindRef.current = 'autosave';
          window.setTimeout(() => {
            if (!mutation.isPending) mutation.mutate(undefined);
          }, 0);
        }
      }

      onDone();
    },
    onError: (err: any) => {
      const n = normalizeError(err, 'Save failed');
      console.error('[ArticleForm] mutation error', n.status, n.raw?.response?.data || n.message);

      if (saveKindRef.current === 'autosave') {
        setAutosaveFailed(true);
        setAutosaveError(n.message);
      } else {
        toast.error(n.message);
      }
    },
    onSettled: () => {
      if (saveKindRef.current === 'publish') setIsPublishing(false);
      if (saveKindRef.current === 'manual') setIsSaving(false);
    },
  });

  function saveDraft(){
    if (!mutation.isPending) {
      // Create mode: force draft persist.
      // Edit mode: no override so live stays live.
      saveKindRef.current = 'manual';
      setIsSaving(true);
      mutation.mutate(mode === 'create' ? 'draft' : undefined);
    } else {
      // Prevent double saves; queue a single pending save.
      pendingSaveRef.current = true;
    }
  }
  function handlePublish(){
    if (!publishEnabled) {
      console.warn('Publish is disabled in this environment');
      toast.error('Publishing temporarily disabled');
      return;
    }
    if (!mutation.isPending) {
      // Publish is the only place that sets status: 'published'.
      saveKindRef.current = 'publish';
      setIsPublishing(true);
      mutation.mutate('published');
    } else {
      // Don't interrupt an in-flight save; queue a publish is not supported.
      toast.error('Please wait for the current save to finish');
    }
  }

  // Upload cover image immediately when selected so the article stores a usable URL.
  async function uploadSelectedCover(file: File) {
    if (!coverUploadEnabled) {
      setCoverImage(null);
      setCoverImageFile(null);
      setCoverUploadOk(false);
      setCoverUploadError(coverUploadStatusText || 'Cover image upload is unavailable.');
      return;
    }

    setIsUploadingCover(true);
    setCoverUploadOk(false);
    setCoverUploadError(null);
    // Do not keep any old cover image if the user is replacing it.
    // Only set coverImage after a successful upload response.
    setCoverImage(null);
    try {
      const res = await uploadCoverImage(file);
      logArticleEditorDebug('cover upload result', {
        url: res.url,
        publicId: res.publicId,
        width: res.width,
        height: res.height,
        bytes: res.bytes,
        format: res.format,
      });
      setCoverImage({ url: res.url, publicId: res.publicId || undefined });
      setCoverImageFile(null);
      setCoverUploadOk(true);
      toast.success('Image uploaded');
    } catch (err: any) {
      const n = normalizeError(err, 'Cover image upload failed');
      setCoverImage(null);
      setCoverImageFile(null);
      setCoverUploadOk(false);
      setCoverUploadError(n.message);
      toast.error(n.message);
    } finally {
      setIsUploadingCover(false);
    }
  }

  function chooseCoverFromMediaLibrary(asset: MediaLibraryAsset) {
    setCoverImage({ url: asset.url });
    setCoverImageFile(null);
    setCoverUploadError(null);
    setCoverUploadOk(true);
    setCoverMediaLibraryOpen(false);
    toast.success('Cover image selected from Media Library');
  }

  async function createLinkedTranslation(target: LangCode) {
    if (!effectiveId) {
      toast.error('Save this story first to create a translation');
      return;
    }

    const gid = String(translationGroupId || '').trim();
    if (!gid) {
      toast.error('Save once to generate Translation Group ID');
      return;
    }

    const categoryKey = normalizeArticleCategoryKey(String(category || '').trim());
    if (!categoryKey) {
      toast.error('Category required to create translation');
      return;
    }

    try {
      const payload: any = {
        title,
        summary,
        content,
        category: categoryKey,
        editorialType: categoryKey === 'editorial' ? editorialType : undefined,
        track: categoryKey === 'youth-pulse' ? normalizeYouthPulseTrack(youthPulseTrack) || undefined : undefined,
        trackName: categoryKey === 'youth-pulse' && normalizeYouthPulseTrack(youthPulseTrack)
          ? YOUTH_PULSE_TRACK_LABELS[normalizeYouthPulseTrack(youthPulseTrack) as YouthPulseTrack]
          : undefined,
        subCategory: categoryKey === 'youth-pulse' ? normalizeYouthPulseTrack(youthPulseTrack) || undefined : undefined,
        subcategory: categoryKey === 'youth-pulse' ? normalizeYouthPulseTrack(youthPulseTrack) || undefined : undefined,
        status: 'draft',
        language: target,
        lang: target,
        translationGroupId: gid,
      };

      const created: any = await createArticle(payload);
      const createdPayload = created?.article || created?.data?.article || created?.data || created;
      const newId: string | null =
        createdPayload?._id || createdPayload?.id || created?._id || created?.id || null;

      if (!newId) throw new Error('Failed to create translation (missing id)');

      toast.success(`Created ${languageLabel(target)} draft`);
      navigate(`/admin/articles/${encodeURIComponent(String(newId))}/edit`);
    } catch (err: any) {
      toast.error(normalizeError(err, 'Failed to create translation').message);
    }
  }
  useEffect(()=> {
    if (autoSaveRef.current !== null) clearInterval(autoSaveRef.current);
    autoSaveRef.current = window.setInterval(()=> {
      // UX-only improvement: autosave only when dirty.
      if (!dirtyRef.current) return;
      // Prevent duplicate drafts: do not autosave-create before the first manual Save Draft.
      if (!effectiveId) return;
      if (!title.trim()) return;
      if (mutation.isPending) return;
      saveKindRef.current = 'autosave';
      mutation.mutate(undefined);
    }, 30000);
    return ()=> { if (autoSaveRef.current !== null) clearInterval(autoSaveRef.current); };
  }, [effectiveId, title, slug, summary, content, coverImageUrl, coverImagePublicId, category, editorialType, youthPulseTrack, language, translationGroupId, status, tags, scheduledAt, isBreaking, publishedAt, state, district, city, isSponsoredArticle, sponsorBrandName, sponsorDisclosure, sponsorCtaText, sponsorCtaUrl]);

  async function runLanguageCheck(l: 'en'|'hi'|'gu') { try { const res = await verifyLanguage(contentPlain || title, l); setLangIssues(prev => ({ ...prev, [l]: res.issues })); } catch {} }
  async function runReadability(){ try { const res = await readability(contentPlain || title, language); setReadabilityGrade(res.grade); setReadingSeconds(res.readingTimeSec); } catch {} }

  const requiredForPublishOk = useMemo(() => {
    const okTitle = (title || '').trim().length > 0;
    const okCategory = String(category || '').trim().length > 0 && categoryValidForPublish;
    const okContent = (content || '').trim().length >= 50;
    return okTitle && okCategory && okContent;
  }, [title, category, content, categoryValidForPublish]);

  // Role gate stays in place; required fields gate controls enable/disable.
  const roleCanPublish = (userRole === 'admin' || userRole === 'founder');
  const canPublish = roleCanPublish && requiredForPublishOk && publishEnabled;

  const publishMissing: string[] = useMemo(() => {
    const missing: string[] = [];
    if ((title || '').trim().length === 0) missing.push('Title');
    if (!String(category || '').trim()) missing.push('Category');
    if (category && !categoryValidForPublish) missing.push('Valid Category');
    if ((content || '').trim().length < 50) missing.push('Content (min 50 chars)');
    if (isSponsoredArticle && !String(sponsorBrandName || '').trim()) missing.push('Sponsor / Brand Name');
    if (isSponsoredArticle && !String(sponsorDisclosure || '').trim()) missing.push('Sponsor Disclosure');
    if ((String(sponsorCtaText || '').trim() && !String(sponsorCtaUrl || '').trim()) || (!String(sponsorCtaText || '').trim() && String(sponsorCtaUrl || '').trim())) {
      missing.push('CTA Text + CTA URL');
    }
    return missing;
  }, [title, content, category, categoryValidForPublish, isSponsoredArticle, sponsorBrandName, sponsorDisclosure, sponsorCtaText, sponsorCtaUrl]);

  const previewEnabled = (title || '').trim().length > 0 && (content || '').trim().length > 0;
  const publishTooltip = !publishEnabled
    ? 'Publishing temporarily disabled'
    : (!roleCanPublish ? 'Not authorized to publish' : (publishMissing.length ? `Fill ${publishMissing.join(', ')}` : undefined));

  const currentHash = useMemo(() => {
    return snapshotHash(buildSnapshot());
  }, [title, slug, summary, content, category, editorialType, youthPulseTrack, language, translationGroupId, status, tags, coverImageUrl, coverImagePublicId, isBreaking, publishedAt, state, district, city, isSponsoredArticle, sponsorBrandName, sponsorDisclosure, sponsorCtaText, sponsorCtaUrl]);

  const isDirty = useMemo(() => {
    return currentHash !== lastSavedHash;
  }, [currentHash, lastSavedHash]);

  useEffect(() => {
    dirtyRef.current = isDirty;
    onDirtyChange?.(isDirty);
  }, [isDirty]);

  // Navigation guard: warn on refresh/back/tab close when dirty.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const saveStatusText = useMemo(() => {
    if (isPublishing) return 'Publishing…';
    if (isSaving || mutation.isPending) return 'Saving…';
    if (autosaveFailed) return 'Autosave failed — retry';
    if (!lastSavedAt) return isDirty ? 'Unsaved changes' : 'Not saved yet';
    const time = new Date(lastSavedAt);
    const timeLabel = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isDirty) return 'Unsaved changes';
    return `All changes saved · ${timeLabel}`;
  }, [autosaveFailed, isDirty, isPublishing, isSaving, lastSavedAt, mutation.isPending]);

  const languageOk = founderOverride || ['en', 'hi', 'gu'].every((l) => ((langIssues as any)[l] || []).length === 0);
  const seoBadgeText = '—';
  const readabilityBadgeText = typeof readabilityGrade === 'number' ? String(readabilityGrade) : '—';

  const accordionItems: AccordionItem[] = useMemo(() => {
    const hasLangIssues = !languageOk;

    const badgeClsOk = 'text-[11px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700';
    const badgeClsWarn = 'text-[11px] px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800';

    return [
      {
        id: 'lang',
        title: 'Language Guard',
        badge: <span className={languageOk ? badgeClsOk : badgeClsWarn}>{languageOk ? '✅' : '⚠️'}</span>,
        defaultOpen: false,
        forceOpenWhen: hasLangIssues,
        children: (
          <div className="space-y-3">
            <div className="flex gap-2 flex-wrap">
              {(['en','hi','gu'] as const).map(l => (
                <button type="button" key={l} onClick={()=>runLanguageCheck(l)} className="btn-secondary text-xs">Check {l.toUpperCase()}</button>
              ))}
            </div>
            <div className="space-y-2">
              {(['en','hi','gu'] as const).map(l => (
                <div key={l} className="text-xs">
                  <strong>{l.toUpperCase()}:</strong> {(langIssues[l]||[]).length === 0 ? 'No issues ✅' : `${(langIssues[l]||[]).length} issues`}
                  {(langIssues[l]||[]).map((iss,i)=>(<div key={i} className="text-red-600">• {iss.message}</div>))}
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        id: 'seo',
        title: 'SEO Preview',
        badge: <span className={badgeClsOk}>{seoBadgeText}</span>,
        defaultOpen: false,
        forceOpenWhen: false,
        children: (
          <div className="space-y-1">
            <div className="text-xs">Title Tag Preview: {title || 'Untitled'} | News Pulse</div>
            <div className="text-xs">Meta Description: {(summary||'').slice(0,140)}</div>
          </div>
        ),
      },
      {
        id: 'readability',
        title: 'Readability',
        badge: <span className={badgeClsOk}>{readabilityBadgeText}</span>,
        defaultOpen: false,
        forceOpenWhen: false,
        children: (
          <div className="space-y-2">
            <button type="button" onClick={runReadability} className="btn-secondary text-xs">Analyze</button>
            <div className="text-xs">Grade: {readabilityGrade ?? '—'}</div>
            <div className="text-xs">Reading Time: {readingSeconds ? `${readingSeconds}s` : '—'}</div>
          </div>
        ),
      },
    ];
  }, [content, language, langIssues, languageOk, readabilityBadgeText, readabilityGrade, readingSeconds, runLanguageCheck, runReadability, seoBadgeText, summary, title]);

  async function beginPublishFlow() {
    if (isSaving || isPublishing) return;
    if (!canPublish) return;
    if (!allTranslationsComplete) {
      toast.error('Complete the English, Hindi and Gujarati versions before publishing.');
      return;
    }
    // Guard: required fields
    if (publishMissing.length > 0) return;

    // Client-side slug fix-up before publish
    const fixed = ensureValidSlug(slug, title);
    if (fixed && fixed !== slug) {
      setSlug(fixed);
      setAutoSlug(false);
    }

    // Slug uniqueness gate (final check before publish)
    if (fixed) {
      const alreadyChecked = slugCheck.checkedSlug === fixed && (slugCheck.status === 'available');
      if (!alreadyChecked) {
        const ok = await runSlugAvailabilityCheck(fixed);
        if (!ok) {
          toast.error('Slug already exists. Please choose a unique slug.');
          return;
        }
      }
    }

    const needsLangConfirm = !founderOverride && !languageOk;

    const proceed = () => {
      if (!publishedAt) setPublishedAt(new Date().toISOString());
      handlePublish();
    };

    if (needsLangConfirm) {
      setConfirmState({
        title: 'Language issues detected — publish anyway?',
        description: 'Language Guard found issues. You can publish anyway, but review is recommended.',
        confirmLabel: 'Publish Anyway',
        cancelLabel: 'Cancel',
        onConfirm: () => { setConfirmState(null); proceed(); },
      });
      return;
    }

    proceed();
  }

  const previewDraft = getDraftForLanguage(previewLanguage);
  const previewLanguageEnabled = (code: LangCode) => {
    const draft = getDraftForLanguage(code);
    return !!(draft.title.trim() && draft.content.trim());
  };
  const sourceLanguageForReview = translationSourceLanguage || language;
  const translationStatusVisible = !!effectiveId || !!translationGroupIdTrimmed;
  const automaticProgressLabel = (() => {
    if (translationJobStatus === 'failed') return 'Failed';
    if (translationJobStatus === 'outdated') return 'Outdated';
    if (automaticTranslationMutation.isPending || translationJobStatus === 'translating') return 'Translating';
    const targets = translationTargets.filter((code) => code !== language);
    if (!targets.length) return 'Waiting';
    const readyCount = targets.filter((code) => !!translationVariants[code]).length;
    if (readyCount === targets.length && readyCount > 0) return 'Ready for review';
    if (readyCount > 0) return 'Partially completed';
    return 'Waiting';
  })();
  const getAutomaticTranslationStatusLabel = (code: LangCode): string => {
    if (code === sourceLanguageForReview) return 'Source';
    if (translationJobStatus === 'failed' && translationTargets.includes(code)) return 'Translation failed';
    if (translationJobStatus === 'outdated' && translationTargets.includes(code)) return 'Outdated';
    const syncEntry = translationSyncStatuses[code];
    if (syncEntry?.state === 'regenerating') return automaticTranslationMutation.isPending ? 'Translating' : 'Queued';
    if (translationVariants[code]) return 'Ready for review';
    return translationStatusVisible ? 'Missing' : '';
  };
  return (
    <form onSubmit={e=> { e.preventDefault(); void beginPublishFlow(); }} className="space-y-6 pb-28">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:h-[calc(100vh-10rem)] md:overflow-hidden md:items-start">
        {/* LEFT: Main editor */}
        <div className="md:col-span-8 space-y-4 md:h-full md:overflow-auto md:pr-2">
          <div className="card p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium">Title</label>
              <input value={title} onChange={e=> setTitle(e.target.value)} className="w-full border px-2 py-2 rounded" required />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">Slug</label>
                <label className="text-xs flex items-center gap-1 select-none">
                  <input type="checkbox" checked={autoSlug} onChange={e=> setAutoSlug(e.target.checked)} /> Auto
                </label>
              </div>
              <input
                value={slug}
                onChange={e=> {
                  setSlug(e.target.value);
                  if (slugCheck.checkedSlug && slugCheck.checkedSlug !== e.target.value) {
                    setSlugCheck(s => ({ ...s, status: s.status === 'checking' ? 'checking' : 'idle' }));
                  }
                }}
                onBlur={() => {
                  const fixed = ensureValidSlug(slug, title);
                  if (fixed && fixed !== slug) {
                    setSlug(fixed);
                    setAutoSlug(false);
                    void runSlugAvailabilityCheck(fixed);
                    return;
                  }
                  void runSlugAvailabilityCheck((slug || '').trim());
                }}
                className="w-full border px-2 py-2 rounded"
              />

              <div className="mt-2 text-xs">
                <div className="text-slate-600">Preview: /story/{ensureValidSlug(slug, title) || '<slug>'}</div>
                {slugCheck.status === 'checking' && <span className="text-slate-600">Checking…</span>}
                {slugCheck.status === 'available' && <span className="text-green-700">✅ Slug available</span>}
                {slugCheck.status === 'taken' && <span className="text-red-600">Slug already exists</span>}
                {slugCheck.status === 'error' && <span className="text-amber-700">{slugCheck.message || 'Could not verify slug availability'}</span>}
              </div>

              {slugCheck.status === 'taken' && (slugCheck.suggestions?.length ?? 0) > 0 && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-600">Try:</span>
                  {slugCheck.suggestions!.map(sug => (
                    <button
                      type="button"
                      key={sug}
                      className="text-xs px-2 py-1 rounded border bg-white hover:bg-slate-50"
                      onClick={() => {
                        setSlug(sug);
                        setAutoSlug(false);
                        void runSlugAvailabilityCheck(sug);
                      }}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}

            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">Summary</label>
                <label className="text-xs flex items-center gap-1 select-none">
                  <input type="checkbox" checked={autoSummary} onChange={e=> setAutoSummary(e.target.checked)} /> Auto
                </label>
              </div>
              <textarea value={summary} onChange={e=> setSummary(e.target.value)} rows={3} className="w-full border px-2 py-2 rounded" />
              {breakingChecked && !summary.trim() && (
                <div className="mt-1 text-[11px] text-amber-700">Summary is recommended for breaking stories (ticker previews look better).</div>
              )}
              <div className="mt-2 flex gap-2 flex-wrap">
                {summary.length > 200 && <button type="button" onClick={trimSummaryTo160} className="btn-secondary text-[11px] px-2 py-1">Trim to ~160</button>}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-medium">Content</label>
                <div className="text-xs text-slate-600">Words: {wordCount}</div>
              </div>
              {isSponsoredArticle ? (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  Sponsored Article is on. This story will keep sponsor details separate from normal editorial content.
                </div>
              ) : null}
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Write article content…"
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <aside className="md:col-span-4 space-y-3 md:h-full md:overflow-auto md:pr-2">
          <div className="card p-4">
            <div className="text-sm font-semibold mb-3">Publishing Settings</div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium">Category</label>
                <select value={category} onChange={e=> setCategory(e.target.value)} className="w-full border px-2 py-2 rounded">
                  <option value="" disabled>Select category…</option>
                  {ARTICLE_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
                {roleCanPublish && publishEnabled && !String(category || '').trim() && ((title || '').trim() || (content || '').trim()) && (
                  <div className="mt-1 text-xs text-red-600">Category is required to publish.</div>
                )}
                {category && !categoryValidForPublish && (
                  <div className="mt-1 text-xs text-red-600">Category is not allowed. Please choose a supported category.</div>
                )}
              </div>

              {category === 'editorial' && (
                <div>
                  <label className="block text-xs font-medium">Editorial Type</label>
                  <select value={editorialType} onChange={e=> setEditorialType(normalizeEditorialType(e.target.value))} className="w-full border px-2 py-2 rounded">
                    <option value="editorial">Editorial</option>
                    <option value="special_story">Special Story</option>
                  </select>
                </div>
              )}

              {category === 'youth-pulse' && (
                <div>
                  <label className="block text-xs font-medium">Youth Pulse Track</label>
                  <select value={youthPulseTrack} onChange={e=> setYouthPulseTrack((e.target.value || '') as YouthPulseTrack | '')} className="w-full border px-2 py-2 rounded">
                    <option value="">Select Youth Pulse track…</option>
                    {YOUTH_PULSE_TRACK_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-xs font-medium">Location Tags (Gujarat)</div>
                  <button
                    type="button"
                    className="text-[11px] text-slate-600 hover:text-slate-900 underline"
                    onClick={() => setLocationTagsCollapsed((v) => !v)}
                  >
                    {locationTagsCollapsed ? 'Show' : 'Minimize'}
                  </button>
                </div>
                {!locationTagsCollapsed && (
                  <>
                    <input
                      value={locationSearch}
                      onChange={(e) => setLocationSearch(e.target.value)}
                      className="w-full border px-2 py-2 rounded text-sm"
                      placeholder="Search districts / cities…"
                    />

                    <div className="mt-2 text-[11px] text-slate-600">Districts</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {filteredDistricts.map((d) => {
                        const tag = `district:${d.slug}`;
                        const selected = selectedDistrictSlugs.has(d.slug);
                        return (
                          <button
                            type="button"
                            key={d.slug}
                            onClick={() => toggleGujaratLocationTag(tag)}
                            className={`px-2 py-1 rounded-full text-xs border ${selected ? 'bg-black text-white' : 'bg-white'}`}
                            title={tag}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 text-[11px] text-slate-600">Cities</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {filteredCities.map((c) => {
                        const tag = `city:${c.slug}`;
                        const selected = selectedCitySlugs.has(c.slug);
                        return (
                          <button
                            type="button"
                            key={c.slug}
                            onClick={() => toggleGujaratLocationTag(tag)}
                            className={`px-2 py-1 rounded-full text-xs border ${selected ? 'bg-black text-white' : 'bg-white'}`}
                            title={tag}
                          >
                            {c.label}
                          </button>
                        );
                      })}
                    </div>

                    <details className="mt-3">
                      <summary className="text-[11px] text-slate-600 cursor-pointer select-none">Other location fields (optional)</summary>
                      <div className="mt-2 space-y-2">
                        <input value={state} onChange={e=> setState(e.target.value)} className="w-full border px-2 py-2 rounded text-sm" placeholder="State" />
                        <input value={district} onChange={e=> setDistrict(e.target.value)} className="w-full border px-2 py-2 rounded text-sm" placeholder="District" />
                        <input value={city} onChange={e=> setCity(e.target.value)} className="w-full border px-2 py-2 rounded text-sm" placeholder="City" />
                      </div>
                    </details>
                  </>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium">Language</label>
                <select value={language} onChange={e=> selectLanguageWorkspace(normalizeLang(e.target.value))} className="w-full border px-2 py-2 rounded" required>
                  <option value="en">English (en)</option>
                  <option value="hi">Hindi (hi)</option>
                  <option value="gu">Gujarati (gu)</option>
                </select>
                {!languagesQuery.isLoading && !languageValidForPublish && language && (
                  <div className="mt-1 text-xs text-red-600">Selected language is not supported.</div>
                )}
                {mixedScriptWarnings.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {mixedScriptWarnings.map((m) => (
                      <div key={m} className="text-[11px] text-amber-700">{m}</div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-slate-900">Automatic Translation</div>
                  {translationStatusVisible ? (
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700">{automaticProgressLabel}</span>
                  ) : null}
                </div>

                <div className="mt-3 space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-700">Source Language</label>
                    <div className="rounded border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800">
                      {ARTICLE_LANGUAGE_LABELS[language]} ({language})
                    </div>
                    <div className="mt-1 text-[11px] text-slate-500">Change this with the existing Language field above.</div>
                  </div>

                  <div>
                    <div className="text-[11px] font-medium text-slate-700">Translate into</div>
                    <div className="mt-1 grid grid-cols-1 gap-1">
                      {ARTICLE_LANGUAGE_CODES.map((code) => {
                        const isSource = code === language;
                        const checked = !isSource && translationTargets.includes(code);
                        return (
                          <label key={`translate-target-${code}`} className={`flex items-center gap-2 text-xs ${isSource ? 'text-slate-400' : 'text-slate-700'}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isSource}
                              onChange={(e) => {
                                setTranslationTargets((prev) => {
                                  const next = new Set(prev.filter((item) => item !== language));
                                  if (e.target.checked) next.add(code);
                                  else next.delete(code);
                                  return ARTICLE_LANGUAGE_CODES.filter((item) => next.has(item));
                                });
                              }}
                            />
                            {ARTICLE_LANGUAGE_LABELS[code]}{isSource ? ' (source)' : ''}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={automaticTranslationMutation.isPending || mutation.isPending}
                      onClick={() => {
                        if (!effectiveId) {
                          toast('Save Draft will save the source and queue translations.');
                          saveDraft();
                          return;
                        }
                        triggerAutomaticTranslationJob(effectiveId, 'generate');
                      }}
                    >Generate Translations</button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={automaticTranslationMutation.isPending || mutation.isPending}
                      onClick={() => triggerAutomaticTranslationJob(effectiveId, 'regenerate')}
                    >Regenerate Translations</button>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={generateTranslationsAfterSave}
                      onChange={(e) => setGenerateTranslationsAfterSave(e.target.checked)}
                    />
                    Generate translations after Save Draft
                  </label>

                  {translationStatusVisible ? (
                    <div className="rounded border border-slate-200 bg-white p-2">
                      <div className="text-[11px] font-semibold text-slate-700">Translation Status</div>
                      <div className="mt-2 space-y-1 text-[11px]">
                        {ARTICLE_LANGUAGE_CODES.map((code) => {
                          const variant = translationVariants[code];
                          const variantId = String((variant as any)?._id || (variant as any)?.id || '').trim();
                          const statusLabel = getAutomaticTranslationStatusLabel(code);
                          return (
                            <div key={`auto-status-${code}`} className="flex items-center justify-between gap-2">
                              <span className="text-slate-700">{ARTICLE_LANGUAGE_LABELS[code]}</span>
                              <div className="flex items-center gap-2">
                                <span className={statusLabel === 'Translation failed' ? 'text-red-700' : statusLabel === 'Missing' || statusLabel === 'Outdated' ? 'text-amber-700' : 'text-slate-700'}>
                                  {statusLabel}
                                </span>
                                {variantId && code !== sourceLanguageForReview ? (
                                  <button
                                    type="button"
                                    className="underline text-slate-700 hover:text-slate-900"
                                    onClick={() => navigate(`/admin/articles/${encodeURIComponent(variantId)}/edit`)}
                                  >Review {ARTICLE_LANGUAGE_LABELS[code]}</button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium">Translation Group ID (optional)</label>
                <input
                  value={translationGroupId}
                  onChange={(e) => setTranslationGroupId(e.target.value)}
                  className="w-full border px-2 py-2 rounded text-sm"
                  placeholder="Leave empty to auto-generate on save"
                />
                {translationGroupId ? (
                  <div className="mt-1 text-[11px] text-slate-500">Group: {translationGroupId}</div>
                ) : (
                  <div className="mt-1 text-[11px] text-slate-500">Save once to generate a group id.</div>
                )}

                {translationGroupIdTrimmed ? (
                  <div className="mt-3 rounded border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold">Translations</div>
                      <div className="text-[11px] text-slate-600">
                        {groupStatus ? `Group Status: ${groupStatus}` : 'Group Status: —'}
                      </div>
                    </div>

                    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">Article Mode</div>
                          <div className="text-sm font-semibold text-slate-900">
                            {isMasterArticle ? 'Master Article' : 'Linked Version'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[11px] uppercase tracking-wide text-slate-500">Linked Versions</div>
                          <div className="mt-1 flex flex-wrap justify-end gap-1">
                            {(['en', 'hi', 'gu'] as const).map((code) => {
                              const present = linkedVersionCodes.includes(code);
                              return (
                                <span
                                  key={`linked-${code}`}
                                  className={
                                    'inline-flex rounded-full border px-2 py-0.5 text-[11px] ' +
                                    (present ? 'border-slate-300 bg-white text-slate-800' : 'border-slate-200 bg-slate-100 text-slate-400')
                                  }
                                >
                                  {code.toUpperCase()}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {isMasterArticle ? (
                        <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-900">
                          Linked language versions stay separate. Publishing or changing media here does not update other stories.
                        </div>
                      ) : null}
                    </div>

                    {translationGroupQuery.isFetching ? (
                      <div className="mt-2 text-[11px] text-slate-500">Loading variants…</div>
                    ) : null}
                    {translationGroupQuery.isError ? (
                      <div className="mt-2 text-[11px] text-amber-700">Could not load translation variants.</div>
                    ) : null}

                    <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                      <div className="text-xs font-semibold text-slate-900">Translation Sync Status</div>
                      <div className="mt-2 space-y-2">
                        {(['en', 'hi', 'gu'] as const).map((code) => {
                          const syncEntry = translationSyncStatuses[code];
                          const tone = getTranslationSyncTone(syncEntry.state);
                          const badgeCls = tone === 'ok'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : tone === 'warn'
                              ? 'border-amber-200 bg-amber-50 text-amber-800'
                              : 'border-slate-200 bg-white text-slate-700';

                          return (
                            <div key={`sync-${code}`} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="font-medium text-slate-700">{languageLabel(code)}</span>
                              <div className="flex items-center gap-2">
                                {syncEntry.detail ? <span className="text-slate-500">{syncEntry.detail}</span> : null}
                                <span className={`inline-flex rounded-full border px-2 py-0.5 ${badgeCls}`}>
                                  {getTranslationSyncLabel(syncEntry.state)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-2 space-y-2">
                      {(['en', 'hi', 'gu'] as const).map((code) => {
                        const v = translationVariants[code];
                        const badges = getTranslationBadges(v);
                        const isActive = language === code;
                        const idForVariant = v?._id || v?.id || null;
                        const isPresent = !!v;

                        return (
                          <div key={code} className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              className={
                                'px-2 py-1 rounded border text-xs ' +
                                (isActive ? 'bg-black text-white border-black' : 'bg-white hover:bg-slate-50')
                              }
                              onClick={() => {
                                if (isActive) return;
                                if (idForVariant) {
                                  navigate(`/admin/articles/${encodeURIComponent(String(idForVariant))}/edit`);
                                  return;
                                }
                              }}
                              title={idForVariant ? 'Open this language variant' : 'Variant not created yet'}
                            >
                              {code.toUpperCase()}
                            </button>

                            <div className="flex flex-wrap items-center justify-center gap-1">
                              {badges.map((badge) => {
                                const badgeCls = badge.tone === 'ok'
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                                  : badge.tone === 'warn'
                                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                                    : 'border-slate-200 bg-slate-50 text-slate-700';

                                return (
                                  <span key={`${code}-${badge.text}`} className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] ${badgeCls}`}>
                                    {badge.text}
                                  </span>
                                );
                              })}
                            </div>

                            <div className="flex items-center gap-2">
                              {idForVariant ? (
                                <button
                                  type="button"
                                  className="text-[11px] underline text-slate-700 hover:text-slate-900"
                                  onClick={() => navigate(`/admin/articles/${encodeURIComponent(String(idForVariant))}/edit`)}
                                  disabled={isActive}
                                >
                                  {isActive ? 'Editing' : 'Edit'}
                                </button>
                              ) : !isPresent ? (
                                <button
                                  type="button"
                                  className="text-[11px] underline text-slate-700 hover:text-slate-900"
                                  onClick={() => createLinkedTranslation(code)}
                                >
                                  Create
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-500">Covered</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-2 text-[11px] text-slate-600">
                      {isMasterArticle
                        ? 'Publishing this story affects only this story. Linked versions must be reviewed and published separately.'
                        : 'This linked version stays separate from the master article for publish and media changes.'}
                    </div>
                  </div>
                ) : null}

                {effectiveId && String(translationGroupId || '').trim() ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {language !== 'hi' ? (
                      <button
                        type="button"
                        className="px-2 py-1 rounded border text-xs bg-white hover:bg-slate-50"
                        onClick={() => createLinkedTranslation('hi')}
                      >Create Hindi version</button>
                    ) : null}
                    {language !== 'gu' ? (
                      <button
                        type="button"
                        className="px-2 py-1 rounded border text-xs bg-white hover:bg-slate-50"
                        onClick={() => createLinkedTranslation('gu')}
                      >Create Gujarati version</button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div>
                <label className="block text-xs font-medium">Status</label>
                <select
                  value={status}
                  onChange={e=> {
                    setStatus(e.target.value as any);
                    setStatusExplicitlyChanged(true);
                  }}
                  disabled={userRole==='writer'}
                  className="w-full border px-2 py-2 rounded"
                >
                  <option value='draft'>Draft</option>
                  <option value='scheduled'>Scheduled</option>
                  {(userRole==='admin'||userRole==='founder') && <option value='published'>Published</option>}
                </select>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-900">Sponsored Article</div>
                    <div className="mt-1 text-[11px] text-slate-600">Use this only for paid article pages so normal editorial stories stay separate and clean.</div>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={isSponsoredArticle}
                      onChange={(e) => setIsSponsoredArticle(e.target.checked)}
                    />
                    Mark as Sponsored Article
                  </label>
                </div>

                {isSponsoredArticle ? (
                  <div className="mt-3 space-y-3">
                    <div>
                      <label className="block text-xs font-medium">Sponsor / Brand Name</label>
                      <input
                        value={sponsorBrandName}
                        onChange={(e) => setSponsorBrandName(e.target.value)}
                        className="w-full border px-2 py-2 rounded text-sm"
                        placeholder="Enter sponsor or brand name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium">Sponsor Disclosure</label>
                      <input
                        value={sponsorDisclosure}
                        onChange={(e) => setSponsorDisclosure(e.target.value)}
                        className="w-full border px-2 py-2 rounded text-sm"
                        placeholder="Example: Sponsored by Brand Name"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <label className="block text-xs font-medium">CTA Text</label>
                        <input
                          value={sponsorCtaText}
                          onChange={(e) => setSponsorCtaText(e.target.value)}
                          className="w-full border px-2 py-2 rounded text-sm"
                          placeholder="Example: Learn More"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium">CTA URL</label>
                        <input
                          value={sponsorCtaUrl}
                          onChange={(e) => setSponsorCtaUrl(e.target.value)}
                          className="w-full border px-2 py-2 rounded text-sm"
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      These fields control the Sponsored Article page CTA directly. If you leave them blank, the public page only falls back to a linked Sponsored Feature CTA when a real combo link exists.
                    </div>
                    <div className="text-[11px] text-slate-600">
                      When Mark as Sponsored Article is on, this article saves and publishes as a Sponsored Article without changing the normal Add Article flow.
                    </div>
                  </div>
                ) : null}
              </div>
              {status === 'scheduled' && (
                <div>
                  <label className="block text-xs font-medium">Schedule (UTC)</label>
                  <input type="datetime-local" value={scheduledAt} onChange={e=> setScheduledAt(e.target.value)} className="w-full border px-2 py-2 rounded" />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium mb-1">Tags</label>
                <TagInput value={tags} onChange={setTagsSafe} />
              </div>

              {/* Cover Image (Upload-only) */}
              <div className="pt-3 border-t border-slate-200">
                <CoverImageUpload
                  url={coverImageUrl}
                  file={coverImageFile}
                  disabled={!coverUploadEnabled || mediaStatusQuery.isLoading}
                  disabledText={coverUploadStatusText}
                  disabledDetail={coverUploadStatusDetail}
                  onChangeFile={(f) => {
                    setCoverUploadOk(false);
                    setCoverUploadError(null);
                    setCoverImageFile(f);
                    if (f) void uploadSelectedCover(f);
                  }}
                  onRemove={() => {
                    setCoverImageFile(null);
                    setCoverImage(null);
                    setCoverUploadOk(false);
                    setCoverUploadError(null);
                  }}
                  onChooseFromLibrary={() => setCoverMediaLibraryOpen(true)}
                />
                {isUploadingCover && <div className="mt-1 text-[11px] text-slate-500">Uploading…</div>}
                {!isUploadingCover && coverUploadOk && coverImageUrl ? (
                  <div className="mt-1 text-[11px] text-slate-600">Uploaded</div>
                ) : null}
                {!isUploadingCover && coverUploadError ? (
                  <div className="mt-1 text-[11px] text-red-600">{coverUploadError}</div>
                ) : null}
              </div>

              {(userRole==='founder') && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-sm font-semibold mb-2">Founder Override</div>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={founderOverride} onChange={e=> setFounderOverride(e.target.checked)} /> Enable Force Publish
                  </label>
                  {founderOverride && <div className="text-xs text-red-600 mt-1">Publishing will ignore language issues.</div>}
                </div>
              )}
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="text-sm font-semibold">Quality Tools</div>
              <button
                type="button"
                className="text-xs text-slate-600 hover:text-slate-900 underline"
                onClick={() => setQualityToolsCollapsed((v) => !v)}
              >
                {qualityToolsCollapsed ? 'Show' : 'Minimize'}
              </button>
            </div>
            {!qualityToolsCollapsed && <Accordion items={accordionItems} />}
          </div>
        </aside>
      </div>

      <PreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        article={{
          title: previewDraft.title,
          slug: previewDraft.slug,
          summary: previewDraft.summary,
          content: previewDraft.content,
          coverImageUrl: coverImageUrl || undefined,
          category,
          editorialType: category === 'editorial' ? editorialType : undefined,
          language: previewLanguage,
          status,
          scheduledAt,
          tags,
        }}
      />

      <MediaLibrarySelector
        open={coverMediaLibraryOpen}
        mode="image"
        title="Choose Cover Image"
        actionLabel="Use as Cover"
        onClose={() => setCoverMediaLibraryOpen(false)}
        onSelect={chooseCoverFromMediaLibrary}
      />

      {publishSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <div className="text-sm font-semibold text-slate-900">
              {publishSuccess.syncResults ? 'Published and synced' : 'Published ✅ (Translations pending)'}
            </div>
            <div className="mt-1 text-xs text-slate-600">
              {publishSuccess.id ? `Article ID: ${publishSuccess.id}` : 'Article published'}
            </div>
            {publishSuccess.syncResults ? (
              <div className="mt-3 rounded border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-semibold text-slate-900">Sync Results</div>
                <div className="mt-2 space-y-1 text-[11px] text-slate-700">
                  {(['en', 'hi', 'gu'] as const).map((code) => (
                    <div key={`publish-sync-${code}`}>{publishSuccess.syncResults?.[code] || `${code.toUpperCase()} needs refresh`}</div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const url = publishSuccess.viewUrl;
                  setPublishSuccess(null);
                  if (url) window.open(url, '_blank', 'noreferrer');
                }}
              >
                View Live
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  const id = publishSuccess.id;
                  setPublishSuccess(null);
                  const qs = new URLSearchParams();
                  qs.set('status', 'published');
                  if (id) qs.set('highlight', String(id));
                  navigate(`/admin/articles?${qs.toString()}`);
                }}
              >
                Go to Manage News
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  resetToNewArticle();
                }}
              >
                New Article
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmState}
        title={confirmState?.title || ''}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        cancelLabel={confirmState?.cancelLabel}
        onCancel={() => setConfirmState(null)}
        onConfirm={() => confirmState?.onConfirm()}
      />

      {/* Optional helpful banner on missing backend route */}
      {mutation.isError && (mutation.error as any)?.response?.status === 404 && (
        <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 px-3 py-2 text-sm">
          Backend route missing (articles). Check backend deployment.
        </div>
      )}

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="text-sm text-slate-600 flex items-center gap-2">
            <span
              className={
                autosaveFailed
                  ? 'text-red-700 font-medium'
                  : (isDirty ? 'text-slate-700 font-medium' : 'text-green-700')
              }
            >
              {saveStatusText}
            </span>
            {autosaveFailed && (
              <button
                type="button"
                className="text-xs underline text-red-700"
                onClick={() => {
                  setAutosaveFailed(false);
                  setAutosaveError(null);
                  saveKindRef.current = 'manual';
                  saveDraft();
                }}
                title={autosaveError || undefined}
              >Retry</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(effectiveId && translationStatus === 'failed') && (
              <button
                type="button"
                onClick={() => retryTranslationMutation.mutate()}
                className="btn-secondary"
                disabled={retryTranslationMutation.isPending || isSaving || isPublishing}
              >
                {retryTranslationMutation.isPending ? 'Retrying…' : 'Retry Translation'}
              </button>
            )}
            <button type="button" onClick={saveDraft} className="btn-secondary" disabled={isSaving || isPublishing || mutation.isPending}>Save Draft</button>
            <button
              type="button"
              onClick={() => openPreviewForLanguage(language)}
              className="btn-secondary"
              disabled={!previewEnabled}
              title={!previewEnabled ? 'Add Title and Content to preview' : undefined}
            >Preview</button>
            <span className="inline-flex" title={publishTooltip}>
              <button
                type="button"
                onClick={() => { void beginPublishFlow(); }}
                className="btn"
                disabled={!canPublish || isSaving || isPublishing}
              >
                {isPublishing ? 'Publishing…' : 'Publish'}
              </button>
            </span>
          </div>
        </div>
      </div>
    </form>
  );
};

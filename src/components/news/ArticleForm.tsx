import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createArticle, updateArticle, getArticle, type Article } from '@/lib/api/articles';
import apiClient from '@/lib/api';
import toast from 'react-hot-toast';
import { verifyLanguage, readability } from '@/lib/api/language';
import { ptiCheck } from '@/lib/api/compliance';
import TagInput from '@/components/ui/TagInput';
import Accordion, { type AccordionItem } from '@/components/ui/Accordion';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { uniqueSlug } from '@/lib/slug';
import { readingTimeSec } from '@/lib/readtime';
import AiAssistantTipBox from '@/components/news/AiAssistantTipBox';
import { assistSuggestV2, type AssistSuggestV2Response } from '@/lib/api/assist';
import { usePublishFlag } from '@/context/PublishFlagContext';
import { normalizeError } from '@/lib/error';
import PreviewModal from '@/components/preview/PreviewModal';
import { buildSlugSuggestions, checkSlugAvailability } from '@/lib/slugAvailability';
import CoverImageUpload from '@/components/articles/CoverImageUpload';
import { uploadCoverImage } from '@/lib/api/media';
import { ARTICLE_CATEGORY_OPTIONS, isAllowedArticleCategoryKey, normalizeArticleCategoryKey } from '@/lib/articleCategories';
import { generateArticleSlug } from '@/lib/articleSlug';

type LangCode = 'en' | 'hi' | 'gu';
const DEFAULT_CREATE_LANGUAGE: LangCode = 'gu';

function normalizeLang(input: any): LangCode {
  const v = String(input || '').trim().toLowerCase();
  if (v === 'en' || v === 'hi' || v === 'gu') return v;
  return 'en';
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
}) => {
  const navigate = useNavigate();
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
  const contentTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Always store ONLY a string identifier for the category in state (slug preferred, else _id).
  const [category, setCategory] = useState<string>('');
  const [language, setLanguage] = useState<LangCode>(() => (initialEditId ? 'en' : DEFAULT_CREATE_LANGUAGE));
  const [translationGroupId, setTranslationGroupId] = useState<string>('');
  const [status, setStatus] = useState<'draft'|'scheduled'|'published'>('draft');
  // Keep original status to ensure Save Draft never downgrades/changes live states
  const originalStatusRef = useRef<'draft'|'scheduled'|'published'|'unknown'>('unknown');
  const [tags, setTags] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState<string>('');
  const [ptiStatus, setPtiStatus] = useState<'pending'|'compliant'|'needs_review'>('pending');
  const [ptiReasons, setPtiReasons] = useState<string[]>([]);
  const [langIssues, setLangIssues] = useState<Record<string, any[]>>({});
  const [readabilityGrade, setReadabilityGrade] = useState<number|undefined>();
  const [readingSeconds, setReadingSeconds] = useState<number|undefined>();
  const [founderOverride, setFounderOverride] = useState(false);
  const autoSaveRef = useRef<number | null>(null);
  const [suggestions, setSuggestions] = useState<AssistSuggestV2Response | null>(null);
  const [useLatinSlug, setUseLatinSlug] = useState(true);
  const [tone, setTone] = useState<'neutral'|'impact'|'analytical'>('neutral');
  const [checks, setChecks] = useState<{ seo: any; compliance: any; duplicate: any }>({ seo: null, compliance: null, duplicate: null });
  const suggestCacheRef = useRef<Map<string, AssistSuggestV2Response>>(new Map());
  const { publishEnabled } = usePublishFlag();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [qualityToolsCollapsed, setQualityToolsCollapsed] = useState(false);
  const [breakingControlsCollapsed, setBreakingControlsCollapsed] = useState(false);
  const [locationTagsCollapsed, setLocationTagsCollapsed] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState<null | {
    viewUrl: string;
    slug: string;
    id?: string | null;
  }>(null);

  // Cover image (backend-supported field: imageUrl)
  const [imageUrl, setImageUrl] = useState('');
  const [coverImagePublicId, setCoverImagePublicId] = useState('');
  // Upload-only: selecting a file uploads it and stores a remote URL.
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [isUploadingCover, setIsUploadingCover] = useState(false);

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

  const handleContentPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageFiles: File[] = [];

    for (const item of items) {
      if (item.kind !== 'file') continue;
      const f = item.getAsFile();
      if (!f) continue;
      if (String(f.type || '').startsWith('image/')) imageFiles.push(f);
    }

    if (imageFiles.length === 0) return;

    e.preventDefault();

    const target = e.currentTarget;
    const base = target.value ?? '';
    const start = typeof target.selectionStart === 'number' ? target.selectionStart : base.length;
    const end = typeof target.selectionEnd === 'number' ? target.selectionEnd : start;

    const tokens = imageFiles.map((_, idx) => `__np_clip_img_${Date.now()}_${idx}__`);
    // Insert as HTML so preview can render it (sanitizer allows <img>).
    const inserted = tokens
      .map((t) => `\n\n<p><img src="${t}" alt="pasted-image" /></p>\n`)
      .join('');

    const nextValue = base.slice(0, start) + inserted + base.slice(end);
    setContent(nextValue);

    const nextCaret = start + inserted.length;
    requestAnimationFrame(() => {
      const el = contentTextareaRef.current;
      if (!el) return;
      try {
        el.focus();
        el.setSelectionRange(nextCaret, nextCaret);
      } catch {
        // ignore
      }
    });

    const toastId = toast.loading(`Uploading ${imageFiles.length} image${imageFiles.length === 1 ? '' : 's'}...`);

    void (async () => {
      try {
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const token = tokens[i];
          const { url } = await uploadCoverImage(file);
          setContent((curr) => String(curr || '').replace(token, url));
        }
        toast.success('Images pasted', { id: toastId });
      } catch (err) {
        toast.error(normalizeError(err).message, { id: toastId });
        // If upload fails, remove unresolved tokens so content stays clean.
        setContent((curr) => {
          let cleaned = String(curr || '');
          for (const t of tokens) cleaned = cleaned.replaceAll(t, '');
          return cleaned;
        });
      }
    })();
  };

  const handleContentPasteWithLinks = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    // 1) Images: upload + insert markdown (existing behavior)
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.kind !== 'file') continue;
      const f = item.getAsFile();
      if (!f) continue;
      if (String(f.type || '').startsWith('image/')) imageFiles.push(f);
    }
    if (imageFiles.length > 0) {
      handleContentPaste(e);
      return;
    }

    // 2) Links / Embeds
    const rawText = String(e.clipboardData?.getData('text/plain') || '').trim();
    if (!rawText) return;
    // If clipboard contains multiple tokens/lines, keep default paste.
    if (/\s/.test(rawText)) return;
    if (!/^https?:\/\//i.test(rawText)) return;

    let url: URL | null = null;
    try {
      url = new URL(rawText);
    } catch {
      url = null;
    }
    if (!url) return;

    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const getYoutubeId = (u: URL): string | null => {
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      const path = u.pathname || '';
      if (host === 'youtu.be') {
        const id = path.split('/').filter(Boolean)[0];
        return id || null;
      }
      if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com') || host === 'm.youtube.com') {
        if (path.startsWith('/watch')) return u.searchParams.get('v');
        const m1 = path.match(/^\/(embed|shorts)\/([^/?#]+)/i);
        if (m1?.[2]) return m1[2];
      }
      return null;
    };

    const getInstagramEmbedSrc = (u: URL): string | null => {
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (host !== 'instagram.com') return null;
      const m = (u.pathname || '').match(/^\/(p|reel|tv)\/([^/?#]+)\/?/i);
      if (!m?.[1] || !m?.[2]) return null;
      return `https://www.instagram.com/${m[1]}/${m[2]}/embed`;
    };

    const getXEmbedSrc = (u: URL): string | null => {
      const host = u.hostname.toLowerCase().replace(/^www\./, '');
      if (!(host === 'x.com' || host === 'twitter.com')) return null;
      // twitframe is a lightweight iframe wrapper for tweets
      return `https://twitframe.com/show?url=${encodeURIComponent(u.toString())}`;
    };

    const el = e.currentTarget;
    const base = el.value ?? '';
    const start = typeof el.selectionStart === 'number' ? el.selectionStart : base.length;
    const end = typeof el.selectionEnd === 'number' ? el.selectionEnd : start;

    // If text is selected, paste URL as <a href="...">selected</a>
    if (start !== end) {
      const selectedText = base.slice(start, end);
      if (!selectedText.trim()) return;
      e.preventDefault();
      const replacement = `<a href="${escapeHtml(rawText)}">${escapeHtml(selectedText)}</a>`;
      const nextValue = base.slice(0, start) + replacement + base.slice(end);
      setContent(nextValue);

      const nextCaret = start + replacement.length;
      requestAnimationFrame(() => {
        const node = contentTextareaRef.current;
        if (!node) return;
        try {
          node.focus();
          node.setSelectionRange(nextCaret, nextCaret);
        } catch {
          // ignore
        }
      });
      return;
    }

    // No selection: only auto-embed when the cursor is on an empty line.
    const lineStart = base.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEnd = (() => {
      const idx = base.indexOf('\n', start);
      return idx === -1 ? base.length : idx;
    })();
    const currentLine = base.slice(lineStart, lineEnd);
    if (currentLine.trim() !== '') return;

    const ytId = getYoutubeId(url);
    const ytEmbedSrc = ytId ? `https://www.youtube.com/embed/${ytId}` : null;
    const igEmbedSrc = getInstagramEmbedSrc(url);
    const xEmbedSrc = getXEmbedSrc(url);

    const embedSrc = ytEmbedSrc || igEmbedSrc || xEmbedSrc;
    if (!embedSrc) return;

    e.preventDefault();

    const height = ytEmbedSrc ? 315 : igEmbedSrc ? 560 : 600;
    const allow = ytEmbedSrc
      ? 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
      : undefined;

    const iframe = `<div><iframe src="${escapeHtml(embedSrc)}" width="100%" height="${height}" frameborder="0"${allow ? ` allow=\"${escapeHtml(allow)}\"` : ''} allowfullscreen></iframe></div>`;
    const fallback = `<p><a href="${escapeHtml(rawText)}">${escapeHtml(rawText)}</a></p>`;
    const inserted = `\n${iframe}\n${fallback}\n`;

    const nextValue = base.slice(0, start) + inserted + base.slice(end);
    setContent(nextValue);

    const nextCaret = start + inserted.length;
    requestAnimationFrame(() => {
      const node = contentTextareaRef.current;
      if (!node) return;
      try {
        node.focus();
        node.setSelectionRange(nextCaret, nextCaret);
      } catch {
        // ignore
      }
    });
  };

  const wordCount = useMemo(() => countWords(content), [content]);

  const mixedScriptWarnings = useMemo(() => {
    const w1 = mixedScriptWarning(language, 'Title', title);
    const w2 = mixedScriptWarning(language, 'Summary', summary);
    return [w1, w2].filter(Boolean) as string[];
  }, [language, title, summary]);

  // Admin publish contract fields
  const [isBreaking, setIsBreaking] = useState(false);
  const previousCategoryBeforeBreakingRef = useRef<string>('');
  const [locationSearch, setLocationSearch] = useState('');
  // ISO string (or empty). Set automatically when publishing if empty.
  const [publishedAt, setPublishedAt] = useState('');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');

  type Snapshot = {
    title: string;
    slug: string;
    summary: string;
    content: string;
    category: string;
    language: string;
    translationGroupId: string;
    status: 'draft' | 'scheduled' | 'published';
    tags: string[];
    coverImage: string;
    coverImagePublicId: string;
    isBreaking: boolean;
    publishedAt: string;
    state: string;
    district: string;
    city: string;
  };

  // Used for dirty-state + publish reset.
  const EMPTY_SNAPSHOT: Snapshot = {
    title: '',
    slug: '',
    summary: '',
    content: '',
    category: '',
    language: DEFAULT_CREATE_LANGUAGE,
    translationGroupId: '',
    status: 'draft',
    tags: [],
    coverImage: '',
    coverImagePublicId: '',
    isBreaking: false,
    publishedAt: '',
    state: '',
    district: '',
    city: '',
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
    setCategory('');
    setLanguage(DEFAULT_CREATE_LANGUAGE);
    setTranslationGroupId('');
    setStatus('draft');
    setTags([]);
    setScheduledAt('');
    setIsBreaking(false);
    setPublishedAt('');
    setState('');
    setDistrict('');
    setCity('');
    setPtiStatus('pending');
    setPtiReasons([]);
    setLangIssues({});
    setReadabilityGrade(undefined);
    setReadingSeconds(undefined);
    setFounderOverride(false);
    setSuggestions(null);
    setTone('neutral');
    setChecks({ seo: null, compliance: null, duplicate: null });
    setSlugCheck({ status: 'idle' });
    setImageUrl('');
    setCoverImagePublicId('');
    setCoverImageFile(null);
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
      language: (next?.language ?? language ?? '').toString(),
      translationGroupId: (next?.translationGroupId ?? translationGroupId ?? '').toString(),
      status: (next?.status ?? status) as Snapshot['status'],
      tags: Array.isArray(next?.tags) ? (next?.tags as string[]) : tags,
      coverImage: (next?.coverImage ?? imageUrl ?? '').toString(),
      coverImagePublicId: (next?.coverImagePublicId ?? coverImagePublicId ?? '').toString(),
      isBreaking: (typeof next?.isBreaking === 'boolean') ? next.isBreaking : isBreaking,
      publishedAt: (next?.publishedAt ?? publishedAt ?? '').toString(),
      state: (next?.state ?? state ?? '').toString(),
      district: (next?.district ?? district ?? '').toString(),
      city: (next?.city ?? city ?? '').toString(),
    };
  }

  function snapshotHash(s: Snapshot): string {
    // Stable JSON: fixed key order + normalized values.
    const normalized: Snapshot = {
      title: (s.title || ''),
      slug: (s.slug || ''),
      summary: (s.summary || ''),
      content: (s.content || ''),
      category: (s.category || ''),
      language: (s.language || ''),
      translationGroupId: (s.translationGroupId || ''),
      status: (s.status || 'draft'),
      tags: (Array.isArray(s.tags) ? s.tags : []).map((t) => String(t || '').trim()).filter(Boolean),
      coverImage: (s.coverImage || ''),
      coverImagePublicId: (s.coverImagePublicId || ''),
      isBreaking: !!s.isBreaking,
      publishedAt: (s.publishedAt || ''),
      state: (s.state || ''),
      district: (s.district || ''),
      city: (s.city || ''),
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

  function ensureTag(tag: string) {
    const t = String(tag || '').trim();
    if (!t) return;
    setTags((prev) => dedupeTags([...(Array.isArray(prev) ? prev : []), t]));
  }

  function removeTag(tag: string) {
    const key = normalizeTagKey(tag);
    setTags((prev) => (Array.isArray(prev) ? prev : []).filter((t) => normalizeTagKey(t) !== key));
  }

  function toggleTag(tag: string) {
    if (hasTag(tag)) removeTag(tag);
    else ensureTag(tag);
  }

  function setTagsSafe(next: string[]) {
    setTags(dedupeTags(next));
  }

  const gujaratRegionalChecked = useMemo(() => {
    return hasTag('state:gujarat') || hasTag('gujarat');
  }, [tags]);

  const breakingChecked = useMemo(() => {
    return isBreaking || hasTag('breaking') || String(category || '').trim() === 'breaking';
  }, [isBreaking, category, tags]);

  function handleBreakingToggle(checked: boolean) {
    setIsBreaking(checked);
    if (checked) {
      ensureTag('breaking');
      return;
    }

    removeTag('breaking');
    // If legacy data had category="breaking", clear it so the editor must pick a real category.
    if (String(category || '').trim() === 'breaking') setCategory('');
  }

  function handleGujaratToggle(checked: boolean) {
    if (checked) {
      ensureTag('state:gujarat');
      return;
    }
    removeTag('state:gujarat');
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
      setLanguage(normalizeLang((src as any).lang ?? (src as any).language ?? 'en'));
      setTranslationGroupId(String((src as any).translationGroupId || ''));
      const incomingStatus = (((src as any).status as any) || 'draft') as 'draft'|'scheduled'|'published';
      setStatus(incomingStatus);
      originalStatusRef.current = incomingStatus;
      const incomingTags = Array.isArray((src as any).tags) ? (src as any).tags : [];
      const normalizedTags = dedupeTags(incomingTags as any);
      setTags(normalizedTags);
      setScheduledAt((src as any).scheduledAt ? new Date((src as any).scheduledAt).toISOString().slice(0,16) : '');

      const incomingCategoryKey = String(categorySlug || '').trim();
      const hasBreakingTag0 = (normalizedTags || []).some((t) => normalizeTagKey(t) === 'breaking');
      setIsBreaking(!!(src as any).isBreaking || hasBreakingTag0 || incomingCategoryKey === 'breaking');
      const incomingPublishedAt = (src as any).publishedAt || (src as any).publishAt || '';
      setPublishedAt(incomingPublishedAt ? new Date(incomingPublishedAt).toISOString() : '');
      setState(String((src as any).state || ''));
      setDistrict(String((src as any).district || ''));
      setCity(String((src as any).city || ''));

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

      setImageUrl(String(incomingCoverUrl || ''));
      setCoverImagePublicId(String(incomingCoverPid || ''));
      setCoverImageFile(null);

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
          language: normalizeLang((src as any).lang ?? (src as any).language ?? 'en'),
          translationGroupId: String((src as any).translationGroupId || ''),
          status: ((((src as any).status as any) || 'draft') as any),
          tags: Array.isArray((src as any).tags) ? (src as any).tags : [],
          coverImage: String(incomingCoverUrl || ''),
          coverImagePublicId: String(incomingCoverPid || ''),
          isBreaking: !!(src as any).isBreaking,
          publishedAt: incomingPublishedAt ? new Date(incomingPublishedAt).toISOString() : '',
          state: String((src as any).state || ''),
          district: String((src as any).district || ''),
          city: String((src as any).city || ''),
        });
        setLastSavedSnapshot(s);
        setLastSavedAt(Date.now());
      } catch { /* ignore */ }

      // Ensure we have an effective id for subsequent PUT updates.
      const sid: string | null = (src as any)?._id || (src as any)?.id || null;
      if (sid && sid !== effectiveId) setEffectiveId(String(sid));
    }
  }, [initialValues, data, computedMode]);

  const existingSlugs = useMemo(()=> new Set<string>([]), []);
  useEffect(()=> { if (autoSlug) { uniqueSlug(title, existingSlugs).then(setSlug); } }, [title, autoSlug, existingSlugs]);
  useEffect(()=> { setReadingSeconds(readingTimeSec(content)); }, [content]);

  const languageOptions = useMemo(() => {
    // Hard rule for Option A+ multilingual publishing.
    return ['en', 'hi', 'gu'] as string[];
  }, []);

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
    const c = (contentText || '').trim();
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

  // Debounced v2 suggestions based on title/content/language
  useEffect(()=>{
    if (!title.trim()) return;
    const key = JSON.stringify({ t: title.slice(0, 160), l: language });
    const timer = window.setTimeout(async ()=>{
      const cached = suggestCacheRef.current.get(key);
      if (cached) {
        setSuggestions(cached);
        setChecks({ seo: cached.seo, compliance: cached.compliance, duplicate: cached.duplicate });
        if (autoSlug && !slug) setSlug(useLatinSlug ? cached.slug.latin : cached.slug.native);
        if (autoSummary && !summary.trim()) setSummary(cached.summary.neutral);
        return;
      }
      try {
        const res = await assistSuggestV2({ title, content: content.slice(0,4000), language });
        suggestCacheRef.current.set(key, res);
        setSuggestions(res);
        setChecks({ seo: res.seo, compliance: res.compliance, duplicate: res.duplicate });
        if (autoSlug && !slug) setSlug(useLatinSlug ? res.slug.latin : res.slug.native);
        if (autoSummary && !summary.trim()) setSummary(res.summary.neutral);
      } catch {}
    }, 500);
    return ()=> window.clearTimeout(timer);
  }, [title, content, language, autoSlug, autoSummary, useLatinSlug, slug, summary]);

  function addAttribution(){
    setSummary(s => (/\b(as per|according to|officials|police|sources|report|pti|agency)\b/i.test(s) ? s : s.replace(/\.*$/, '') + '. As per officials, details are being verified.'));
  }
  function trimSummaryTo160(){ setSummary(s => (s.length <= 160 ? s : s.slice(0,160).replace(/\s+\S*$/, '') + '…')); }

  const publishBlocked = !founderOverride && ((checks.compliance?.ptiFlags?.length ?? 0) > 0 || (checks.duplicate?.score ?? 0) >= 0.78);

  const lastSubmitRef = useRef<null | {
    statusToSend: 'draft'|'published';
    safeSlug: string;
    wasNew: boolean;
  }>(null);

  const mutation = useMutation({
    // desiredStatusOverride lets callers force a specific status (e.g., Publish)
    mutationFn: async (desiredStatusOverride?: 'draft'|'scheduled'|'published') => {
      // Ensure we never send an empty/invalid slug on publish/save.
      const safeSlug = ensureValidSlug(slug, title);

      type PublicArticleStatus = 'draft' | 'published';
      const coercePublicStatus = (s: 'draft'|'scheduled'|'published'): PublicArticleStatus => (s === 'published' ? 'published' : 'draft');
      const trimOrUndef = (v: string) => {
        const t = (v || '').trim();
        return t ? t : undefined;
      };

      const buildPublicPayload = (opts: { status: PublicArticleStatus; publishedAt?: string }): {
        title: string;
        slug: string;
        summary: string;
        content: string;
        category?: string;
        postType?: string;
        isFounder?: boolean;
        status: PublicArticleStatus;
        language: 'en'|'hi'|'gu';
        lang: 'en'|'hi'|'gu';
        translationGroupId?: string;
        publishedAt?: string;
        isBreaking: boolean;
        state?: string;
        district?: string;
        city?: string;
        imageUrl?: string;
        coverImageUrl?: string;
        coverImage?: { url: string; publicId?: string };
        tags: string[];
      } => {
        const categoryKeyRaw = (category || '').trim();
        const categoryKey = normalizeArticleCategoryKey(categoryKeyRaw);
        const publishedAtToSend = opts.status === 'published'
          ? (opts.publishedAt || new Date().toISOString())
          : undefined;

        const isViralVideo = categoryKey === 'viral-videos';
        const isFounderEditorial = categoryKey === 'editorial' && userRole === 'founder' && opts.status === 'published';

        const coverUrl = trimOrUndef(imageUrl);
        const coverPid = trimOrUndef(coverImagePublicId);
        return {
          title,
          slug: safeSlug,
          summary,
          content,
          category: categoryKey || undefined,
          postType: isViralVideo ? 'video' : undefined,
          isFounder: isFounderEditorial ? true : undefined,
          status: opts.status,
          language: (language as any) as 'en'|'hi'|'gu',
          lang: (language as any) as 'en'|'hi'|'gu',
          translationGroupId: (translationGroupId || '').trim() ? (translationGroupId || '').trim() : undefined,
          publishedAt: publishedAtToSend,
          isBreaking,
          state: trimOrUndef(state),
          district: trimOrUndef(district),
          city: trimOrUndef(city),
          imageUrl: coverUrl,
          coverImageUrl: coverUrl,
          coverImage: coverUrl ? { url: coverUrl, publicId: coverPid } : undefined,
          tags: Array.isArray(tags) ? tags : [],
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
          // Fallback: backends that only support /publish endpoint
          const res = await apiClient.post(`/articles/${encodeURIComponent(idToPublish)}/publish`);
          const data = (res as any)?.data ?? res;
          return { data: { ...(data as any), __npCreatedId: idToPublish } };
        }
      }

      // Compute safe status to send:
      // - New/draft items => draft
      // - Live items (published/scheduled) => keep original live state
      // - If override provided (e.g., publish), use it explicitly
      let statusToSend: PublicArticleStatus;
      if (desiredStatusOverride) {
        statusToSend = coercePublicStatus(desiredStatusOverride);
      } else if (computedMode === 'create') {
        statusToSend = 'draft';
      } else {
        // Never let "Save Draft" unpublish/un-schedule an already-live article.
        const orig = originalStatusRef.current === 'unknown' ? (status || 'draft') : originalStatusRef.current;
        statusToSend = (orig === 'published') ? 'published' : 'draft';
      }

      lastSubmitRef.current = { statusToSend, safeSlug, wasNew: !effectiveId };

      const publishingViaSave = statusToSend === 'published';
      const publishAtToSend = publishingViaSave ? (publishedAtIso || new Date().toISOString()) : undefined;
      const body = buildPublicPayload({ status: statusToSend, publishedAt: publishAtToSend });
      if (!title.trim()) throw new Error('Title required');
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
      if (computedMode === 'create') return createArticle(body as any);
      return updateArticle(effectiveId!, body as any);
    },
    onSuccess: (result: any) => {
      const raw = result as any;
      const saved = (raw?.article) || (raw?.data?.article) || (raw?.data && typeof raw.data === 'object' ? raw.data : raw);
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

      setLastSavedSnapshot(buildSnapshot({
        slug: safeSlug,
        status: statusToSend,
        translationGroupId: savedGroupId || translationGroupId,
        coverImage: imageUrl,
        coverImagePublicId,
        isBreaking,
        publishedAt,
        state,
        district,
        city,
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
        });
        return;
      } else if (saveKindRef.current !== 'autosave') {
        // Manual "Save Draft" behavior:
        // - New: Draft saved
        // - Existing: Draft updated
        toast.success(wasNew ? 'Draft saved' : 'Draft updated');
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
    setIsUploadingCover(true);
    try {
      const res = await uploadCoverImage(file);
      setImageUrl(res.url);
      setCoverImagePublicId(res.publicId || '');
      toast.success('Image uploaded');
    } catch (err: any) {
      const n = normalizeError(err, 'Cover image upload failed');
      toast.error(n.message);
    } finally {
      setIsUploadingCover(false);
    }
  }

  async function createLinkedTranslation(target: 'hi' | 'gu') {
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
  }, [effectiveId, title, slug, summary, content, imageUrl, coverImagePublicId, category, language, translationGroupId, status, tags, scheduledAt, ptiStatus, isBreaking, publishedAt, state, district, city]);

  async function runLanguageCheck(l: 'en'|'hi'|'gu') { try { const res = await verifyLanguage(content || title, l); setLangIssues(prev => ({ ...prev, [l]: res.issues })); } catch {} }
  async function runPti(){ try { const res = await ptiCheck({ title, content }); setPtiStatus(res.status === 'compliant' ? 'compliant' : 'needs_review'); setPtiReasons(res.reasons); } catch {} }
  async function runReadability(){ try { const res = await readability(content || title, language); setReadabilityGrade(res.grade); setReadingSeconds(res.readingTimeSec); } catch {} }

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
    return missing;
  }, [title, content, category, categoryValidForPublish]);

  const previewEnabled = (title || '').trim().length > 0 && (content || '').trim().length > 0;
  const publishTooltip = !publishEnabled
    ? 'Publishing temporarily disabled'
    : (!roleCanPublish ? 'Not authorized to publish' : (publishMissing.length ? `Fill ${publishMissing.join(', ')}` : undefined));

  const currentHash = useMemo(() => {
    return snapshotHash(buildSnapshot());
  }, [title, slug, summary, content, category, language, translationGroupId, status, tags, imageUrl, coverImagePublicId, isBreaking, publishedAt, state, district, city]);

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

  const ptiOk = ptiStatus === 'compliant' || founderOverride;
  const languageOk = founderOverride || ['en', 'hi', 'gu'].every((l) => ((langIssues as any)[l] || []).length === 0);
  const seoBadgeText = checks.seo ? 'preview' : '—';
  const readabilityBadgeText = typeof readabilityGrade === 'number' ? String(readabilityGrade) : '—';
  const aiBadgeText = suggestions ? 'AI' : 'Offline';

  const accordionItems: AccordionItem[] = useMemo(() => {
    const hasLangIssues = !languageOk;
    const hasPtiIssues = !ptiOk;

    const badgeClsOk = 'text-[11px] px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-700';
    const badgeClsWarn = 'text-[11px] px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800';

    return [
      {
        id: 'ai',
        title: 'AI Assistant',
        badge: <span className={aiBadgeText === 'AI' ? badgeClsOk : badgeClsWarn}>{aiBadgeText}</span>,
        defaultOpen: false,
        forceOpenWhen: false,
        children: (
          <AiAssistantTipBox
            title={title}
            content={content}
            language={language}
            onApplyTitle={(v)=> { setTitle(v); }}
            onApplySlug={(v)=> { setSlug(v); setAutoSlug(false); }}
            onApplySummary={(v)=> { setSummary(v); setAutoSummary(false); }}
          />
        ),
      },
      {
        id: 'pti',
        title: 'PTI Compliance',
        badge: <span className={ptiOk ? badgeClsOk : badgeClsWarn}>{ptiOk ? '✅' : '⚠️'}</span>,
        defaultOpen: false,
        forceOpenWhen: hasPtiIssues,
        children: (
          <div className="space-y-2">
            <button type="button" onClick={runPti} className="btn-secondary text-xs">Run PTI Check</button>
            <div className="text-sm">Status: {ptiStatus === 'compliant' ? '✅ Compliant' : '⚠️ Needs Review'}</div>
            {ptiReasons.map(r=> <div key={r} className="text-xs text-red-600">• {r}</div>)}
          </div>
        ),
      },
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
            {checks.seo && (
              <div className="text-[11px] text-gray-600">Hook score: {checks.seo.titleHookScore} · Keywords: {checks.seo.keywords.join(', ')}</div>
            )}
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
  }, [aiBadgeText, checks.seo, content, language, langIssues, languageOk, ptiOk, ptiReasons, ptiStatus, readabilityBadgeText, readabilityGrade, readingSeconds, runLanguageCheck, runPti, runReadability, seoBadgeText, suggestions, summary, title]);

  async function beginPublishFlow() {
    if (isSaving || isPublishing) return;
    if (!canPublish) return;
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

    const needsPtiConfirm = !founderOverride && (ptiStatus === 'pending' || ptiStatus === 'needs_review');
    const needsLangConfirm = !founderOverride && !languageOk;

    const proceed = () => {
      if (!publishedAt) setPublishedAt(new Date().toISOString());
      handlePublish();
    };

    if (needsPtiConfirm) {
      setConfirmState({
        title: 'PTI review not cleared — publish anyway?',
        description: 'PTI compliance is not marked as compliant (or not run yet). You can publish anyway, but review is recommended.',
        confirmLabel: 'Publish Anyway',
        cancelLabel: 'Cancel',
        onConfirm: () => {
          setConfirmState(null);
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
        },
      });
      return;
    }

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

              {suggestions && (
                <label className="mt-2 inline-flex items-center gap-2 text-[11px]">
                  <input type="checkbox" checked={useLatinSlug} onChange={e=> { setUseLatinSlug(e.target.checked); if (autoSlug && suggestions) setSlug(e.target.checked ? suggestions.slug.latin : suggestions.slug.native); }} />
                  Use Latin SEO slug
                </label>
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
              {suggestions && (
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  {(['neutral','impact','analytical'] as const).map(t => (
                    <button type="button" key={t} onClick={()=> { setTone(t); setSummary(suggestions.summary[t]); setAutoSummary(false); }}
                      className={`px-2 py-1 rounded text-xs border ${tone===t? 'bg-black text-white':'bg-white'}`}>{t}</button>
                  ))}
                  <span className={`text-[11px] ${summary.length>=120 && summary.length<=180 ? 'text-green-600' : 'text-amber-600'}`}>{summary.length} chars (aim 120–180)</span>
                </div>
              )}
              {checks.compliance?.ptiFlags?.length > 0 && (
                <div className="mt-2 text-xs text-red-600">PTI flags: {checks.compliance.ptiFlags.join(' · ')} <button type="button" className="underline" onClick={addAttribution}>Add attribution</button></div>
              )}
              {checks.duplicate && checks.duplicate.score >= 0.78 && (
                <div className="mt-1 text-xs text-amber-700">Similar headline ({Math.round(checks.duplicate.score*100)}%). {checks.duplicate.closestId && <a className="underline" href={`/admin/articles/${checks.duplicate.closestId}`} target="_blank" rel="noreferrer">View closest</a>}</div>
              )}
              <div className="mt-2 flex gap-2 flex-wrap">
                {summary.length > 200 && <button type="button" onClick={trimSummaryTo160} className="btn-secondary text-[11px] px-2 py-1">Trim to ~160</button>}
                {(checks.compliance?.ptiFlags?.length ?? 0) > 0 && <button type="button" onClick={addAttribution} className="btn-secondary text-[11px] px-2 py-1">Add attribution</button>}
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-medium">Content</label>
                <div className="text-xs text-slate-600">Words: {wordCount}</div>
              </div>
              <textarea
                ref={contentTextareaRef}
                value={content}
                onChange={e=> setContent(e.target.value)}
                onPaste={handleContentPasteWithLinks}
                rows={14}
                className="w-full border px-2 py-2 rounded font-mono min-h-[360px]"
                placeholder="Write article content..."
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

              <div className="pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="text-xs font-medium">Breaking Controls</div>
                  <button
                    type="button"
                    className="text-[11px] text-slate-600 hover:text-slate-900 underline"
                    onClick={() => setBreakingControlsCollapsed((v) => !v)}
                  >
                    {breakingControlsCollapsed ? 'Show' : 'Minimize'}
                  </button>
                </div>
                {!breakingControlsCollapsed && (
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={breakingChecked}
                        onChange={(e) => handleBreakingToggle(e.target.checked)}
                      />
                      <span>
                        <span className="font-medium">Mark as Breaking</span>
                        <span className="block text-[11px] text-slate-600">Adds tag <span className="font-mono">breaking</span> and sets <span className="font-mono">isBreaking</span> (does not change category).</span>
                      </span>
                    </label>

                    <label className="flex items-start gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={gujaratRegionalChecked}
                        onChange={(e) => handleGujaratToggle(e.target.checked)}
                      />
                      <span>
                        <span className="font-medium">Gujarat Regional</span>
                        <span className="block text-[11px] text-slate-600">Adds tag <span className="font-mono">state:gujarat</span>.</span>
                      </span>
                    </label>
                  </div>
                )}
              </div>

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
                            onClick={() => toggleTag(tag)}
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
                            onClick={() => toggleTag(tag)}
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
                <select value={language} onChange={e=> setLanguage(normalizeLang(e.target.value))} className="w-full border px-2 py-2 rounded" required>
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
                <select value={status} onChange={e=> setStatus(e.target.value as any)} disabled={userRole==='writer'} className="w-full border px-2 py-2 rounded">
                  <option value='draft'>Draft</option>
                  <option value='scheduled'>Scheduled</option>
                  {(userRole==='admin'||userRole==='founder') && <option value='published'>Published</option>}
                </select>
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
                  url={imageUrl}
                  file={coverImageFile}
                  onChangeFile={(f) => {
                    setCoverImageFile(f);
                    if (f) void uploadSelectedCover(f);
                  }}
                  onRemove={() => {
                    setCoverImageFile(null);
                    setImageUrl('');
                    setCoverImagePublicId('');
                  }}
                />
                {isUploadingCover && <div className="mt-1 text-[11px] text-slate-500">Uploading…</div>}
              </div>

              {(userRole==='founder') && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-sm font-semibold mb-2">Founder Override</div>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={founderOverride} onChange={e=> setFounderOverride(e.target.checked)} /> Enable Force Publish
                  </label>
                  {founderOverride && <div className="text-xs text-red-600 mt-1">Publishing will ignore PTI & language issues.</div>}
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
          title,
          slug,
          summary,
          content,
          coverImageUrl: (imageUrl || '').trim() || undefined,
          category,
          language,
          status,
          scheduledAt,
          tags,
        }}
      />

      {publishSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-lg">
            <div className="text-sm font-semibold text-slate-900">Published successfully</div>
            <div className="mt-1 text-xs text-slate-600">
              {publishSuccess.id ? `Article ID: ${publishSuccess.id}` : 'Article published'}
            </div>
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
            <button type="button" onClick={saveDraft} className="btn-secondary" disabled={isSaving || isPublishing || mutation.isPending}>Save Draft</button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
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

import { useEffect, useMemo, useRef } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';
import { parseNewsPulseFacebookAttrs } from '@/lib/facebook';
import { parseNewsPulseInstagramAttrs } from '@/lib/instagram';
import { parseNewsPulseYouTubeAttrs } from '@/lib/youtube';
import { parseNewsPulseXAttrs } from '@/lib/x';
import { PULSE_DIALOGUE_CATEGORY, dialogueFormatLabel, type PulseDialogueArticleMetadata } from '@/lib/pulseDialogue';
import { validateAuthorPhotoUrl, type AuthorByline } from '@/lib/authorByline';

export type PreviewLanguage = 'en' | 'hi' | 'gu';

export interface ArticlePreviewModel {
  title: string;
  slug?: string;
  summary?: string;
  content: string;
  // Optional cover image for preview (admin uses this as coverImageUrl).
  coverImageUrl?: string;
  category?: string;
  editorialType?: 'editorial' | 'special_story';
  language?: PreviewLanguage;
  // Some backends/components provide language as `lang`.
  lang?: PreviewLanguage;
  status?: 'draft' | 'scheduled' | 'published';
  scheduledAt?: string;
  tags?: string[];
  pulseDialogue?: PulseDialogueArticleMetadata;
  authorByline?: AuthorByline;
}

const X_WIDGETS_SRC = 'https://platform.twitter.com/widgets.js';
const INSTAGRAM_EMBED_SRC = 'https://www.instagram.com/embed.js';
let xWidgetsLoadPromise: Promise<void> | null = null;
let instagramEmbedLoadPromise: Promise<void> | null = null;

function getXWidgets() {
  return (typeof window !== 'undefined' ? (window as any).twttr?.widgets : undefined);
}

function getInstagramEmbeds() {
  return (typeof window !== 'undefined' ? (window as any).instgrm?.Embeds : undefined);
}

function findXWidgetsScript(): HTMLScriptElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector(`script[src="${X_WIDGETS_SRC}"]`);
}

function findInstagramEmbedScript(): HTMLScriptElement | null {
  if (typeof document === 'undefined') return null;
  return document.querySelector(`script[src="${INSTAGRAM_EMBED_SRC}"]`);
}

function loadXWidgetsScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.reject(new Error('Document unavailable'));
  if (typeof getXWidgets()?.load === 'function') return Promise.resolve();
  if (xWidgetsLoadPromise && findXWidgetsScript()) return xWidgetsLoadPromise;

  xWidgetsLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = findXWidgetsScript();
    const script = existing || document.createElement('script');
    const onLoad = () => resolve();
    const onError = () => reject(new Error('X widgets script failed to load'));

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    if (!existing) {
      script.async = true;
      script.src = X_WIDGETS_SRC;
      document.body.appendChild(script);
    }
  }).catch((error) => {
    xWidgetsLoadPromise = null;
    throw error;
  });

  return xWidgetsLoadPromise;
}

function loadInstagramEmbedScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.reject(new Error('Document unavailable'));
  if (typeof getInstagramEmbeds()?.process === 'function') return Promise.resolve();
  if (instagramEmbedLoadPromise && findInstagramEmbedScript()) return instagramEmbedLoadPromise;

  instagramEmbedLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = findInstagramEmbedScript();
    const script = existing || document.createElement('script');
    const onLoad = () => resolve();
    const onError = () => reject(new Error('Instagram embed script failed to load'));

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    if (!existing) {
      script.async = true;
      script.src = INSTAGRAM_EMBED_SRC;
      document.body.appendChild(script);
    }
  }).catch((error) => {
    instagramEmbedLoadPromise = null;
    throw error;
  });

  return instagramEmbedLoadPromise;
}

function hydrateXEmbeds(container: HTMLElement | null): void {
  if (!container?.querySelector('blockquote.twitter-tweet')) return;
  void loadXWidgetsScript()
    .then(() => {
      const widgets = getXWidgets();
      if (typeof widgets?.load === 'function') widgets.load(container);
    })
    .catch(() => undefined);
}

function hydrateInstagramEmbeds(container: HTMLElement | null): void {
  const blockquotes = Array.from(container?.querySelectorAll('.np-instagram-preview blockquote.instagram-media') || []);
  if (!blockquotes.length) return;

  let hasValidEmbed = false;
  blockquotes.forEach((blockquote) => {
    const link = blockquote.querySelector('a[href]');
    const embed = parseNewsPulseInstagramAttrs({
      url: link?.getAttribute('href'),
    });
    if (!embed) return;

    blockquote.setAttribute('data-instgrm-permalink', embed.url);
    blockquote.setAttribute('data-instgrm-version', '14');
    hasValidEmbed = true;
  });

  if (!hasValidEmbed) return;

  void loadInstagramEmbedScript()
    .then(() => {
      const embeds = getInstagramEmbeds();
      if (typeof embeds?.process === 'function') embeds.process(container);
    })
    .catch(() => undefined);
}

function stripHtml(input: string): string {
  return (input || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeHtml(input: string): boolean {
  return /<\s*\/?\s*[a-z][\s\S]*>/i.test(input || '');
}

type InlineImageLayout = 'normal' | 'wide' | 'full';

const INLINE_IMAGE_LAYOUTS: InlineImageLayout[] = ['normal', 'wide', 'full'];

function normalizeInlineImageLayout(value: unknown): InlineImageLayout {
  const normalized = String(value ?? '').trim();
  return INLINE_IMAGE_LAYOUTS.includes(normalized as InlineImageLayout) ? normalized as InlineImageLayout : 'normal';
}

function normalizePhotoCreditDisplay(value: unknown): string {
  const normalized = String(value ?? '').replace(/^\s*(?:(?:credit|photo(?:\s+credit)?)\s*:\s*)+/i, '').trim();
  return normalized ? `Photo: ${normalized}` : '';
}

function renderControlledInlineImageBlocks(html: string): string {
  if (!html || !/data-np-block=["']inline-image["']/i.test(html)) return html;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('figure[data-np-block="inline-image"]').forEach((figure) => {
      if (figure.closest('div[data-np-block="gallery"]')) return;

      const image = figure.querySelector('img[src]') as HTMLImageElement | null;
      if (!image) return;

      const layout = normalizeInlineImageLayout(figure.getAttribute('data-np-layout'));
      const replacement = doc.createElement('figure');
      replacement.setAttribute('class', `np-inline-image-preview np-inline-image-preview-${layout}`);

      const nextImage = doc.createElement('img');
      nextImage.setAttribute('src', image.getAttribute('src') || '');
      nextImage.setAttribute('alt', image.getAttribute('alt') || '');
      const width = figure.getAttribute('data-np-width') || image.getAttribute('width');
      const height = figure.getAttribute('data-np-height') || image.getAttribute('height');
      if (width) nextImage.setAttribute('width', width);
      if (height) nextImage.setAttribute('height', height);
      replacement.appendChild(nextImage);

      const caption = figure.querySelector('[data-np-caption], figcaption')?.textContent?.trim();
      if (caption) {
        const captionNode = doc.createElement('figcaption');
        captionNode.setAttribute('data-np-caption', 'true');
        captionNode.setAttribute('class', 'np-media-caption');
        captionNode.textContent = caption;
        replacement.appendChild(captionNode);
      }

      const credit = normalizePhotoCreditDisplay(figure.querySelector('[data-np-credit]')?.textContent);
      if (credit) {
        const creditNode = doc.createElement('div');
        creditNode.setAttribute('data-np-credit', 'true');
        creditNode.setAttribute('class', 'np-media-credit');
        creditNode.textContent = credit;
        replacement.appendChild(creditNode);
      }

      figure.replaceWith(replacement);
    });
    return doc.body.innerHTML;
  } catch {
    return html;
  }
}

function renderControlledYouTubeBlocks(html: string): string {
  if (!html || !/data-np-block=["']youtube["']/i.test(html)) return html;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('div[data-np-block="youtube"]').forEach((node) => {
      const embed = parseNewsPulseYouTubeAttrs({
        videoId: node.getAttribute('data-np-video-id'),
        url: node.getAttribute('data-np-url'),
      });
      const replacement = doc.createElement('div');
      if (!embed) {
        replacement.textContent = 'YouTube video unavailable';
        node.replaceWith(replacement);
        return;
      }

      const iframe = doc.createElement('iframe');
      iframe.setAttribute('src', embed.embedUrl);
      iframe.setAttribute('title', 'YouTube video');
      iframe.setAttribute('width', '560');
      iframe.setAttribute('height', '315');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
      iframe.setAttribute('allowfullscreen', 'true');
      replacement.appendChild(iframe);
      node.replaceWith(replacement);
    });
    return doc.body.innerHTML;
  } catch {
    return html.replace(/<div\b[^>]*data-np-block=["']youtube["'][\s\S]*?<\/div>/gi, '');
  }
}

function renderControlledXBlocks(html: string): string {
  if (!html || !/data-np-block=["']x["']/i.test(html)) return html;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('div[data-np-block="x"]').forEach((node) => {
      const embed = parseNewsPulseXAttrs({
        postId: node.getAttribute('data-np-post-id'),
        url: node.getAttribute('data-np-url'),
      });
      const replacement = doc.createElement('div');
      if (!embed) {
        replacement.textContent = 'X post unavailable';
        node.replaceWith(replacement);
        return;
      }

      replacement.setAttribute('class', 'np-x-preview');

      const blockquote = doc.createElement('blockquote');
      blockquote.setAttribute('class', 'twitter-tweet');

      const fallback = doc.createElement('p');
      const label = doc.createElement('strong');
      label.textContent = 'X Post';
      fallback.appendChild(label);

      if (embed.username) {
        fallback.appendChild(doc.createElement('br'));
        const username = doc.createElement('span');
        username.textContent = `@${embed.username}`;
        fallback.appendChild(username);
      }

      fallback.appendChild(doc.createElement('br'));
      const link = doc.createElement('a');
      link.setAttribute('href', embed.url);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noreferrer');
      link.textContent = 'Open post';
      fallback.appendChild(link);
      blockquote.appendChild(fallback);
      replacement.appendChild(blockquote);
      node.replaceWith(replacement);
    });
    return doc.body.innerHTML;
  } catch {
    return html.replace(/<div\b[^>]*data-np-block=["']x["'][\s\S]*?<\/div>/gi, '');
  }
}

function renderControlledInstagramBlocks(html: string): string {
  if (!html || !/data-np-block=["']instagram["']/i.test(html)) return html;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('div[data-np-block="instagram"]').forEach((node) => {
      const embed = parseNewsPulseInstagramAttrs({
        shortcode: node.getAttribute('data-np-shortcode'),
        url: node.getAttribute('data-np-url'),
      });
      const replacement = doc.createElement('div');
      if (!embed) {
        replacement.textContent = 'Instagram post unavailable';
        node.replaceWith(replacement);
        return;
      }

      replacement.setAttribute('class', 'np-instagram-preview');

      const blockquote = doc.createElement('blockquote');
      blockquote.setAttribute('class', 'instagram-media');

      const fallback = doc.createElement('p');
      const label = doc.createElement('strong');
      label.textContent = 'Instagram';
      fallback.appendChild(label);

      fallback.appendChild(doc.createElement('br'));
      const type = doc.createElement('span');
      type.textContent = 'Post/Reel';
      fallback.appendChild(type);

      fallback.appendChild(doc.createElement('br'));
      const link = doc.createElement('a');
      link.setAttribute('href', embed.url);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noreferrer');
      link.textContent = 'Open post';
      fallback.appendChild(link);
      blockquote.appendChild(fallback);
      replacement.appendChild(blockquote);
      node.replaceWith(replacement);
    });
    return doc.body.innerHTML;
  } catch {
    return html.replace(/<div\b[^>]*data-np-block=["']instagram["'][\s\S]*?<\/div>/gi, '');
  }
}

function facebookPluginPostUrl(canonicalUrl: string): string {
  return `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(canonicalUrl)}&show_text=true&width=500`;
}

function renderControlledFacebookBlocks(html: string): string {
  if (!html || !/data-np-block=["']facebook["']/i.test(html)) return html;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('div[data-np-block="facebook"]').forEach((node) => {
      const embed = parseNewsPulseFacebookAttrs({
        url: node.getAttribute('data-np-url'),
      });
      const replacement = doc.createElement('div');
      if (!embed) {
        replacement.textContent = 'Facebook post unavailable';
        node.replaceWith(replacement);
        return;
      }

      replacement.setAttribute('class', 'np-facebook-preview');

      const iframe = doc.createElement('iframe');
      iframe.setAttribute('src', facebookPluginPostUrl(embed.url));
      iframe.setAttribute('title', embed.kind === 'reel' ? 'Facebook Reel' : 'Facebook Post');
      iframe.setAttribute('width', '500');
      iframe.setAttribute('height', '650');
      iframe.setAttribute('allow', 'encrypted-media; picture-in-picture; web-share');
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allowfullscreen', 'true');
      replacement.appendChild(iframe);

      const fallback = doc.createElement('div');
      fallback.setAttribute('class', 'np-facebook-preview-fallback');

      const label = doc.createElement('strong');
      label.textContent = 'Facebook Post';
      fallback.appendChild(label);

      fallback.appendChild(doc.createElement('br'));
      const link = doc.createElement('a');
      link.setAttribute('href', embed.url);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noreferrer');
      link.textContent = 'Open post';
      fallback.appendChild(link);
      replacement.appendChild(fallback);
      node.replaceWith(replacement);
    });
    return doc.body.innerHTML;
  } catch {
    return html.replace(/<div\b[^>]*data-np-block=["']facebook["'][\s\S]*?<\/div>/gi, '');
  }
}

function renderControlledGalleryBlocks(html: string): string {
  if (!html || !/data-np-block=["']gallery["']/i.test(html)) return html;

  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('div[data-np-block="gallery"]').forEach((node) => {
      const figures = Array.from(node.querySelectorAll('figure[data-np-block="inline-image"]'));
      const replacement = doc.createElement('div');
      replacement.setAttribute('class', 'np-gallery-preview');

      const validFigures = figures.filter((figure) => figure.querySelector('img[src]'));
      if (validFigures.length < 2) {
        replacement.textContent = 'Photo gallery unavailable';
        node.replaceWith(replacement);
        return;
      }

      validFigures.forEach((figure, index) => {
        const image = figure.querySelector('img[src]') as HTMLImageElement | null;
        if (!image) return;

        const item = doc.createElement('div');
        item.setAttribute('class', index === 0 ? 'np-gallery-preview-featured' : 'np-gallery-preview-item');

        const nextImage = doc.createElement('img');
        nextImage.setAttribute('src', image.getAttribute('src') || '');
        nextImage.setAttribute('alt', image.getAttribute('alt') || 'Gallery image');
        const width = figure.getAttribute('data-np-width') || image.getAttribute('width');
        const height = figure.getAttribute('data-np-height') || image.getAttribute('height');
        if (width) nextImage.setAttribute('width', width);
        if (height) nextImage.setAttribute('height', height);
        item.appendChild(nextImage);

        const caption = figure.querySelector('[data-np-caption], figcaption')?.textContent?.trim();
        if (caption) {
          const captionNode = doc.createElement('div');
          captionNode.setAttribute('class', 'np-media-caption');
          captionNode.textContent = caption;
          item.appendChild(captionNode);
        }

        const credit = normalizePhotoCreditDisplay(figure.querySelector('[data-np-credit]')?.textContent);
        if (credit) {
          const creditNode = doc.createElement('div');
          creditNode.setAttribute('class', 'np-media-credit');
          creditNode.textContent = credit;
          item.appendChild(creditNode);
        }

        replacement.appendChild(item);
      });
      node.replaceWith(replacement);
    });
    return doc.body.innerHTML;
  } catch {
    return html.replace(/<div\b[^>]*data-np-block=["']gallery["'][\s\S]*?<\/div>/gi, '');
  }
}

const LANG_LABEL: Record<PreviewLanguage, string> = {
  en: 'English',
  hi: 'Hindi',
  gu: 'Gujarati',
};

export interface ArticlePreviewProps {
  article: ArticlePreviewModel;
  selectedLanguage?: PreviewLanguage;
  availableLanguages?: PreviewLanguage[];
  onSelectLanguage?: (lang: PreviewLanguage) => void;
}

export default function ArticlePreview({
  article,
  selectedLanguage,
  availableLanguages,
  onSelectLanguage,
}: ArticlePreviewProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const title = (article.title || '').trim() || 'Untitled';
  const slug = (article.slug || '').trim();
  const summary = (article.summary || '').trim();
  const category = (article.category || '').trim();
  const authorSnapshot = category !== PULSE_DIALOGUE_CATEGORY && article.authorByline?.enabled
    ? article.authorByline.snapshot : undefined;
  let authorPhotoUrl = '';
  try {
    validateAuthorPhotoUrl(authorSnapshot?.photoUrl || '');
    authorPhotoUrl = authorSnapshot?.photoUrl || '';
  } catch {}
  const pulseDialogue = category === PULSE_DIALOGUE_CATEGORY ? article.pulseDialogue : undefined;
  const pulseContributor = pulseDialogue?.contributor;
  const pulseByline = pulseDialogue?.bylineSnapshot;
  const pulseName = String(pulseByline?.name || (pulseContributor as any)?.name || (pulseContributor as any)?.canonicalName || '').trim();
  const pulseDesignation = String(
    pulseDialogue?.bylineDesignationOverride
    || pulseByline?.designation
    || (pulseContributor as any)?.publicDesignation
    || ''
  ).trim();
  const pulseAffiliation = String(pulseByline?.affiliation || (pulseContributor as any)?.affiliation || '').trim();
  const pulsePhoto = pulseByline?.photo || (pulseContributor as any)?.photo || null;
  const editorialLabel = category === 'editorial'
    ? (article.editorialType === 'special_story' ? 'SPECIAL STORY' : 'EDITORIAL')
    : '';
  const lang = (selectedLanguage || article.language || article.lang || 'en') as PreviewLanguage;

  const content = article.content || '';

  const safeHtml = useMemo(() => {
    if (!content) return '';
    if (!looksLikeHtml(content)) return '';
    return sanitizeHtml(renderControlledFacebookBlocks(renderControlledInstagramBlocks(renderControlledXBlocks(renderControlledYouTubeBlocks(renderControlledInlineImageBlocks(renderControlledGalleryBlocks(content)))))));
  }, [content]);

  useEffect(() => {
    hydrateXEmbeds(contentRef.current);
    hydrateInstagramEmbeds(contentRef.current);
  }, [safeHtml]);

  const seoDescription = useMemo(() => {
    const base = summary || stripHtml(content);
    if (!base) return '';
    return base.length > 160 ? base.slice(0, 157).replace(/\s+\S*$/, '') + '…' : base;
  }, [summary, content]);

  const seoTitle = useMemo(() => {
    const t = title;
    return t.length > 70 ? t.slice(0, 67).replace(/\s+\S*$/, '') + '…' : t;
  }, [title]);

  const languages = (availableLanguages && availableLanguages.length ? availableLanguages : (['en', 'hi', 'gu'] as PreviewLanguage[]));
  const hasVariants = (availableLanguages?.length ?? 0) > 1;
  const languageSwitcherDisabled = !hasVariants || !onSelectLanguage;

  const metaLineParts: string[] = [];
  if (editorialLabel) metaLineParts.push(editorialLabel);
  if (category) metaLineParts.push(category);
  metaLineParts.push(LANG_LABEL[lang] || lang.toUpperCase());
  if (article.status === 'scheduled' && article.scheduledAt) {
    metaLineParts.push(`Scheduled: ${article.scheduledAt}`);
  }

  const urlPreview = slug ? `/story/${slug}` : '/story/<slug>';

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold leading-tight break-words">{title}</h1>
            <div className="mt-1 text-sm text-slate-600">{metaLineParts.join(' · ')}</div>
          </div>

          <div className="shrink-0">
            <div className="text-xs text-slate-600 mb-1">Language</div>
            <div className="inline-flex rounded-md border border-slate-200 overflow-hidden" title={languageSwitcherDisabled ? 'No translated variants yet' : undefined}>
              {(languages as PreviewLanguage[]).map((code) => {
                const isActive = code === lang;
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={languageSwitcherDisabled}
                    onClick={() => onSelectLanguage?.(code)}
                    className={
                      `px-3 py-1 text-xs border-r border-slate-200 last:border-r-0 ` +
                      (languageSwitcherDisabled ? 'opacity-50 cursor-not-allowed ' : 'hover:bg-slate-50 ') +
                      (isActive ? 'bg-slate-100 font-semibold text-slate-900' : 'bg-white text-slate-700')
                    }
                    aria-pressed={isActive}
                  >
                    {code.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {summary && (
          <div className="text-sm text-slate-700 whitespace-pre-wrap">{summary}</div>
        )}

        {authorSnapshot?.name ? (
          <div className="flex items-start gap-3" data-testid="author-byline-preview">
            {authorPhotoUrl ? <img src={authorPhotoUrl} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" /> : null}
            <div className="min-w-0 break-words">
              <div className="text-sm font-semibold text-slate-900">{authorSnapshot.name}</div>
              {authorSnapshot.publicDesignation ? <div className="text-sm text-slate-600">{authorSnapshot.publicDesignation}</div> : null}
              {authorSnapshot.shortBio ? <div className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{authorSnapshot.shortBio}</div> : null}
            </div>
          </div>
        ) : null}

        {pulseDialogue ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
              Pulse Dialogue{pulseDialogue.dialogueFormat ? ` - ${dialogueFormatLabel(pulseDialogue.dialogueFormat)}` : ''}
            </div>
            {(pulseName || pulseDesignation || pulseAffiliation || pulsePhoto?.url) ? (
              <div className="flex items-start gap-3">
                {pulsePhoto?.url ? <img src={pulsePhoto.url} alt="" className="h-14 w-14 rounded-full object-cover" /> : null}
                <div className="min-w-0">
                  {pulseName ? <div className="font-semibold text-slate-900">By {pulseName}</div> : null}
                  {pulseDesignation ? <div className="text-sm text-slate-700">{pulseDesignation}</div> : null}
                  {pulseAffiliation ? <div className="text-sm text-slate-500">{pulseAffiliation}</div> : null}
                  {pulseDialogue.series ? <div className="mt-1 text-xs text-slate-500">{pulseDialogue.series}</div> : null}
                </div>
              </div>
            ) : null}
            {pulseDialogue.contributorDisclosure ? <div className="mt-3 text-sm text-slate-700"><span className="font-medium">Disclosure:</span> {pulseDialogue.contributorDisclosure}</div> : null}
            {pulseDialogue.editorNote ? <div className="mt-2 text-sm text-slate-700"><span className="font-medium">Editor's Note:</span> {pulseDialogue.editorNote}</div> : null}
            {pulseDialogue.contributorDisclaimer ? <div className="mt-2 text-xs text-slate-500">{pulseDialogue.contributorDisclaimer}</div> : null}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="p-4 border-b border-slate-200">
              <div className="text-sm font-semibold">Article</div>
            </div>
            <div className="p-4">
              <div ref={contentRef} className="prose max-w-none">
                {safeHtml ? (
                  <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
                ) : (
                  <div className="whitespace-pre-wrap">{content || 'No content'}</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="p-4 border-b border-slate-200">
              <div className="text-sm font-semibold">SEO Snippet</div>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <div className="text-xs text-slate-600 mb-1">URL</div>
                <div className="text-xs text-slate-800 break-words">{urlPreview}</div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="text-[13px] font-medium text-sky-800 break-words">{seoTitle}</div>
                <div className="text-[11px] text-green-700 break-words">{urlPreview}</div>
                <div className="text-[12px] text-slate-700 mt-1 break-words">{seoDescription || 'Add a summary to preview meta description.'}</div>
              </div>

              <div className="text-xs text-slate-700 space-y-1">
                <div className={title.length > 60 ? 'text-amber-700' : ''}>Title length: {title.length} / 60</div>
                <div className={seoDescription.length > 160 ? 'text-amber-700' : ''}>Description length: {seoDescription.length} / 160</div>
                <div className={slug && slug.length > 80 ? 'text-amber-700' : ''}>Slug length: {slug ? slug.length : 0} / 80</div>
              </div>
            </div>
          </div>

          {Array.isArray(article.tags) && article.tags.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="p-4 border-b border-slate-200">
                <div className="text-sm font-semibold">Tags</div>
              </div>
              <div className="p-4 flex flex-wrap gap-2">
                {article.tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-700">{t}</span>
                ))}
              </div>
            </div>
          )}

          {pulseDialogue?.showAboutContributor && (pulseContributor as any)?.shortBio ? (
            <div className="rounded-lg border border-slate-200 bg-white">
              <div className="p-4 border-b border-slate-200">
                <div className="text-sm font-semibold">About the Contributor</div>
              </div>
              <div className="p-4 text-sm text-slate-700 whitespace-pre-wrap">{(pulseContributor as any).shortBio}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

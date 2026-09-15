import { useMemo } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';
import { parseNewsPulseFacebookAttrs } from '@/lib/facebook';
import { parseNewsPulseInstagramAttrs } from '@/lib/instagram';
import { parseNewsPulseYouTubeAttrs } from '@/lib/youtube';
import { parseNewsPulseXAttrs } from '@/lib/x';

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

      const label = doc.createElement('strong');
      label.textContent = 'X Post';
      replacement.appendChild(label);

      if (embed.username) {
        replacement.appendChild(doc.createElement('br'));
        const username = doc.createElement('span');
        username.textContent = `@${embed.username}`;
        replacement.appendChild(username);
      }

      replacement.appendChild(doc.createElement('br'));
      const link = doc.createElement('a');
      link.setAttribute('href', embed.url);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noreferrer');
      link.textContent = 'Open post';
      replacement.appendChild(link);
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

      const label = doc.createElement('strong');
      label.textContent = 'Instagram';
      replacement.appendChild(label);

      replacement.appendChild(doc.createElement('br'));
      const type = doc.createElement('span');
      type.textContent = 'Post/Reel';
      replacement.appendChild(type);

      replacement.appendChild(doc.createElement('br'));
      const link = doc.createElement('a');
      link.setAttribute('href', embed.url);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noreferrer');
      link.textContent = 'Open post';
      replacement.appendChild(link);
      node.replaceWith(replacement);
    });
    return doc.body.innerHTML;
  } catch {
    return html.replace(/<div\b[^>]*data-np-block=["']instagram["'][\s\S]*?<\/div>/gi, '');
  }
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

      const label = doc.createElement('strong');
      label.textContent = 'Facebook Post';
      replacement.appendChild(label);

      replacement.appendChild(doc.createElement('br'));
      const link = doc.createElement('a');
      link.setAttribute('href', embed.url);
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noreferrer');
      link.textContent = 'Open post';
      replacement.appendChild(link);
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
  const title = (article.title || '').trim() || 'Untitled';
  const slug = (article.slug || '').trim();
  const summary = (article.summary || '').trim();
  const category = (article.category || '').trim();
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8">
          <div className="rounded-lg border border-slate-200 bg-white">
            <div className="p-4 border-b border-slate-200">
              <div className="text-sm font-semibold">Article</div>
            </div>
            <div className="p-4">
              <div className="prose max-w-none">
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
        </div>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';

export type PreviewLanguage = 'en' | 'hi' | 'gu';

export interface ArticlePreviewModel {
  title: string;
  slug?: string;
  summary?: string;
  content: string;
  // Optional cover image for preview (admin uses this as coverImageUrl).
  coverImageUrl?: string;
  category?: string;
  language?: PreviewLanguage;
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
  const lang = (selectedLanguage || article.language || 'en') as PreviewLanguage;

  const content = article.content || '';

  const safeHtml = useMemo(() => {
    if (!content) return '';
    if (!looksLikeHtml(content)) return '';
    return sanitizeHtml(content);
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

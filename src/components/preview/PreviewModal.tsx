import { useMemo, useState } from 'react';
import ArticlePreview, { type ArticlePreviewModel, type PreviewLanguage } from '@/components/preview/ArticlePreview';

export interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  article: ArticlePreviewModel;
}

export default function PreviewModal({ open, onClose, article }: PreviewModalProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<PreviewLanguage | undefined>(article.language);

  // Keep local selection in sync when the underlying article language changes.
  // This intentionally does not try to hydrate translated variants (not available in current form state).
  const effectiveLanguage = useMemo(() => {
    return (selectedLanguage || article.language || 'en') as PreviewLanguage;
  }, [selectedLanguage, article.language]);

  if (!open) return null;

  const cover = (article as any)?.coverImageUrl ? String((article as any).coverImageUrl).trim() : '';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className="h-full max-w-6xl mx-auto bg-white rounded-lg border border-slate-200 shadow-lg flex flex-col">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="font-semibold">Preview</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-sm px-3 py-1 rounded border bg-white hover:bg-slate-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="p-4">
            {cover ? (
              <div className="mb-4">
                <div className="w-full aspect-video rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                  <img src={cover} alt="Cover" className="w-full h-full object-cover" />
                </div>
              </div>
            ) : null}

            <ArticlePreview
              article={article}
              selectedLanguage={effectiveLanguage}
              availableLanguages={article.language ? [article.language] : undefined}
              onSelectLanguage={(l) => setSelectedLanguage(l)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

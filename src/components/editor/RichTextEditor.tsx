import { useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Node, mergeAttributes, type Editor as TiptapEditor } from '@tiptap/core';
import { TextSelection } from 'prosemirror-state';
import toast from 'react-hot-toast';

import { autoFormatPlainTextToHtml } from '@/lib/richText';
import { uploadInlineImage, type UploadInlineImageResult } from '@/lib/api/media';
import { extractNewsPulseInstagramFromHtml, parseNewsPulseInstagramUrl, type NewsPulseInstagramEmbed } from '@/lib/instagram';
import { extractNewsPulseYouTubeFromHtml, parseNewsPulseYouTubeUrl, type NewsPulseYouTubeEmbed } from '@/lib/youtube';
import { extractNewsPulseXFromHtml, parseNewsPulseXUrl, type NewsPulseXEmbed } from '@/lib/x';
import MediaLibrarySelector, { type MediaLibraryAsset } from '@/components/media/MediaLibrarySelector';
import { InlineImageUploadPlaceholder, NewsPulseInlineImage, type NewsPulseInlineImageAttrs } from './NewsPulseInlineImage';
import { NewsPulseInstagram } from './NewsPulseInstagram';
import { NewsPulseX } from './NewsPulseX';
import { NewsPulseYouTube } from './NewsPulseYouTube';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onPendingUploadChange?: (pending: boolean) => void;
}

const INLINE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function isInlineImageFile(file: File): boolean {
  return INLINE_IMAGE_MIME_TYPES.has(file.type);
}

function getImageFilesFromList(files: FileList | File[] | null | undefined): File[] {
  return Array.from(files || []).filter((file) => file.type.startsWith('image/'));
}

function getClipboardImageFiles(data: DataTransfer | null | undefined): File[] {
  if (!data) return [];
  const fromFiles = getImageFilesFromList(data.files);
  if (fromFiles.length) return fromFiles;

  return Array.from(data.items || [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file);
}

function htmlHasImage(html: string): boolean {
  return /<img\b/i.test(html);
}

function removeImagesFromHtml(html: string): { html: string; text: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('img').forEach((image) => image.remove());
  return {
    html: doc.body.innerHTML,
    text: doc.body.textContent?.trim() || '',
  };
}

function textFromRejectedEmbedHtml(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('iframe,script,style').forEach((node) => node.remove());
    return doc.body.textContent?.trim() || '';
  } catch {
    return html
      .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, ' ')
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

function isSingleClipboardUrl(value: string): boolean {
  const text = String(value || '').trim();
  return /^https?:\/\/\S+$/i.test(text) && !/\s/.test(text);
}

function getDropInsertPosition(view: TiptapEditor['view'], left: number, top: number): number {
  try {
    return view.posAtCoords({ left, top })?.pos ?? view.state.selection.from;
  } catch {
    return view.state.selection.from;
  }
}

function isInlineImageDropHandled(event: Event): boolean {
  return Boolean((event as any).__npInlineImageDropHandled);
}

function markInlineImageDropHandled(event: Event): void {
  (event as any).__npInlineImageDropHandled = true;
}

function toggleBoldCurrentParagraph(editor: TiptapEditor) {
  const { state, view } = editor;
  const { $from } = state.selection;
  const paragraph = state.schema.nodes.paragraph;

  let depth = $from.depth;
  while (depth > 0 && $from.node(depth).type !== paragraph) depth -= 1;
  if (depth <= 0) {
    editor.chain().focus().toggleBold().run();
    return;
  }

  const from = $from.start(depth);
  const to = $from.end(depth);
  view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
  editor.chain().focus().toggleBold().run();
}

function normalizeHref(raw: string): string {
  const href = String(raw || '').trim();
  if (!href) return '';

  // Prevent obviously unsafe protocols.
  if (/^\s*javascript:/i.test(href)) return '';

  if (/^(https?:\/\/|mailto:)/i.test(href)) return href;
  return `https://${href}`;
}

function escapeHtmlAttr(input: string): string {
  return String(input || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const VideoBlock = Node.create({
  name: 'videoBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      poster: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'video[src]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes, { controls: '', playsinline: '', class: 'np-rich-video' })];
  },
});

function ToolbarButton({
  editor,
  label,
  onClick,
  active,
  disabled,
  title,
}: {
  editor: TiptapEditor;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`px-2 py-0.5 text-xs rounded-md border transition-colors disabled:opacity-50 ${
        active ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
      }`}
    >
      {label}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder = 'Write article content…', onPendingUploadChange }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingUploadsRef = useRef(0);
  const [pendingUploads, setPendingUploads] = useState(0);

  const extensions = useMemo(
    () => [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false }),
      Image,
      NewsPulseInlineImage,
      InlineImageUploadPlaceholder,
      NewsPulseYouTube,
      NewsPulseX,
      NewsPulseInstagram,
      VideoBlock,
      Placeholder.configure({ placeholder }),
    ],
    [placeholder]
  );

  const editor = useEditor({
    extensions,
    content: value || '<p></p>',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'min-h-[360px] p-4 prose prose-sm max-w-none bg-white text-slate-900 focus:outline-none',
        'data-placeholder': placeholder,
      },
      handleDOMEvents: {
        drop: (view, event) => {
          const dragEvent = event as DragEvent;
          if (isInlineImageDropHandled(dragEvent)) return true;
          const imageFiles = getImageFilesFromList(dragEvent.dataTransfer?.files);
          if (imageFiles.length === 0) return false;

          markInlineImageDropHandled(dragEvent);
          dragEvent.preventDefault();
          const accepted = imageFiles.filter(isInlineImageFile);
          if (accepted.length !== imageFiles.length) {
            toast.error('Only JPEG, PNG, or WebP images can be uploaded inline.');
          }
          const dropPos = getDropInsertPosition(view, dragEvent.clientX, dragEvent.clientY);
          accepted.forEach((file, index) => insertUploadingImage(file, dropPos + index));
          return true;
        },
      },
      handlePaste: (_view, event) => {
        const imageFiles = getClipboardImageFiles(event.clipboardData);
        if (imageFiles.length > 0) {
          event.preventDefault();
          const accepted = imageFiles.filter(isInlineImageFile);
          if (accepted.length !== imageFiles.length) {
            toast.error('Only JPEG, PNG, or WebP images can be uploaded inline.');
          }
          accepted.forEach((file) => insertUploadingImage(file));
          return true;
        }

        const html = event.clipboardData?.getData('text/html') || '';
        if (html && (/<\s*(iframe|script)\b/i.test(html) || /<\s*blockquote\b[^>]*(twitter-tweet|instagram-media)/i.test(html))) {
          event.preventDefault();
          const youtubeEmbed = extractNewsPulseYouTubeFromHtml(html);
          if (youtubeEmbed) {
            insertNewsPulseYouTube(youtubeEmbed);
            return true;
          }

          const xEmbed = extractNewsPulseXFromHtml(html);
          if (xEmbed) {
            insertNewsPulseX(xEmbed);
            return true;
          }

          const instagramEmbed = extractNewsPulseInstagramFromHtml(html);
          if (instagramEmbed) {
            insertNewsPulseInstagram(instagramEmbed);
            return true;
          }

          const text = textFromRejectedEmbedHtml(html);
          if (text) editor.chain().focus().insertContent(text).run();
          toast.error('Only supported YouTube URLs can be inserted as video blocks.');
          return true;
        }

        if (html && htmlHasImage(html)) {
          const cleaned = removeImagesFromHtml(html);
          event.preventDefault();
          if (cleaned.text || cleaned.html.trim()) editor.chain().focus().insertContent(cleaned.html || cleaned.text).run();
          toast.error('Paste or upload the image file directly. Website image URLs are not imported as inline images.');
          return true;
        }

        const plainText = event.clipboardData?.getData('text/plain') || '';
        const youtubeUrl = parseNewsPulseYouTubeUrl(plainText);
        if (youtubeUrl && isSingleClipboardUrl(plainText)) {
          event.preventDefault();
          insertNewsPulseYouTube(youtubeUrl);
          return true;
        }

        const xUrl = parseNewsPulseXUrl(plainText);
        if (xUrl && isSingleClipboardUrl(plainText)) {
          event.preventDefault();
          insertNewsPulseX(xUrl);
          return true;
        }

        const instagramUrl = parseNewsPulseInstagramUrl(plainText);
        if (instagramUrl && isSingleClipboardUrl(plainText)) {
          event.preventDefault();
          insertNewsPulseInstagram(instagramUrl);
          return true;
        }

        return false;
      },
      handleDrop: (view, event) => {
        if (isInlineImageDropHandled(event)) return true;
        const imageFiles = getImageFilesFromList(event.dataTransfer?.files);
        if (imageFiles.length === 0) return false;

        markInlineImageDropHandled(event);
        event.preventDefault();
        const accepted = imageFiles.filter(isInlineImageFile);
        if (accepted.length !== imageFiles.length) {
          toast.error('Only JPEG, PNG, or WebP images can be uploaded inline.');
        }
        const dropPos = getDropInsertPosition(view, event.clientX, event.clientY);
        accepted.forEach((file, index) => insertUploadingImage(file, dropPos + index));
        return true;
      },
    },
  });

  const setPendingUploadCount = (nextCount: number) => {
    const normalized = Math.max(0, nextCount);
    pendingUploadsRef.current = normalized;
    setPendingUploads(normalized);
    onPendingUploadChange?.(normalized > 0);
  };

  const updatePendingUploads = (delta: number) => {
    setPendingUploadCount(pendingUploadsRef.current + delta);
  };

  const findUploadPlaceholder = (uploadId: string): { from: number; to: number } | null => {
    if (!editor) return null;
    let found: { from: number; to: number } | null = null;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'inlineImageUploadPlaceholder' && node.attrs.id === uploadId) {
        found = { from: pos, to: pos + node.nodeSize };
        return false;
      }
      return true;
    });
    return found;
  };

  const insertNewsPulseImage = (attrs: NewsPulseInlineImageAttrs, range?: { from: number; to: number }) => {
    if (!editor) return;
    const content = { type: 'newsPulseInlineImage', attrs };
    if (range) {
      editor.chain().focus().insertContentAt(range, content).run();
      return;
    }
    editor.chain().focus().insertContent(content).run();
  };

  const insertNewsPulseYouTube = (embed: NewsPulseYouTubeEmbed) => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'newsPulseYouTube',
      attrs: {
        videoId: embed.videoId,
        url: embed.url,
      },
    }).run();
  };

  const insertNewsPulseX = (embed: NewsPulseXEmbed) => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'newsPulseX',
      attrs: {
        postId: embed.postId,
        url: embed.url,
      },
    }).run();
  };

  const insertNewsPulseInstagram = (embed: NewsPulseInstagramEmbed) => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'newsPulseInstagram',
      attrs: {
        shortcode: embed.shortcode,
        url: embed.url,
      },
    }).run();
  };

  const removeUploadPlaceholder = (uploadId: string) => {
    const range = findUploadPlaceholder(uploadId);
    if (!editor || !range) return;
    editor.chain().focus().deleteRange(range).run();
  };

  const attrsFromUploadResult = (result: UploadInlineImageResult, file: File): NewsPulseInlineImageAttrs => ({
    mediaId: result.mediaId,
    src: result.url,
    alt: result.alt || file.name,
    caption: result.caption || null,
    credit: result.credit || null,
    width: result.width || null,
    height: result.height || null,
  });

  const insertUploadingImage = (file: File, pos?: number) => {
    if (!editor) return;
    const uploadId = `inline-image-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const placeholder = { type: 'inlineImageUploadPlaceholder', attrs: { id: uploadId, filename: file.name } };
    if (typeof pos === 'number') editor.chain().focus().insertContentAt(pos, placeholder).run();
    else editor.chain().focus().insertContent(placeholder).run();

    updatePendingUploads(1);
    void uploadInlineImage(file)
      .then((result) => {
        const range = findUploadPlaceholder(uploadId);
        insertNewsPulseImage(attrsFromUploadResult(result, file), range || undefined);
      })
      .catch((error: any) => {
        removeUploadPlaceholder(uploadId);
        toast.error(String(error?.message || 'Inline image upload failed'));
      })
      .finally(() => updatePendingUploads(-1));
  };

  useEffect(() => {
    if (!editor) return;
    const next = value || '<p></p>';
    const current = editor.getHTML();
    if (current !== next) editor.commands.setContent(next);
  }, [editor, value]);

  useEffect(() => {
    return () => onPendingUploadChange?.(false);
  }, [onPendingUploadChange]);

  const [symbol, setSymbol] = useState('');
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);

  if (!editor) return <div className="text-xs text-slate-500">Loading editor…</div>;

  const canUndo = editor.can().chain().undo().run();
  const canRedo = editor.can().chain().redo().run();

  const insertSymbol = (s: string) => editor.chain().focus().insertContent(s).run();

  const insertMediaAsset = (asset: MediaLibraryAsset) => {
    if (asset.mediaType === 'video') {
      editor.chain().focus().insertContent({
        type: 'videoBlock',
        attrs: {
          src: asset.url,
          poster: asset.posterUrl || undefined,
          title: asset.filename,
        },
      }).run();
    } else {
      insertNewsPulseImage({
        mediaId: asset.id,
        src: asset.url,
        alt: asset.filename,
        caption: null,
        credit: null,
      });
    }
    setMediaLibraryOpen(false);
  };

  const onChooseLocalImage = () => {
    fileInputRef.current?.click();
  };

  const onYouTube = () => {
    const raw = window.prompt('YouTube URL');
    if (raw == null) return;
    const youtubeUrl = parseNewsPulseYouTubeUrl(raw);
    if (!youtubeUrl) {
      toast.error('Enter a valid YouTube URL.');
      return;
    }
    insertNewsPulseYouTube(youtubeUrl);
  };

  const onX = () => {
    const raw = window.prompt('X/Twitter post URL');
    if (raw == null) return;
    const xUrl = parseNewsPulseXUrl(raw);
    if (!xUrl) {
      toast.error('Enter a valid X/Twitter status URL.');
      return;
    }
    insertNewsPulseX(xUrl);
  };

  const onInstagram = () => {
    const raw = window.prompt('Instagram post or reel URL');
    if (raw == null) return;
    const instagramUrl = parseNewsPulseInstagramUrl(raw);
    if (!instagramUrl) {
      toast.error('Enter a valid Instagram post or reel URL.');
      return;
    }
    insertNewsPulseInstagram(instagramUrl);
  };

  const onEditorDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    if (isInlineImageDropHandled(event.nativeEvent)) return;
    const imageFiles = getImageFilesFromList(event.dataTransfer?.files);
    if (imageFiles.length === 0) return;

    markInlineImageDropHandled(event.nativeEvent);
    event.preventDefault();
    const accepted = imageFiles.filter(isInlineImageFile);
    if (accepted.length !== imageFiles.length) {
      toast.error('Only JPEG, PNG, or WebP images can be uploaded inline.');
    }
    const dropPos = getDropInsertPosition(editor.view, event.clientX, event.clientY);
    accepted.forEach((file, index) => insertUploadingImage(file, dropPos + index));
  };

  const onLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const raw = window.prompt('Enter link URL');
    if (raw == null) return;
    const href = normalizeHref(raw);
    if (!href) return;

    if (editor.state.selection.empty) {
      const safe = escapeHtmlAttr(href);
      editor.chain().focus().insertContent(`<a href="${safe}" target="_blank" rel="noreferrer">${safe}</a>`).run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
  };

  const onAutoFormat = () => {
    const text = editor.getText({ blockSeparator: '\n\n' });
    const html = autoFormatPlainTextToHtml(text);
    editor.commands.setContent(html);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05),inset_0_1px_0_rgba(255,255,255,0.72)] transition-[border-color,box-shadow] duration-150 focus-within:border-slate-500 focus-within:shadow-[0_0_0_1px_rgba(100,116,139,0.22),0_8px_18px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.72)] np-rich-editor">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-3 py-2 shadow-[inset_0_-1px_0_rgba(203,213,225,0.55)]">
        <ToolbarButton editor={editor} label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
        <ToolbarButton editor={editor} label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
        <ToolbarButton editor={editor} label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} />
        <ToolbarButton
          editor={editor}
          label="One-Liner Bold"
          onClick={() => toggleBoldCurrentParagraph(editor)}
          title="Bold the current paragraph"
        />
        <ToolbarButton editor={editor} label="Bullets" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} />
        <ToolbarButton editor={editor} label="Numbered" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} />
        <ToolbarButton editor={editor} label="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} />
        <ToolbarButton editor={editor} label="Highlight" onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} />
        <ToolbarButton editor={editor} label="Link" onClick={onLink} active={editor.isActive('link')} />
        <ToolbarButton editor={editor} label="YouTube" onClick={onYouTube} title="Insert a YouTube video block" />
        <ToolbarButton editor={editor} label="X / Twitter" onClick={onX} title="Insert an X/Twitter post block" />
        <ToolbarButton editor={editor} label="Instagram" onClick={onInstagram} title="Insert an Instagram post or reel block" />
        <ToolbarButton editor={editor} label="Upload Image" onClick={onChooseLocalImage} title="Upload local image into the article body" />
        <ToolbarButton editor={editor} label="Media Library" onClick={() => setMediaLibraryOpen(true)} title="Insert image or video from Media Library" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          aria-label="Upload inline image"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            if (!isInlineImageFile(file)) {
              toast.error('Only JPEG, PNG, or WebP images can be uploaded inline.');
              return;
            }
            insertUploadingImage(file);
          }}
        />

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <select
          value={symbol}
          onChange={(e) => {
            const v = String(e.target.value || '');
            setSymbol(v);
            if (!v) return;
            insertSymbol(v);
            setSymbol('');
          }}
          className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-700 transition-colors hover:bg-slate-100 hover:border-slate-400 focus:border-slate-400 focus:outline-none"
          aria-label="Insert symbol"
        >
          <option value="">Symbols</option>
          <option value="✅">✅</option>
          <option value="•">•</option>
          <option value="➤">➤</option>
          <option value="—">—</option>
        </select>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <ToolbarButton editor={editor} label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!canUndo} />
        <ToolbarButton editor={editor} label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!canRedo} />

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <ToolbarButton
          editor={editor}
          label="Auto Format"
          onClick={onAutoFormat}
          title="Auto Format: \n\n => <p>, -/• => <ul><li>, ## => one-liner bold, ==x== => <mark>"
        />
      </div>

      <EditorContent
        editor={editor}
        className="bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.03)]"
        onDrop={onEditorDrop}
      />

      {pendingUploads > 0 ? (
        <div className="border-t border-slate-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Uploading inline image{pendingUploads > 1 ? 's' : ''}... Please wait before saving.
        </div>
      ) : null}

      <MediaLibrarySelector
        open={mediaLibraryOpen}
        mode="all"
        title="Insert Media in Article"
        actionLabel="Insert in Article"
        onClose={() => setMediaLibraryOpen(false)}
        onSelect={insertMediaAsset}
      />
    </div>
  );
}

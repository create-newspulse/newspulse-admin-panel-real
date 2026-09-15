import { Node, mergeAttributes, type NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import type { NewsPulseInlineImageAttrs } from './NewsPulseInlineImage';

export type NewsPulseGalleryItem = NewsPulseInlineImageAttrs & {
  mediaId: string;
  src: string;
};

export type NewsPulseGalleryAttrs = {
  items?: NewsPulseGalleryItem[] | string | null;
};

export const NEWS_PULSE_GALLERY_MIN_ITEMS = 2;
export const NEWS_PULSE_GALLERY_MAX_ITEMS = 20;

function safeAttr(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return text || undefined;
}

function safeDimension(value: unknown): string | undefined {
  const text = safeAttr(value);
  if (!text) return undefined;
  return /^\d+$/.test(text) ? text : undefined;
}

function stripCreditPrefix(value: string): string {
  return value.replace(/^\s*(credit|source)\s*:\s*/i, '').trim();
}

function getInlineImageAttrs(element: HTMLElement): NewsPulseGalleryItem | null {
  const image = element.querySelector('img');
  const mediaId = safeAttr(element.getAttribute('data-np-media-id'));
  const src = safeAttr(image?.getAttribute('src'));
  if (!mediaId || !src) return null;

  const captionNode = element.querySelector('[data-np-caption], figcaption');
  const creditNode = element.querySelector('[data-np-credit]');
  return {
    mediaId,
    src,
    alt: safeAttr(image?.getAttribute('alt')) || null,
    caption: safeAttr(captionNode?.textContent) || null,
    credit: creditNode?.textContent ? stripCreditPrefix(creditNode.textContent) : null,
    width: safeDimension(element.getAttribute('data-np-width')) || safeDimension(image?.getAttribute('width')) || null,
    height: safeDimension(element.getAttribute('data-np-height')) || safeDimension(image?.getAttribute('height')) || null,
  };
}

function normalizeGalleryItems(value: NewsPulseGalleryAttrs['items']): NewsPulseGalleryItem[] {
  const rawItems = typeof value === 'string' ? safelyParseItems(value) : value;
  if (!Array.isArray(rawItems)) return [];

  const seen = new Set<string>();
  const items: NewsPulseGalleryItem[] = [];
  for (const item of rawItems) {
    const mediaId = safeAttr((item as any)?.mediaId);
    const src = safeAttr((item as any)?.src || (item as any)?.url);
    if (!mediaId || !src || seen.has(mediaId)) continue;
    seen.add(mediaId);
    items.push({
      mediaId,
      src,
      alt: safeAttr((item as any)?.alt) || null,
      caption: safeAttr((item as any)?.caption) || null,
      credit: safeAttr((item as any)?.credit) || null,
      width: safeDimension((item as any)?.width) || null,
      height: safeDimension((item as any)?.height) || null,
    });
  }
  return items.slice(0, NEWS_PULSE_GALLERY_MAX_ITEMS);
}

function safelyParseItems(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getNewsPulseGalleryItems(attrs: NewsPulseGalleryAttrs): NewsPulseGalleryItem[] {
  return normalizeGalleryItems(attrs.items);
}

export function isValidNewsPulseGallery(attrs: NewsPulseGalleryAttrs): boolean {
  const items = getNewsPulseGalleryItems(attrs);
  return items.length >= NEWS_PULSE_GALLERY_MIN_ITEMS && items.length <= NEWS_PULSE_GALLERY_MAX_ITEMS;
}

function renderInlineFigure(item: NewsPulseGalleryItem) {
  const width = safeDimension(item.width);
  const height = safeDimension(item.height);
  const caption = safeAttr(item.caption);
  const credit = safeAttr(item.credit);
  return [
    'figure',
    mergeAttributes({
      'data-np-block': 'inline-image',
      'data-np-media-id': item.mediaId,
      'data-np-width': width,
      'data-np-height': height,
      class: 'np-inline-image',
    }),
    ['img', {
      src: item.src,
      alt: safeAttr(item.alt) || '',
      width,
      height,
    }],
    ...(caption ? [['figcaption', { 'data-np-caption': 'true' }, caption]] : []),
    ...(credit ? [['div', { 'data-np-credit': 'true' }, `Credit: ${credit}`]] : []),
  ];
}

function NewsPulseGalleryView({ editor, getPos, node }: NodeViewProps) {
  const items = getNewsPulseGalleryItems(node.attrs as NewsPulseGalleryAttrs);

  const remove = () => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  };

  const editGallery = () => {
    window.dispatchEvent(new CustomEvent('np:edit-gallery', {
      detail: { editor, getPos, nodeSize: node.nodeSize, items },
    }));
  };

  return (
    <NodeViewWrapper
      as="div"
      data-np-block="gallery"
      className="my-4 rounded-lg border border-slate-200 bg-white p-3 text-slate-900 shadow-sm"
      contentEditable={false}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Photo Gallery</div>
          <div className="mt-0.5 text-xs text-slate-500">{items.length} images</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={editGallery} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
            Edit Gallery
          </button>
          <button type="button" onClick={remove} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
            Remove Gallery
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.slice(0, 8).map((item) => (
          <div key={item.mediaId} className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            <img src={item.src} alt={safeAttr(item.alt) || 'Gallery image'} className="h-24 w-full object-cover" />
          </div>
        ))}
      </div>
    </NodeViewWrapper>
  );
}

export const NewsPulseGallery = Node.create({
  name: 'newsPulseGallery',
  group: 'block',
  atom: true,
  draggable: true,
  priority: 1000,

  addAttributes() {
    return {
      items: { default: [] },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-np-block="gallery"]',
        getAttrs: (node) => {
          const element = node as HTMLElement;
          const items = Array.from(element.querySelectorAll('figure[data-np-block="inline-image"]'))
            .map((figure) => getInlineImageAttrs(figure as HTMLElement))
            .filter((item): item is NewsPulseGalleryItem => !!item);
          return items.length >= NEWS_PULSE_GALLERY_MIN_ITEMS ? { items } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const items = getNewsPulseGalleryItems(HTMLAttributes as NewsPulseGalleryAttrs);
    return [
      'div',
      mergeAttributes({ 'data-np-block': 'gallery' }),
      ...items.map(renderInlineFigure),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NewsPulseGalleryView);
  },
});
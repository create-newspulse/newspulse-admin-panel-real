import { Node, mergeAttributes, type NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';

export type NewsPulseInlineImageAttrs = {
  mediaId?: string | null;
  src: string;
  alt?: string | null;
  caption?: string | null;
  credit?: string | null;
  width?: number | string | null;
  height?: number | string | null;
};

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

function getFigureAttrs(element: HTMLElement): NewsPulseInlineImageAttrs | false {
  const image = element.matches('img') ? element : element.querySelector('img');
  const src = safeAttr(image?.getAttribute('src'));
  if (!src) return false;

  const captionNode = element.querySelector('[data-np-caption], figcaption');
  const creditNode = element.querySelector('[data-np-credit]');

  return {
    mediaId:
      safeAttr(element.getAttribute('data-np-media-id')) ||
      safeAttr(element.getAttribute('data-media-id')) ||
      safeAttr(image?.getAttribute('data-np-media-id')) ||
      safeAttr(image?.getAttribute('data-media-id')) ||
      safeAttr(image?.getAttribute('data-public-id')) ||
      null,
    src,
    alt: safeAttr(image?.getAttribute('alt')) || safeAttr(element.getAttribute('data-alt')) || null,
    caption: safeAttr(element.getAttribute('data-caption')) || safeAttr(captionNode?.textContent) || null,
    credit: safeAttr(element.getAttribute('data-credit')) || (creditNode?.textContent ? stripCreditPrefix(creditNode.textContent) : null),
    width: safeDimension(element.getAttribute('data-np-width')) || safeDimension(element.getAttribute('data-width')) || safeDimension(image?.getAttribute('width')) || null,
    height: safeDimension(element.getAttribute('data-np-height')) || safeDimension(element.getAttribute('data-height')) || safeDimension(image?.getAttribute('height')) || null,
  };
}

function NewsPulseInlineImageView({ node, updateAttributes }: NodeViewProps) {
  const attrs = node.attrs as NewsPulseInlineImageAttrs;
  const caption = safeAttr(attrs.caption) || '';
  const credit = safeAttr(attrs.credit) || '';
  const alt = safeAttr(attrs.alt) || 'Inline article image';

  const editCaption = () => {
    const next = window.prompt('Image caption', caption);
    if (next == null) return;
    updateAttributes({ caption: next.trim() || null });
  };

  const editCredit = () => {
    const next = window.prompt('Image credit or source', credit);
    if (next == null) return;
    updateAttributes({ credit: next.trim() || null });
  };

  return (
    <NodeViewWrapper
      as="figure"
      data-np-block="inline-image"
      data-np-media-id={safeAttr(attrs.mediaId)}
      data-np-width={safeDimension(attrs.width)}
      data-np-height={safeDimension(attrs.height)}
      className="np-inline-image my-4 rounded-lg border border-slate-200 bg-slate-50 p-2"
      contentEditable={false}
    >
      <img
        src={attrs.src}
        alt={alt}
        width={safeDimension(attrs.width)}
        height={safeDimension(attrs.height)}
        className="mx-auto max-h-[520px] max-w-full rounded-md object-contain"
      />
      <figcaption data-np-caption="true" className="mt-2 text-center text-sm text-slate-700">
        {caption || <span className="text-slate-400">No caption</span>}
      </figcaption>
      {credit ? (
        <div data-np-credit="true" className="mt-1 text-center text-xs uppercase tracking-wide text-slate-500">
          Credit: {credit}
        </div>
      ) : null}
      <div className="mt-2 flex justify-center gap-2">
        <button type="button" onClick={editCaption} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
          Edit caption
        </button>
        <button type="button" onClick={editCredit} className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
          Edit credit
        </button>
      </div>
    </NodeViewWrapper>
  );
}

export const NewsPulseInlineImage = Node.create({
  name: 'newsPulseInlineImage',
  group: 'block',
  atom: true,
  draggable: true,
  priority: 1000,

  addAttributes() {
    return {
      mediaId: { default: null },
      src: { default: null },
      alt: { default: null },
      caption: { default: null },
      credit: { default: null },
      width: { default: null },
      height: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-np-block="inline-image"]',
        getAttrs: (node) => getFigureAttrs(node as HTMLElement),
      },
      {
        tag: 'img[data-np-block="inline-image"]',
        getAttrs: (node) => getFigureAttrs(node as HTMLElement),
      },
      {
        tag: 'figure[data-np-inline-image]',
        getAttrs: (node) => getFigureAttrs(node as HTMLElement),
      },
      {
        tag: 'img[data-np-inline-image]',
        getAttrs: (node) => getFigureAttrs(node as HTMLElement),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as NewsPulseInlineImageAttrs;
    const mediaId = safeAttr(attrs.mediaId);
    const caption = safeAttr(attrs.caption);
    const credit = safeAttr(attrs.credit);
    const width = safeDimension(attrs.width);
    const height = safeDimension(attrs.height);

    return [
      'figure',
      mergeAttributes({
        'data-np-block': 'inline-image',
        'data-np-media-id': mediaId,
        'data-np-width': width,
        'data-np-height': height,
        class: 'np-inline-image',
      }),
      ['img', {
        src: attrs.src,
        alt: safeAttr(attrs.alt) || '',
        width,
        height,
      }],
      ...(caption ? [['figcaption', { 'data-np-caption': 'true' }, caption]] : []),
      ...(credit ? [['div', { 'data-np-credit': 'true' }, `Credit: ${credit}`]] : []),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NewsPulseInlineImageView);
  },
});

export const InlineImageUploadPlaceholder = Node.create({
  name: 'inlineImageUploadPlaceholder',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      id: { default: null },
      filename: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-np-inline-image-uploading]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-np-inline-image-uploading': 'true',
        class: 'np-inline-image-uploading rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-sm text-slate-500',
      }),
      `Uploading image${safeAttr(HTMLAttributes.filename) ? `: ${safeAttr(HTMLAttributes.filename)}` : ''}...`,
    ];
  },
});
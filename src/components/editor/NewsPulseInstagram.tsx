import { Node, mergeAttributes, type NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import {
  parseNewsPulseInstagramAttrs,
  parseNewsPulseInstagramUrl,
  type NewsPulseInstagramEmbed,
} from '@/lib/instagram';

export type NewsPulseInstagramAttrs = {
  shortcode?: string | null;
  url?: string | null;
};

function safeAttr(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return text || undefined;
}

function attrsToEmbed(attrs: NewsPulseInstagramAttrs): NewsPulseInstagramEmbed | null {
  return parseNewsPulseInstagramAttrs({ shortcode: attrs.shortcode, url: attrs.url });
}

function NewsPulseInstagramView({ editor, getPos, node, updateAttributes }: NodeViewProps) {
  const attrs = node.attrs as NewsPulseInstagramAttrs;
  const embed = attrsToEmbed(attrs);

  const remove = () => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  };

  const editUrl = () => {
    const next = window.prompt('Instagram post or reel URL', embed?.url || safeAttr(attrs.url) || '');
    if (next == null) return;
    const parsed = parseNewsPulseInstagramUrl(next);
    if (!parsed) {
      window.alert('Enter a valid Instagram post or reel URL.');
      return;
    }
    updateAttributes({ shortcode: parsed.shortcode, url: parsed.url });
  };

  return (
    <NodeViewWrapper
      as="div"
      data-np-block="instagram"
      data-np-shortcode={embed?.shortcode || safeAttr(attrs.shortcode)}
      data-np-url={embed?.url || safeAttr(attrs.url)}
      className="my-4 rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm"
      contentEditable={false}
    >
      <div className="p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Instagram</div>
        <div className="mt-1 text-sm font-medium">Post/Reel</div>
        <div className="mt-1 break-all text-xs text-slate-600">{embed?.url || 'Invalid Instagram URL'}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {embed ? (
            <a href={embed.url} target="_blank" rel="noreferrer" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
              Open on Instagram
            </a>
          ) : null}
          <button type="button" onClick={editUrl} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
            Change URL
          </button>
          <button type="button" onClick={remove} className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
            Remove
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const NewsPulseInstagram = Node.create({
  name: 'newsPulseInstagram',
  group: 'block',
  atom: true,
  draggable: true,
  priority: 1000,

  addAttributes() {
    return {
      shortcode: { default: null },
      url: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-np-block="instagram"]',
        getAttrs: (node) => {
          const element = node as HTMLElement;
          const parsed = parseNewsPulseInstagramAttrs({
            shortcode: element.getAttribute('data-np-shortcode'),
            url: element.getAttribute('data-np-url'),
          });
          return parsed ? { shortcode: parsed.shortcode, url: parsed.url } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const parsed = parseNewsPulseInstagramAttrs({
      shortcode: HTMLAttributes.shortcode,
      url: HTMLAttributes.url,
    });
    return [
      'div',
      mergeAttributes({
        'data-np-block': 'instagram',
        'data-np-shortcode': parsed?.shortcode,
        'data-np-url': parsed?.url,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NewsPulseInstagramView);
  },
});
import { Node, mergeAttributes, type NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import {
  parseNewsPulseFacebookAttrs,
  parseNewsPulseFacebookUrl,
  type NewsPulseFacebookEmbed,
} from '@/lib/facebook';

export type NewsPulseFacebookAttrs = {
  url?: string | null;
};

function safeAttr(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return text || undefined;
}

function attrsToEmbed(attrs: NewsPulseFacebookAttrs): NewsPulseFacebookEmbed | null {
  return parseNewsPulseFacebookAttrs({ url: attrs.url });
}

function NewsPulseFacebookView({ editor, getPos, node, updateAttributes }: NodeViewProps) {
  const attrs = node.attrs as NewsPulseFacebookAttrs;
  const embed = attrsToEmbed(attrs);

  const remove = () => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  };

  const editUrl = () => {
    const next = window.prompt('Facebook post URL', embed?.url || safeAttr(attrs.url) || '');
    if (next == null) return;
    const parsed = parseNewsPulseFacebookUrl(next);
    if (!parsed) {
      window.alert('Enter a valid Facebook post URL.');
      return;
    }
    updateAttributes({ url: parsed.url });
  };

  return (
    <NodeViewWrapper
      as="div"
      data-np-block="facebook"
      data-np-url={embed?.url || safeAttr(attrs.url)}
      className="my-4 rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm"
      contentEditable={false}
    >
      <div className="p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Facebook Post</div>
        <div className="mt-1 break-all text-xs text-slate-600">{embed?.url || 'Invalid Facebook URL'}</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {embed ? (
            <a href={embed.url} target="_blank" rel="noreferrer" className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">
              Open post
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

export const NewsPulseFacebook = Node.create({
  name: 'newsPulseFacebook',
  group: 'block',
  atom: true,
  draggable: true,
  priority: 1000,

  addAttributes() {
    return {
      url: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-np-block="facebook"]',
        getAttrs: (node) => {
          const element = node as HTMLElement;
          const parsed = parseNewsPulseFacebookAttrs({
            url: element.getAttribute('data-np-url'),
          });
          return parsed ? { url: parsed.url } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const parsed = parseNewsPulseFacebookAttrs({
      url: HTMLAttributes.url,
    });
    return [
      'div',
      mergeAttributes({
        'data-np-block': 'facebook',
        'data-np-url': parsed?.url,
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NewsPulseFacebookView);
  },
});
import { Node, mergeAttributes, type NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import {
  parseNewsPulseXAttrs,
  parseNewsPulseXUrl,
  type NewsPulseXEmbed,
} from '@/lib/x';

export type NewsPulseXAttrs = {
  postId?: string | null;
  url?: string | null;
};

function safeAttr(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return text || undefined;
}

function attrsToEmbed(attrs: NewsPulseXAttrs): NewsPulseXEmbed | null {
  return parseNewsPulseXAttrs({ postId: attrs.postId, url: attrs.url });
}

function NewsPulseXView({ editor, getPos, node, updateAttributes }: NodeViewProps) {
  const attrs = node.attrs as NewsPulseXAttrs;
  const embed = attrsToEmbed(attrs);

  const remove = () => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  };

  const editUrl = () => {
    const next = window.prompt('X/Twitter post URL', embed?.url || safeAttr(attrs.url) || '');
    if (next == null) return;
    const parsed = parseNewsPulseXUrl(next);
    if (!parsed) {
      window.alert('Enter a valid X/Twitter status URL.');
      return;
    }
    updateAttributes({ postId: parsed.postId, url: parsed.url });
  };

  return (
    <NodeViewWrapper
      as="div"
      data-np-block="x"
      data-np-post-id={embed?.postId || safeAttr(attrs.postId)}
      data-np-url={embed?.url || safeAttr(attrs.url)}
      className="my-4 rounded-lg border border-slate-200 bg-white text-slate-900 shadow-sm"
      contentEditable={false}
    >
      <div className="p-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">X Post</div>
        {embed?.username ? <div className="mt-1 text-sm font-medium">@{embed.username}</div> : null}
        <div className="mt-1 break-all text-xs text-slate-600">{embed?.url || 'Invalid X/Twitter URL'}</div>
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

export const NewsPulseX = Node.create({
  name: 'newsPulseX',
  group: 'block',
  atom: true,
  draggable: true,
  priority: 1000,

  addAttributes() {
    return {
      postId: { default: null },
      url: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-np-block="x"]',
        getAttrs: (node) => {
          const element = node as HTMLElement;
          const parsed = parseNewsPulseXAttrs({
            postId: element.getAttribute('data-np-post-id'),
            url: element.getAttribute('data-np-url'),
          });
          return parsed ? { postId: parsed.postId, url: parsed.url } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const parsed = parseNewsPulseXAttrs({
      postId: HTMLAttributes.postId,
      url: HTMLAttributes.url,
    });
    return [
      'div',
      mergeAttributes({
        'data-np-block': 'x',
        'data-np-post-id': parsed?.postId || safeAttr(HTMLAttributes.postId),
        'data-np-url': parsed?.url || safeAttr(HTMLAttributes.url),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NewsPulseXView);
  },
});
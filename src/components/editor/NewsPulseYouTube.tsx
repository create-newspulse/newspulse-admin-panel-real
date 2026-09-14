import { Node, mergeAttributes, type NodeViewProps } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import {
  parseNewsPulseYouTubeAttrs,
  parseNewsPulseYouTubeUrl,
  type NewsPulseYouTubeEmbed,
} from '@/lib/youtube';

export type NewsPulseYouTubeAttrs = {
  videoId?: string | null;
  url?: string | null;
  title?: string | null;
};

function safeAttr(value: unknown): string | undefined {
  const text = String(value ?? '').trim();
  return text || undefined;
}

function attrsToEmbed(attrs: NewsPulseYouTubeAttrs): NewsPulseYouTubeEmbed | null {
  return parseNewsPulseYouTubeAttrs({ videoId: attrs.videoId, url: attrs.url });
}

function NewsPulseYouTubeView({ editor, getPos, node, updateAttributes }: NodeViewProps) {
  const attrs = node.attrs as NewsPulseYouTubeAttrs;
  const embed = attrsToEmbed(attrs);
  const title = safeAttr(attrs.title);

  const remove = () => {
    if (typeof getPos !== 'function') return;
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
  };

  const editUrl = () => {
    const next = window.prompt('YouTube URL', embed?.url || safeAttr(attrs.url) || '');
    if (next == null) return;
    const parsed = parseNewsPulseYouTubeUrl(next);
    if (!parsed) {
      window.alert('Enter a valid YouTube URL.');
      return;
    }
    updateAttributes({ videoId: parsed.videoId, url: parsed.url });
  };

  return (
    <NodeViewWrapper
      as="div"
      data-np-block="youtube"
      data-np-video-id={embed?.videoId || safeAttr(attrs.videoId)}
      data-np-url={embed?.url || safeAttr(attrs.url)}
      className="my-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-950 text-white"
      contentEditable={false}
    >
      <div className="grid gap-3 p-3 sm:grid-cols-[180px_1fr] sm:items-center">
        <div className="aspect-video overflow-hidden rounded-md bg-slate-800">
          {embed ? (
            <img src={embed.thumbnailUrl} alt="YouTube video thumbnail" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-300">YouTube preview</div>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-red-300">YouTube</div>
          {title ? <div className="mt-1 truncate text-sm font-medium">{title}</div> : null}
          <div className="mt-1 truncate text-xs text-slate-300">{embed?.url || 'Invalid YouTube URL'}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={editUrl} className="rounded border border-white/20 bg-white/10 px-2 py-1 text-xs hover:bg-white/15">
              Change URL
            </button>
            <button type="button" onClick={remove} className="rounded border border-white/20 bg-white/10 px-2 py-1 text-xs hover:bg-white/15">
              Remove
            </button>
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const NewsPulseYouTube = Node.create({
  name: 'newsPulseYouTube',
  group: 'block',
  atom: true,
  draggable: true,
  priority: 1000,

  addAttributes() {
    return {
      videoId: { default: null },
      url: { default: null },
      title: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-np-block="youtube"]',
        getAttrs: (node) => {
          const element = node as HTMLElement;
          const parsed = parseNewsPulseYouTubeAttrs({
            videoId: element.getAttribute('data-np-video-id'),
            url: element.getAttribute('data-np-url'),
          });
          return parsed ? { videoId: parsed.videoId, url: parsed.url } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const parsed = parseNewsPulseYouTubeAttrs({
      videoId: HTMLAttributes.videoId,
      url: HTMLAttributes.url,
    });
    return [
      'div',
      mergeAttributes({
        'data-np-block': 'youtube',
        'data-np-video-id': parsed?.videoId || safeAttr(HTMLAttributes.videoId),
        'data-np-url': parsed?.url || safeAttr(HTMLAttributes.url),
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NewsPulseYouTubeView);
  },
});
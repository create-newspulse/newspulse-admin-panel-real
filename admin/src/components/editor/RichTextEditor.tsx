import { useEffect, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import type { Editor as TiptapEditor } from '@tiptap/core';
import { TextSelection } from 'prosemirror-state';

import { autoFormatPlainTextToHtml } from '../../lib/richText';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
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

function ToolbarButton({
  label,
  onClick,
  active,
  disabled,
  title,
}: {
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
      className={`px-2 py-1 text-xs rounded border disabled:opacity-50 ${
        active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder = 'Write article content…' }: RichTextEditorProps) {
  const extensions = useMemo(
    () => [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false }),
      Image,
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
        class: 'np-richtext min-h-[360px] p-3 text-sm leading-6 focus:outline-none',
        'data-placeholder': placeholder,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = value || '<p></p>';
    const current = editor.getHTML();
    if (current !== next) editor.commands.setContent(next);
  }, [editor, value]);

  if (!editor) return <div className="text-xs text-slate-500">Loading editor…</div>;

  const canUndo = editor.can().chain().undo().run();
  const canRedo = editor.can().chain().redo().run();

  const insertSymbol = (s: string) => editor.chain().focus().insertContent(s).run();

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
    <div className="border rounded">
      <div className="flex flex-wrap gap-1 p-2 border-b bg-slate-50 items-center">
        <ToolbarButton label="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
        <ToolbarButton label="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
        <ToolbarButton label="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} />
        <ToolbarButton label="One-Liner Bold" onClick={() => toggleBoldCurrentParagraph(editor)} title="Bold the current paragraph" />
        <ToolbarButton label="Bullets" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} />
        <ToolbarButton label="Numbered" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} />
        <ToolbarButton label="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} />
        <ToolbarButton label="Highlight" onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} />
        <ToolbarButton label="Link" onClick={onLink} active={editor.isActive('link')} />

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <button type="button" onClick={() => insertSymbol('✅')} className="px-2 py-1 text-xs rounded bg-white border hover:bg-slate-50">
          ✅
        </button>
        <button type="button" onClick={() => insertSymbol('•')} className="px-2 py-1 text-xs rounded bg-white border hover:bg-slate-50">
          •
        </button>
        <button type="button" onClick={() => insertSymbol('➤')} className="px-2 py-1 text-xs rounded bg-white border hover:bg-slate-50">
          ➤
        </button>
        <button type="button" onClick={() => insertSymbol('—')} className="px-2 py-1 text-xs rounded bg-white border hover:bg-slate-50">
          —
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <ToolbarButton label="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!canUndo} />
        <ToolbarButton label="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!canRedo} />

        <span className="mx-1 h-4 w-px bg-slate-200" />

        <ToolbarButton
          label="Auto Format"
          onClick={onAutoFormat}
          title="Auto Format: \n\n => <p>, -/• => <ul><li>, ## => one-liner bold, ==x== => <mark>"
        />
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}

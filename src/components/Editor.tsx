import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlock from '@tiptap/extension-code-block';
import Underline from '@tiptap/extension-underline'; // ✅ Fix for toggleUnderline

import type { Editor as TiptapEditor } from '@tiptap/core';

interface Props {
  content: string;
  onChange: (html: string) => void;
}

const MenuBar = ({ editor }: { editor: TiptapEditor | null }) => {
  if (!editor) return null;

  const buttonClass =
    'px-2 py-1 bg-white dark:bg-gray-700 rounded shadow hover:bg-blue-100 dark:hover:bg-slate-600 transition';

  return (
    <div className="flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-800 p-2 rounded mb-3 text-sm">
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={buttonClass}>Bold</button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={buttonClass}>Italic</button>
      <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={buttonClass}>Underline</button>
      <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={buttonClass}>H2</button>
      <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={buttonClass}>• List</button>
      <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={buttonClass}>❝ Quote</button>
      <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={buttonClass}>Code</button>
    </div>
  );
};

const RichTextEditor = ({ content, onChange }: Props) => {
  const editor = useEditor({
    extensions: [StarterKit, Underline, Image, Link, CodeBlock],
    content,
    editorProps: {
      attributes: {
        class: 'min-h-[200px] outline-none prose dark:prose-invert max-w-full',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <div className="border rounded p-3 bg-white dark:bg-gray-900">
      <MenuBar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
};

export default RichTextEditor;
